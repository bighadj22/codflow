-- Migration: 0003_product_categories_seo
-- Adds SEO metadata fields to the product_categories table.
-- All fields are nullable so existing rows are unaffected.

ALTER TABLE `product_categories` ADD `meta_title` text;--> statement-breakpoint
ALTER TABLE `product_categories` ADD `meta_description` text;--> statement-breakpoint
ALTER TABLE `product_categories` ADD `meta_keywords` text;
