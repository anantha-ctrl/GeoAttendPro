<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Support\Settings;

/**
 * Monthly payroll calculation driven by attendance.
 *
 * Rules:
 *  - Working days  = calendar days in the month minus Sundays minus holidays.
 *  - present/late/wfh = fully paid;  leave = paid;  half_day = 0.5 day.
 *  - Loss-of-pay (LOP) days = recorded absences + 0.5 × half-days.
 *  - per_day = monthly_salary / working_days;  net = salary − per_day × LOP.
 */
final class PayrollService
{
    /** Number of working days in a month (excludes Sundays + holidays). */
    public static function workingDays(int $year, int $month): int
    {
        $daysInMonth = (int)date('t', mktime(0, 0, 0, $month, 1, $year));

        // Holidays in this month (explicit dates + recurring month/day), de-duplicated.
        $holidayRows = Database::fetchAll(
            'SELECT DAY(holiday_date) AS d FROM holidays
              WHERE YEAR(holiday_date) = ? AND MONTH(holiday_date) = ?
             UNION
             SELECT DAY(holiday_date) AS d FROM holidays
              WHERE recurring = 1 AND MONTH(holiday_date) = ?',
            [$year, $month, $month]
        );
        $holidayDays = array_unique(array_map(static fn($r) => (int)$r['d'], $holidayRows));

        $count = 0;
        for ($d = 1; $d <= $daysInMonth; $d++) {
            $dow = (int)date('w', mktime(0, 0, 0, $month, $d, $year)); // 0 = Sunday
            if ($dow === 0) continue;
            if (in_array($d, $holidayDays, true)) continue;
            $count++;
        }
        return max($count, 1);
    }

    /** Is the given date a company week-off? (Sunday or a holiday.) */
    public static function isWeekOff(string $date): bool
    {
        $ts = strtotime($date);
        if ($ts === false) return false;
        if ((int)date('w', $ts) === 0) return true; // Sunday

        $month = (int)date('n', $ts);
        $day   = (int)date('j', $ts);
        $hit = Database::scalar(
            'SELECT COUNT(*) FROM holidays
              WHERE holiday_date = ?
                 OR (recurring = 1 AND MONTH(holiday_date) = ? AND DAY(holiday_date) = ?)',
            [$date, $month, $day]
        );
        return (int)$hit > 0;
    }

    /** Compute the payroll breakdown for one employee for a given month. */
    public static function forEmployee(array $user, int $year, int $month): array
    {
        $salary      = (float)($user['monthly_salary'] ?? 0);
        $workingDays = self::workingDays($year, $month);
        $perDay      = $workingDays > 0 ? $salary / $workingDays : 0.0;

        $row = Database::fetch(
            'SELECT
                SUM(status IN ("present","late","wfh")) AS present_days,
                SUM(status = "half_day")                AS half_days,
                SUM(status = "leave")                   AS leave_days,
                SUM(status = "absent")                  AS absent_days,
                SUM(is_late = 1)                        AS late_count
             FROM attendance
             WHERE user_id = ? AND YEAR(attendance_date) = ? AND MONTH(attendance_date) = ?',
            [$user['id'], $year, $month]
        ) ?: [];

        $present = (int)($row['present_days'] ?? 0);
        $half    = (int)($row['half_days'] ?? 0);
        $leave   = (int)($row['leave_days'] ?? 0);
        $absent  = (int)($row['absent_days'] ?? 0);
        $late    = (int)($row['late_count'] ?? 0);

        // Late penalty: every N late check-ins = 1 day deducted (configurable).
        $latesPerDeduction = max(1, (int)Settings::get('lates_per_deduction', '3'));
        $lateLopDays = (float)floor($late / $latesPerDeduction);

        // Loss-of-pay = full days absent + half of half-days + late penalty.
        $lopDays    = $absent + 0.5 * $half + $lateLopDays;
        $paidDays   = $present + $leave + 0.5 * $half;   // late days are still "present" pay
        $deductions = round($perDay * $lopDays, 2);

        // Overtime incentive: minutes worked past the office end time, per day,
        // counted only when the day's overtime exceeds the minimum threshold.
        $endTime = Settings::get('work_end_time', '18:30');
        $otRate  = (float)Settings::get('overtime_rate_per_hour', '0');
        $otMin   = (int)Settings::get('overtime_min_minutes', '0');
        $ot = Database::fetch(
            'SELECT COALESCE(SUM(ot),0) AS ot_minutes, COUNT(*) AS ot_days FROM (
                SELECT TIMESTAMPDIFF(MINUTE, CONCAT(attendance_date, " ", ?), check_out_time) AS ot
                FROM attendance
                WHERE user_id = ? AND YEAR(attendance_date) = ? AND MONTH(attendance_date) = ?
                  AND check_out_time IS NOT NULL
             ) t WHERE t.ot >= ?',
            [$endTime, $user['id'], $year, $month, max(1, $otMin)]
        ) ?: [];
        $overtimeMinutes   = (int)($ot['ot_minutes'] ?? 0);
        $overtimeDays      = (int)($ot['ot_days'] ?? 0);
        $overtimeHours     = round($overtimeMinutes / 60, 2);
        $overtimeIncentive = round($overtimeHours * $otRate, 2);

        $netPay = round(max(0, $salary - $deductions) + $overtimeIncentive, 2);

        return [
            'user_id'        => (int)$user['id'],
            'employee_code'  => $user['employee_code'] ?? null,
            'full_name'      => $user['full_name'] ?? null,
            'department_name'=> $user['department_name'] ?? null,
            'monthly_salary' => round($salary, 2),
            'working_days'   => $workingDays,
            'per_day_rate'   => round($perDay, 2),
            'present_days'   => $present,
            'half_days'      => $half,
            'leave_days'     => $leave,
            'absent_days'    => $absent,
            'late_count'     => $late,
            'lates_per_deduction' => $latesPerDeduction,
            'late_lop_days'  => $lateLopDays,
            'paid_days'      => $paidDays,
            'lop_days'       => $lopDays,
            // Per-reason deduction breakdown (shown on the payslip).
            'absent_deduction'   => round($perDay * $absent, 2),
            'half_day_deduction' => round($perDay * 0.5 * $half, 2),
            'late_deduction'     => round($perDay * $lateLopDays, 2),
            'deductions'     => $deductions,
            // Overtime incentive (added on top of salary).
            'work_end_time'         => $endTime,
            'overtime_rate_per_hour'=> $otRate,
            'overtime_minutes'      => $overtimeMinutes,
            'overtime_hours'        => $overtimeHours,
            'overtime_days'         => $overtimeDays,
            'overtime_incentive'    => $overtimeIncentive,
            'net_pay'        => $netPay,
        ];
    }
}
