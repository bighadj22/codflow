/**
 * Unified Cloud resource values — single source of truth for CodFlow scripts.
 *
 * Reads <repo-root>/.env (gitignored) for the D1 database name, R2 bucket, KV
 * namespace IDs, and worker URLs. Every workspace imports this helper instead
 * of hardcoding resource values. Precedence: process.env > .env > default.
 *
 * Template keys live in <repo-root>/.env.example.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

const DEFAULTS = {
  COD_ACCOUNT_ID: "",
  COD_DB_NAME: "codflow-os-db",
  COD_R2_BUCKET_NAME: "codflow-images",
  COD_KV_RATE_LIMIT_ID: "",
  COD_KV_OAUTH_ID: "",
  COD_SERVER_URL: "http://localhost:8787",
  COD_MEDIA_DOMAIN: "media.example.com",
};

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function getCloudEnv() {
  let fileEnv = {};
  try {
    fileEnv = parseEnv(readFileSync(ROOT + ".env", "utf8"));
  } catch {
    // No .env file present — fall back to defaults below.
  }
  const merged = {};
  for (const key of Object.keys(DEFAULTS)) {
    const fromProcess = process.env[key];
    merged[key] = fromProcess ? fromProcess : fileEnv[key] ?? DEFAULTS[key];
  }
  return {
    accountId: merged.COD_ACCOUNT_ID,
    dbName: merged.COD_DB_NAME,
    bucketName: merged.COD_R2_BUCKET_NAME,
    rateLimitKvId: merged.COD_KV_RATE_LIMIT_ID,
    oauthKvId: merged.COD_KV_OAUTH_ID,
    serverUrl: merged.COD_SERVER_URL,
    mediaDomain: merged.COD_MEDIA_DOMAIN,
  };
}
/**
 * R2 API-token credentials for the storage scripts. Kept separate from
 * getCloudEnv() so secrets never ride along in the resource-value object.
 * Precedence: process.env > .env. Account id falls back to COD_ACCOUNT_ID.
 */
export function getR2Credentials() {
  let fileEnv = {};
  try {
    fileEnv = parseEnv(readFileSync(ROOT + ".env", "utf8"));
  } catch {
    // No .env file present — rely on process.env below.
  }
  const pick = (key) => process.env[key] || fileEnv[key] || "";
  return {
    accountId: pick("CF_ACCOUNT_ID") || pick("COD_ACCOUNT_ID"),
    accessKeyId: pick("R2_ACCESS_KEY_ID"),
    secretAccessKey: pick("R2_SECRET_ACCESS_KEY"),
  };
}
