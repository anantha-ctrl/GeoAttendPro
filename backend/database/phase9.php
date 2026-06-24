<?php
/**
 * Phase 9 migration — multi-branch attendance.
 * Records WHICH office branch (geofence) a check-in/out matched. Idempotent.
 * Run:  php database/phase9.php
 */
declare(strict_types=1);

require dirname(__DIR__) . '/config/bootstrap.php';

use App\Core\Database;

$pdo = Database::connection();
$run = function (string $sql) use ($pdo): void {
    try { $pdo->exec($sql); echo "  OK\n"; }
    catch (\PDOException $e) { echo "  skip/err: " . substr($e->getMessage(), 0, 90) . "\n"; }
};

echo "1) attendance.branch\n";
$run("ALTER TABLE `attendance` ADD COLUMN `branch` VARCHAR(120) DEFAULT NULL AFTER `status`");

echo "2) attendance_sessions.branch\n";
$run("ALTER TABLE `attendance_sessions` ADD COLUMN `branch` VARCHAR(120) DEFAULT NULL AFTER `work_status`");

echo "Done.\n";
