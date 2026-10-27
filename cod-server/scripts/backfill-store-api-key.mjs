/**
 * Backfill the merchant-visible plaintext store API key on existing stores.
 *
 * Migration 0007 added `stores.store_api_key`, but earlier provisioning wrote
 * only the digest into `store_api_keys`, so the dashboard's Store API Key
 * panel reads null — and no redeploy can fix it, because the worker only holds
 * the irreversible digest. This fills the plaintext from the SAME raw key the
 * storefront already authenticates with (`STORE_API_KEY`), touching nothing
 * else on the row. It does NOT re-run the demo seed, which would overwrite the
 * merchant's settings, products and orders.
 *
 * Safety: it refuses to write unless the raw key's digest already appears in
 * `store_api_keys`. A key that does not match the stored digest would show a
 * credential in the dashboard that the storefront rejects — worse than an
 * empty panel, because the merchant would copy a broken key.
 *
 * Usage:
 *   node scripts/backfill-store-api-key.mjs            # local D1
 *   node scripts/backfill-store-api-key.mjs --remote   # remote Cloudflare D1
 *
 * Reads STORE_API_KEY from $STORE_API_KEY or cod-astro/theme01/.dev.vars.
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { getCloudEnv } from "./cloud-env.mjs";
import { hashStoreApiKey, storeApiKeyPlaintextStatement } from "./lib/store-key.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const remote = process.argv.includes("--remote");
const { dbName } = getCloudEnv();

function resolveRawKey() {
  if (process.env.STORE_API_KEY) return process.env.STORE_API_KEY;
  try {
    const content = readFileSync(path.resolve(root, "../cod-astro/theme01/.dev.vars"), "utf8");
    const match = content.match(/^STORE_API_KEY=(.+)$/m);
    if (match) return match[1].trim();
  } catch { /* fall through */ }
  return null;
}

function d1(sql, { json = false } = {}) {
  const target = remote ? "--remote -y" : "--local --persist-to ../.wrangler-shared";
  return execSync(
    `npx wrangler d1 execute ${dbName} ${target}${json ? " --json" : ""} --command "${sql.replace(/"/g, '\\"')}"`,
    { cwd: root, stdio: "pipe" }
  ).toString();
}

function parseRows(stdout) {
  const start = stdout.indexOf("[");
  const end = stdout.lastIndexOf("]");
  const parsed = JSON.parse(stdout.slice(start, end + 1));
  const entries = Array.isArray(parsed) ? parsed : [parsed];
  return entries.flatMap((entry) => entry.results ?? []);
}

const rawKey = resolveRawKey();
if (!rawKey) {
  console.error("[backfill-store-key] STORE_API_KEY not found (env or cod-astro/theme01/.dev.vars).");
  console.error("                     Set it to the exact key the storefront uses, then re-run.");
  process.exit(1);
}

const where = remote ? `remote D1 (${dbName})` : "local D1 (.wrangler-shared)";

// Read-only pre-check: the key we hold must be the key this store already
// trusts. `key_hash` is a digest — nothing secret leaves the database.
let rows;
try {
  rows = parseRows(d1("SELECT key_hash FROM store_api_keys", { json: true }));
} catch (err) {
  console.error("[backfill-store-key] ✗ Could not read store_api_keys to verify the key.");
  console.error("  " + (err.stderr?.toString().split("\n").pop() ?? err.message));
  process.exit(1);
}

if (!rows.some((row) => row.key_hash === hashStoreApiKey(rawKey))) {
  console.error("[backfill-store-key] ✗ Refusing to write: STORE_API_KEY does not match this store's current key.");
  console.error(`                     store_api_keys holds ${rows.length} row(s); none matches the digest of the key`);
  console.error("                     from env/.dev.vars. Set STORE_API_KEY to the exact storefront key, then re-run.");
  process.exit(1);
}

// No storeId → updates every store row; single-tenant deployments have one.
const statement = storeApiKeyPlaintextStatement({ rawKey, ts: new Date().toISOString() });

try {
  d1(statement);
} catch (err) {
  console.error("[backfill-store-key] ✗ Backfill failed.");
  console.error("  " + (err.stderr?.toString().split("\n").pop() ?? err.message));
  process.exit(1);
}

console.log(`[backfill-store-key] ✓ stores.store_api_key written on ${where} (value not printed)`);
