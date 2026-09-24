-- Per-landing-page Meta Pixel + Conversions API (report-md/MULTI_PIXEL_PLAN.md).
--
-- A merchant testing eight products at once feeds all eight campaigns into one
-- pixel, so Meta's optimiser learns from a blur and no single product's numbers
-- can be read. This lets one landing page report to its own pixel instead.
--
-- Three additive changes, none of which alters behaviour on the day it lands:
--
--   1. landing_page_pixel_config — no row means "inherit the store", which is
--      every landing page that exists today.
--   2. store_pixel_config.per_page_tracking_enabled — the master switch,
--      DEFAULT 0, so every store reads as "store pixel everywhere" until a
--      merchant deliberately turns it on. This is also the rollback: one flip,
--      instantly, and every override row survives to be honoured again.
--   3. capi_event_log.pixel_id — where a server event actually went. Nullable,
--      because rows written before this genuinely do not know.
--
-- The claim index on capi_event_log stays (order_id, stage, event_name) —
-- deliberately NOT widened with pixel_id. One order has one destination; a wide
-- key would let a retry claim a second row and send the same sale to a second
-- pixel if the merchant edited the configuration in between (plan D8).

CREATE TABLE IF NOT EXISTS landing_page_pixel_config (
  id                TEXT PRIMARY KEY,
  landing_page_id   TEXT NOT NULL UNIQUE REFERENCES landing_pages(id) ON DELETE CASCADE,
  pixel_id          TEXT NOT NULL,
  ad_account_name   TEXT,
  access_token      TEXT NOT NULL,
  test_event_code   TEXT,
  conversion_event  TEXT NOT NULL DEFAULT 'Purchase',
  test_mode         INTEGER NOT NULL DEFAULT 0,
  enabled           INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);--> statement-breakpoint

ALTER TABLE `store_pixel_config` ADD COLUMN `per_page_tracking_enabled` integer NOT NULL DEFAULT 0;--> statement-breakpoint

ALTER TABLE `capi_event_log` ADD COLUMN `pixel_id` text;
