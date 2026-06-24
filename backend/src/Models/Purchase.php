<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

final class Purchase extends BaseModel
{
    protected static string $table = 'purchases';
    protected static array $fillable = [
        'item_name', 'category', 'vendor', 'quantity', 'unit_price', 'total_amount',
        'purchase_date', 'payment_status', 'invoice_no', 'notes', 'created_by',
    ];

    /** Paginated + filtered purchase listing with creator name. */
    public static function paginate(array $filters, int $page, int $perPage): array
    {
        $where = ['1 = 1'];
        $params = [];

        if (!empty($filters['search'])) {
            $where[] = '(p.item_name LIKE ? OR p.vendor LIKE ? OR p.invoice_no LIKE ?)';
            $like = '%' . $filters['search'] . '%';
            array_push($params, $like, $like, $like);
        }
        if (!empty($filters['category'])) {
            $where[] = 'p.category = ?';
            $params[] = $filters['category'];
        }
        if (!empty($filters['payment_status'])) {
            $where[] = 'p.payment_status = ?';
            $params[] = $filters['payment_status'];
        }
        if (!empty($filters['from'])) {
            $where[] = 'p.purchase_date >= ?';
            $params[] = $filters['from'];
        }
        if (!empty($filters['to'])) {
            $where[] = 'p.purchase_date <= ?';
            $params[] = $filters['to'];
        }

        $whereSql = implode(' AND ', $where);
        $total = (int)Database::scalar("SELECT COUNT(*) FROM purchases p WHERE {$whereSql}", $params);

        $offset = ($page - 1) * $perPage;
        $rows = Database::fetchAll(
            "SELECT p.*, u.full_name AS created_by_name
             FROM purchases p LEFT JOIN users u ON u.id = p.created_by
             WHERE {$whereSql} ORDER BY p.purchase_date DESC, p.id DESC
             LIMIT {$perPage} OFFSET {$offset}",
            $params
        );

        // Summary across the whole filtered set (not just this page).
        $sum = Database::fetch(
            "SELECT
                COALESCE(SUM(total_amount),0) AS total_spent,
                COALESCE(SUM(CASE WHEN payment_status='pending' THEN total_amount ELSE 0 END),0) AS pending_amount,
                COUNT(*) AS count
             FROM purchases p WHERE {$whereSql}",
            $params
        ) ?: [];

        return [
            'data' => $rows,
            'meta' => [
                'page' => $page, 'per_page' => $perPage,
                'total' => $total, 'total_pages' => (int)ceil($total / max(1, $perPage)),
            ],
            'summary' => [
                'total_spent'    => (float)($sum['total_spent'] ?? 0),
                'pending_amount' => (float)($sum['pending_amount'] ?? 0),
                'count'          => (int)($sum['count'] ?? 0),
            ],
        ];
    }
}
