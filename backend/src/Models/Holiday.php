<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

final class Holiday extends BaseModel
{
    protected static string $table = 'holidays';
    protected static array $fillable = ['name', 'holiday_date', 'recurring'];

    public static function upcoming(): array
    {
        return Database::fetchAll('SELECT * FROM holidays ORDER BY holiday_date');
    }

    /** Is the given date a holiday? (matches exact date or a recurring month/day). */
    public static function isHoliday(string $date): bool
    {
        return (int)Database::scalar(
            'SELECT COUNT(*) FROM holidays
             WHERE holiday_date = ?
                OR (recurring = 1 AND DATE_FORMAT(holiday_date, "%m-%d") = DATE_FORMAT(?, "%m-%d"))',
            [$date, $date]
        ) > 0;
    }
}
