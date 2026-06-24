<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

final class Leave extends BaseModel
{
    protected static string $table = 'leaves';
    protected static array $fillable = [
        'user_id', 'leave_type_id', 'from_date', 'to_date', 'total_days',
        'reason', 'status', 'approved_by', 'approved_at', 'admin_remarks',
    ];

    public static function listFor(?int $userId, array $filters, int $page, int $perPage): array
    {
        $where = ['1 = 1'];
        $params = [];
        if ($userId !== null) { $where[] = 'l.user_id = ?'; $params[] = $userId; }
        if (!empty($filters['status'])) { $where[] = 'l.status = ?'; $params[] = $filters['status']; }
        if (!empty($filters['from'])) { $where[] = 'l.to_date >= ?'; $params[] = $filters['from']; }
        if (!empty($filters['to']))   { $where[] = 'l.from_date <= ?'; $params[] = $filters['to']; }
        $whereSql = implode(' AND ', $where);

        $total = (int)Database::scalar("SELECT COUNT(*) FROM leaves l WHERE {$whereSql}", $params);
        $offset = ($page - 1) * $perPage;
        $rows = Database::fetchAll(
            "SELECT l.*, u.full_name, u.employee_code, lt.name AS leave_type_name,
                    appr.full_name AS approver_name
             FROM leaves l
             JOIN users u ON u.id = l.user_id
             LEFT JOIN leave_types lt ON lt.id = l.leave_type_id
             LEFT JOIN users appr ON appr.id = l.approved_by
             WHERE {$whereSql}
             ORDER BY l.created_at DESC LIMIT {$perPage} OFFSET {$offset}",
            $params
        );
        return [
            'data' => $rows,
            'meta' => ['page' => $page, 'per_page' => $perPage, 'total' => $total,
                       'total_pages' => (int)ceil($total / $perPage)],
        ];
    }

    /** Detect overlapping non-rejected leave for a user. */
    public static function hasOverlap(int $userId, string $from, string $to, ?int $excludeId = null): bool
    {
        $sql = 'SELECT COUNT(*) FROM leaves
                WHERE user_id = ? AND status IN ("pending","approved")
                  AND from_date <= ? AND to_date >= ?';
        $params = [$userId, $to, $from];
        if ($excludeId) { $sql .= ' AND id <> ?'; $params[] = $excludeId; }
        return (int)Database::scalar($sql, $params) > 0;
    }
}
