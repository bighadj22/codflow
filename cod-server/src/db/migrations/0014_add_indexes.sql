-- Migration: Add performance indexes for core business tables
-- CodFlow D1 optimization Slice 1 (see report-md/D1_PERFORMANCE_AUDIT.md).
--
-- D1 bills by rows read, not rows returned — these tables had zero secondary
-- indexes, so every hot query full-scanned. Shapes follow the Cloudflare
-- "Use indexes" guidance: multi-column for leftmost-prefix filter+sort pairs,
-- partial where queries only touch a stable subset.
--
-- Plain indexes only — the UNIQUE index on customers.phone is deliberately
-- NOT here (needs the duplicate-audit precondition first; Slice 3).

-- orders: dashboard list (status filter + created_at DESC sort)
CREATE INDEX IF NOT EXISTS `idx_orders_status_created` ON `orders` (`status`, `created_at` DESC);
-- orders: non-terminal partial (active board queries; skips terminal history)
CREATE INDEX IF NOT EXISTS `idx_orders_active` ON `orders` (`status`, `created_at` DESC) WHERE `status` NOT IN ('delivered', 'returned', 'cancelled');
-- orders: carrier webhook lookup by tracking number
CREATE INDEX IF NOT EXISTS `idx_orders_tracking` ON `orders` (`tracking_number`) WHERE `tracking_number` IS NOT NULL;
-- orders: customer detail (recent orders list)
CREATE INDEX IF NOT EXISTS `idx_orders_customer` ON `orders` (`customer_id`, `created_at` DESC);
-- orders: driver detail (recent orders list)
CREATE INDEX IF NOT EXISTS `idx_orders_driver` ON `orders` (`driver_id`);
-- orders: carrier reconcile paths
CREATE INDEX IF NOT EXISTS `idx_orders_company` ON `orders` (`company_id`);

-- order_products: order detail + status-change restock loops
CREATE INDEX IF NOT EXISTS `idx_order_products_order` ON `order_products` (`order_id`);
CREATE INDEX IF NOT EXISTS `idx_order_products_product` ON `order_products` (`product_id`);

-- order_status_history: order detail timeline + getAllOrders lastUpdatedBy
CREATE INDEX IF NOT EXISTS `idx_order_status_history_order_ts` ON `order_status_history` (`order_id`, `timestamp` DESC);

-- stock_movements: stock history page per product
CREATE INDEX IF NOT EXISTS `idx_stock_movements_product_created` ON `stock_movements` (`product_id`, `created_at` DESC);

-- product_variants: order creation + product detail lookups
CREATE INDEX IF NOT EXISTS `idx_product_variants_product` ON `product_variants` (`product_id`);

-- product_images: cover image + product detail galleries
CREATE INDEX IF NOT EXISTS `idx_product_images_product_position` ON `product_images` (`product_id`, `position`);

-- reviews: storefront rating aggregates + review moderation lists
CREATE INDEX IF NOT EXISTS `idx_reviews_product_status` ON `reviews` (`product_id`, `status`);

-- shipping_rules: storefront checkout fee resolution
CREATE INDEX IF NOT EXISTS `idx_shipping_rules_profile_wilaya` ON `shipping_rules` (`profile_id`, `wilaya_id`);

-- shipping_profiles: default-profile lookup per checkout
CREATE INDEX IF NOT EXISTS `idx_shipping_profiles_default` ON `shipping_profiles` (`is_default`) WHERE `is_default` = 1;

-- communes: storefront checkout commune picker
CREATE INDEX IF NOT EXISTS `idx_communes_wilaya` ON `communes` (`wilaya_id`);

-- company_shipments: label lookup in order detail
CREATE INDEX IF NOT EXISTS `idx_company_shipments_order` ON `company_shipments` (`order_id`);

-- activity_logs: audit trail filters (actor + entity)
CREATE INDEX IF NOT EXISTS `idx_activity_logs_actor_created` ON `activity_logs` (`actor_id`, `created_at` DESC);
CREATE INDEX IF NOT EXISTS `idx_activity_logs_entity_created` ON `activity_logs` (`entity_type`, `created_at` DESC);

-- drivers: duplicate-phone check
CREATE INDEX IF NOT EXISTS `idx_drivers_phone` ON `drivers` (`phone`);
