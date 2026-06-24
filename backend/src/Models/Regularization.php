<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

final class Regularization extends BaseModel
{
    protected static string $table = 'regularizations';
    protected static array $fillable = [
        'user_id', 'attendance_date', 'requested_check_in', 'requested_check_out',
        'reason', 'status', 'reviewed_by', 'reviewed_at', 'admin_remarks',
    ];

    /** Paginated list. $userId null = all (admin); otherwise scoped to one user. */
    public static function listFor(?int $userId, ?string $status, int $page, int $perPage): array
    {
        $where = ['1 = 1'];
        $params = [];
        if ($userId !== null) {
            $where[] = 'r.user_id = ?';
            $params[] = $userId;
        }
        if ($status) {
            $where[] = 'r.status = ?';
            $params[] = $status;
        }
        $whereSql = implode(' AND ', $where);
        $total = (int)Database::scalar("SELECT COUNT(*) FROM regularizations r WHERE {$whereSql}", $params);

        $offset = ($page - 1) * $perPage;
        $rows = Database::fetchAll(
            "SELECT r.*, u.full_name, u.employee_code, rv.full_name AS reviewer_name
             FROM regularizations r
             JOIN users u ON u.id = r.user_id
             LEFT JOIN users rv ON rv.id = r.reviewed_by
             WHERE {$whereSql}
             ORDER BY r.created_at DESC
             LIMIT {$perPage} OFFSET {$offset}",
            $params
        );

        return [
            'data' => $rows,
            'meta' => [
                'page' => $page, 'per_page' => $perPage,
                'total' => $total, 'total_pages' => (int)ceil($total / max(1, $perPage)),
            ],
        ];
    }

    public static function pendingForDate(int $userId, string $date): bool
    {
        return (int)Database::scalar(
            'SELECT COUNT(*) FROM regularizations WHERE user_id = ? AND attendance_date = ? AND status = "pending"',
            [$userId, $date]
        ) > 0;
    }
}
