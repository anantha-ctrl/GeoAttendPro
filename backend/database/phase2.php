<?php
/**
 * Phase 2 migration — Shifts, Manager hierarchy, Attendance regularization.
 * Idempotent: safe to run multiple times. Run:  php database/phase2.php
 */
declare(strict_types=1);

require dirname(__DIR__) . '/config/bootstrap.php';

use App\Core\Database;

$pdo = Database::connection();
$run = function (string $sql) use ($pdo): void {
    try {
        $pdo->exec($sql);
        echo "  OK\n";
    } catch (\PDOException $e) {
        // Ignore "already exists" / "duplicate column" so the script is re-runnable.
        $msg = $e->getMessage();
        if (str_contains($msg, 'Duplicate') || str_contains($msg, 'already exists') ||
            str_contains($msg, 'check that column') || str_contains($msg, "doesn't exist") === false && str_contains($msg, '1060')) {
            echo "  skip (" . substr($msg, 0, 60) . ")\n";
        } else {
            echo "  ERR: {$msg}\n";
        }
    }
};

$colExists = function (string $table, string $col) use ($pdo): bool {
    $n = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
    );
    $n->execute([$table, $col]);
    return (int)$n->fetchColumn() > 0;
};

echo "1) shifts table\n";
$run("CREATE TABLE IF NOT EXISTS `shifts` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(80)  NOT NULL,
  `start_time`    TIME NOT NULL DEFAULT '09:30:00',
  `end_time`      TIME NOT NULL DEFAULT '18:30:00',
  `grace_minutes` SMALLINT UNSIGNED NOT NULL DEFAULT 15,
  `status`        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_shifts_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

echo "2) users.shift_id\n";
if (!$colExists('users', 'shift_id')) {
    $run("ALTER TABLE `users` ADD COLUMN `shift_id` INT UNSIGNED DEFAULT NULL AFTER `designation_id`");
    $run("ALTER TABLE `users` ADD CONSTRAINT `fk_users_shift` FOREIGN KEY (`shift_id`)
          REFERENCES `shifts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE");
} else { echo "  exists\n"; }

echo "3) users.manager_id\n";
if (!$colExists('users', 'manager_id')) {
    $run("ALTER TABLE `users` ADD COLUMN `manager_id` INT UNSIGNED DEFAULT NULL AFTER `shift_id`");
    $run("ALTER TABLE `users` ADD CONSTRAINT `fk_users_manager` FOREIGN KEY (`manager_id`)
          REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE");
} else { echo "  exists\n"; }

echo "4) regularizations table\n";
$run("CREATE TABLE IF NOT EXISTS `regularizations` (
  `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`             INT UNSIGNED NOT NULL,
  `attendance_date`     DATE NOT NULL,
  `requested_check_in`  DATETIME DEFAULT NULL,
  `requested_check_out` DATETIME DEFAULT NULL,
  `reason`              VARCHAR(500) NOT NULL,
  `status`              ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `reviewed_by`         INT UNSIGNED DEFAULT NULL,
  `reviewed_at`         DATETIME DEFAULT NULL,
  `admin_remarks`       VARCHAR(500) DEFAULT NULL,
  `created_at`          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_reg_user` (`user_id`),
  KEY `idx_reg_status` (`status`),
  CONSTRAINT `fk_reg_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_reg_reviewer` FOREIGN KEY (`reviewed_by`)
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

echo "5) seed default shifts\n";
$run("INSERT IGNORE INTO `shifts` (name, start_time, end_time, grace_minutes) VALUES
  ('General (9:30–6:30)', '09:30:00', '18:30:00', 15),
  ('Morning (6:00–2:00)', '06:00:00', '14:00:00', 10),
  ('Night (10:00 PM–6:00 AM)', '22:00:00', '06:00:00', 15)");

echo "Done.\n";
