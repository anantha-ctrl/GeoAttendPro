<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

final class ExpenseClaim extends BaseModel
{
    protected static string $table = 'expense_claims';
    protected static array $fillable = [
        'user_id', 'title', 'category', 'amount', 'expense_date', 'receipt_path',
        'notes', 'status', 'reviewed_by', 'reviewed_at', 'admin_remarks',
    ];

    /** List claims; $userId null = all (admin). Returns rows + summary. */
    public static function listFor(?int $userId, ?string $status): array
    {
        $where = ['1 = 1'];
        $params = [];
        if ($userId !== null) { $where[] = 'e.user_id = ?'; $params[] = $userId; }
        if ($status) { $where[] = 'e.status = ?'; $params[] = $status; }
        $whereSql = implode(' AND ', $where);

        $rows = Database::fetchAll(
            "SELECT e.*, u.full_name, u.employee_code, rv.full_name AS reviewer_name
             FROM expense_claims e
             JOIN users u ON u.id = e.user_id
             LEFT JOIN users rv ON rv.id = e.reviewed_by
             WHERE {$whereSql} ORDER BY e.created_at DESC",
            $params
        );
        $sum = Database::fetch(
            "SELECT
                COALESCE(SUM(amount),0) AS total,
                COALESCE(SUM(CASE WHEN status='approved' THEN amount ELSE 0 END),0) AS approved,
                COALESCE(SUM(CASE WHEN status='pending'  THEN amount ELSE 0 END),0) AS pending
             FROM expense_claims e WHERE {$whereSql}",
            $params
        ) ?: [];

        return [
            'data' => $rows,
            'summary' => [
                'total'    => (float)($sum['total'] ?? 0),
                'approved' => (float)($sum['approved'] ?? 0),
                'pending'  => (float)($sum['pending'] ?? 0),
            ],
        ];
    }
}
