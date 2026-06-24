<?php
/**
 * Phase 7 migration — Active vs Rest time tracking.
 * Adds rest_seconds (laptop sleep / screen-off / tab-hidden time) to
 * the daily attendance summary and to each session. Idempotent.
 * Run:  php database/phase7.php
 */
declare(strict_types=1);

require dirname(__DIR__) . '/config/bootstrap.php';

use App\Core\Database;

$pdo = Database::connection();
$run = function (string $sql) use ($pdo): void {
    try { $pdo->exec($sql); echo "  OK\n"; }
    catch (\PDOException $e) { echo "  skip/err: " . substr($e->getMessage(), 0, 80) . "\n"; }
};

echo "1) attendance.rest_seconds\n";
$run("ALTER TABLE `attendance` ADD COLUMN `rest_seconds` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `working_minutes`");

echo "2) attendance_sessions.rest_seconds\n";
$run("ALTER TABLE `attendance_sessions` ADD COLUMN `rest_seconds` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `working_minutes`");

echo "Done.\n";
