#!/usr/bin/env node
/**
 * Wrapper for `wrangler d1` that injects the D1 database name read from the
 * unified root .env (COD_DB_NAME) — see ./cloud-env.mjs.
 *
 * The database name lands in the correct positional slot:
 *   wrangler d1 execute <db> ...
 *   wrangler d1 migrations apply <db> ...
 *   wrangler d1 migrations list <db>
 *   wrangler d1 delete <db>
 *
 * Usage:
 *   node scripts/d1.mjs execute --remote --command "…"
 *   node scripts/d1.mjs migrations apply --local --persist-to ../.wrangler-shared
 */

import { execSync } from "node:child_process";
import { getCloudEnv } from "./cloud-env.mjs";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/d1.mjs <wrangler-d1-args…>");
  process.exit(1);
}

const { dbName } = getCloudEnv();
const parts = [...args];
const dbIndex = parts[0] === "migrations" ? 2 : 1;
parts.splice(dbIndex, 0, dbName);

const quoted = parts.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" ");
execSync(`npx wrangler d1 ${quoted}`, { stdio: "inherit" });