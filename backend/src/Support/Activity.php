<?php

declare(strict_types=1);

namespace App\Support;

use App\Core\Database;
use App\Core\Request;

/**
 * Audit trail helpers: activity logs + login history.
 */
final class Activity
{
    public static function log(?int $userId, string $action, ?string $entity = null,
                               ?string $entityId = null, ?string $description = null,
                               ?string $ip = null): void
    {
        Database::run(
            'INSERT INTO activity_logs (user_id, action, entity, entity_id, description, ip_address)
             VALUES (?,?,?,?,?,?)',
            [$userId, $action, $entity, $entityId, $description, $ip]
        );
    }

    public static function loginSuccess(int $userId, string $email, Request $r): void
    {
        Database::run(
            'INSERT INTO login_history (user_id, email, login_at, ip_address, user_agent, status)
             VALUES (?,?,?,?,?,"success")',
            [$userId, $email, date('Y-m-d H:i:s'), $r->ip(), $r->userAgent()]
        );
    }

    public static function loginFailed(string $email, Request $r): void
    {
        Database::run(
            'INSERT INTO login_history (email, ip_address, user_agent, status)
             VALUES (?,?,?,"failed")',
            [$email, $r->ip(), $r->userAgent()]
        );
    }

    public static function logout(int $userId, Request $r): void
    {
        // Close the most recent open login row for this user
        Database::run(
            'UPDATE login_history SET logout_at = ?, status = "logout"
             WHERE user_id = ? AND logout_at IS NULL AND status = "success"
             ORDER BY id DESC LIMIT 1',
            [date('Y-m-d H:i:s'), $userId]
        );
    }

    public static function loginExpired(int $userId, Request $r): void
    {
        Database::run(
            'UPDATE login_history SET logout_at = ?, status = "expired"
             WHERE user_id = ? AND logout_at IS NULL AND status = "success"
             ORDER BY id DESC LIMIT 1',
            [date('Y-m-d H:i:s'), $userId]
        );
    }
}
