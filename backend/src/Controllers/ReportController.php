<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Models\Attendance;
use App\Support\Guard;

/**
 * Reports module. Each endpoint supports ?format=json|csv|html.
 *  - csv  -> Excel-openable download
 *  - html -> print-friendly page (browser "Print -> Save as PDF")
 */
final class ReportController
{
    /** GET /reports/daily?date=YYYY-MM-DD */
    public function daily(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $date = $request->query['date'] ?? date('Y-m-d');
        $rows = Attendance::dailyReport($date);
        $this->output($request, "Daily Attendance - {$date}", [
            'Employee Code', 'Name', 'Department', 'Check In', 'Check Out', 'Hours', 'Late', 'Status',
        ], array_map(fn($r) => [
            $r['employee_code'], $r['full_name'], $r['department_name'] ?? '-',
            $r['check_in_time'] ?? '-', $r['check_out_time'] ?? '-',
            $r['working_minutes'] ? round($r['working_minutes'] / 60, 2) : '-',
            $r['is_late'] ? 'Yes' : 'No', $r['status'] ?? 'absent',
        ], $rows), $rows);
    }

    /** GET /reports/monthly?year=&month= */
    public function monthly(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $year  = (int)($request->query['year'] ?? date('Y'));
        $month = (int)($request->query['month'] ?? date('m'));
        $rows = Database::fetchAll(
            'SELECT u.employee_code, u.full_name, d.name AS department_name,
                    SUM(a.status IN ("present","late","wfh")) AS present_days,
                    SUM(a.status = "half_day") AS half_days,
                    SUM(a.status = "leave") AS leave_days,
                    SUM(a.is_late = 1) AS late_count,
                    COALESCE(SUM(a.working_minutes),0) AS total_minutes
             FROM users u
             LEFT JOIN attendance a ON a.user_id = u.id
                  AND YEAR(a.attendance_date) = ? AND MONTH(a.attendance_date) = ?
             LEFT JOIN departments d ON d.id = u.department_id
             WHERE u.role_id = 3 AND u.status = "active"
             GROUP BY u.id ORDER BY u.full_name',
            [$year, $month]
        );
        $this->output($request, "Monthly Attendance - {$year}-{$month}", [
            'Employee Code', 'Name', 'Department', 'Present', 'Half Days', 'Leave', 'Late', 'Total Hours',
        ], array_map(fn($r) => [
            $r['employee_code'], $r['full_name'], $r['department_name'] ?? '-',
            $r['present_days'], $r['half_days'], $r['leave_days'], $r['late_count'],
            round($r['total_minutes'] / 60, 2),
        ], $rows), $rows);
    }

    /** GET /reports/employee?user_id=&from=&to= */
    public function employee(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $userId = (int)($request->query['user_id'] ?? 0);
        $from   = $request->query['from'] ?? date('Y-m-01');
        $to     = $request->query['to'] ?? date('Y-m-t');
        $rows = Database::fetchAll(
            'SELECT attendance_date, check_in_time, check_out_time, working_minutes, is_late, status
             FROM attendance WHERE user_id = ? AND attendance_date BETWEEN ? AND ?
             ORDER BY attendance_date',
            [$userId, $from, $to]
        );
        $emp = Database::fetch('SELECT full_name, employee_code FROM users WHERE id = ?', [$userId]);
        $title = 'Employee Report - ' . ($emp['full_name'] ?? $userId) . " ({$from} to {$to})";
        $this->output($request, $title, [
            'Date', 'Check In', 'Check Out', 'Hours', 'Late', 'Status',
        ], array_map(fn($r) => [
            $r['attendance_date'], $r['check_in_time'] ?? '-', $r['check_out_time'] ?? '-',
            $r['working_minutes'] ? round($r['working_minutes'] / 60, 2) : '-',
            $r['is_late'] ? 'Yes' : 'No', $r['status'],
        ], $rows), $rows);
    }

    /** GET /reports/department?date= */
    public function department(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $date = $request->query['date'] ?? date('Y-m-d');
        $rows = Attendance::departmentBreakdown($date);
        $this->output($request, "Department-wise Attendance - {$date}", [
            'Department', 'Total', 'Present', 'Absent', 'Attendance %',
        ], array_map(fn($r) => [
            $r['department'] ?? '-', $r['total'], $r['present'],
            (int)$r['total'] - (int)$r['present'],
            $r['total'] > 0 ? round(($r['present'] / $r['total']) * 100, 1) . '%' : '0%',
        ], $rows), $rows);
    }

