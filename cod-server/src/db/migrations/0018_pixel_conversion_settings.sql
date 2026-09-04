-- Tracking settings: merchant-chosen CAPI conversion event + test mode toggle.
-- conversion_event: which event the merchant optimizes for — 'Lead' (fires at
-- order placement, deduplicated with the browser pixel) or 'Purchase' (fires
-- at confirmed delivery). The dashboard requires an explicit choice before
-- enabling tracking; the column default is defensive only.
-- test_mode: when 1, CAPI events carry test_event_code to Meta's test stream.
-- ad_account_name: merchant's own reference label — never sent to Meta.
ALTER TABLE `store_pixel_config` ADD `ad_account_name` text;--> statement-breakpoint
ALTER TABLE `store_pixel_config` ADD `conversion_event` text NOT NULL DEFAULT 'Purchase';--> statement-breakpoint
ALTER TABLE `store_pixel_config` ADD `test_mode` integer NOT NULL DEFAULT 0;
