<?php
/**
 * Phase 10 migration — work summary at check-out.
 * Employees describe what they worked on before checking out. Idempotent.
 * Run:  php database/phase10.php
 */
declare(strict_types=1);

require dirname(__DIR__) . '/config/bootstrap.php';

use App\Core\Database;

$pdo = Database::connection();
$run = function (string $sql) use ($pdo): void {
    try { $pdo->exec($sql); echo "  OK\n"; }
    catch (\PDOException $e) { echo "  skip/err: " . substr($e->getMessage(), 0, 90) . "\n"; }
};

echo "1) attendance_sessions.work_note\n";
$run("ALTER TABLE `attendance_sessions` ADD COLUMN `work_note` VARCHAR(2000) DEFAULT NULL AFTER `branch`");

echo "Done.\n";
