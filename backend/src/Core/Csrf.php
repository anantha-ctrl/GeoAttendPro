<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Double-submit-cookie CSRF protection.
 *
 * On authentication a CSRF token is issued and returned to the SPA. For every
 * state-changing request (POST/PUT/PATCH/DELETE) the SPA must echo the token
 * back in the `X-CSRF-Token` header. The token is bound to the session token,
 * so it cannot be forged from another origin.
 */
final class Csrf
{
    /** Derive the CSRF token deterministically from the session id + app secret. */
    public static function tokenFor(string $sessionId): string
    {
        return hash_hmac('sha256', $sessionId, self::secret());
    }

    public static function verify(Request $request, string $sessionId): bool
    {
        $sent = $request->header('X-CSRF-Token') ?? (string)$request->input('_csrf', '');
        $expected = self::tokenFor($sessionId);
        return $sent !== '' && hash_equals($expected, $sent);
    }

    private static function secret(): string
    {
        return (string)(env('APP_SECRET') ?? 'geoattend-pro-static-secret-change-me');
    }
}
