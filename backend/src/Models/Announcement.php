<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

final class Announcement extends BaseModel
{
    protected static string $table = 'announcements';
    protected static array $fillable = ['title', 'body', 'pinned', 'created_by'];

    /** Latest announcements (pinned first) with author name. */
    public static function feed(int $limit = 100): array
    {
        return Database::fetchAll(
            "SELECT a.*, u.full_name AS author
             FROM announcements a LEFT JOIN users u ON u.id = a.created_by
             ORDER BY a.pinned DESC, a.created_at DESC LIMIT {$limit}"
        );
    }
}
