<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

/**
 * Generic active-record-lite base. Subclasses set $table and $fillable.
 */
abstract class BaseModel
{
    protected static string $table = '';
    protected static string $primaryKey = 'id';
    /** @var string[] columns allowed for mass create/update */
    protected static array $fillable = [];

    public static function find(int|string $id): ?array
    {
        return Database::fetch(
            'SELECT * FROM ' . static::$table . ' WHERE ' . static::$primaryKey . ' = ?',
            [$id]
        );
    }

    public static function all(string $orderBy = 'id DESC'): array
    {
        return Database::fetchAll('SELECT * FROM ' . static::$table . " ORDER BY {$orderBy}");
    }

    public static function create(array $data): int
    {
        $data = static::filterFillable($data);
        $cols = array_keys($data);
        $place = implode(',', array_fill(0, count($cols), '?'));
        $sql = 'INSERT INTO ' . static::$table . ' (' . implode(',', $cols) . ") VALUES ({$place})";
        return Database::insert($sql, array_values($data));
    }

    public static function update(int|string $id, array $data): void
    {
        $data = static::filterFillable($data);
        if ($data === []) {
            return;
        }
        $set = implode(',', array_map(fn($c) => "$c = ?", array_keys($data)));
        $sql = 'UPDATE ' . static::$table . " SET {$set} WHERE " . static::$primaryKey . ' = ?';
        Database::run($sql, [...array_values($data), $id]);
    }

    public static function delete(int|string $id): void
    {
        Database::run(
            'DELETE FROM ' . static::$table . ' WHERE ' . static::$primaryKey . ' = ?',
            [$id]
        );
    }

    protected static function filterFillable(array $data): array
    {
        if (static::$fillable === []) {
            return $data;
        }
        return array_intersect_key($data, array_flip(static::$fillable));
    }
}
