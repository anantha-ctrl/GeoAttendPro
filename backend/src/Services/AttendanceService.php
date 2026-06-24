<?php

declare(strict_types=1);

namespace App\Services;

use App\Support\Settings;

/**
 * Encapsulates attendance business rules:
 *  - late detection (work_start_time + grace)
 *  - working-hours calculation
 *  - status derivation (present / late / half_day)
 */
final class AttendanceService
{
    /** Determine if a check-in time is "late" relative to configured start + grace. */
    public static function isLate(string $checkInDateTime): bool
    {
        $start = Settings::get('work_start_time', '09:30');
        $grace = (int)Settings::get('late_grace_minutes', '15');

        $date      = substr($checkInDateTime, 0, 10);
        $threshold = strtotime("{$date} {$start}") + $grace * 60;
        return strtotime($checkInDateTime) > $threshold;
    }

    /**
     * Shift-aware late detection. If the employee has an assigned shift, its
     * start_time + grace_minutes win; otherwise fall back to the global setting.
     */
    public static function isLateForShift(string $checkInDateTime, ?array $shift): bool
    {
        if (!$shift) {
            return self::isLate($checkInDateTime);
        }
        $start = substr((string)$shift['start_time'], 0, 5);
        $grace = (int)$shift['grace_minutes'];
        $date  = substr($checkInDateTime, 0, 10);
        $threshold = strtotime("{$date} {$start}") + $grace * 60;
        return strtotime($checkInDateTime) > $threshold;
    }

    /** Working minutes between check-in and check-out. */
    public static function workingMinutes(string $checkIn, string $checkOut): int
    {
        return max(0, (int)round((strtotime($checkOut) - strtotime($checkIn)) / 60));
    }

    /**
     * Derive final attendance status at check-out time.
     * half_day if worked < half_day_minutes; otherwise late|present.
     */
    public static function deriveStatus(bool $isLate, int $workingMinutes): string
    {
        $halfDay = (int)Settings::get('half_day_minutes', '240');
        if ($workingMinutes > 0 && $workingMinutes < $halfDay) {
            return 'half_day';
        }
        return $isLate ? 'late' : 'present';
    }
}
