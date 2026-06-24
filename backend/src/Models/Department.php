<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

final class Department extends BaseModel
{
    protected static string $table = 'departments';
    protected static array $fillable = ['name', 'description', 'status'];

    public static function withCounts(): array
    {
        return Database::fetchAll(
            'SELECT d.*, (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id) AS employee_count
             FROM departments d ORDER BY d.name'
        );
    }
}
