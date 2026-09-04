-- Migration: UNIQUE index on customers.phone
-- CodFlow D1 optimization Slice 3 (see report-md/D1_PERFORMANCE_AUDIT.md).
--
-- Closes the duplicate-customer race: two concurrent storefront orders from
-- the same phone used to both pass the SELECT-then-INSERT check and create
-- two customer rows (stats split between them). The UNIQUE constraint makes
-- findOrCreateCustomer's INSERT ... ON CONFLICT path the single serialized
-- entry point.
--
-- PRECONDITION (run before applying to any environment with data):
--   SELECT phone, COUNT(*) c FROM customers GROUP BY phone HAVING c > 1;
-- must return zero rows. Duplicates must be merged first, or this migration
-- fails on apply.
--
-- Also serves the frequent lookup: customers WHERE phone = ? (every
-- storefront order), which previously full-scanned.

CREATE UNIQUE INDEX IF NOT EXISTS `idx_customers_phone_unique` ON `customers` (`phone`);
