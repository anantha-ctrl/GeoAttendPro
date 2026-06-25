<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Attendance;
use App\Models\AttendanceEvent;
use App\Models\AttendanceSession;
use App\Services\AttendanceService;
use App\Support\Activity;
use App\Support\Geo;
use App\Support\Guard;
use App\Models\Notification as NotificationHelper;
use App\Support\Uploader;

final class AttendanceController
{
    /** Hides shorter than this are app/tab switches, not real rest. */
    private const MIN_REST_SECONDS = 60;

    /** True if the user has an approved Work-From-Home leave covering the date. */
    private static function isWfhToday(int $userId, string $date): bool
    {
        return (int)\App\Core\Database::scalar(
            'SELECT COUNT(*) FROM leaves l JOIN leave_types lt ON lt.id = l.leave_type_id
             WHERE l.user_id = ? AND l.status = "approved"
               AND lt.name = "Work From Home" AND ? BETWEEN l.from_date AND l.to_date',
            [$userId, $date]
        ) > 0;
    }

    /**
     * Enforce the office geofence unless the employee is WFH today, and return
     * the name of the branch the location matched (any of multiple branches).
     * On office days the location must be inside an active geofence (e.g. 100m);
     * halts with a 422 if outside. Returns 'Work From Home' on WFH days,
     * the matched branch name on office days, or null if geofencing is off.
     */
    private static function enforceLocation(int $userId, string $today, float $lat, float $lng): ?string
    {
        if (self::isWfhToday($userId, $today)) return 'Work From Home'; // any location allowed

        [$allowed, $fence, $distance] = Geo::withinFence($lat, $lng);
        if (!$allowed) {
            $name = $fence['name'] ?? 'office';
            Response::error(
                "You are outside the {$name} location" .
                ($distance ? ' (' . round($distance) . 'm away)' : '') .
                '. Check-in/out is only allowed within an office branch, or on an approved Work-From-Home day.',
                422
            );
        }
        return $fence['name'] ?? null; // matched branch (null if geofencing disabled)
    }

    /** GET /attendance/today — current user's attendance summary + sessions for today. */
    public function today(Request $request): void
    {
        $userId = Auth::id();
        $today  = date('Y-m-d');
        $record = Attendance::forUserOnDate($userId, $today);
        $open   = AttendanceSession::openSession($userId, $today);
        $sessions = AttendanceSession::forDate($userId, $today);

        Response::success([
            'date'         => $today,
            'attendance'   => $record,
            'sessions'     => $sessions,
            'open_session' => $open,
            // Multiple sessions/day: can check in whenever no session is open;
            // can check out only while a session is open.
            'can_checkin'  => $open === null,
            'can_checkout' => $open !== null,
            // Location rule for the UI: office geofence enforced unless WFH today.
            'is_wfh_today'      => self::isWfhToday($userId, $today),
            'geofence_enforced' => (int)\App\Support\Settings::get('geofence_enabled', '0') === 1,
            'geofences'         => \App\Core\Database::fetchAll(
                'SELECT name, latitude, longitude, radius_m FROM geofences WHERE status = "active"'),
        ]);
    }

