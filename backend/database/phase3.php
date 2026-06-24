<?php
/**
 * Phase 3 migration — Face verification, attendance face flags, documents.
 * Idempotent. Run:  php database/phase3.php
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

echo "1) users.face_descriptor\n";
if (!$colExists('users', 'face_descriptor')) {
    $run("ALTER TABLE `users` ADD COLUMN `face_descriptor` TEXT NULL AFTER `profile_photo`");
} else { echo "  exists\n"; }

echo "2) attendance.face_verified\n";
if (!$colExists('attendance', 'face_verified')) {
    $run("ALTER TABLE `attendance` ADD COLUMN `face_verified` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_late`");
} else { echo "  exists\n"; }

echo "3) attendance_sessions.face_verified\n";
if (!$colExists('attendance_sessions', 'face_verified')) {
    $run("ALTER TABLE `attendance_sessions` ADD COLUMN `face_verified` TINYINT(1) NOT NULL DEFAULT 0 AFTER `working_minutes`");
} else { echo "  exists\n"; }

echo "4) documents table\n";
$run("CREATE TABLE IF NOT EXISTS `documents` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`      INT UNSIGNED NOT NULL,
  `title`        VARCHAR(150) NOT NULL,
  `category`     VARCHAR(60) NOT NULL DEFAULT 'other',
  `file_path`    VARCHAR(255) NOT NULL,
  `mime`         VARCHAR(100) DEFAULT NULL,
  `size_bytes`   INT UNSIGNED DEFAULT NULL,
  `uploaded_by`  INT UNSIGNED DEFAULT NULL,
  `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_doc_user` (`user_id`),
  CONSTRAINT `fk_doc_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_doc_uploader` FOREIGN KEY (`uploaded_by`)
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

echo "Done.\n";
