<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Models\Attendance;
use App\Services\PayrollService;
use App\Support\Guard;

final class DashboardController
{
    /**
     * GET /dashboard/live-board — real-time work status of every active employee.
     * Returns one row per employee: Working / Rest Mode / Overtime / Logged Out
     * plus live login, working, rest and overtime durations. Polled by the admin.
     */
    public function liveBoard(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $today = date('Y-m-d');

        $employees = Database::fetchAll(
            'SELECT u.id, u.full_name, u.employee_code, u.profile_photo, d.name AS department_name
             FROM users u LEFT JOIN departments d ON d.id = u.department_id
             WHERE u.role_id = 3 AND u.status = "active"
             ORDER BY u.full_name'
        );

        $rows = [];
        $tally = ['working' => 0, 'rest' => 0, 'overtime' => 0, 'logged_out' => 0];
        foreach ($employees as $e) {
            $snap = \App\Controllers\AttendanceController::snapshot((int)$e['id'], $today);
            // Never logged in today => logged_out (no session at all).
            $status = $snap['login_time'] ? $snap['status'] : 'logged_out';
            $tally[$status] = ($tally[$status] ?? 0) + 1;
            $rows[] = [
                'user_id'          => (int)$e['id'],
                'full_name'        => $e['full_name'],
                'employee_code'    => $e['employee_code'],
                'profile_photo'    => $e['profile_photo'],
                'department_name'  => $e['department_name'],
                'status'           => $status,
                'login_time'       => $snap['login_time'],
                'gross_minutes'    => $snap['gross_minutes'],
                'active_minutes'   => $snap['active_minutes'],
                'rest_minutes'     => $snap['rest_minutes'],
                'overtime_minutes' => $snap['overtime_minutes'],
            ];
        }

        Response::success(['date' => $today, 'tally' => $tally, 'employees' => $rows]);
    }

    /** GET /dashboard/admin — widgets + chart datasets + recent activity. */
    public function admin(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $date = $request->query['date'] ?? date('Y-m-d');
        $year = (int)($request->query['year'] ?? date('Y'));

        $counters = Attendance::dashboardCounters($date);

        // ---- extra widget metrics ----
        $counters['total_departments'] = (int)Database::scalar('SELECT COUNT(*) FROM departments WHERE status = "active"');
        $counters['wfh_today']         = (int)Database::scalar('SELECT COUNT(*) FROM attendance WHERE attendance_date = ? AND status = "wfh"', [$date]);
        $counters['half_day_today']    = (int)Database::scalar('SELECT COUNT(*) FROM attendance WHERE attendance_date = ? AND status = "half_day"', [$date]);
        $counters['month_check_ins']   = (int)Database::scalar(
            'SELECT COUNT(*) FROM attendance WHERE YEAR(attendance_date)=? AND MONTH(attendance_date)=? AND check_in_time IS NOT NULL',
            [$year, (int)date('m')]
        );
        $avgMin = Database::scalar('SELECT AVG(working_minutes) FROM attendance WHERE attendance_date = ? AND working_minutes IS NOT NULL', [$date]);
        $counters['avg_work_hours_today'] = $avgMin ? round(((float)$avgMin) / 60, 1) : 0;

        // ---- today's status breakdown (for pie) ----
        $statusRows = Database::fetchAll(
            'SELECT status, COUNT(*) AS cnt FROM attendance WHERE attendance_date = ? GROUP BY status',
            [$date]
        );
        $status = ['present' => 0, 'late' => 0, 'half_day' => 0, 'leave' => 0, 'wfh' => 0, 'absent' => 0];
        foreach ($statusRows as $r) {
            $status[$r['status']] = (int)$r['cnt'];
        }
        // employees with no record today are implicit absentees — but not on a week-off (Sunday/holiday).
        if (PayrollService::isWeekOff($date)) {
            $status['absent'] = 0;
        } else {
            $marked = array_sum($status);
            $status['absent'] = max($status['absent'], $counters['total_employees'] - ($marked - $status['absent']));
        }

        Response::success([
            'counters'             => $counters,
            'status_breakdown'     => $status,
            'daily_trend'          => Attendance::dailyTrend(7),
            'monthly_trend'        => Attendance::monthlyTrend($year),
            'department_breakdown' => Attendance::departmentBreakdown($date),
            'pending_leaves_count' => (int)Database::scalar('SELECT COUNT(*) FROM leaves WHERE status = "pending"'),

            // ---- recent activity / lists ----
            'recent_check_ins' => Database::fetchAll(
                'SELECT u.full_name, u.employee_code, a.check_in_time, a.status, a.is_late, a.check_in_selfie
                 FROM attendance a JOIN users u ON u.id = a.user_id
                 WHERE a.check_in_time IS NOT NULL
                 ORDER BY a.check_in_time DESC LIMIT 8'
            ),
            'pending_leaves' => Database::fetchAll(
                'SELECT l.id, u.full_name, u.employee_code, l.from_date, l.to_date, l.total_days,
                        l.reason, lt.name AS leave_type_name
                 FROM leaves l JOIN users u ON u.id = l.user_id
                 LEFT JOIN leave_types lt ON lt.id = l.leave_type_id
                 WHERE l.status = "pending" ORDER BY l.created_at DESC LIMIT 6'
            ),
            'late_today' => Database::fetchAll(
                'SELECT u.full_name, u.employee_code, a.check_in_time
                 FROM attendance a JOIN users u ON u.id = a.user_id
                 WHERE a.attendance_date = ? AND a.is_late = 1
                 ORDER BY a.check_in_time DESC LIMIT 8',
                [$date]
            ),
        ]);
    }

