/**
 * Store API key provisioning — one raw key, two artifacts.
 *
 * The storefront authenticates with the `X-Store-API-Key` header; the worker's
 * storeAuthMiddleware compares its SHA-256 digest against `store_api_keys`.
 * The merchant sees the SAME raw key under Settings → Store API Key, read from
 * `stores.store_api_key`. Migration 0007 added that column, but provisioning
 * long wrote only the digest — so the dashboard panel stayed empty while the
 * storefront worked, and no redeploy could ever fill it.
 *
 * Both artifacts must be written from the identical string, so provisioning
 * lives here and nowhere else. Node crypto is used because the seeders run
 * under node; the digest is ordinary SHA-256 hex, byte-for-byte what
 * storeAuthMiddleware computes with WebCrypto (the e2e test pins that).
 */

import { createHash } from "node:crypto";

/** SHA-256 hex digest of a raw storefront key. */
export function hashStoreApiKey(rawKey) {
  return createHash("sha256").update(rawKey).digest("hex");
}

function sqlText(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Records the digest storeAuthMiddleware checks. The row id is derived from
 * the store, so re-provisioning rotates the key in place instead of
 * accumulating rows (INSERT OR REPLACE also clears a stale digest on the
 * key_hash unique index).
 */
export function storeApiKeyHashStatement({ storeId, rawKey, ts }) {
  return (
    `INSERT OR REPLACE INTO store_api_keys (id, store_id, key_hash, name, created_at) ` +
    `VALUES (${sqlText("key-" + storeId)}, ${sqlText(storeId)}, ` +
    `${sqlText(hashStoreApiKey(rawKey))}, 'default', ${sqlText(ts)})`
  );
}

/**
 * Records the plaintext key on the store row — what the dashboard reads.
 * Display only; authentication uses the digest above. Omit `storeId` to
 * update every store row (single-tenant deployments have exactly one).
 */
export function storeApiKeyPlaintextStatement({ storeId, rawKey, ts }) {
  const where = storeId ? ` WHERE id = ${sqlText(storeId)}` : "";
  return `UPDATE stores SET store_api_key = ${sqlText(rawKey)}, updated_at = ${sqlText(ts)}${where}`;
}
