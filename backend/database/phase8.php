<?php
/**
 * Phase 8 migration — Smart Work-Tracking state machine.
 *   Working → Rest (screen off/lock/sleep) → Overtime → Logged Out
 * Adds work_status + overtime + rest/overtime markers to sessions, and an
 * attendance_events timeline table. Idempotent.  Run:  php database/phase8.php
 */
declare(strict_types=1);

require dirname(__DIR__) . '/config/bootstrap.php';

use App\Core\Database;

$pdo = Database::connection();
$run = function (string $sql) use ($pdo): void {
    try { $pdo->exec($sql); echo "  OK\n"; }
    catch (\PDOException $e) { echo "  skip/err: " . substr($e->getMessage(), 0, 90) . "\n"; }
};

echo "1) attendance_sessions.work_status\n";
$run("ALTER TABLE `attendance_sessions`
        ADD COLUMN `work_status` ENUM('working','rest','overtime','logged_out')
            NOT NULL DEFAULT 'working' AFTER `rest_seconds`");

echo "2) attendance_sessions.overtime_seconds\n";
$run("ALTER TABLE `attendance_sessions`
        ADD COLUMN `overtime_seconds` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `work_status`");

echo "3) attendance_sessions.rest_started_at\n";
$run("ALTER TABLE `attendance_sessions`
        ADD COLUMN `rest_started_at` DATETIME DEFAULT NULL AFTER `overtime_seconds`");

echo "4) attendance_sessions.overtime_started_at\n";
$run("ALTER TABLE `attendance_sessions`
        ADD COLUMN `overtime_started_at` DATETIME DEFAULT NULL AFTER `rest_started_at`");

echo "5) attendance_events timeline\n";
$run("CREATE TABLE IF NOT EXISTS `attendance_events` (
        `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        `user_id`         INT UNSIGNED NOT NULL,
        `session_id`      BIGINT UNSIGNED DEFAULT NULL,
        `attendance_date` DATE NOT NULL,
        `event_type`      ENUM('login','rest_start','rest_end','overtime_start','logout') NOT NULL,
        `event_time`      DATETIME NOT NULL,
        `note`            VARCHAR(255) DEFAULT NULL,
        `created_at`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        KEY `idx_evt_user_date` (`user_id`,`attendance_date`),
        KEY `idx_evt_session` (`session_id`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

echo "Done.\n";
