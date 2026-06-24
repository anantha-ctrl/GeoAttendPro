<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Leave;
use App\Models\Notification;
use App\Support\Activity;
use App\Support\Guard;

final class LeaveController
{
    /** GET /leaves — own leaves (employee) or all (admin, with ?user_id, ?status). */
    public function index(Request $request): void
    {
        $page    = max(1, (int)($request->query['page'] ?? 1));
        $perPage = min(100, max(5, (int)($request->query['per_page'] ?? 15)));
        $filters = [
            'status' => $request->query['status'] ?? null,
            'from'   => $request->query['from'] ?? null,
            'to'     => $request->query['to'] ?? null,
        ];

        if (Guard::isAdmin()) {
            $userId = $request->query['user_id'] ?? null;
            $userId = $userId !== null ? (int)$userId : null;
        } else {
            $userId = Auth::id(); // employees see only their own
        }
        Response::success(Leave::listFor($userId, $filters, $page, $perPage));
    }

    /** GET /leaves/types */
    public function types(Request $request): void
    {
        Response::success(Database::fetchAll('SELECT * FROM leave_types WHERE status = "active" ORDER BY name'));
    }

    /** GET /leaves/balance — per-type entitlement vs used vs remaining (current year). */
    public function balance(Request $request): void
    {
        $userId = Auth::id();
        if (Guard::isAdmin() && ($request->query['user_id'] ?? null)) {
            $userId = (int)$request->query['user_id'];
        }
        $year = (int)($request->query['year'] ?? date('Y'));

        $rows = Database::fetchAll(
            'SELECT lt.id, lt.name, lt.max_days_year,
                    COALESCE(SUM(CASE WHEN l.status = "approved" THEN l.total_days ELSE 0 END), 0) AS used
             FROM leave_types lt
             LEFT JOIN leaves l ON l.leave_type_id = lt.id AND l.user_id = ?
                   AND YEAR(l.from_date) = ?
             WHERE lt.status = "active"
             GROUP BY lt.id ORDER BY lt.name',
            [$userId, $year]
        );
        $balance = array_map(static function ($r) {
            $max  = $r['max_days_year'] !== null ? (int)$r['max_days_year'] : null;
            $used = (int)$r['used'];
            return [
                'id'            => (int)$r['id'],
                'name'          => $r['name'],
                'max_days_year' => $max,
                'used'          => $used,
                'remaining'     => $max !== null ? max(0, $max - $used) : null,
            ];
        }, $rows);

        Response::success(['year' => $year, 'balance' => $balance]);
    }

    /** POST /leaves — employee applies for leave. */
    public function store(Request $request): void
    {
        $v = new Validator($request->body, [
            'leave_type_id' => 'nullable|integer',
            'from_date'     => 'required|date',
            'to_date'       => 'required|date',
            'reason'        => 'required|max:500',
        ]);
        if ($v->fails()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        $from = (string)$request->input('from_date');
        $to   = (string)$request->input('to_date');
        if (strtotime($to) < strtotime($from)) {
            Response::error('End date cannot be before start date.', 422, ['to_date' => ['Invalid range.']]);
        }

        $userId = Auth::id();
        if (Leave::hasOverlap($userId, $from, $to)) {
            Response::error('You already have a leave request overlapping these dates.', 409);
        }

        $days = (int)((strtotime($to) - strtotime($from)) / 86400) + 1;

        $id = Leave::create([
            'user_id'       => $userId,
            'leave_type_id' => $request->input('leave_type_id') ?: null,
            'from_date'     => $from,
            'to_date'       => $to,
            'total_days'    => $days,
            'reason'        => $request->input('reason'),
            'status'        => 'pending',
        ]);

        Activity::log($userId, 'leave.apply', 'leaves', (string)$id,
            "Applied {$from} to {$to}", $request->ip());

        // Notify all admins/HR
        foreach (Database::fetchAll('SELECT id FROM users WHERE role_id IN (1,2) AND status = "active"') as $admin) {
            Notification::push((int)$admin['id'], 'leave_request', 'New leave request',
                Auth::user()['full_name'] . " requested leave {$from} to {$to}.");
        }

        Response::success(Leave::find($id), 'Leave request submitted.', 201);
    }

    /** PATCH /leaves/{id}/approve */
    public function approve(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $this->decide($request, 'approved');
    }

    /** PATCH /leaves/{id}/reject */
    public function reject(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $this->decide($request, 'rejected');
    }

    private function decide(Request $request, string $decision): void
    {
        $id = (int)$request->params['id'];
        $leave = Leave::find($id);
        if (!$leave) {
            Response::error('Leave request not found.', 404);
        }
        if ($leave['status'] !== 'pending') {
            Response::error('This request has already been ' . $leave['status'] . '.', 409);
        }

        Leave::update($id, [
            'status'        => $decision,
            'approved_by'   => Auth::id(),
            'approved_at'   => date('Y-m-d H:i:s'),
            'admin_remarks' => $request->input('admin_remarks'),
        ]);

        // On approval, stamp attendance rows as "leave" for each day in the range.
        if ($decision === 'approved') {
            $cursor = strtotime($leave['from_date']);
            $end    = strtotime($leave['to_date']);
            while ($cursor <= $end) {
                $d = date('Y-m-d', $cursor);
                Database::run(
                    'INSERT INTO attendance (user_id, attendance_date, status, remarks)
                     VALUES (?,?,"leave","Approved leave")
                     ON DUPLICATE KEY UPDATE status = "leave", remarks = "Approved leave"',
                    [$leave['user_id'], $d]
                );
                $cursor += 86400;
            }
        }

        Activity::log(Auth::id(), 'leave.' . $decision, 'leaves', (string)$id, null, $request->ip());
        Notification::push((int)$leave['user_id'], 'leave_status',
            'Leave ' . $decision,
            "Your leave request ({$leave['from_date']} to {$leave['to_date']}) was {$decision}.", true);

        Response::success(Leave::find($id), 'Leave ' . $decision . '.');
    }

    /** PATCH /leaves/{id}/cancel — employee cancels own pending request. */
    public function cancel(Request $request): void
    {
        $id = (int)$request->params['id'];
        $leave = Leave::find($id);
        if (!$leave) {
            Response::error('Leave request not found.', 404);
        }
        if ((int)$leave['user_id'] !== Auth::id() && !Guard::isAdmin()) {
            Response::error('Forbidden.', 403);
        }
        if ($leave['status'] !== 'pending') {
            Response::error('Only pending requests can be cancelled.', 409);
        }
        Leave::update($id, ['status' => 'cancelled']);
        Activity::log(Auth::id(), 'leave.cancel', 'leaves', (string)$id, null, $request->ip());
        Response::success(null, 'Leave request cancelled.');
    }
}
