-- Migration: Add issuer column to accounts
-- Better Auth >= 1.7 requires `accounts.issuer` for credential-account lookup:
-- sign-in filters accounts on provider_id = 'credential' AND issuer = 'local:credential'
-- AND account_id = user id. Without the column every password sign-in 401s.
-- Backfill existing credential rows so seeded/legacy users keep working.

ALTER TABLE `accounts` ADD `issuer` text;

UPDATE `accounts`
SET `issuer` = 'local:credential'
WHERE `provider_id` = 'credential' AND `issuer` IS NULL;
