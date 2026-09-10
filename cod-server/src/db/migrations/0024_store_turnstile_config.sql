-- Per-store Cloudflare Turnstile configuration (checkout bot protection).
-- One row per store. No row = Turnstile disabled (safe default).
-- Separate from `stores` — checkout bot protection is a distinct concern.
-- The secret key is merchant integration config (like the dzverify/Sendili
-- keys), never a worker secret. Safety at the interface: cod-shared queries
-- split safe/raw reads; the secret is never returned to a client.
CREATE TABLE IF NOT EXISTS `store_turnstile_config` (
  `id`         text PRIMARY KEY NOT NULL,
  `store_id`   text NOT NULL UNIQUE REFERENCES `stores`(`id`) ON DELETE CASCADE,
  `site_key`   text NOT NULL,
  `secret_key` text NOT NULL,
  `enabled`    integer NOT NULL DEFAULT 1,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
