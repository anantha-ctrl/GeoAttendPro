<?php
/**
 * Phase 6 migration — Notice Board, Expense claims, Tasks, Help-desk tickets.
 * Idempotent. Run:  php database/phase6.php
 */
declare(strict_types=1);

require dirname(__DIR__) . '/config/bootstrap.php';

use App\Core\Database;

$pdo = Database::connection();
$run = function (string $sql) use ($pdo): void {
    try { $pdo->exec($sql); echo "  OK\n"; }
    catch (\PDOException $e) { echo "  skip/err: " . substr($e->getMessage(), 0, 70) . "\n"; }
};

echo "1) announcements\n";
$run("CREATE TABLE IF NOT EXISTS `announcements` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title`      VARCHAR(180) NOT NULL,
  `body`       TEXT NOT NULL,
  `pinned`     TINYINT(1) NOT NULL DEFAULT 0,
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ann_pinned` (`pinned`),
  CONSTRAINT `fk_ann_creator` FOREIGN KEY (`created_by`)
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

echo "2) expense_claims\n";
$run("CREATE TABLE IF NOT EXISTS `expense_claims` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`       INT UNSIGNED NOT NULL,
  `title`         VARCHAR(180) NOT NULL,
  `category`      VARCHAR(60) NOT NULL DEFAULT 'Travel',
  `amount`        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `expense_date`  DATE DEFAULT NULL,
  `receipt_path`  VARCHAR(255) DEFAULT NULL,
  `notes`         VARCHAR(500) DEFAULT NULL,
  `status`        ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `reviewed_by`   INT UNSIGNED DEFAULT NULL,
  `reviewed_at`   DATETIME DEFAULT NULL,
  `admin_remarks` VARCHAR(500) DEFAULT NULL,
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_exp_user` (`user_id`),
  KEY `idx_exp_status` (`status`),
  CONSTRAINT `fk_exp_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_exp_reviewer` FOREIGN KEY (`reviewed_by`)
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

echo "3) tasks\n";
$run("CREATE TABLE IF NOT EXISTS `tasks` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title`       VARCHAR(180) NOT NULL,
  `description` VARCHAR(1000) DEFAULT NULL,
  `assigned_to` INT UNSIGNED NOT NULL,
  `assigned_by` INT UNSIGNED DEFAULT NULL,
  `due_date`    DATE DEFAULT NULL,
  `priority`    ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  `status`      ENUM('todo','in_progress','done') NOT NULL DEFAULT 'todo',
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_task_assignee` (`assigned_to`),
  KEY `idx_task_status` (`status`),
  CONSTRAINT `fk_task_assignee` FOREIGN KEY (`assigned_to`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_task_assigner` FOREIGN KEY (`assigned_by`)
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

echo "4) tickets\n";
$run("CREATE TABLE IF NOT EXISTS `tickets` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`       INT UNSIGNED NOT NULL,
  `subject`       VARCHAR(180) NOT NULL,
  `category`      VARCHAR(40) NOT NULL DEFAULT 'IT',
  `description`   VARCHAR(2000) NOT NULL,
  `priority`      ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  `status`        ENUM('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
  `assigned_to`   INT UNSIGNED DEFAULT NULL,
  `admin_remarks` VARCHAR(1000) DEFAULT NULL,
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ticket_user` (`user_id`),
  KEY `idx_ticket_status` (`status`),
  CONSTRAINT `fk_ticket_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_ticket_assignee` FOREIGN KEY (`assigned_to`)
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

echo "Done.\n";
