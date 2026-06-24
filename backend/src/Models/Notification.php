<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;
use App\Support\Mailer;

final class Notification extends BaseModel
{
    protected static string $table = 'notifications';
    protected static array $fillable = ['user_id', 'type', 'title', 'message', 'is_read', 'emailed'];

    /** Create an in-app notification and optionally email it. */
    public static function push(int $userId, string $type, string $title, string $message, bool $email = false): int
    {
        $id = self::create([
            'user_id' => $userId, 'type' => $type, 'title' => $title,
            'message' => $message, 'emailed' => $email ? 1 : 0,
        ]);

        if ($email) {
            $user = User::find($userId);
            if ($user) {
                Mailer::send($user['email'], $title, "<p>{$message}</p>");
            }
        }
        return $id;
    }

    public static function forUser(int $userId, int $limit = 20): array
    {
        return Database::fetchAll(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
            [$userId, $limit]
        );
    }

    public static function unreadCount(int $userId): int
    {
        return (int)Database::scalar(
            'SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0',
            [$userId]
        );
    }

    public static function markRead(int $userId, ?int $id = null): void
    {
        if ($id) {
            Database::run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [$id, $userId]);
        } else {
            Database::run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [$userId]);
        }
    }
}
