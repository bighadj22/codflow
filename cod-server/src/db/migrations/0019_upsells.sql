-- Upsells feature: upsell-product flag, per-product upsell assignments,
-- per-store checkout placement config, and upsell markers on order lines.
--> statement-breakpoint
ALTER TABLE `products` ADD `is_upsell` integer NOT NULL DEFAULT 0;--> statement-breakpoint
-- Upsell assignments: product -> upsell product offers shown at checkout.
-- price / compare_at_price are integer DZD overrides; NULL = use the upsell
-- product's own price / compare_at_price. One row per (product, upsell) pair.
CREATE TABLE IF NOT EXISTS `product_upsells` (
  `id`                text PRIMARY KEY NOT NULL,
  `product_id`        text NOT NULL REFERENCES `products`(`id`) ON DELETE CASCADE,
  `upsell_product_id` text NOT NULL REFERENCES `products`(`id`) ON DELETE CASCADE,
  `price`             integer,
  `compare_at_price`  integer,
  `is_active`         integer NOT NULL DEFAULT 1,
  `position`          integer NOT NULL DEFAULT 1,
  `created_at`        text NOT NULL,
  `updated_at`        text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `product_upsells_product_id_upsell_product_id_idx`
  ON `product_upsells` (`product_id`, `upsell_product_id`);--> statement-breakpoint
-- Per-store upsell checkout placement. One row per store; no row = disabled.
CREATE TABLE IF NOT EXISTS `store_upsell_config` (
  `id`                     text PRIMARY KEY NOT NULL,
  `store_id`               text NOT NULL UNIQUE REFERENCES `stores`(`id`) ON DELETE CASCADE,
  `show_in_inline_checkout` integer NOT NULL DEFAULT 1,
  `show_in_confirm_modal`   integer NOT NULL DEFAULT 1,
  `created_at`             text NOT NULL,
  `updated_at`             text NOT NULL
);--> statement-breakpoint
-- Upsell markers on order lines (self-reference groups upsell lines under
-- their parent line).
ALTER TABLE `order_products` ADD `is_upsell` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `order_products` ADD `upsell_of_id` text REFERENCES `order_products`(`id`) ON DELETE SET NULL;