<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;

/**
 * Rejects the request (401) unless a valid, non-expired session token is present.
 * Populates Auth::user() for downstream controllers.
 */
final class AuthMiddleware
{
    public function handle(Request $request): void
    {
        $user = Auth::authenticate($request);
        if (!$user) {
            Response::error('Unauthenticated or session expired. Please log in again.', 401);
        }
    }
}
