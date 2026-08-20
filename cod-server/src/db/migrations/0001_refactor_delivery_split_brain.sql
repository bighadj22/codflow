-- ─────────────────────────────────────────────────────────────────────────────
-- 0001 — Refactor delivery "split-brain" architecture.
--
-- Removes dead columns (pricing_json, profile_id on companies/drivers,
-- type on shipping_profiles, status on company_shipments), introduces a
-- dedicated driver_compensations table for per-wilaya driver payroll, makes
-- delivery_method "unassigned" by default, and adds partial-return support
-- on order_products + commune-level price overrides on shipping_rule_communes.
--
-- Data-preserving steps run first:
--   1. Create driver_compensations table.
--   2. Backfill driver_compensations from the old drivers.profile_id links
--      (uses the driver's profile's home_price as fee_per_delivery — the
--      dominant delivery mode — one row per covered wilaya).
-- Then destructive recreate-table steps drop the dead columns.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE `driver_compensations` (
	`id` text PRIMARY KEY NOT NULL,
	`driver_id` text NOT NULL,
	`wilaya_id` integer NOT NULL,
	`fee_per_delivery` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`wilaya_id`) REFERENCES `wilayas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `driver_compensations_driver_wilaya_unique` ON `driver_compensations` (`driver_id`,`wilaya_id`);--> statement-breakpoint

-- Backfill: port each driver's old profile rates into compensations rows.
-- Uses home_price as the payroll fee (the dominant delivery mode).
INSERT INTO `driver_compensations` (`id`, `driver_id`, `wilaya_id`, `fee_per_delivery`, `created_at`, `updated_at`)
SELECT
	lower(hex(randomblob(8))),
	d.id,
	sr.wilaya_id,
	sr.home_price,
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `drivers` d
JOIN `shipping_rules` sr ON sr.profile_id = d.profile_id
WHERE d.profile_id IS NOT NULL;
--> statement-breakpoint

PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_delivery_companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_ar` text NOT NULL,
	`code` text NOT NULL,
	`website` text,
	`active` integer DEFAULT true NOT NULL,
	`api_endpoint` text,
	`api_token` text,
	`api_user_guid` text,
	`supports_home_delivery` integer DEFAULT true NOT NULL,
	`supports_stop_desk` integer DEFAULT true NOT NULL,
	`supports_tracking` integer DEFAULT false NOT NULL,
	`webhook_secret` text,
	`webhook_endpoint_id` text,
	`webhook_status_mapping` text,
	`auto_validate` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_delivery_companies`("id", "name", "name_ar", "code", "website", "active", "api_endpoint", "api_token", "api_user_guid", "supports_home_delivery", "supports_stop_desk", "supports_tracking", "webhook_secret", "webhook_endpoint_id", "webhook_status_mapping", "auto_validate", "notes", "created_at", "updated_at") SELECT "id", "name", "name_ar", "code", "website", "active", "api_endpoint", "api_token", "api_user_guid", "supports_home_delivery", "supports_stop_desk", "supports_tracking", "webhook_secret", "webhook_endpoint_id", "webhook_status_mapping", "auto_validate", "notes", "created_at", "updated_at" FROM `delivery_companies`;--> statement-breakpoint
DROP TABLE `delivery_companies`;--> statement-breakpoint
ALTER TABLE `__new_delivery_companies` RENAME TO `delivery_companies`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `delivery_companies_code_unique` ON `delivery_companies` (`code`);--> statement-breakpoint

CREATE TABLE `__new_drivers` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`phone` text NOT NULL,
	`phone2` text,
	`vehicle_type` text,
	`status` text DEFAULT 'available' NOT NULL,
	`total_delivered` integer DEFAULT 0 NOT NULL,
	`total_earnings` real DEFAULT 0 NOT NULL,
	`pending_cash` real DEFAULT 0 NOT NULL,
	`total_paid` real DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_drivers`("id", "first_name", "last_name", "phone", "phone2", "vehicle_type", "status", "total_delivered", "total_earnings", "pending_cash", "total_paid", "notes", "created_at", "updated_at") SELECT "id", "first_name", "last_name", "phone", "phone2", "vehicle_type", "status", "total_delivered", "total_earnings", "pending_cash", "total_paid", "notes", "created_at", "updated_at" FROM `drivers`;--> statement-breakpoint
