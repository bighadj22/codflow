-- Per-store Sendili transactional email configuration.
-- One row per store. No row = email sending disabled (safe default).
-- Separate from `stores` — outbound email is a distinct concern.
-- The Sendili API key is merchant integration config (like carrier tokens
-- and the dzverify key): stored here, never returned to a client — reads
-- go through the safe/raw split in cod-shared/queries/email-config.ts.
CREATE TABLE IF NOT EXISTS `store_email_config` (
  `id`         text PRIMARY KEY NOT NULL,
  `store_id`   text NOT NULL UNIQUE REFERENCES `stores`(`id`) ON DELETE CASCADE,
  `api_key`    text NOT NULL,
  `from_email` text NOT NULL,
  `from_name`  text,
  `enabled`    integer NOT NULL DEFAULT 1,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
