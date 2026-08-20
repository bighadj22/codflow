-- Store the plaintext STORE_API_KEY on the stores row so the merchant
-- can view it in the dashboard settings (read-only). Written on every
-- provision by initClientDatabase.
ALTER TABLE `stores` ADD COLUMN `store_api_key` text;
