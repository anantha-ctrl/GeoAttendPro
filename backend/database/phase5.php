<?php
/**
 * Phase 5 migration — Client/Customer management + Purchases (office expenses).
 * Idempotent. Run:  php database/phase5.php
 */
declare(strict_types=1);

require dirname(__DIR__) . '/config/bootstrap.php';

use App\Core\Database;

$pdo = Database::connection();
$run = function (string $sql) use ($pdo): void {
    try { $pdo->exec($sql); echo "  OK\n"; }
    catch (\PDOException $e) { echo "  skip/err: " . substr($e->getMessage(), 0, 70) . "\n"; }
};

echo "1) clients table\n";
$run("CREATE TABLE IF NOT EXISTS `clients` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(150) NOT NULL,            -- contact person
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

echo "2) purchases table\n";
$run("CREATE TABLE IF NOT EXISTS `purchases` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

echo "Done.\n";
