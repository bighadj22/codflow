#!/usr/bin/env node
/**
 * Build and deploy the dashboard Worker.
 *
 * `PUBLIC_API_URL` is a build-time client value: `astro:env/client` inlines it
 * into the browser bundle, so whatever is present when `astro build` runs is
 * what every shopper's browser will call forever after. Three files can supply
 * it, and the order is not the obvious one — the Cloudflare adapter pushes both
 * wrangler values and `.dev.vars` into `process.env`, and Astro reads env with
 * an empty prefix, so Vite's final `process.env` pass outranks the .env files:
 *
 *   .dev.vars  >  wrangler.toml [vars]  >  process.env  >  .env
 *
 * `.dev.vars` is local-development-only by Cloudflare's own definition, but it
 * is read during a build too. Building on a developer machine therefore baked
 * `http://localhost:8787` into production — the dashboard deployed fine and
 * then failed every API call. This script removes that trap: the dev overrides
 * are set aside for the build, and the built bundle is checked before anything
 * ships.
 *
 * Usage:
 *   npm run deploy
 *   npm run deploy -- --force-local   # deploy a loopback URL on purpose
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getCloudEnv } from "../../cod-server/scripts/cloud-env.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DEV_VARS = `${ROOT}.dev.vars`;
const DEV_VARS_PARKED = `${ROOT}.dev.vars.deploying`;
const CLIENT_DIR = `${ROOT}dist/client`;

const forceLocal = process.argv.includes("--force-local");

/** Loopback hosts a deployed Worker can never reach. */
function isLoopbackUrl(value) {
  let hostname;
  try {
    ({ hostname } = new URL(value));
  } catch {
    return false;
  }
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "[::1]" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

/** The PUBLIC_API_URL wrangler.toml publishes — the value a build will use. */
function wranglerApiUrl() {
  const toml = readFileSync(`${ROOT}wrangler.toml`, "utf8");
  return toml.match(/^\s*PUBLIC_API_URL\s*=\s*["']([^"']+)["']/m)?.[1];
}

/** Every URL `astro:env/client` inlined into the browser bundle. */
function inlinedApiUrls() {
  const files = execSync(`find ${CLIENT_DIR} -name '*.js'`, { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  const found = new Set();
  for (const file of files) {
    for (const m of readFileSync(file, "utf8").matchAll(
      /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/g,
    )) {
      found.add(m[0]);
    }
  }
  return found;
}

const apiUrl = wranglerApiUrl();
if (!apiUrl) {
  console.error(`
Error: wrangler.toml has no PUBLIC_API_URL under [vars].

That is the value the browser bundle is built with. Add it:

  [vars]
  PUBLIC_API_URL = "https://api.yourdomain.com"
`);
  process.exit(1);
}

if (isLoopbackUrl(apiUrl) && !forceLocal) {
  console.error(`
Error: wrangler.toml PUBLIC_API_URL is a local address (${apiUrl}).

A deployed dashboard cannot reach your machine, so every API call would fail.
Set the deployed cod-server origin in cod-client-astro/wrangler.toml, then:

  npm run deploy

To deploy the local value anyway (rarely what you want):

  npm run deploy -- --force-local
`);
  process.exit(1);
}

// Drift check against the repo-wide source of truth used by cod-server and
// theme01. Not fatal — a dashboard may legitimately target another origin —
// but silent disagreement between the two is worth saying out loud.
const { serverUrl } = getCloudEnv();
if (serverUrl && serverUrl !== apiUrl) {
  console.warn(
    `Warning: wrangler.toml PUBLIC_API_URL (${apiUrl}) differs from COD_SERVER_URL in the repo-root .env (${serverUrl}).`,
  );
}

const parked = existsSync(DEV_VARS);
if (parked) renameSync(DEV_VARS, DEV_VARS_PARKED);
try {
  console.log(`Building dashboard against ${apiUrl} ...`);
  execSync("npm run build", { stdio: "inherit", cwd: ROOT });
} finally {
  if (parked) renameSync(DEV_VARS_PARKED, DEV_VARS);
}

// The whole point of this script: never ship a bundle that calls localhost.
const loopbacks = inlinedApiUrls();
if (loopbacks.size > 0 && !forceLocal) {
  console.error(`
Error: the built client bundle still contains ${[...loopbacks].join(", ")}.

Something re-introduced a local value at build time. Deployment stopped — the
bundle was NOT uploaded. Check for PUBLIC_API_URL in .dev.vars or .env.
`);
  process.exit(1);
}

execSync("npx wrangler deploy", { stdio: "inherit", cwd: ROOT });
