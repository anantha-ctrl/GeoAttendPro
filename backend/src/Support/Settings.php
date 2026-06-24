<?php

declare(strict_types=1);

namespace App\Support;

use App\Core\Database;

/**
 * Cached access to the `settings` key/value table.
 */
final class Settings
{
    private static ?array $cache = null;

    private static function load(): array
    {
        if (self::$cache === null) {
            self::$cache = [];
            foreach (Database::fetchAll('SELECT key_name, value FROM settings') as $row) {
                self::$cache[$row['key_name']] = $row['value'];
            }
        }
        return self::$cache;
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        return self::load()[$key] ?? $default;
    }

    public static function all(): array
    {
        return self::load();
    }

    public static function set(string $key, string $value): void
    {
        Database::run(
            'INSERT INTO settings (key_name, value) VALUES (?,?)
             ON DUPLICATE KEY UPDATE value = VALUES(value)',
            [$key, $value]
        );
        self::$cache[$key] = $value;
    }
}
