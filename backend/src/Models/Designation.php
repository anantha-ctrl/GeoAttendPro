<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

final class Designation extends BaseModel
{
    protected static string $table = 'designations';
    protected static array $fillable = ['name', 'department_id', 'status'];

    public static function withDepartment(): array
    {
        return Database::fetchAll(
            'SELECT dg.*, d.name AS department_name
             FROM designations dg
             LEFT JOIN departments d ON d.id = dg.department_id
             ORDER BY dg.name'
        );
    }
}
