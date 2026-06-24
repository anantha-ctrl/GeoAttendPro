<?php
/**
 * CLI migration + seed runner.
 *   php console/migrate.php          # schema + seed
 *   php console/migrate.php --fresh  # same (schema uses DROP TABLE)
 *   php console/migrate.php --schema # schema only
 */

declare(strict_types=1);

require dirname(__DIR__) . '/config/bootstrap.php';

use App\Core\Database;

$args      = $argv ?? [];
$schemaOnly = in_array('--schema', $args, true);

function runSqlFile(PDO $pdo, string $file): void
{
    if (!is_file($file)) {
        fwrite(STDERR, "Missing SQL file: {$file}\n");
        exit(1);
    }
    $sql = file_get_contents($file);
    $pdo->exec($sql);
    echo "  applied " . basename($file) . "\n";
}

// Connect WITHOUT a database first so schema.sql can CREATE DATABASE.
$host = env('DB_HOST', '127.0.0.1');
$port = env('DB_PORT', '3306');
$user = env('DB_USER', 'root');
$pass = (string)env('DB_PASS', 'anantha');
$rootPdo = new PDO("mysql:host={$host};port={$port};charset=utf8mb4", $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
]);

echo "Running migrations...\n";
runSqlFile($rootPdo, dirname(__DIR__) . '/database/schema.sql');

if (!$schemaOnly) {
    // seed uses USE geoattend_pro; reuse connection
    runSqlFile($rootPdo, dirname(__DIR__) . '/database/seed.sql');
}

echo "Done. Default logins:\n";
echo "  Super Admin : superadmin@geoattend.test / Admin@123\n";
echo "  HR / Admin  : hr@geoattend.test         / Admin@123\n";
echo "  Employee    : john@geoattend.test       / Employee@123\n";
