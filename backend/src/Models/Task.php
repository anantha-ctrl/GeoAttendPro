<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

final class Task extends BaseModel
{
    protected static string $table = 'tasks';
    protected static array $fillable = [
        'title', 'description', 'assigned_to', 'assigned_by', 'due_date', 'priority', 'status',
    ];

    /** List tasks; $assignee null = all (admin). */
    public static function listFor(?int $assignee, ?string $status): array
    {
        $where = ['1 = 1'];
        $params = [];
        if ($assignee !== null) { $where[] = 't.assigned_to = ?'; $params[] = $assignee; }
        if ($status) { $where[] = 't.status = ?'; $params[] = $status; }
        $whereSql = implode(' AND ', $where);

        return Database::fetchAll(
            "SELECT t.*, a.full_name AS assignee_name, a.employee_code AS assignee_code,
                    b.full_name AS assigner_name
             FROM tasks t
             JOIN users a ON a.id = t.assigned_to
             LEFT JOIN users b ON b.id = t.assigned_by
             WHERE {$whereSql}
             ORDER BY FIELD(t.status,'todo','in_progress','done'),
                      FIELD(t.priority,'high','medium','low'), t.due_date IS NULL, t.due_date",
            $params
        );
    }
}
