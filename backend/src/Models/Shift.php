<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

final class Shift extends BaseModel
{
    protected static string $table = 'shifts';
    protected static array $fillable = ['name', 'start_time', 'end_time', 'grace_minutes', 'status'];

    /** All shifts with a count of assigned employees. */
    public static function withCounts(): array
    {
        return Database::fetchAll(
            'SELECT s.*, (SELECT COUNT(*) FROM users u WHERE u.shift_id = s.id) AS employee_count
             FROM shifts s ORDER BY s.start_time'
        );
    }

    /** The shift assigned to a given user (or null). */
    public static function forUser(int $userId): ?array
    {
        return Database::fetch(
            'SELECT s.* FROM shifts s JOIN users u ON u.shift_id = s.id WHERE u.id = ?',
            [$userId]
        );
    }
}
