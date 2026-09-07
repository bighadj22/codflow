#!/usr/bin/env node
/**
 * Deploy the storefront worker with COD_SERVER_URL injected from the unified
 * root .env (COD_SERVER_URL) — see cod-server/scripts/cloud-env.mjs.
 * STORE_API_KEY is a worker secret, set separately via `wrangler secret put`.
 */

import { execSync } from "node:child_process";
import { getCloudEnv } from "../../../cod-server/scripts/cloud-env.mjs";

const { serverUrl } = getCloudEnv();
execSync(`npx wrangler deploy --var COD_SERVER_URL:${serverUrl}`, { stdio: "inherit" });