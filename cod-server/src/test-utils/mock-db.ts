/**
 * Mock D1 Database Helper
 *
 * Provides a lightweight Drizzle/D1 mock backed by a sequential response queue.
 *
 * Usage:
 *   const db = makeMockDb([ f(rowObject), a([row1, row2]), f(null) ]);
 *
 *   f(value)  — next SELECT…get() call returns this row (or null if not found)
 *   a(values) — next SELECT…all() call returns this array
 *
 * How it works:
 *   Drizzle ORM always routes reads through D1's raw() method (never first()
 *   or all()). raw() must return T[][] — an array of value-arrays, where each
 *   inner array has column values in the same order as the SELECT clause.
 *
 *   For full-table selects (db.select().from(table)), values must be in
 *   schema column definition order — which matches the property order in
 *   the row fixture helpers below (driverRow, orderRow, etc.).
 *
 *   For partial selects (db.select({ col1, col2 }).from(table)), only
 *   provide the selected columns in the same order as the select clause:
 *   f({ col1_snake: val, col2_snake: val })
 *
 *   run() calls (INSERT / UPDATE / DELETE) always succeed without consuming
 *   from the queue.
 *
 * Column names in row objects must use database column names (snake_case),
 * e.g. { first_name: "Ahmed" } which Drizzle maps to { firstName: "Ahmed" }.
 */

import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db";

export type Q =
  | { _: "f"; v: Record<string, unknown> | null }
  | { _: "a"; v: Record<string, unknown>[] };

/** Response for a .get() call — a single row or null (not found). */
export const f = (v: Record<string, unknown> | null): Q => ({ _: "f", v });

/** Response for an .all() call — an array of rows. */
export const a = (v: Record<string, unknown>[]): Q => ({ _: "a", v });

export function makeMockDb(queue: Q[] = []): AppDb {
  let idx = 0;

  function makeStmt(): D1PreparedStatement {
    const stmt: D1PreparedStatement = {
      bind: (..._args: unknown[]) => makeStmt(),

      // Drizzle D1 never calls first() or all() for standard queries —
      // it always goes through values() → raw(). These are kept for
      // type-compatibility only and do NOT consume from the queue.
      first: <T = unknown>(_colName?: string) => Promise.resolve(null as T | null),

      all: <T = unknown>() =>
        Promise.resolve({
          results: [] as T[],
          success: true,
          meta: {
            changed_db: false,
            changes: 0,
            last_row_id: 0,
            served_by: "mock",
            duration: 0,
            size_after: 0,
            rows_read: 0,
            rows_written: 0,
          },
        } as D1Result<T>),

      run: <T = Record<string, unknown>>() =>
        Promise.resolve({
          success: true,
          results: [] as unknown as T,
          meta: {
            changed_db: true,
            changes: 1,
            last_row_id: 0,
            served_by: "mock",
            duration: 0,
            size_after: 0,
            rows_read: 0,
            rows_written: 1,
          },
        } as unknown as D1Result<T>),

      // Drizzle D1 routes ALL reads (get + all) through values() → raw().
      // raw() must return T[][] — column values in the SELECT clause order.
      // Object.values(row) gives values in property insertion order, which
      // must match the Drizzle fieldsList order (schema definition order for
      // full selects, or select-clause order for partial selects).
      raw: ((..._args: unknown[]) => {
        const entry = queue[idx++];
        if (!entry) return Promise.resolve([]);
        if (entry._ === "f") {
          if (!entry.v) return Promise.resolve([]);
          return Promise.resolve([Object.values(entry.v)]);
        }
        // a() entry — map each row to a value array
        return Promise.resolve(entry.v.map((r) => Object.values(r)));
      }) as D1PreparedStatement["raw"],
    };
    return stmt;
  }

  const d1 = {
    prepare: (_sql: string) => makeStmt(),
    dump: () => Promise.resolve(new ArrayBuffer(0)),
    batch: () => Promise.resolve([] as any),
    exec: () => Promise.resolve({ count: 0, duration: 0 } as D1ExecResult),
  } as unknown as D1Database;

  return drizzle(d1, { schema }) as unknown as AppDb;
}

// ─── Row fixtures (snake_case = D1 / database column names) ──────────────────

export const NOW = "2026-01-01T00:00:00.000Z";

export function driverRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "drv_1",
    first_name: "Ahmed",
    last_name: "Benali",
    phone: "0551234567",
    phone2: null,
    vehicle_type: "motorcycle",
    status: "available",
    total_delivered: 5,
    total_earnings: 1000,
    pending_cash: 100,
    total_paid: 0,
    notes: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

