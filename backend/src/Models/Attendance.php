<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;
use App\Services\PayrollService;
use App\Support\Settings;

final class Attendance extends BaseModel
{
    protected static string $table = 'attendance';
    protected static array $fillable = [
        'user_id', 'attendance_date', 'check_in_time', 'check_out_time',
        'check_in_lat', 'check_in_lng', 'check_out_lat', 'check_out_lng',
        'check_in_selfie', 'check_out_selfie', 'ip_address', 'device_info',
        'working_minutes', 'rest_seconds', 'is_late', 'status', 'branch', 'remarks',
    ];

    public static function forUserOnDate(int $userId, string $date): ?array
    {
        return Database::fetch(
            'SELECT * FROM attendance WHERE user_id = ? AND attendance_date = ?',
            [$userId, $date]
        );
    }

    /** Attendance history for one user (paginated). */
    public static function history(int $userId, ?string $from, ?string $to, int $page, int $perPage): array
    {
        $where = ['user_id = ?'];
        $params = [$userId];
        if ($from) { $where[] = 'attendance_date >= ?'; $params[] = $from; }
        if ($to)   { $where[] = 'attendance_date <= ?'; $params[] = $to; }
        $whereSql = implode(' AND ', $where);

        $total = (int)Database::scalar("SELECT COUNT(*) FROM attendance WHERE {$whereSql}", $params);
        $offset = ($page - 1) * $perPage;
        $rows = Database::fetchAll(
            "SELECT * FROM attendance WHERE {$whereSql}
             ORDER BY attendance_date DESC LIMIT {$perPage} OFFSET {$offset}",
            $params
        );
        return [
            'data' => $rows,
            'meta' => ['page' => $page, 'per_page' => $perPage, 'total' => $total,
                       'total_pages' => (int)ceil($total / $perPage)],
        ];
    }

    /** Today's attendance for all employees (admin daily report). */
    public static function dailyReport(string $date): array
    {
        return Database::fetchAll(
            'SELECT u.id AS user_id, u.employee_code, u.full_name,
                    d.name AS department_name,
                    a.check_in_time, a.check_out_time, a.working_minutes,
                    a.is_late, a.status, a.check_in_lat, a.check_in_lng, a.check_in_selfie
             FROM users u
             LEFT JOIN attendance a ON a.user_id = u.id AND a.attendance_date = ?
             LEFT JOIN departments d ON d.id = u.department_id
             WHERE u.role_id = 3 AND u.status = "active"
             ORDER BY u.full_name',
            [$date]
        );
    }

    /** Monthly attendance % for one user. */
    public static function monthlyStats(int $userId, int $year, int $month): array
    {
        $rows = Database::fetchAll(
            'SELECT status, COUNT(*) AS cnt, COALESCE(SUM(working_minutes),0) AS minutes
             FROM attendance
             WHERE user_id = ? AND YEAR(attendance_date) = ? AND MONTH(attendance_date) = ?
             GROUP BY status',
            [$userId, $year, $month]
        );
        $counts = ['present' => 0, 'late' => 0, 'half_day' => 0, 'absent' => 0, 'leave' => 0, 'wfh' => 0];
        $minutes = 0;
        foreach ($rows as $r) {
            $counts[$r['status']] = (int)$r['cnt'];
            $minutes += (int)$r['minutes'];
        }
        // Working days exclude Sundays (company week-off) and holidays.
        $workingDays = PayrollService::workingDays($year, $month);
        $presentEquiv = $counts['present'] + $counts['late'] + $counts['wfh'] + ($counts['half_day'] * 0.5);
        $percentage = $workingDays > 0 ? round(($presentEquiv / $workingDays) * 100, 2) : 0;

        // Required (expected) hours for the month = working days × full-day hours.
        $fullDayMinutes  = (int)Settings::get('full_day_minutes', '480'); // 8h/day default
        $requiredMinutes = $workingDays * $fullDayMinutes;
        $requiredHours   = round($requiredMinutes / 60, 2);
        $workedHours     = round($minutes / 60, 2);
        $hoursPercent    = $requiredMinutes > 0 ? round(($minutes / $requiredMinutes) * 100, 2) : 0;
        $remainingHours  = round(max(0, $requiredMinutes - $minutes) / 60, 2);

        return [
            'counts'              => $counts,
            'total_work_minutes'  => $minutes,
            'total_work_hours'    => $workedHours,
            'attendance_percent'  => $percentage,
            'days_in_month'       => $workingDays,
            // Required vs worked hours (monthly target).
            'full_day_hours'      => round($fullDayMinutes / 60, 2),
            'required_hours'      => $requiredHours,
            'worked_hours'        => $workedHours,
            'remaining_hours'     => $remainingHours,
            'hours_percent'       => $hoursPercent,
        ];
    }

