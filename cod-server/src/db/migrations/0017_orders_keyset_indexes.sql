-- Migration: keyset pagination + deterministic ordering indexes for orders
-- CodFlow D1 optimization Slice 9 (see report-md/D1_PERFORMANCE_AUDIT.md).
--
-- The default (unfiltered) orders list previously full-scanned + sorted
-- (EXPLAIN: SCAN orders | USE TEMP B-TREE FOR ORDER BY). The new
-- (created_at DESC, id DESC) composite serves the unfiltered sort AND the
-- keyset row-value predicate `(created_at, id) < (?, ?)` — verified by
-- EXPLAIN after apply.
--
-- The id tie-breaker makes pagination deterministic for same-timestamp
-- rows (offset pagination could skip/duplicate them). Extending the status
-- composite keeps the filtered path sort-free — with the old two-column
-- index, ORDER BY ... , id DESC degraded to
-- "USE TEMP B-TREE FOR LAST TERM OF ORDER BY". Leftmost prefixes are
-- preserved, so every prior use of the old index stays covered.

CREATE INDEX IF NOT EXISTS `idx_orders_created_id` ON `orders` (`created_at` DESC, `id` DESC);

DROP INDEX IF EXISTS `idx_orders_status_created`;
CREATE INDEX IF NOT EXISTS `idx_orders_status_created_id` ON `orders` (`status`, `created_at` DESC, `id` DESC);
