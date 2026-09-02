#!/usr/bin/env node
/**
 * Static output guard:
 *   1. Prerendered HTML shells must never contain data patterns.
 *   2. Client bundles must never reference the legacy dashboard domain.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const CLIENT_DIR = new URL("../dist/client", import.meta.url).pathname;
const FORBIDDEN = [/ORD-\d{4,}/, /\b[1-9]\d{8,}\b/, /[\w.+-]+@[\w-]+\.[\w.]{2,}/];
const ALLOWED = /codflow\.store|example\.com|better-auth|astro\.build/i;
const LEGACY_DOMAIN = /https:\/\/app\.codflow\.store/;

let files = 0, hits = 0;

function scanFile(path, content) {
  if (path.endsWith(".html")) {
    files++;
    for (const rx of FORBIDDEN) {
      const m = content.match(rx);
      if (m && !ALLOWED.test(m[0])) {
        hits++;
        console.log(`  LEAK ${path}: matches ${rx} → "${m[0].slice(0, 40)}"`);
      }
    }
  } else if (path.endsWith(".js")) {
    if (LEGACY_DOMAIN.test(content)) {
      hits++;
      console.log(`  LEAK ${path}: client bundle references legacy dashboard domain`);
    }
  }
}

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    console.log(`  (skipping missing dir: ${dir})`);
    return;
  }
  for (const entry of entries) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else scanFile(p, readFileSync(p, "utf8"));
  }
}

walk(CLIENT_DIR);
console.log(`scan complete: ${files} html file(s), ${hits} violation(s)`);
process.exit(hits > 0 ? 1 : 0);