DROP TABLE `drivers`;--> statement-breakpoint
ALTER TABLE `__new_drivers` RENAME TO `drivers`;--> statement-breakpoint

CREATE TABLE `__new_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`customer_id` text NOT NULL,
	`customer_name` text NOT NULL,
	`phone` text NOT NULL,
	`wilaya_id` integer,
	`commune_id` text,
	`city` text,
	`address` text,
	`price` real NOT NULL,
	`notes` text,
	`status` text DEFAULT 'new' NOT NULL,
	`order_type` text DEFAULT 'online' NOT NULL,
	`delivery_method` text DEFAULT 'unassigned' NOT NULL,
	`driver_id` text,
	`company_id` text,
	`assigned_at` text,
	`assigned_by` text,
	`assignment_notes` text,
	`tracking_number` text,
	`tracking_url` text,
	`external_order_id` text,
	`delivery_type` text DEFAULT 'home' NOT NULL,
	`station_code` text,
	`delivery_fee` real DEFAULT 0 NOT NULL,
	`driver_fee` real DEFAULT 0 NOT NULL,
	`cod_amount` real DEFAULT 0 NOT NULL,
	`weight` real,
	`is_fragile` integer,
	`pickup_time` text,
	`delivery_time` text,
	`delivery_attempts` integer DEFAULT 0,
	`photos` text,
	`cod_payment_id` text,
	`fee_payment_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`wilaya_id`) REFERENCES `wilayas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`commune_id`) REFERENCES `communes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `delivery_companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

-- Migrate existing orders: anything with the old default "driver" method but no
-- driver_id and no company_id should become "unassigned" (the new default).
-- Orders with a real driver_id keep "driver"; orders dispatched via a company
-- keep "company".
INSERT INTO `__new_orders`("id", "order_number", "customer_id", "customer_name", "phone", "wilaya_id", "commune_id", "city", "address", "price", "notes", "status", "order_type", "delivery_method", "driver_id", "company_id", "assigned_at", "assigned_by", "assignment_notes", "tracking_number", "tracking_url", "external_order_id", "delivery_type", "station_code", "delivery_fee", "driver_fee", "cod_amount", "weight", "is_fragile", "pickup_time", "delivery_time", "delivery_attempts", "photos", "cod_payment_id", "fee_payment_id", "created_at", "updated_at")
SELECT
	"id", "order_number", "customer_id", "customer_name", "phone", "wilaya_id", "commune_id", "city", "address", "price", "notes", "status", "order_type",
	CASE
		WHEN "driver_id" IS NOT NULL THEN 'driver'
		WHEN "company_id" IS NOT NULL OR "tracking_number" IS NOT NULL THEN 'company'
		ELSE 'unassigned'
	END,
	"driver_id", "company_id", "assigned_at", "assigned_by", "assignment_notes", "tracking_number", "tracking_url", "external_order_id", "delivery_type", "station_code", "delivery_fee", "driver_fee", "cod_amount", "weight", "is_fragile", "pickup_time", "delivery_time", "delivery_attempts", "photos", "cod_payment_id", "fee_payment_id", "created_at", "updated_at"
FROM `orders`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `__new_orders` RENAME TO `orders`;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`order_number`);--> statement-breakpoint

ALTER TABLE `order_products` ADD `status` text DEFAULT 'fulfilled' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_products` ADD `returned_quantity` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shipping_rule_communes` ADD `home_price` real;--> statement-breakpoint
ALTER TABLE `shipping_rule_communes` ADD `stop_desk_price` real;--> statement-breakpoint
ALTER TABLE `company_shipments` DROP COLUMN `status`;--> statement-breakpoint
ALTER TABLE `shipping_profiles` DROP COLUMN `type`;
