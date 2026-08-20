-- Per-store Meta Pixel + Conversions API configuration.
-- One row per store. No row = tracking disabled (safe default).
-- Separate from `stores` — analytics config is a distinct concern from branding/locale.
CREATE TABLE IF NOT EXISTS `store_pixel_config` (
  `id`              text PRIMARY KEY NOT NULL,
  `store_id`        text NOT NULL UNIQUE REFERENCES `stores`(`id`) ON DELETE CASCADE,
  `pixel_id`        text NOT NULL,
  `access_token`    text NOT NULL,
  `test_event_code` text,
  `enabled`         integer NOT NULL DEFAULT 1,
  `created_at`      text NOT NULL,
  `updated_at`      text NOT NULL
);
