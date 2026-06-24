<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

final class Client extends BaseModel
{
    protected static string $table = 'clients';
    protected static array $fillable = [
        'name', 'company_name', 'email', 'phone', 'address',
        'gst_number', 'type', 'status', 'notes', 'created_by',
    ];

    /** Paginated + filtered client listing. */
    public static function paginate(array $filters, int $page, int $perPage): array
    {
        $where = ['1 = 1'];
        $params = [];

        if (!empty($filters['search'])) {
            $where[] = '(name LIKE ? OR company_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
            $like = '%' . $filters['search'] . '%';
            array_push($params, $like, $like, $like, $like);
        }
        if (!empty($filters['type'])) {
            $where[] = 'type = ?';
            $params[] = $filters['type'];
        }
        if (!empty($filters['status'])) {
            $where[] = 'status = ?';
            $params[] = $filters['status'];
        }

        $whereSql = implode(' AND ', $where);
        $total = (int)Database::scalar("SELECT COUNT(*) FROM clients WHERE {$whereSql}", $params);

        $offset = ($page - 1) * $perPage;
        $rows = Database::fetchAll(
            "SELECT * FROM clients WHERE {$whereSql} ORDER BY created_at DESC LIMIT {$perPage} OFFSET {$offset}",
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
}
