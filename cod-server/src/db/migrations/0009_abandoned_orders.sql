-- Migration: Add abandoned_orders table
-- Tracks storefront visitors who filled name + phone but never placed an order.

CREATE TABLE IF NOT EXISTS abandoned_orders (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  wilaya_id INTEGER REFERENCES wilayas(id),
  commune_id TEXT REFERENCES communes(id),
  wilaya_name TEXT,
  commune_name TEXT,
  product_id TEXT,
  product_name TEXT,
  variant_id TEXT,
  variant_label TEXT,
  price REAL,
  delivery_type TEXT,
  fbc TEXT,
  fbp TEXT,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  converted_order_id TEXT,
  converted_order_number TEXT,
  recovery_attempts INTEGER NOT NULL DEFAULT 0,
  last_recovery_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS abandoned_orders_status_idx ON abandoned_orders(status);
CREATE INDEX IF NOT EXISTS abandoned_orders_phone_idx ON abandoned_orders(phone);
CREATE INDEX IF NOT EXISTS abandoned_orders_created_at_idx ON abandoned_orders(created_at);
