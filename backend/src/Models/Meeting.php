<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

final class Meeting extends BaseModel
{
    protected static string $table = 'meetings';
    protected static array $fillable = [
        'title', 'agenda', 'meeting_date', 'duration_minutes',
        'location', 'meeting_link', 'status', 'created_by',
    ];

    /** All meetings (admin) + invitee/attended counts. */
    public static function listAll(?string $status): array
    {
        $where = ['1 = 1'];
        $params = [];
        if ($status) { $where[] = 'm.status = ?'; $params[] = $status; }
        return Database::fetchAll(
            "SELECT m.*, u.full_name AS organizer,
                    (SELECT COUNT(*) FROM meeting_attendees a WHERE a.meeting_id = m.id) AS invitee_count,
                    (SELECT COUNT(*) FROM meeting_attendees a WHERE a.meeting_id = m.id AND a.attended = 1) AS attended_count
             FROM meetings m
             LEFT JOIN users u ON u.id = m.created_by
             WHERE " . implode(' AND ', $where) . "
             ORDER BY m.meeting_date DESC",
            $params
        );
    }

    /** Meetings a user is invited to OR organised, with their response/attendance. */
    public static function listForUser(int $userId, ?string $status): array
    {
        $statusSql = $status ? ' AND m.status = ?' : '';
        $params = [$userId /*select*/, $userId /*join*/, $userId /*where*/];
        if ($status) { $params[] = $status; }
        return Database::fetchAll(
            "SELECT m.*, u.full_name AS organizer,
                    a.response, a.attended, a.attended_at,
                    (m.created_by = ?) AS is_organizer,
                    (SELECT COUNT(*) FROM meeting_attendees x WHERE x.meeting_id = m.id) AS invitee_count,
                    (SELECT COUNT(*) FROM meeting_attendees x WHERE x.meeting_id = m.id AND x.attended = 1) AS attended_count
             FROM meetings m
             LEFT JOIN meeting_attendees a ON a.meeting_id = m.id AND a.user_id = ?
             LEFT JOIN users u ON u.id = m.created_by
             WHERE (a.id IS NOT NULL OR m.created_by = ?){$statusSql}
             ORDER BY m.meeting_date DESC",
            $params
        );
    }

    /** Attendee roster for one meeting (with names). */
    public static function attendees(int $meetingId): array
    {
        return Database::fetchAll(
            "SELECT a.user_id, a.response, a.attended, a.attended_at,
                    u.full_name, u.employee_code, u.profile_photo
             FROM meeting_attendees a
             JOIN users u ON u.id = a.user_id
             WHERE a.meeting_id = ?
             ORDER BY u.full_name",
            [$meetingId]
        );
    }

    /** Replace the invitee list for a meeting. */
    public static function setAttendees(int $meetingId, array $userIds): void
    {
        Database::run('DELETE FROM meeting_attendees WHERE meeting_id = ?', [$meetingId]);
        foreach (array_unique(array_map('intval', $userIds)) as $uid) {
            if ($uid > 0) {
                Database::run(
                    'INSERT IGNORE INTO meeting_attendees (meeting_id, user_id) VALUES (?, ?)',
                    [$meetingId, $uid]
                );
            }
        }
    }
}
