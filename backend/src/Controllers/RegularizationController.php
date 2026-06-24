<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Attendance;
use App\Models\Regularization;
use App\Models\Notification;
use App\Services\AttendanceService;
use App\Support\Activity;
use App\Support\Guard;

final class RegularizationController
{
    /** GET /regularizations — own (employee) or all (admin, with ?user_id & ?status). */
    public function index(Request $request): void
    {
        $page    = max(1, (int)($request->query['page'] ?? 1));
        $perPage = min(100, max(5, (int)($request->query['per_page'] ?? 15)));
        $status  = $request->query['status'] ?? null;

        if (Guard::isAdmin()) {
            $userId = isset($request->query['user_id']) ? (int)$request->query['user_id'] : null;
        } else {
            $userId = Auth::id();
        }
        Response::success(Regularization::listFor($userId, $status, $page, $perPage));
    }

    /** POST /regularizations — employee requests an attendance correction. */
    public function store(Request $request): void
    {
        $v = new Validator($request->body, [
            'attendance_date'     => 'required|date',
            'requested_check_in'  => 'nullable',
            'requested_check_out' => 'nullable',
            'reason'              => 'required|max:500',
        ]);
        if ($v->fails()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        $date = (string)$request->input('attendance_date');
        if (strtotime($date) > strtotime(date('Y-m-d'))) {
            Response::error('You cannot regularize a future date.', 422, ['attendance_date' => ['Future date.']]);
        }

        $in  = $request->input('requested_check_in');
        $out = $request->input('requested_check_out');
        if (!$in && !$out) {
            Response::error('Provide at least a check-in or check-out time.', 422);
        }

        $userId = Auth::id();
        if (Regularization::pendingForDate($userId, $date)) {
            Response::error('You already have a pending request for this date.', 409);
        }

        // Normalise "HH:MM" (or full datetime) into a DATETIME on the requested date.
        $toDateTime = function ($val) use ($date): ?string {
            if (!$val) return null;
            $val = (string)$val;
            if (strlen($val) <= 5) return $date . ' ' . $val . ':00';      // HH:MM
            if (strlen($val) === 16) return str_replace('T', ' ', $val) . ':00'; // datetime-local
            return str_replace('T', ' ', $val);
        };

        $id = Regularization::create([
            'user_id'             => $userId,
            'attendance_date'     => $date,
            'requested_check_in'  => $toDateTime($in),
            'requested_check_out' => $toDateTime($out),
            'reason'              => $request->input('reason'),
            'status'              => 'pending',
        ]);

        Activity::log($userId, 'regularization.apply', 'regularizations', (string)$id,
            "Requested correction for {$date}", $request->ip());

        foreach (Database::fetchAll('SELECT id FROM users WHERE role_id IN (1,2) AND status = "active"') as $admin) {
            Notification::push((int)$admin['id'], 'regularization_request', 'Attendance regularization',
                Auth::user()['full_name'] . " requested a correction for {$date}.");
        }

        Response::success(Regularization::find($id), 'Regularization request submitted.', 201);
    }

    /** PATCH /regularizations/{id}/approve */
    public function approve(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $this->decide($request, 'approved');
    }

    /** PATCH /regularizations/{id}/reject */
    public function reject(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $this->decide($request, 'rejected');
    }

    private function decide(Request $request, string $decision): void
    {
        $id  = (int)$request->params['id'];
        $req = Regularization::find($id);
        if (!$req) {
            Response::error('Request not found.', 404);
        }
        if ($req['status'] !== 'pending') {
            Response::error('This request has already been ' . $req['status'] . '.', 409);
        }

        Regularization::update($id, [
            'status'        => $decision,
            'reviewed_by'   => Auth::id(),
            'reviewed_at'   => date('Y-m-d H:i:s'),
            'admin_remarks' => $request->input('admin_remarks'),
        ]);

        // On approval, apply the corrected times to the attendance summary row.
        if ($decision === 'approved') {
            $this->applyCorrection($req);
        }

        Activity::log(Auth::id(), 'regularization.' . $decision, 'regularizations', (string)$id, null, $request->ip());
        Notification::push((int)$req['user_id'], 'regularization_status',
            'Regularization ' . $decision,
            "Your attendance correction for {$req['attendance_date']} was {$decision}.", true);

        Response::success(Regularization::find($id), 'Request ' . $decision . '.');
    }

    /** Write approved correction into the attendance summary, recomputing status. */
    private function applyCorrection(array $req): void
    {
        $userId = (int)$req['user_id'];
        $date   = (string)$req['attendance_date'];
        $in     = $req['requested_check_in'];
        $out    = $req['requested_check_out'];

        $existing = Attendance::forUserOnDate($userId, $date);
        $checkIn  = $in  ?: ($existing['check_in_time']  ?? null);
        $checkOut = $out ?: ($existing['check_out_time'] ?? null);

        $minutes = ($checkIn && $checkOut)
            ? AttendanceService::workingMinutes($checkIn, $checkOut) : ($existing['working_minutes'] ?? null);
        $isLate  = $checkIn ? AttendanceService::isLateForShift($checkIn, \App\Models\Shift::forUser($userId)) : false;
        $status  = $checkIn
            ? AttendanceService::deriveStatus($isLate, (int)($minutes ?? 0))
            : ($existing['status'] ?? 'present');

        if ($existing) {
            Attendance::update((int)$existing['id'], [
                'check_in_time'  => $checkIn,
                'check_out_time' => $checkOut,
                'working_minutes'=> $minutes,
                'is_late'        => $isLate ? 1 : 0,
                'status'         => $status,
                'remarks'        => 'Regularized',
            ]);
        } else {
            Attendance::create([
                'user_id'         => $userId,
                'attendance_date' => $date,
                'check_in_time'   => $checkIn,
                'check_out_time'  => $checkOut,
                'working_minutes' => $minutes,
                'is_late'         => $isLate ? 1 : 0,
                'status'          => $status,
                'remarks'         => 'Regularized',
            ]);
        }
    }
}