export function orderRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "ord_1",
    order_number: "ORD-001",
    customer_id: "cust_1",
    customer_name: "Fatima Zahra",
    phone: "0661234567",
    wilaya_id: 16,
    commune_id: "c-16-001",
    city: null,
    address: "Rue des Lilas",
    price: 2500,
    notes: null,
    status: "ready",
    order_type: "online",
    delivery_method: "driver",
    driver_id: null,
    company_id: null,
    assigned_at: null,
    assigned_by: null,
    assignment_notes: null,
    tracking_number: null,
    tracking_url: null,
    external_order_id: null,
    delivery_type: "home",
    station_code: null,
    delivery_fee: 400,
    driver_fee: 0,
    cod_amount: 2500,
    weight: null,
    is_fragile: null,
    pickup_time: null,
    delivery_time: null,
    delivery_attempts: 0,
    photos: null,
    cod_payment_id: null,
    fee_payment_id: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

export function productRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "prod_1",
    name: "T-Shirt",
    description: null,
    handle: "t-shirt-prod_1",
    currency: "DZD",
    price: 1500,
    compare_at_price: null,
    cost_price: null,
    type: "PHYSICAL",
    has_variants: 0,
    variant_options: null,
    sku: "TS-001",
    inventory: 10,
    track_inventory: 1,
    low_stock_threshold: 5,
    category_id: null,
    tags: null,
    visibility: 1,
    status: "ACTIVE",
    show_in_store: 1,
    store_featured: 0,
    deleted_at: null,
    published_at: NOW,
    shipping_profile_id: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

export function customerRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "cust_1",
    name: "Fatima Zahra",
    phone: "0661234567",
    phone2: null,
    wilaya_id: 16,
    commune_id: null,
    wilaya: "الجزائر",
    commune: null,
    address: null,
    total_orders: 3,
    total_spent: 7500,
    created_at: NOW,
    last_order_at: NOW,
    ...overrides,
  };
}

// Schema: id, name, isDefault, notes, createdAt, updatedAt
export function shippingProfileRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "prof_1",
    name: "Standard DZ",
    is_default: 0,
    notes: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

// Schema: id, name, slug, description, parentId, imageUrl, position, createdAt, updatedAt
export function categoryRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "cat_1",
    name: "ملابس",
    slug: "malbas-cat_1",
    description: null,
    parent_id: null,
    image_url: null,
    position: 0,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

// Schema: id, productId, variations, currency, price, compareAtPrice, sku, barcode,
//         inventory, weightKg, imageId, isDefault, active, position, createdAt, updatedAt
export function variantRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "var_1",
    product_id: "prod_1",
    variations: '{"Color":"Red"}',
    currency: "DZD",
    price: 1500,
    compare_at_price: null,
    sku: null,
    barcode: null,
    inventory: 5,
    low_stock_threshold: 5,
    weight_kg: null,
    image_id: null,
    is_default: 1,
    active: 1,
    position: 1,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

// Schema: id, name, triggerProductId, triggerVariantId, triggerQuantity,
//         rewardProductId, rewardVariantId, rewardQuantity, discountType,
//         startsAt, endsAt, status, createdAt, updatedAt
export function offerRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "offer_1",
    name: "Buy 2 Get 1 Free",
    trigger_product_id: "prod_1",
    trigger_variant_id: null,
    trigger_quantity: 2,
    reward_product_id: "prod_1",
    reward_variant_id: null,
    reward_quantity: 1,
    discount_type: "free",
    starts_at: null,
    ends_at: null,
    status: "active",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

// Schema: id, name, email, emailVerified, image, role, status, apiKey, createdAt, updatedAt
export function userRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "user_1",
    name: "Ahmed Benali",
    email: "ahmed@example.com",
    email_verified: 1,
    image: null,
    role: "staff",
    status: "active",
    api_key: null,
    // timestamp_ms columns return numbers (ms since epoch), not strings
    created_at: 1735689600000,
    updated_at: 1735689600000,
    ...overrides,
  };
}

// Schema: id, name, nameAr, code, website, active, apiEndpoint, apiToken, apiUserGuid,
//         supportsHomeDelivery, supportsStopDesk, supportsTracking, notes,
//         webhookSecret, webhookEndpointId, webhookStatusMapping, createdAt, updatedAt
export function deliveryCompanyRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "co_1",
    name: "Yalidine",
    name_ar: "ياليدين",
    code: "yalidine",
    website: null,
    active: 1,
    api_endpoint: null,
    api_token: null,
    api_user_guid: null,
    supports_home_delivery: 1,
    supports_stop_desk: 1,
    supports_tracking: 0,
    notes: null,
    webhook_secret: null,
    webhook_endpoint_id: null,
    webhook_status_mapping: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}
