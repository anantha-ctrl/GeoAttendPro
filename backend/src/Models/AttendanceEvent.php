<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

/**
 * Append-only timeline of work-session events:
 * login, rest_start, rest_end, overtime_start, logout.
 */
final class AttendanceEvent extends BaseModel
{
    protected static string $table = 'attendance_events';
    protected static array $fillable = [
        'user_id', 'session_id', 'attendance_date', 'event_type', 'event_time', 'note',
    ];

    /** Record one timeline event (event_time defaults to now). */
    public static function record(int $userId, ?int $sessionId, string $type, ?string $note = null, ?string $when = null): int
    {
        return self::create([
            'user_id'         => $userId,
            'session_id'      => $sessionId,
            'attendance_date' => date('Y-m-d'),
            'event_type'      => $type,
            'event_time'      => $when ?? date('Y-m-d H:i:s'),
            'note'            => $note,
        ]);
    }

    /** Full timeline for a user on a date (chronological). */
    public static function timeline(int $userId, string $date): array
    {
        return Database::fetchAll(
            'SELECT event_type, event_time, note FROM attendance_events
             WHERE user_id = ? AND attendance_date = ? ORDER BY event_time ASC, id ASC',
            [$userId, $date]
        );
    }
}