    /** GET /reports/late?from=&to= */
    public function late(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $from = $request->query['from'] ?? date('Y-m-01');
        $to   = $request->query['to'] ?? date('Y-m-t');
        $rows = Database::fetchAll(
            'SELECT u.employee_code, u.full_name, a.attendance_date, a.check_in_time
             FROM attendance a JOIN users u ON u.id = a.user_id
             WHERE a.is_late = 1 AND a.attendance_date BETWEEN ? AND ?
             ORDER BY a.attendance_date DESC',
            [$from, $to]
        );
        $this->output($request, "Late Attendance Report ({$from} to {$to})", [
            'Employee Code', 'Name', 'Date', 'Check In',
        ], array_map(fn($r) => [
            $r['employee_code'], $r['full_name'], $r['attendance_date'], $r['check_in_time'],
        ], $rows), $rows);
    }

    /** GET /reports/leave?from=&to=&status= */
    public function leave(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $from = $request->query['from'] ?? date('Y-m-01');
        $to   = $request->query['to'] ?? date('Y-m-t');
        $where = ['l.from_date <= ?', 'l.to_date >= ?'];
        $params = [$to, $from];
        if (!empty($request->query['status'])) {
            $where[] = 'l.status = ?';
            $params[] = $request->query['status'];
        }
        $rows = Database::fetchAll(
            'SELECT u.employee_code, u.full_name, lt.name AS leave_type,
                    l.from_date, l.to_date, l.total_days, l.status
             FROM leaves l JOIN users u ON u.id = l.user_id
             LEFT JOIN leave_types lt ON lt.id = l.leave_type_id
             WHERE ' . implode(' AND ', $where) . ' ORDER BY l.from_date DESC',
            $params
        );
        $this->output($request, "Leave Report ({$from} to {$to})", [
            'Employee Code', 'Name', 'Type', 'From', 'To', 'Days', 'Status',
        ], array_map(fn($r) => [
            $r['employee_code'], $r['full_name'], $r['leave_type'] ?? '-',
            $r['from_date'], $r['to_date'], $r['total_days'], $r['status'],
        ], $rows), $rows);
    }

    /**
     * Render output in the requested format.
     * @param array<int,string>        $headers
     * @param array<int,array<int,mixed>> $matrix  table rows for csv/html
     * @param array                    $raw      raw rows for json
     */
    private function output(Request $request, string $title, array $headers, array $matrix, array $raw): never
    {
        $format = strtolower((string)($request->query['format'] ?? 'json'));

        if ($format === 'csv') {
            $this->csv($title, $headers, $matrix);
        }
        if ($format === 'html' || $format === 'print') {
            $this->html($title, $headers, $matrix);
        }
        // `matrix` = display-ordered rows aligned to `headers` (used by PDF/UI);
        // `rows` = raw records for any richer client rendering.
        Response::success(['title' => $title, 'headers' => $headers, 'matrix' => $matrix, 'rows' => $raw]);
    }

    private function csv(string $title, array $headers, array $matrix): never
    {
        $filename = preg_replace('/[^A-Za-z0-9_-]+/', '_', $title) . '.csv';
        header('Content-Type: text/csv; charset=utf-8');
        header("Content-Disposition: attachment; filename=\"{$filename}\"");
        $out = fopen('php://output', 'w');
        fputcsv($out, $headers);
        foreach ($matrix as $row) {
            fputcsv($out, $row);
        }
        fclose($out);
        exit;
    }

    private function html(string $title, array $headers, array $matrix): never
    {
        $esc = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
        $th = implode('', array_map(fn($h) => '<th>' . $esc($h) . '</th>', $headers));
        $rowsHtml = '';
        foreach ($matrix as $row) {
            $rowsHtml .= '<tr>' . implode('', array_map(fn($c) => '<td>' . $esc($c) . '</td>', $row)) . '</tr>';
        }
        $titleEsc = $esc($title);
        $generated = $esc(date('Y-m-d H:i'));
        header('Content-Type: text/html; charset=utf-8');
        echo <<<HTML
<!doctype html><html><head><meta charset="utf-8"><title>{$titleEsc}</title>
<style>
 body{font-family:Arial,Helvetica,sans-serif;margin:24px;color:#222}
 h1{font-size:18px;margin-bottom:4px}.meta{color:#666;font-size:12px;margin-bottom:16px}
 table{border-collapse:collapse;width:100%;font-size:12px}
 th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
 th{background:#0d6efd;color:#fff}tr:nth-child(even){background:#f5f7fa}
 @media print{.noprint{display:none}}
 .noprint{margin-bottom:16px}button{padding:8px 14px;cursor:pointer}
</style></head><body>
<div class="noprint"><button onclick="window.print()">Print / Save as PDF</button></div>
<h1>{$titleEsc}</h1>
<div class="meta">GeoAttend Pro &middot; Generated {$generated}</div>
<table><thead><tr>{$th}</tr></thead><tbody>{$rowsHtml}</tbody></table>
</body></html>
HTML;
        exit;
    }
}