    /** POST /attendance/check-in — opens a new session (multiple per day allowed). */
    public function checkIn(Request $request): void
    {
        $userId = Auth::id();
        $today  = date('Y-m-d');

        // Prevent duplicate: must check out the current session before starting a new one.
        if (AttendanceSession::openSession($userId, $today)) {
            Response::error('You are already checked in. Please check out before checking in again.', 409);
        }

        $v = new Validator($request->body, [
            'latitude'  => 'required|latitude',
            'longitude' => 'required|longitude',
            'selfie'    => 'required',
        ]);
        if ($v->fails()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        $lat = (float)$request->input('latitude');
        $lng = (float)$request->input('longitude');

        // Office geofence (e.g. 100m) is enforced unless the employee is WFH today.
        // Returns the matched branch (any of multiple branches) for the record.
        $isWfh  = self::isWfhToday($userId, $today);
        $branch = self::enforceLocation($userId, $today, $lat, $lng);

        $now        = date('Y-m-d H:i:s');
        $selfiePath = Uploader::fromBase64((string)$request->input('selfie'), 'selfies', 'in_' . $userId);
        $faceOk     = $request->input('face_verified') ? 1 : 0;

        $daily = Attendance::forUserOnDate($userId, $today);
        // Late only judged on the FIRST check-in of the day, against the
        // employee's assigned shift (falls back to global work_start_time).
        $shift  = \App\Models\Shift::forUser($userId);
        $isLate = $daily ? (bool)$daily['is_late'] : AttendanceService::isLateForShift($now, $shift);

        // 1) Create the session row.
        $sessionId = AttendanceSession::create([
            'user_id'         => $userId,
            'attendance_date' => $today,
            'check_in_time'   => $now,
            'check_in_lat'    => $lat,
            'check_in_lng'    => $lng,
            'check_in_selfie' => $selfiePath,
            'ip_address'      => $request->ip(),
            'device_info'     => $request->userAgent(),
            'face_verified'   => $faceOk,
            'branch'          => $branch,
        ]);

        // 2) Create or re-open the per-day summary row.
        if (!$daily) {
            Attendance::create([
                'user_id'         => $userId,
                'attendance_date' => $today,
                'check_in_time'   => $now,
                'check_in_lat'    => $lat,
                'check_in_lng'    => $lng,
                'check_in_selfie' => $selfiePath,
                'ip_address'      => $request->ip(),
                'device_info'     => $request->userAgent(),
                'is_late'         => $isWfh ? 0 : ($isLate ? 1 : 0),
                'face_verified'   => $faceOk,
                'status'          => $isWfh ? 'wfh' : ($isLate ? 'late' : 'present'),
                'branch'          => $branch,
            ]);
        } else {
            // Re-opening for a new session today: clear the day's checkout marker.
            Attendance::update((int)$daily['id'], ['check_out_time' => null]);
        }

        // Start the work-tracking state machine for this session.
        AttendanceSession::update((int)$sessionId, ['work_status' => 'working']);
        AttendanceEvent::record($userId, (int)$sessionId, 'login', 'Work session started');

        Activity::log($userId, 'attendance.check_in', 'attendance_sessions', (string)$sessionId,
            "Checked in at {$now}" . ($isLate ? ' (late)' : ''), $request->ip());

        if ($isLate && !$daily) {
            NotificationHelper::push($userId, 'late_alert', 'Late check-in',
                'You checked in late at ' . date('h:i A', strtotime($now)) . '.');
        }

        $where = $branch ? " at {$branch}" : '';
        Response::success([
            'session_id'    => $sessionId,
            'check_in_time' => $now,
            'is_late'       => $isLate,
            'branch'        => $branch,
            'selfie'        => $selfiePath,
        ], ($isLate && !$daily ? "Checked in{$where} (marked late)." : "Checked in{$where} successfully."), 201);
    }

    /** POST /attendance/check-out — closes the open session, re-aggregates the day. */
    public function checkOut(Request $request): void
    {
        $userId = Auth::id();
        $today  = date('Y-m-d');
        $open   = AttendanceSession::openSession($userId, $today);

        if (!$open) {
            Response::error('You are not checked in. Please check in first.', 409);
        }

        $v = new Validator($request->body, [
            'latitude'  => 'required|latitude',
            'longitude' => 'required|longitude',
            'selfie'    => 'nullable',
        ]);
        if ($v->fails()) {
            Response::error('Validation failed.', 422, $v->errors());
        }

        // A work summary is required before checking out.
        $workNote = trim((string)$request->input('work_note', ''));
        if ($workNote === '') {
            Response::error('Please describe the work you did this session before checking out.', 422,
                ['work_note' => 'Work summary is required.']);
        }
        if (mb_strlen($workNote) > 2000) {
            $workNote = mb_substr($workNote, 0, 2000);
        }

        // Same office-geofence rule on check-out (skipped for WFH days).
        self::enforceLocation($userId, $today, (float)$request->input('latitude'), (float)$request->input('longitude'));

        $now            = date('Y-m-d H:i:s');
        $sessionMinutes = AttendanceService::workingMinutes($open['check_in_time'], $now);

        $selfiePath = null;
        if ($request->input('selfie')) {
            $selfiePath = Uploader::fromBase64((string)$request->input('selfie'), 'selfies', 'out_' . $userId);
        }

        // 1) Close this session (with the employee's work summary).
        AttendanceSession::update((int)$open['id'], [
            'check_out_time'   => $now,
            'check_out_lat'    => (float)$request->input('latitude'),
            'check_out_lng'    => (float)$request->input('longitude'),
            'check_out_selfie' => $selfiePath,
            'working_minutes'  => $sessionMinutes,
            'work_note'        => $workNote,
        ]);

        // 2) Re-aggregate the per-day summary (sum of all sessions today).
        $daily        = Attendance::forUserOnDate($userId, $today);
        $totalMinutes = AttendanceSession::totalMinutes($userId, $today);
        // Keep WFH days marked as WFH; otherwise derive present/late/half-day.
        $status = ($daily['status'] ?? '') === 'wfh'
            ? 'wfh'
            : AttendanceService::deriveStatus((bool)($daily['is_late'] ?? false), $totalMinutes);

        Attendance::update((int)$daily['id'], [
            'check_out_time'   => $now,
            'check_out_lat'    => (float)$request->input('latitude'),
            'check_out_lng'    => (float)$request->input('longitude'),
            'check_out_selfie' => $selfiePath,
            'working_minutes'  => $totalMinutes,
            'status'           => $status,
        ]);

        Activity::log($userId, 'attendance.check_out', 'attendance_sessions', (string)$open['id'],
            "Checked out at {$now} (session {$sessionMinutes} min, day total {$totalMinutes} min)", $request->ip());

        $sessionCount = count(AttendanceSession::forDate($userId, $today));

        Response::success([
            'check_out_time'    => $now,
            'session_minutes'   => $sessionMinutes,
            'total_minutes'     => $totalMinutes,
            'total_hours'       => round($totalMinutes / 60, 2),
            'sessions_today'    => $sessionCount,
            'status'            => $status,
            'can_checkin_again' => true,
        ], 'Checked out. You can check in again for a new session.');
    }

    /**
     * Build the live work snapshot for one user today (status + timeline + totals).
     * Used by the employee heartbeat and the admin live board.
     */
    public static function snapshot(int $userId, string $today): array
    {
        $open  = AttendanceSession::openSession($userId, $today);
        $status = $open ? AttendanceSession::liveStatus($open) : 'logged_out';

        // Gross (login) minutes = closed sessions + the live open session.
        $sessionMinutes = $open ? AttendanceService::workingMinutes($open['check_in_time'], date('Y-m-d H:i:s')) : 0;
        $completed      = AttendanceSession::totalMinutes($userId, $today);

        // Rest = stored rest of every session + any in-progress rest on the open one.
        $restSeconds = (int)\App\Core\Database::scalar(
            'SELECT COALESCE(SUM(rest_seconds),0) FROM attendance_sessions WHERE user_id = ? AND attendance_date = ?',
            [$userId, $today]
        );
        if ($open) $restSeconds = max($restSeconds, AttendanceSession::effectiveRestSeconds($open)
            + (int)\App\Core\Database::scalar(
                'SELECT COALESCE(SUM(rest_seconds),0) FROM attendance_sessions WHERE user_id = ? AND attendance_date = ? AND id <> ?',
                [$userId, $today, $open['id']]));

        // Overtime = wall time since the employee chose "Continue Working".
        $overtimeSeconds = (int)\App\Core\Database::scalar(
            'SELECT COALESCE(SUM(overtime_seconds),0) FROM attendance_sessions WHERE user_id = ? AND attendance_date = ?',
            [$userId, $today]
        );
        if ($open && !empty($open['overtime_started_at'])) {
            $overtimeSeconds = max($overtimeSeconds, max(0, time() - strtotime((string)$open['overtime_started_at'])));
        }

        $grossMinutes  = $completed + $sessionMinutes;
        $restMinutes   = (int)round($restSeconds / 60);
        $activeMinutes = max(0, $grossMinutes - $restMinutes);

        // First login of the day (first session check-in).
        $firstIn = \App\Core\Database::scalar(
            'SELECT MIN(check_in_time) FROM attendance_sessions WHERE user_id = ? AND attendance_date = ?',
            [$userId, $today]
        );

        return [
            'has_open_session'  => $open !== null,
            'status'            => $status,
            'work_end_time'     => \App\Support\Settings::get('work_end_time', '18:30'),
            'login_time'        => $firstIn,
            'check_in_time'     => $open['check_in_time'] ?? null,
            'rest_started_at'   => $open['rest_started_at'] ?? null,
            'overtime_started_at' => $open['overtime_started_at'] ?? null,
            'gross_minutes'     => $grossMinutes,
            'rest_minutes'      => $restMinutes,
            'rest_seconds'      => $restSeconds,
            'active_minutes'    => $activeMinutes,
            'overtime_minutes'  => (int)round($overtimeSeconds / 60),
            'overtime_seconds'  => $overtimeSeconds,
        ];
    }

    /** POST /attendance/activity — lightweight heartbeat; returns the live snapshot. */
    public function activity(Request $request): void
    {
        Response::success(self::snapshot(Auth::id(), date('Y-m-d')));
    }

    /** GET /attendance/live — the caller's own live work snapshot + timeline. */
    public function live(Request $request): void
    {
        $userId = Auth::id();
        $today  = date('Y-m-d');
        $snap = self::snapshot($userId, $today);
        $snap['timeline'] = AttendanceEvent::timeline($userId, $today);
        Response::success($snap);
    }

    /** POST /attendance/rest-start — device screen off / locked / sleeping. */
    public function restStart(Request $request): void
    {
        $userId = Auth::id();
        $today  = date('Y-m-d');
        $open   = AttendanceSession::openSession($userId, $today);
        if (!$open) { Response::success(self::snapshot($userId, $today)); }

        // Idempotent: only open a rest window if one isn't already open.
        if (empty($open['rest_started_at'])) {
            $now = date('Y-m-d H:i:s');
            AttendanceSession::update((int)$open['id'], [
                'rest_started_at' => $now,
                'work_status'     => 'rest',
            ]);
            AttendanceEvent::record($userId, (int)$open['id'], 'rest_start', 'Screen off / locked / sleep');
        }
        Response::success(self::snapshot($userId, $today));
    }

    /** POST /attendance/rest-end — screen back on; finalise the rest window. */
    public function restEnd(Request $request): void
    {
        $userId = Auth::id();
        $today  = date('Y-m-d');
        $open   = AttendanceSession::openSession($userId, $today);
        if (!$open) { Response::success(self::snapshot($userId, $today)); }

        $restWasOpen = !empty($open['rest_started_at']);
        if ($restWasOpen) {
            $delta = max(0, time() - strtotime((string)$open['rest_started_at']));
        } else {
            // Fallback (device slept before rest-start landed): trust client seconds.
            $delta = max(0, (int)$request->input('seconds', 0));
        }
        if ($delta > 86400) $delta = 86400; // clamp clock jumps

        // Returning to overtime if the user had chosen "Continue Working".
        $resume = !empty($open['overtime_started_at']) ? 'overtime' : 'working';

        // Ignore sub-threshold hides that slipped through (brief app switches).
        if (!$restWasOpen && $delta < self::MIN_REST_SECONDS) {
            AttendanceSession::update((int)$open['id'], ['work_status' => $resume]);
            Response::success(self::snapshot($userId, $today));
        }

        AttendanceSession::update((int)$open['id'], [
            'rest_seconds'    => (int)$open['rest_seconds'] + $delta,
            'rest_started_at' => null,
            'work_status'     => $resume,
        ]);
        // For the sleep case (no live rest window) add the matching rest_start so
        // the timeline shows a clean pair rather than a lone rest_end.
        if (!$restWasOpen) {
            AttendanceEvent::record($userId, (int)$open['id'], 'rest_start',
                'Screen off / sleep', date('Y-m-d H:i:s', time() - $delta));
        }
        AttendanceEvent::record($userId, (int)$open['id'], 'rest_end', 'Rest ' . round($delta / 60) . 'm');
        self::syncDailyRest($userId, $today);

        Response::success(self::snapshot($userId, $today));
    }

    /** POST /attendance/overtime-start — employee chose "Continue Working" past work end. */
    public function overtimeStart(Request $request): void
    {
        $userId = Auth::id();
        $today  = date('Y-m-d');
        $open   = AttendanceSession::openSession($userId, $today);
        if (!$open) { Response::success(self::snapshot($userId, $today)); }

        if (empty($open['overtime_started_at'])) {
            $now = date('Y-m-d H:i:s');
            AttendanceSession::update((int)$open['id'], [
                'overtime_started_at' => $now,
                'work_status'         => 'overtime',
            ]);
            AttendanceEvent::record($userId, (int)$open['id'], 'overtime_start', 'Continued working past standard hours');
        }
        Response::success(self::snapshot($userId, $today));
    }

    /**
     * POST /attendance/logout — finalise the open session (popup "Logout" / end of day).
     * Records logout time, total working/rest/overtime, no selfie required.
     */
    public function logout(Request $request): void
    {
        $userId = Auth::id();
        $today  = date('Y-m-d');
        $open   = AttendanceSession::openSession($userId, $today);
        if (!$open) {
            Response::success(self::snapshot($userId, $today), 'Already logged out.');
        }

        $now = date('Y-m-d H:i:s');

        // Close any in-progress rest first.
        $restSeconds = (int)$open['rest_seconds'];
        if (!empty($open['rest_started_at'])) {
            $restSeconds += max(0, time() - strtotime((string)$open['rest_started_at']));
            AttendanceEvent::record($userId, (int)$open['id'], 'rest_end', 'Auto-closed at logout');
        }

        // Overtime = wall time since the employee continued past standard hours.
        $overtimeSeconds = (int)$open['overtime_seconds'];
        if (!empty($open['overtime_started_at'])) {
            $overtimeSeconds = max(0, strtotime($now) - strtotime((string)$open['overtime_started_at']));
        }

        $sessionMinutes = AttendanceService::workingMinutes($open['check_in_time'], $now);

        AttendanceSession::update((int)$open['id'], [
            'check_out_time'   => $now,
            'working_minutes'  => $sessionMinutes,
            'rest_seconds'     => $restSeconds,
            'rest_started_at'  => null,
            'overtime_seconds' => $overtimeSeconds,
            'work_status'      => 'logged_out',
        ]);

        // Re-aggregate the per-day summary.
        $daily        = Attendance::forUserOnDate($userId, $today);
        $totalMinutes = AttendanceSession::totalMinutes($userId, $today);
        if ($daily) {
            Attendance::update((int)$daily['id'], [
                'check_out_time'  => $now,
                'working_minutes' => $totalMinutes,
                'rest_seconds'    => AttendanceSession::totalRestSeconds($userId, $today),
                'status'          => AttendanceService::deriveStatus((bool)$daily['is_late'], $totalMinutes),
            ]);
        }

        AttendanceEvent::record($userId, (int)$open['id'], 'logout',
            "Logged out (work {$sessionMinutes}m, overtime " . round($overtimeSeconds / 60) . "m)");
        Activity::log($userId, 'attendance.logout', 'attendance_sessions', (string)$open['id'],
            "Logged out at {$now}", $request->ip());

        Response::success(self::snapshot($userId, $today), 'Logged out. Attendance finalised.');
    }

    /** Keep the daily summary's rest_seconds in sync with its sessions. */
    private static function syncDailyRest(int $userId, string $today): void
    {
        $daily = Attendance::forUserOnDate($userId, $today);
        if ($daily) {
            Attendance::update((int)$daily['id'], [
                'rest_seconds' => AttendanceSession::totalRestSeconds($userId, $today),
            ]);
        }
    }

    /** GET /attendance/calendar?month=YYYY-MM&user_id= — month grid data. */
    public function calendar(Request $request): void
    {
        $userId = Auth::id();
        if ($request->query['user_id'] ?? null) {
            Guard::allow(['super_admin', 'admin']);
            $userId = (int)$request->query['user_id'];
        }
        $month = (string)($request->query['month'] ?? date('Y-m'));
        if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
            $month = date('Y-m');
        }
        $start = $month . '-01';
        $end   = date('Y-m-t', strtotime($start));

        $rows = \App\Core\Database::fetchAll(
            'SELECT attendance_date, status, check_in_time, check_out_time, working_minutes, is_late, face_verified
             FROM attendance WHERE user_id = ? AND attendance_date BETWEEN ? AND ?',
            [$userId, $start, $end]
        );
        $days = [];
        $counts = ['present' => 0, 'late' => 0, 'absent' => 0, 'leave' => 0, 'half_day' => 0, 'wfh' => 0];
        foreach ($rows as $r) {
            $days[$r['attendance_date']] = $r;
            if (isset($counts[$r['status']])) {
                $counts[$r['status']]++;
            }
        }

        // Holidays that fall in this month (explicit date or recurring month/day).
        $holidays = \App\Core\Database::fetchAll(
            'SELECT name, holiday_date,
                    CASE WHEN recurring = 1
                         THEN DATE_FORMAT(?, CONCAT("%Y-", DATE_FORMAT(holiday_date, "%m-%d")))
                         ELSE holiday_date END AS resolved_date
             FROM holidays
             WHERE (holiday_date BETWEEN ? AND ?)
                OR (recurring = 1 AND DATE_FORMAT(holiday_date, "%m") = ?)',
            [$start, $start, $end, substr($month, 5, 2)]
        );
        $holidayMap = [];
        foreach ($holidays as $h) {
            $holidayMap[$h['resolved_date']] = $h['name'];
        }

        Response::success([
            'month'    => $month,
            'days'     => $days,
            'holidays' => $holidayMap,
            'counts'   => $counts,
        ]);
    }

    /** GET /attendance/history — own history (employees) or any user (admin via ?user_id). */
    public function history(Request $request): void
    {
        $userId = Auth::id();
        if ($request->query['user_id'] ?? null) {
            Guard::allow(['super_admin', 'admin']);
            $userId = (int)$request->query['user_id'];
        }
        $page    = max(1, (int)($request->query['page'] ?? 1));
        $perPage = min(100, max(5, (int)($request->query['per_page'] ?? 15)));
        $result  = Attendance::history(
            $userId,
            $request->query['from'] ?? null,
            $request->query['to'] ?? null,
            $page,
            $perPage
        );
        Response::success($result);
    }
}
