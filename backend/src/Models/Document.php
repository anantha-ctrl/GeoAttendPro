<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

final class Document extends BaseModel
{
    protected static string $table = 'documents';
    protected static array $fillable = [
        'user_id', 'title', 'category', 'file_path', 'mime', 'size_bytes', 'uploaded_by',
    ];

    /** Documents for a user (or all, when $userId is null) with owner names. */
    public static function listFor(?int $userId): array
    {
        if ($userId !== null) {
            return Database::fetchAll(
                'SELECT d.*, u.full_name, u.employee_code
                 FROM documents d JOIN users u ON u.id = d.user_id
                 WHERE d.user_id = ? ORDER BY d.created_at DESC',
                [$userId]
            );
        }
        return Database::fetchAll(
            'SELECT d.*, u.full_name, u.employee_code
             FROM documents d JOIN users u ON u.id = d.user_id
             ORDER BY d.created_at DESC'
        );
    }
}