    /** Admin dashboard counters for a given date. */
    public static function dashboardCounters(string $date): array
    {
        $totalEmployees = (int)Database::scalar(
            'SELECT COUNT(*) FROM users WHERE role_id = 3 AND status = "active"'
        );
        $present = (int)Database::scalar(
            'SELECT COUNT(*) FROM attendance WHERE attendance_date = ? AND status IN ("present","late","wfh","half_day")',
            [$date]
        );
        $late = (int)Database::scalar(
            'SELECT COUNT(*) FROM attendance WHERE attendance_date = ? AND is_late = 1',
            [$date]
        );
        $onLeave = (int)Database::scalar(
            'SELECT COUNT(*) FROM attendance WHERE attendance_date = ? AND status = "leave"',
            [$date]
        );
        $checkIns = (int)Database::scalar(
            'SELECT COUNT(*) FROM attendance WHERE attendance_date = ? AND check_in_time IS NOT NULL',
            [$date]
        );
        // On a company week-off (Sunday/holiday) nobody is "absent".
        $weekOff = PayrollService::isWeekOff($date);
        $absent = $weekOff ? 0 : max(0, $totalEmployees - $present - $onLeave);
        $percent = $totalEmployees > 0 ? round(($present / $totalEmployees) * 100, 2) : 0;

        return [
            'total_employees'    => $totalEmployees,
            'present_today'      => $present,
            'absent_today'       => $absent,
            'late_today'         => $late,
            'on_leave_today'     => $onLeave,
            'total_check_ins'    => $checkIns,
            'attendance_percent' => $percent,
        ];
    }

    /** Last N days present-count trend (daily attendance chart). */
    public static function dailyTrend(int $days = 7): array
    {
        return Database::fetchAll(
            'SELECT attendance_date AS date,
                    SUM(status IN ("present","late","wfh","half_day")) AS present,
                    SUM(is_late = 1) AS late
             FROM attendance
             WHERE attendance_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
             GROUP BY attendance_date ORDER BY attendance_date',
            [$days]
        );
    }

    /** Per-department present counts for a date (department chart). */
    public static function departmentBreakdown(string $date): array
    {
        return Database::fetchAll(
            'SELECT d.name AS department,
                    COUNT(DISTINCT u.id) AS total,
                    COUNT(DISTINCT CASE WHEN a.status IN ("present","late","wfh","half_day") THEN a.user_id END) AS present
             FROM users u
             LEFT JOIN departments d ON d.id = u.department_id
             LEFT JOIN attendance a ON a.user_id = u.id AND a.attendance_date = ?
             WHERE u.role_id = 3 AND u.status = "active"
             GROUP BY d.id, d.name ORDER BY d.name',
            [$date]
        );
    }

    /** Monthly present trend for the whole company (12 months). */
    public static function monthlyTrend(int $year): array
    {
        return Database::fetchAll(
            'SELECT MONTH(attendance_date) AS month,
                    SUM(status IN ("present","late","wfh","half_day")) AS present,
                    SUM(status = "absent") AS absent
             FROM attendance
             WHERE YEAR(attendance_date) = ?
             GROUP BY MONTH(attendance_date) ORDER BY month',
            [$year]
        );
    }
}
