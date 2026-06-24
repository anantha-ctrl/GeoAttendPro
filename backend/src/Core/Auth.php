<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Token-based session manager backed by the `user_sessions` table.
 *
 * - On login a 64-char opaque token is generated and stored with an expiry of
 *   SESSION_TIMEOUT_HOURS (default 5h).
 * - Every authenticated request slides `last_activity` forward but the hard
 *   `expires_at` cap is preserved; expired rows are deleted (auto-logout).
 */
final class Auth
{
    private static ?array $user = null;

    /** Create a new session and return its token. */
    public static function startSession(int $userId, Request $request): string
    {
        $token   = bin2hex(random_bytes(32));            // 64 hex chars
        $hours   = (int)(env('SESSION_TIMEOUT_HOURS', 5));
        $now     = date('Y-m-d H:i:s');
        $expires = date('Y-m-d H:i:s', time() + $hours * 3600);

        Database::run(
            'INSERT INTO user_sessions (id, user_id, ip_address, user_agent, last_activity, expires_at)
             VALUES (?,?,?,?,?,?)',
            [$token, $userId, $request->ip(), $request->userAgent(), $now, $expires]
        );

        return $token;
    }

    /**
     * Resolve the authenticated user from the request token, or null.
     * Side-effect: deletes the session row if expired (forced logout).
     */
    public static function authenticate(Request $request): ?array
    {
        $token = $request->bearerToken();
        if (!$token) {
            return null;
        }

        $session = Database::fetch(
            'SELECT * FROM user_sessions WHERE id = ?',
            [$token]
        );
        if (!$session) {
            return null;
        }

        // Hard expiry check -> auto logout
        if (strtotime($session['expires_at']) < time()) {
            self::destroy($token);
            \App\Support\Activity::loginExpired((int)$session['user_id'], $request);
            return null;
        }

        // Slide activity window
        Database::run(
            'UPDATE user_sessions SET last_activity = ? WHERE id = ?',
            [date('Y-m-d H:i:s'), $token]
        );

        $user = Database::fetch(
            'SELECT u.*, r.slug AS role_slug, r.name AS role_name,
                    d.name AS department_name, dg.name AS designation_name,
                    s.name AS shift_name, m.full_name AS manager_name,
                    (SELECT COUNT(*) FROM users sub WHERE sub.manager_id = u.id) AS subordinate_count
             FROM users u
             JOIN roles r ON r.id = u.role_id
             LEFT JOIN departments d ON d.id = u.department_id
             LEFT JOIN designations dg ON dg.id = u.designation_id
             LEFT JOIN shifts s ON s.id = u.shift_id
             LEFT JOIN users m ON m.id = u.manager_id
             WHERE u.id = ? AND u.status = "active"',
            [$session['user_id']]
        );

        if ($user) {
            $user['session_id'] = $token;
            self::$user = $user;
        }
        return $user;
    }

    public static function user(): ?array
    {
        return self::$user;
    }

    public static function id(): ?int
    {
        return self::$user ? (int)self::$user['id'] : null;
    }

    public static function role(): ?string
    {
        return self::$user['role_slug'] ?? null;
    }

    public static function destroy(string $token): void
    {
        Database::run('DELETE FROM user_sessions WHERE id = ?', [$token]);
    }

    /** Housekeeping: purge all expired sessions (call from cron). */
    public static function purgeExpired(): int
    {
        $stmt = Database::run('DELETE FROM user_sessions WHERE expires_at < NOW()');
        return $stmt->rowCount();
    }
}
