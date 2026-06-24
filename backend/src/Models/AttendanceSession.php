<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

/**
 * One row = one check-in/check-out session. A day can have many sessions.
 */
final class AttendanceSession extends BaseModel
{
    protected static string $table = 'attendance_sessions';
    protected static array $fillable = [
        'user_id', 'attendance_date', 'check_in_time', 'check_out_time',
        'check_in_lat', 'check_in_lng', 'check_out_lat', 'check_out_lng',
        'check_in_selfie', 'check_out_selfie', 'ip_address', 'device_info', 'working_minutes',
        'rest_seconds', 'face_verified',
        'work_status', 'branch', 'overtime_seconds', 'rest_started_at', 'overtime_started_at',
    ];

    /** Add idle/rest seconds (sleep / screen-off) to a session. */
    public static function addRest(int $sessionId, int $deltaSeconds): void
    {
        if ($deltaSeconds <= 0) return;
        Database::run(
            'UPDATE attendance_sessions SET rest_seconds = rest_seconds + ? WHERE id = ?',
            [$deltaSeconds, $sessionId]
        );
    }

    /**
     * Live work_status of a session, derived from its markers so the value is
     * always correct even if a heartbeat was missed:
     *   closed → logged_out;  resting → rest;  past-6:30 continue → overtime;  else working.
     */
    public static function liveStatus(array $session): string
    {
        if (!empty($session['check_out_time'])) return 'logged_out';
        if (!empty($session['rest_started_at']))     return 'rest';
        if (!empty($session['overtime_started_at'])) return 'overtime';
        return 'working';
    }

    /**
     * Effective rest seconds for a session including any in-progress rest
     * (now − rest_started_at) so live displays keep counting up.
     */
    public static function effectiveRestSeconds(array $session): int
    {
        $rest = (int)($session['rest_seconds'] ?? 0);
        if (!empty($session['rest_started_at']) && empty($session['check_out_time'])) {
            $rest += max(0, time() - strtotime((string)$session['rest_started_at']));
        }
        return $rest;
    }

    /** Total idle/rest seconds across all sessions on a date. */
    public static function totalRestSeconds(int $userId, string $date): int
    {
        return (int)Database::scalar(
            'SELECT COALESCE(SUM(rest_seconds),0) FROM attendance_sessions
             WHERE user_id = ? AND attendance_date = ?',
            [$userId, $date]
        );
    }

    /** The currently open (not-yet-checked-out) session for a user on a date, if any. */
    public static function openSession(int $userId, string $date): ?array
    {
        return Database::fetch(
            'SELECT * FROM attendance_sessions
             WHERE user_id = ? AND attendance_date = ? AND check_out_time IS NULL
             ORDER BY id DESC LIMIT 1',
            [$userId, $date]
        );
    }

    /** All sessions for a user on a date (most recent first). */
    public static function forDate(int $userId, string $date): array
    {
        return Database::fetchAll(
            'SELECT * FROM attendance_sessions
             WHERE user_id = ? AND attendance_date = ? ORDER BY id ASC',
            [$userId, $date]
        );
    }

    /** Total worked minutes across all completed sessions on a date. */
    public static function totalMinutes(int $userId, string $date): int
    {
        return (int)Database::scalar(
            'SELECT COALESCE(SUM(working_minutes),0) FROM attendance_sessions
             WHERE user_id = ? AND attendance_date = ?',
            [$userId, $date]
        );
    }
}