    /** GET /dashboard/employee — own summary for the employee dashboard. */
    public function employee(Request $request): void
    {
        $userId = Auth::id();
        $today  = date('Y-m-d');
        $year   = (int)date('Y');
        $month  = (int)date('m');

        $todayRec = Attendance::forUserOnDate($userId, $today);
        $monthly  = Attendance::monthlyStats($userId, $year, $month);

        // This month's attendance-driven payslip preview.
        $userRow = Database::fetch(
            'SELECT id, employee_code, full_name, monthly_salary FROM users WHERE id = ?', [$userId]) ?: [];
        $payroll = PayrollService::forEmployee($userRow, $year, $month);

        Response::success([
            'today'             => [
                'date'         => $today,
                'attendance'   => $todayRec,
                'can_checkin'  => $todayRec === null,
                'can_checkout' => $todayRec !== null && empty($todayRec['check_out_time']),
            ],
            'monthly'           => $monthly,
            'payroll'           => $payroll,
            'pending_leaves'    => (int)Database::scalar(
                'SELECT COUNT(*) FROM leaves WHERE user_id = ? AND status = "pending"', [$userId]),
            'open_tasks_count'  => (int)Database::scalar(
                "SELECT COUNT(*) FROM tasks WHERE assigned_to = ? AND status <> 'done'", [$userId]),
            'open_tickets_count' => (int)Database::scalar(
                "SELECT COUNT(*) FROM tickets WHERE user_id = ? AND status IN ('open','in_progress')", [$userId]),
            'my_tasks'          => Database::fetchAll(
                "SELECT id, title, priority, status, due_date FROM tasks
                 WHERE assigned_to = ? AND status <> 'done'
                 ORDER BY FIELD(priority,'high','medium','low'), due_date IS NULL, due_date LIMIT 5", [$userId]),
            'latest_announcement' => Database::fetch(
                "SELECT a.id, a.title, a.body, a.pinned, a.created_at, u.full_name AS author
                 FROM announcements a LEFT JOIN users u ON u.id = a.created_by
                 ORDER BY a.pinned DESC, a.created_at DESC LIMIT 1"),
            'upcoming_holidays' => Database::fetchAll(
                "SELECT name,
                        CASE WHEN recurring = 1
                             THEN STR_TO_DATE(CONCAT(YEAR(CURDATE()),'-',MONTH(holiday_date),'-',DAY(holiday_date)),'%Y-%m-%d')
                             ELSE holiday_date END AS holiday_date
                 FROM holidays
                 HAVING holiday_date >= CURDATE()
                 ORDER BY holiday_date ASC LIMIT 4"),
            'recent_attendance' => Database::fetchAll(
                'SELECT attendance_date, check_in_time, check_out_time, working_minutes, status, is_late
                 FROM attendance WHERE user_id = ? ORDER BY attendance_date DESC LIMIT 7', [$userId]),
        ]);
    }
}
