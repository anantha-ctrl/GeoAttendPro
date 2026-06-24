-- =============================================================================
--  GeoAttend Pro - Smart Web-Based Employee Attendance & Workforce Tracking
--  Database Schema  |  MySQL / MariaDB 10.4+
-- -----------------------------------------------------------------------------
--  Engine : InnoDB (FK + transactions)
--  Charset: utf8mb4 (full unicode incl. emoji)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `geoattend_pro`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `geoattend_pro`;

SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. ROLES  (Super Admin / Admin-HR / Employee)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `id`          TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(50)  NOT NULL,
  `slug`        VARCHAR(50)  NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_roles_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. DEPARTMENTS
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `departments`;
CREATE TABLE `departments` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(120) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `status`      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_departments_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. DESIGNATIONS
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `designations`;
CREATE TABLE `designations` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(120) NOT NULL,
  `department_id` INT UNSIGNED DEFAULT NULL,
  `status`        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_desig_department` (`department_id`),
  CONSTRAINT `fk_desig_department` FOREIGN KEY (`department_id`)
    REFERENCES `departments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. USERS  (auth + employee identity unified)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id`                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_code`       VARCHAR(30)  NOT NULL,          -- human readable Employee ID e.g. CLHK-0001
  `full_name`           VARCHAR(150) NOT NULL,
  `email`               VARCHAR(150) NOT NULL,
  `phone`               VARCHAR(20)  DEFAULT NULL,
  `password_hash`       VARCHAR(255) NOT NULL,
  `role_id`             TINYINT UNSIGNED NOT NULL,
  `department_id`       INT UNSIGNED DEFAULT NULL,
  `designation_id`      INT UNSIGNED DEFAULT NULL,
  `address`             VARCHAR(255) DEFAULT NULL,
  `joining_date`        DATE DEFAULT NULL,
  `profile_photo`       VARCHAR(255) DEFAULT NULL,
  `status`              ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active',
  `must_change_password` TINYINT(1) NOT NULL DEFAULT 0,
  `last_login_at`       TIMESTAMP NULL DEFAULT NULL,
  `created_at`          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_empcode` (`employee_code`),
  KEY `fk_users_role` (`role_id`),
  KEY `fk_users_department` (`department_id`),
  KEY `fk_users_designation` (`designation_id`),
  KEY `idx_users_status` (`status`),
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`)
    REFERENCES `roles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_users_department` FOREIGN KEY (`department_id`)
    REFERENCES `departments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_users_designation` FOREIGN KEY (`designation_id`)
    REFERENCES `designations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. ATTENDANCE  (one row per user per day)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `attendance`;
CREATE TABLE `attendance` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`         INT UNSIGNED NOT NULL,
  `attendance_date` DATE NOT NULL,
  `check_in_time`   DATETIME DEFAULT NULL,
  `check_out_time`  DATETIME DEFAULT NULL,
  `check_in_lat`    DECIMAL(10,7) DEFAULT NULL,
  `check_in_lng`    DECIMAL(10,7) DEFAULT NULL,
  `check_out_lat`   DECIMAL(10,7) DEFAULT NULL,
  `check_out_lng`   DECIMAL(10,7) DEFAULT NULL,
  `check_in_selfie` VARCHAR(255) DEFAULT NULL,
  `check_out_selfie` VARCHAR(255) DEFAULT NULL,
  `ip_address`      VARCHAR(45) DEFAULT NULL,
  `device_info`     VARCHAR(255) DEFAULT NULL,
  `working_minutes` INT UNSIGNED DEFAULT NULL,            -- auto-calculated on check-out
  `is_late`         TINYINT(1) NOT NULL DEFAULT 0,
  `status`          ENUM('present','late','half_day','absent','leave','wfh') NOT NULL DEFAULT 'present',
  `remarks`         VARCHAR(255) DEFAULT NULL,
  `created_at`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_attendance_user_day` (`user_id`,`attendance_date`),  -- prevents duplicate check-in/day
  KEY `idx_attendance_date` (`attendance_date`),
  KEY `idx_attendance_status` (`status`),
  CONSTRAINT `fk_attendance_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. LEAVE TYPES
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `leave_types`;
CREATE TABLE `leave_types` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`           VARCHAR(80) NOT NULL,
  `max_days_year`  SMALLINT UNSIGNED DEFAULT NULL,
  `status`         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_leave_types_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. LEAVES
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `leaves`;
CREATE TABLE `leaves` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`       INT UNSIGNED NOT NULL,
  `leave_type_id` INT UNSIGNED DEFAULT NULL,
  `from_date`     DATE NOT NULL,
  `to_date`       DATE NOT NULL,
  `total_days`    SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  `reason`        VARCHAR(500) DEFAULT NULL,
  `status`        ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  `approved_by`   INT UNSIGNED DEFAULT NULL,
  `approved_at`   DATETIME DEFAULT NULL,
  `admin_remarks` VARCHAR(500) DEFAULT NULL,
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_leaves_user` (`user_id`),
  KEY `idx_leaves_status` (`status`),
  KEY `fk_leaves_type` (`leave_type_id`),
  KEY `fk_leaves_approver` (`approved_by`),
  CONSTRAINT `fk_leaves_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_leaves_type` FOREIGN KEY (`leave_type_id`)
    REFERENCES `leave_types` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_leaves_approver` FOREIGN KEY (`approved_by`)
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. GEOFENCES  (geo-fencing ready architecture)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `geofences`;
CREATE TABLE `geofences` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(120) NOT NULL,
  `latitude`    DECIMAL(10,7) NOT NULL,
  `longitude`   DECIMAL(10,7) NOT NULL,
  `radius_m`    INT UNSIGNED NOT NULL DEFAULT 200,     -- allowed radius in metres
  `status`      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 9. USER SESSIONS  (5-hour timeout + force-logout of expired sessions)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `user_sessions`;
