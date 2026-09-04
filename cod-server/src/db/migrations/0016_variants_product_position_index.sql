-- Migration: extend product_variants index to (product_id, position)
-- CodFlow D1 optimization Slice 5 (see report-md/D1_PERFORMANCE_AUDIT.md).
--
-- The batched variant fetch for product lists orders by (product_id, position).
-- With the single-column index from 0014 that plan degenerated to a full SCAN
-- + TEMP B-TREE sort (docs' anti-pattern). The composite index serves both
-- the filter and the order. Leftmost prefix (product_id) covers every prior
-- use of the old index, so it is dropped in the same migration.

DROP INDEX IF EXISTS `idx_product_variants_product`;
CREATE INDEX IF NOT EXISTS `idx_product_variants_product_position` ON `product_variants` (`product_id`, `position`);
