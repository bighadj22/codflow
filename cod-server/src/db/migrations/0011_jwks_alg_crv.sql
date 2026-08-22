-- Migration: Add alg and crv columns to jwkss
-- Better Auth >= 1.7's jwt() plugin stores the signing algorithm (and EC curve)
-- per JWK. get-session mints JWTs through this table; without the columns
-- every authenticated request fails with
--   BetterAuthError: The field "alg" does not exist in the "jwkss" Drizzle schema.

ALTER TABLE `jwkss` ADD `alg` text;
ALTER TABLE `jwkss` ADD `crv` text;