CREATE TABLE `user_sessions` (
  `id`             CHAR(64) NOT NULL,                   -- opaque random token (sha256 hex)
  `user_id`        INT UNSIGNED NOT NULL,
  `ip_address`     VARCHAR(45) DEFAULT NULL,
  `user_agent`     VARCHAR(255) DEFAULT NULL,
  `last_activity`  DATETIME NOT NULL,
  `expires_at`     DATETIME NOT NULL,
  `created_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sessions_user` (`user_id`),
  KEY `idx_sessions_expires` (`expires_at`),
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 10. LOGIN HISTORY  (login/logout activity, IP + device tracking)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `login_history`;
CREATE TABLE `login_history` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED DEFAULT NULL,
  `email`       VARCHAR(150) DEFAULT NULL,             -- captured even on failed login
  `login_at`    DATETIME DEFAULT NULL,
  `logout_at`   DATETIME DEFAULT NULL,
  `ip_address`  VARCHAR(45) DEFAULT NULL,
  `user_agent`  VARCHAR(255) DEFAULT NULL,
  `status`      ENUM('success','failed','logout','expired') NOT NULL DEFAULT 'success',
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_login_user` (`user_id`),
  KEY `idx_login_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 11. ACTIVITY LOGS  (audit trail for all sensitive operations)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `activity_logs`;
CREATE TABLE `activity_logs` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED DEFAULT NULL,
  `action`      VARCHAR(80)  NOT NULL,                 -- e.g. employee.create
  `entity`      VARCHAR(80)  DEFAULT NULL,             -- e.g. users
  `entity_id`   VARCHAR(40)  DEFAULT NULL,
  `description` VARCHAR(500) DEFAULT NULL,
  `ip_address`  VARCHAR(45)  DEFAULT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_activity_user` (`user_id`),
  KEY `idx_activity_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 12. PASSWORD RESETS  (forgot / reset password tokens)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `password_resets`;
CREATE TABLE `password_resets` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email`       VARCHAR(150) NOT NULL,
  `token_hash`  CHAR(64) NOT NULL,                     -- sha256 of emailed token
  `expires_at`  DATETIME NOT NULL,
  `used`        TINYINT(1) NOT NULL DEFAULT 0,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pwreset_email` (`email`),
  KEY `idx_pwreset_token` (`token_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 13. NOTIFICATIONS  (in-app + email support)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED NOT NULL,
  `type`        VARCHAR(50) NOT NULL,                  -- attendance_reminder, late_alert, leave_status
  `title`       VARCHAR(150) NOT NULL,
  `message`     VARCHAR(500) NOT NULL,
  `is_read`     TINYINT(1) NOT NULL DEFAULT 0,
  `emailed`     TINYINT(1) NOT NULL DEFAULT 0,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notif_user` (`user_id`),
  KEY `idx_notif_read` (`is_read`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 14. SETTINGS  (key/value app configuration)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `settings`;
CREATE TABLE `settings` (
  `key_name`    VARCHAR(80) NOT NULL,
  `value`       VARCHAR(255) DEFAULT NULL,
  `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 15. ATTENDANCE SESSIONS  (multiple check-in/out cycles per day)
--     The `attendance` row stays the per-day summary; each row here is one session.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `attendance_sessions`;
CREATE TABLE `attendance_sessions` (
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

-- -----------------------------------------------------------------------------
-- 16. HOLIDAYS  (excluded from absent marking)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `holidays`;
CREATE TABLE `holidays` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(120) NOT NULL,
  `holiday_date` DATE NOT NULL,
  `recurring`    TINYINT(1) NOT NULL DEFAULT 0,   -- repeats yearly (month/day)
  `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_holiday_date` (`holiday_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 17. SHIFTS  (work timing templates; drive late detection per employee)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `shifts`;
CREATE TABLE `shifts` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- users.shift_id + users.manager_id (added for Phase 2; FKs below)
ALTER TABLE `users` ADD COLUMN `shift_id`   INT UNSIGNED DEFAULT NULL AFTER `designation_id`;
ALTER TABLE `users` ADD COLUMN `manager_id` INT UNSIGNED DEFAULT NULL AFTER `shift_id`;
ALTER TABLE `users` ADD CONSTRAINT `fk_users_shift`   FOREIGN KEY (`shift_id`)
  REFERENCES `shifts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `users` ADD CONSTRAINT `fk_users_manager` FOREIGN KEY (`manager_id`)
  REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 18. REGULARIZATIONS  (employee requests to correct missing/wrong attendance)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `regularizations`;
CREATE TABLE `regularizations` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 19. FACE VERIFICATION + DOCUMENTS (Phase 3)
-- -----------------------------------------------------------------------------
ALTER TABLE `users`               ADD COLUMN `face_descriptor` TEXT NULL AFTER `profile_photo`;
ALTER TABLE `attendance`          ADD COLUMN `face_verified` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_late`;
ALTER TABLE `attendance_sessions` ADD COLUMN `face_verified` TINYINT(1) NOT NULL DEFAULT 0 AFTER `working_minutes`;

-- Payroll salary + date of birth (Phase 4)
ALTER TABLE `users` ADD COLUMN `monthly_salary` DECIMAL(12,2) NULL AFTER `joining_date`;
ALTER TABLE `users` ADD COLUMN `date_of_birth`  DATE NULL AFTER `monthly_salary`;

DROP TABLE IF EXISTS `documents`;
CREATE TABLE `documents` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 20. CLIENTS / CUSTOMERS  +  PURCHASES (office expenses)  (Phase 5)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `clients`;
CREATE TABLE `clients` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(150) NOT NULL,
  `company_name`  VARCHAR(150) DEFAULT NULL,
  `email`         VARCHAR(150) DEFAULT NULL,
  `phone`         VARCHAR(20)  DEFAULT NULL,
  `address`       VARCHAR(255) DEFAULT NULL,
  `gst_number`    VARCHAR(40)  DEFAULT NULL,
  `type`          ENUM('client','customer','vendor') NOT NULL DEFAULT 'client',
  `status`        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `notes`         VARCHAR(500) DEFAULT NULL,
  `created_by`    INT UNSIGNED DEFAULT NULL,
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_clients_status` (`status`),
  KEY `idx_clients_type` (`type`),
  CONSTRAINT `fk_clients_creator` FOREIGN KEY (`created_by`)
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `purchases`;
CREATE TABLE `purchases` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `item_name`      VARCHAR(150) NOT NULL,
  `category`       VARCHAR(60)  NOT NULL DEFAULT 'Office Supplies',
  `vendor`         VARCHAR(150) DEFAULT NULL,
  `quantity`       INT UNSIGNED NOT NULL DEFAULT 1,
  `unit_price`     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total_amount`   DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `purchase_date`  DATE DEFAULT NULL,
  `payment_status` ENUM('paid','pending') NOT NULL DEFAULT 'paid',
  `invoice_no`     VARCHAR(60)  DEFAULT NULL,
  `notes`          VARCHAR(500) DEFAULT NULL,
  `created_by`     INT UNSIGNED DEFAULT NULL,
  `created_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_purchases_date` (`purchase_date`),
  KEY `idx_purchases_category` (`category`),
  KEY `idx_purchases_payment` (`payment_status`),
  CONSTRAINT `fk_purchases_creator` FOREIGN KEY (`created_by`)
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
