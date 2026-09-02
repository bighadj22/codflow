-- Per-store WhatsApp OTP verification configuration (dzverify provider).
-- One row per store. No row = verification disabled (safe default).
-- Separate from `stores` — checkout verification is a distinct concern.
CREATE TABLE IF NOT EXISTS `store_otp_config` (
  `id`         text PRIMARY KEY NOT NULL,
  `store_id`   text NOT NULL UNIQUE REFERENCES `stores`(`id`) ON DELETE CASCADE,
  `api_key`    text NOT NULL,
  `language`   text NOT NULL DEFAULT 'ar',
  `enabled`    integer NOT NULL DEFAULT 1,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);