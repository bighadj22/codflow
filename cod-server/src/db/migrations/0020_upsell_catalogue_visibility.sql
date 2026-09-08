-- Catalogue visibility for upsell products: when disabled, products flagged
-- is_upsell are hidden from the storefront listings (they stay reachable by
-- handle so an attached offer can still link to them).
-- Defaults to 1 so existing stores keep showing every product as before.
ALTER TABLE `store_upsell_config` ADD `show_in_catalogue` integer NOT NULL DEFAULT 1;
