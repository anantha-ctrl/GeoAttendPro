<?php
/**
 * Phase 4 migration — Payroll salary + Date of birth (celebrations).
 * Idempotent. Run:  php database/phase4.php
 */
declare(strict_types=1);

require dirname(__DIR__) . '/config/bootstrap.php';

use App\Core\Database;

$pdo = Database::connection();
$run = function (string $sql) use ($pdo): void {
    try { $pdo->exec($sql); echo "  OK\n"; }
    catch (\PDOException $e) { echo "  skip/err: " . substr($e->getMessage(), 0, 70) . "\n"; }
};
$colExists = function (string $table, string $col) use ($pdo): bool {
    $n = $pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?');
    $n->execute([$table, $col]);
    return (int)$n->fetchColumn() > 0;
};

echo "1) users.monthly_salary\n";
if (!$colExists('users', 'monthly_salary')) {
    $run("ALTER TABLE `users` ADD COLUMN `monthly_salary` DECIMAL(12,2) NULL AFTER `joining_date`");
} else { echo "  exists\n"; }

echo "2) users.date_of_birth\n";
if (!$colExists('users', 'date_of_birth')) {
    $run("ALTER TABLE `users` ADD COLUMN `date_of_birth` DATE NULL AFTER `monthly_salary`");
} else { echo "  exists\n"; }

echo "Done.\n";
