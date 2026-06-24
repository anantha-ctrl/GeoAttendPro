<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Models\Notification;

final class NotificationController
{
    /** GET /notifications */
    public function index(Request $request): void
    {
        Response::success([
            'items'        => Notification::forUser(Auth::id(), (int)($request->query['limit'] ?? 20)),
            'unread_count' => Notification::unreadCount(Auth::id()),
        ]);
    }

    /** PATCH /notifications/read — mark one (?id) or all as read. */
    public function markRead(Request $request): void
    {
        $id = $request->input('id');
        Notification::markRead(Auth::id(), $id ? (int)$id : null);
        Response::success(['unread_count' => Notification::unreadCount(Auth::id())], 'Marked as read.');
    }
}
