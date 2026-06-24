<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

final class Ticket extends BaseModel
{
    protected static string $table = 'tickets';
    protected static array $fillable = [
        'user_id', 'subject', 'category', 'description', 'priority',
        'status', 'assigned_to', 'admin_remarks',
    ];

    /** List tickets; $userId null = all (admin). */
    public static function listFor(?int $userId, ?string $status): array
    {
        $where = ['1 = 1'];
        $params = [];
        if ($userId !== null) { $where[] = 't.user_id = ?'; $params[] = $userId; }
        if ($status) { $where[] = 't.status = ?'; $params[] = $status; }
        $whereSql = implode(' AND ', $where);

        return Database::fetchAll(
            "SELECT t.*, u.full_name, u.employee_code, ag.full_name AS assignee_name
             FROM tickets t
             JOIN users u ON u.id = t.user_id
             LEFT JOIN users ag ON ag.id = t.assigned_to
             WHERE {$whereSql}
             ORDER BY FIELD(t.status,'open','in_progress','resolved','closed'),
                      FIELD(t.priority,'high','medium','low'), t.created_at DESC",
            $params
        );
    }
}
