<?php

declare(strict_types=1);

namespace App\Support;

use App\Core\Auth;
use App\Core\Response;

/**
 * Role-based authorization guard. Call inside controller actions:
 *   Guard::allow(['super_admin', 'admin']);
 */
final class Guard
{
    public static function allow(array $roles): void
    {
        if (!in_array(Auth::role(), $roles, true)) {
            Response::error('You do not have permission to perform this action.', 403);
        }
    }

    public static function isAdmin(): bool
    {
        return in_array(Auth::role(), ['super_admin', 'admin'], true);
    }

    public static function isSuperAdmin(): bool
    {
        return Auth::role() === 'super_admin';
    }
}
