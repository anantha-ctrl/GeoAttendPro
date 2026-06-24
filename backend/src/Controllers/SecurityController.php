<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Support\Guard;

/**
 * Security module endpoints: login history, activity logs, active sessions.
 * Admin / Super Admin only.
 */
final class SecurityController
{
    public function loginHistory(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $page    = max(1, (int)($request->query['page'] ?? 1));
        $perPage = min(100, max(5, (int)($request->query['per_page'] ?? 20)));
        $offset  = ($page - 1) * $perPage;

        $total = (int)Database::scalar('SELECT COUNT(*) FROM login_history');
        $rows  = Database::fetchAll(
            'SELECT lh.*, u.full_name, u.employee_code
             FROM login_history lh
             LEFT JOIN users u ON u.id = lh.user_id
             ORDER BY lh.id DESC LIMIT ? OFFSET ?',
            [$perPage, $offset]
        );
        Response::success(['data' => $rows, 'meta' => [
            'page' => $page, 'per_page' => $perPage, 'total' => $total,
            'total_pages' => (int)ceil($total / $perPage),
        ]]);
    }

    public function activityLogs(Request $request): void
    {
        Guard::allow(['super_admin', 'admin']);
        $page    = max(1, (int)($request->query['page'] ?? 1));
        $perPage = min(100, max(5, (int)($request->query['per_page'] ?? 20)));
        $offset  = ($page - 1) * $perPage;

        $total = (int)Database::scalar('SELECT COUNT(*) FROM activity_logs');
        $rows  = Database::fetchAll(
            'SELECT al.*, u.full_name, u.employee_code
             FROM activity_logs al
             LEFT JOIN users u ON u.id = al.user_id
             ORDER BY al.id DESC LIMIT ? OFFSET ?',
            [$perPage, $offset]
        );
        Response::success(['data' => $rows, 'meta' => [
            'page' => $page, 'per_page' => $perPage, 'total' => $total,
            'total_pages' => (int)ceil($total / $perPage),
        ]]);
    }

    public function activeSessions(Request $request): void
    {
        Guard::allow(['super_admin']);
        $rows = Database::fetchAll(
            'SELECT s.id, s.ip_address, s.user_agent, s.last_activity, s.expires_at,
                    u.full_name, u.email
             FROM user_sessions s JOIN users u ON u.id = s.user_id
             ORDER BY s.last_activity DESC'
        );
        Response::success($rows);
    }
}
