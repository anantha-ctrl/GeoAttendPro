<?php
/**
 * Phase 11 migration — Meetings & attendance.
 * Admin/HR schedule meetings and invite employees; employees RSVP and mark
 * attendance. Idempotent. Run:  php database/phase11.php
 */
declare(strict_types=1);

require dirname(__DIR__) . '/config/bootstrap.php';

use App\Core\Database;

$pdo = Database::connection();
$run = function (string $sql) use ($pdo): void {
    try { $pdo->exec($sql); echo "  OK\n"; }
    catch (\PDOException $e) { echo "  skip/err: " . substr($e->getMessage(), 0, 90) . "\n"; }
};

echo "1) meetings\n";
$run("CREATE TABLE IF NOT EXISTS `meetings` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title`            VARCHAR(180) NOT NULL,
  `agenda`           TEXT NULL,
  `meeting_date`     DATETIME NOT NULL,
  `duration_minutes` SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  `location`         VARCHAR(200) NULL,
  `meeting_link`     VARCHAR(500) NULL,
  `status`           ENUM('scheduled','ongoing','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  `created_by`       INT UNSIGNED NULL,
  `created_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_meeting_date` (`meeting_date`),
  CONSTRAINT `fk_meetings_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

echo "2) meeting_attendees\n";
$run("CREATE TABLE IF NOT EXISTS `meeting_attendees` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `meeting_id`  BIGINT UNSIGNED NOT NULL,
  `user_id`     INT UNSIGNED NOT NULL,
  `response`    ENUM('invited','accepted','declined') NOT NULL DEFAULT 'invited',
  `attended`    TINYINT(1) NOT NULL DEFAULT 0,
  `attended_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_meeting_user` (`meeting_id`, `user_id`),
  KEY `idx_attendee_user` (`user_id`),
  CONSTRAINT `fk_ma_meeting` FOREIGN KEY (`meeting_id`) REFERENCES `meetings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ma_user`    FOREIGN KEY (`user_id`)    REFERENCES `users` (`id`)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

echo "Done.\n";
