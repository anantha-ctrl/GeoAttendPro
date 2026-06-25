-- =============================================================================
--  GeoAttend Pro - Seed / Reference Data
--  Default credentials (CHANGE IN PRODUCTION):
--    Super Admin : superadmin@geoattend.test / Admin@123
--    HR / Admin  : hr@geoattend.test        / Admin@123
--    Employee    : john@geoattend.test       / Employee@123
-- =============================================================================
USE `geoattend_pro`;

-- Roles ----------------------------------------------------------------------
INSERT INTO `roles` (`id`,`name`,`slug`,`description`) VALUES
  (1,'Super Admin','super_admin','Full system control'),
  (2,'Admin / HR','admin','Manage employees, attendance, leaves, reports'),
  (3,'Employee','employee','Mark attendance, apply leave, view own data')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- Departments ----------------------------------------------------------------
INSERT INTO `departments` (`id`,`name`,`description`) VALUES
  (1,'Engineering','Software & product engineering'),
  (2,'Sales','Field sales & business development'),
  (3,'Human Resources','People operations'),
  (4,'Operations','Field operations & logistics')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- Designations ---------------------------------------------------------------
INSERT INTO `designations` (`id`,`name`,`department_id`) VALUES
  (1,'Software Engineer',1),
  (2,'Senior Engineer',1),
  (3,'Field Sales Executive',2),
  (4,'HR Manager',3),
  (5,'Operations Executive',4)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- Leave types ----------------------------------------------------------------
INSERT INTO `leave_types` (`id`,`name`,`max_days_year`) VALUES
  (1,'Casual Leave',12),
  (2,'Sick Leave',10),
  (3,'Earned Leave',12),
  (4,'Work From Home',NULL)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- Users  (password hashes are bcrypt) ---------------------------------------
INSERT INTO `users`
  (`id`,`employee_code`,`full_name`,`email`,`phone`,`password_hash`,`role_id`,`department_id`,`designation_id`,`address`,`joining_date`,`status`)
VALUES
  (1,'CLHK001','System Super Admin','superadmin@geoattend.test','9000000001',
   '$2y$10$oZEXhi4EGcj0yOo7B6EZ8.Ni7uI.yqvYrimmohlXSUZQ1RbM7zRlS',1,3,4,'HQ','2024-01-01','active'),
  (2,'CLHK002','Priya HR','hr@geoattend.test','9000000002',
   '$2y$10$oZEXhi4EGcj0yOo7B6EZ8.Ni7uI.yqvYrimmohlXSUZQ1RbM7zRlS',2,3,4,'HQ','2024-02-01','active'),
  (3,'CLHK003','John Field','john@geoattend.test','9000000003',
   '$2y$10$5T39tT5NLvJ8u6iRh.SHBuBFZ7nhvIQK2sBhzwBKoPyp3lg8X0cUe',3,2,3,'Remote','2024-03-15','active')
ON DUPLICATE KEY UPDATE `full_name`=VALUES(`full_name`);

-- Geofence (sample) ----------------------------------------------------------
INSERT INTO `geofences` (`id`,`name`,`latitude`,`longitude`,`radius_m`,`status`) VALUES
  (1,'Head Office',12.9716000,77.5946000,300,'active')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- Settings -------------------------------------------------------------------
INSERT INTO `settings` (`key_name`,`value`) VALUES
  ('work_start_time','09:30'),         -- HH:MM, used for late calculation
  ('work_end_time','18:30'),           -- HH:MM, office end; work past this earns overtime
  ('late_grace_minutes','15'),
  ('half_day_minutes','240'),          -- < 4h worked => half day
  ('full_day_minutes','480'),          -- 8h expected
  ('lates_per_deduction','3'),         -- every N lates = 1 day salary cut
  ('overtime_rate_per_hour','100'),    -- incentive paid per overtime hour
  ('overtime_min_minutes','30'),       -- ignore OT shorter than this per day
  ('session_timeout_hours','5'),
  ('geofence_enabled','0'),            -- 0 = ready but not enforced
  ('company_name','GeoAttend Pro'),
  ('mail_from','no-reply@geoattend.test')
ON DUPLICATE KEY UPDATE `value`=VALUES(`value`);
