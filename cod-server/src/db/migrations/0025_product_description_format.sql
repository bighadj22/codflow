-- Product rich-text descriptions (report-md/PRODUCT_RICH_TEXT_DESCRIPTION_PLAN.md §7).
-- description_format: 'text' = legacy, rendered as literal text;
--                     'html' = sanitised at the write chokepoint
--                     (cod-shared/queries/products.ts, HTMLRewriter allow-list
--                     in cod-shared/lib/rich-text.ts).
-- Additive only: existing rows keep their description byte-for-byte and are
-- filled with 'text', so nothing is reinterpreted as markup.
ALTER TABLE `products` ADD COLUMN `description_format` text NOT NULL DEFAULT 'text';
