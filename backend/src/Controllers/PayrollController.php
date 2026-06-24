<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Models\User;
use App\Services\PayrollService;
use App\Support\Guard;

final class PayrollController
{
    /** GET /payroll?month=YYYY-MM[&user_id=] — payroll for all (admin) or one employee. */
    public function index(Request $request): void
    {
        $month = (string)($request->query['month'] ?? date('Y-m'));
        if (!preg_match('/^(\d{4})-(\d{2})$/', $month, $m)) {
            $month = date('Y-m');
            preg_match('/^(\d{4})-(\d{2})$/', $month, $m);
        }
        $year = (int)$m[1];
        $mon  = (int)$m[2];

        // Employees may only view their own payslip.
        if (!Guard::isAdmin()) {
            $user = User::detailed(Auth::id());
            Response::success([
                'month'   => $month,
                'payroll' => [PayrollService::forEmployee($user, $year, $mon)],
            ]);
        }

        // Admin: single employee, or the whole active workforce.
        if ($request->query['user_id'] ?? null) {
            $user = User::detailed((int)$request->query['user_id']);
            if (!$user) {
                Response::error('Employee not found.', 404);
            }
            Response::success([
                'month'   => $month,
                'payroll' => [PayrollService::forEmployee($user, $year, $mon)],
            ]);
        }

        $employees = Database::fetchAll(
            'SELECT u.id, u.employee_code, u.full_name, u.monthly_salary, d.name AS department_name
             FROM users u LEFT JOIN departments d ON d.id = u.department_id
             WHERE u.role_id = 3 AND u.status = "active" ORDER BY u.full_name'
        );

        $rows = array_map(
            static fn($u) => PayrollService::forEmployee($u, $year, $mon),
            $employees
        );

        $totals = [
            'gross' => round(array_sum(array_column($rows, 'monthly_salary')), 2),
            'net'   => round(array_sum(array_column($rows, 'net_pay')), 2),
            'count' => count($rows),
        ];

        Response::success(['month' => $month, 'payroll' => $rows, 'totals' => $totals]);
    }
}
