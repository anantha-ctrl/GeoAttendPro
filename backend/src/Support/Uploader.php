<?php

declare(strict_types=1);

namespace App\Support;

use App\Core\Response;

/**
 * Handles image storage for profile photos and attendance selfies.
 * Accepts either a multipart file upload or a base64 data-URI (live camera capture).
 */
final class Uploader
{
    private const ALLOWED = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    private const MAX_BYTES = 5_242_880; // 5 MB

    public static function storageDir(string $sub): string
    {
        // Stored under public/ so files are directly web-servable via .htaccess passthrough.
        $base = dirname(__DIR__, 2) . '/public/storage/uploads/' . trim($sub, '/');
        if (!is_dir($base)) {
            mkdir($base, 0775, true);
        }
        return $base;
    }

    public static function publicUrl(string $sub, string $filename): string
    {
        return '/storage/uploads/' . trim($sub, '/') . '/' . $filename;
    }

    /** Store a base64 data-URI (e.g. "data:image/jpeg;base64,....") image. */
    public static function fromBase64(string $dataUri, string $sub, string $prefix): string
    {
        if (!preg_match('#^data:(image/[a-z]+);base64,(.+)$#i', $dataUri, $m)) {
            Response::error('Invalid image data.', 422);
        }
        $mime = strtolower($m[1]);
        if (!isset(self::ALLOWED[$mime])) {
            Response::error('Unsupported image type.', 422);
        }
        $binary = base64_decode($m[2], true);
        if ($binary === false || strlen($binary) > self::MAX_BYTES) {
            Response::error('Image is invalid or too large (max 5MB).', 422);
        }
        $filename = $prefix . '_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . self::ALLOWED[$mime];
        file_put_contents(self::storageDir($sub) . '/' . $filename, $binary);
        return self::publicUrl($sub, $filename);
    }

    private const DOC_TYPES = [
        'application/pdf' => 'pdf',
        'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp',
        'application/msword' => 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
        'application/vnd.ms-excel' => 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
    ];
    private const DOC_MAX_BYTES = 10_485_760; // 10 MB

    /**
     * Store a multipart document upload (PDF/image/doc/xls). Returns
     * [public_url, mime, size_bytes].
     */
    public static function fromDocument(array $file, string $sub, string $prefix): array
    {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            Response::error('File upload failed.', 422);
        }
        if (($file['size'] ?? 0) > self::DOC_MAX_BYTES) {
            Response::error('File too large (max 10MB).', 422);
        }
        $mime = mime_content_type($file['tmp_name']) ?: '';
        if (!isset(self::DOC_TYPES[$mime])) {
            Response::error('Unsupported file type. Allowed: PDF, image, Word, Excel.', 422);
        }
        $filename = $prefix . '_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . self::DOC_TYPES[$mime];
        move_uploaded_file($file['tmp_name'], self::storageDir($sub) . '/' . $filename);
        return [self::publicUrl($sub, $filename), $mime, (int)($file['size'] ?? 0)];
    }

    /** Store a multipart uploaded file ($_FILES entry). */
    public static function fromUpload(array $file, string $sub, string $prefix): string
    {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            Response::error('File upload failed.', 422);
        }
        if ($file['size'] > self::MAX_BYTES) {
            Response::error('Image too large (max 5MB).', 422);
        }
        $mime = mime_content_type($file['tmp_name']) ?: '';
        if (!isset(self::ALLOWED[$mime])) {
            Response::error('Unsupported image type.', 422);
        }
        $filename = $prefix . '_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . self::ALLOWED[$mime];
        move_uploaded_file($file['tmp_name'], self::storageDir($sub) . '/' . $filename);
        return self::publicUrl($sub, $filename);
    }
}
