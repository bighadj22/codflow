-- Capture browser tracking values at order placement for CAPI attribution.
-- Must be stored on the order because the browser session is gone at delivery time.
ALTER TABLE `orders` ADD `fbc` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `fbp` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `ip_address` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `user_agent` text;
