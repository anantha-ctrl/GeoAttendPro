<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Auth;
use App\Core\Csrf;
use App\Core\Request;
use App\Core\Response;

/**
 * Enforces CSRF token on state-changing methods. Must run AFTER AuthMiddleware
 * (it needs the resolved session id). Safe (GET/HEAD) methods are skipped.
 */
final class CsrfMiddleware
{
    public function handle(Request $request): void
    {
        if (in_array($request->method, ['GET', 'HEAD', 'OPTIONS'], true)) {
            return;
        }
        $user = Auth::user();
        if (!$user) {
            return; // AuthMiddleware will have rejected already on protected routes
        }
        if (!Csrf::verify($request, (string)$user['session_id'])) {
            Response::error('CSRF token mismatch.', 419);
        }
    }
}
