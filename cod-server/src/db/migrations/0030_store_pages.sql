-- Store pages — merchant-owned content pages (Terms, Privacy, Refund, Shipping,
-- and any custom page). See report-md/LEGAL_PAGES_PLAN.md.
--
-- Why this exists: Meta Ads rejects storefronts with no policy pages, which
-- blocks Algerian COD merchants from advertising. These tables hold the pages
-- so the theme can render them without hardcoding a single word.
--
-- Additive only. No existing table is touched.

CREATE TABLE IF NOT EXISTS store_pages (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  kind TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  show_in_footer INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0,
  template_version INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_pages_slug ON store_pages(store_id, slug);

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_pages_kind ON store_pages(store_id, kind) WHERE kind <> 'custom';

CREATE INDEX IF NOT EXISTS idx_store_pages_footer ON store_pages(store_id, status, position);

CREATE TABLE IF NOT EXISTS store_page_translations (
  page_id TEXT NOT NULL REFERENCES store_pages(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  title TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_plain TEXT NOT NULL,
  meta_title TEXT,
  meta_description TEXT,
  source TEXT NOT NULL DEFAULT 'template',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (page_id, locale)
);

CREATE TABLE IF NOT EXISTS store_legal_profile (
  store_id TEXT PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  legal_name TEXT,
  rc_number TEXT,
  nif TEXT,
  address TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  return_window_days INTEGER NOT NULL DEFAULT 0,
  delivery_min_days INTEGER NOT NULL DEFAULT 2,
  delivery_max_days INTEGER NOT NULL DEFAULT 7,
  updated_at TEXT NOT NULL
);
