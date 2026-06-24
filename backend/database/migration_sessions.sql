-- Adds multi-session support: each check-in/check-out pair is one session row.
-- The `attendance` table remains the per-day summary (first in, last out, total minutes).
USE `geoattend_pro`;

CREATE TABLE IF NOT EXISTS `attendance_sessions` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`          INT UNSIGNED NOT NULL,
  `attendance_date`  DATE NOT NULL,
  `check_in_time`    DATETIME DEFAULT NULL,
  `check_out_time`   DATETIME DEFAULT NULL,
  `check_in_lat`     DECIMAL(10,7) DEFAULT NULL,
  `check_in_lng`     DECIMAL(10,7) DEFAULT NULL,
  `check_out_lat`    DECIMAL(10,7) DEFAULT NULL,
  `check_out_lng`    DECIMAL(10,7) DEFAULT NULL,
  `check_in_selfie`  VARCHAR(255) DEFAULT NULL,
  `check_out_selfie` VARCHAR(255) DEFAULT NULL,
  `ip_address`       VARCHAR(45) DEFAULT NULL,
  `device_info`      VARCHAR(255) DEFAULT NULL,
  `working_minutes`  INT UNSIGNED DEFAULT NULL,
  `created_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sess_user_date` (`user_id`,`attendance_date`),
  KEY `idx_sess_open` (`user_id`,`attendance_date`,`check_out_time`),
  CONSTRAINT `fk_sess_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
