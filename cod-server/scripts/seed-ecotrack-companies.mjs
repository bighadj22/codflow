#!/usr/bin/env node
/**
 * Seed the 82 EcoTrack courier companies into D1 (delivery_companies).
 *
 * Idempotent: re-runs refresh only name / name_ar / api_endpoint — merchant
 * state (api_token, auto_validate, active, notes) is never clobbered.
 * Companies seed INACTIVE with no token; a merchant activates a courier by
 * adding their dashboard token and testing the connection.
 *
 * Usage:
 *   node scripts/seed-ecotrack-companies.mjs            # local D1 (.wrangler-shared)
 *   node scripts/seed-ecotrack-companies.mjs --remote   # remote Cloudflare D1
 *   node scripts/seed-ecotrack-companies.mjs --dry-run  # print SQL, touch nothing
 *
 * Requires Node >= 23 (native TypeScript stripping) to import the catalog.
 */

import { execSync } from "child_process";
import { writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { buildAllEcotrackCompanyUpserts } from "../src/endpoints/delivery-companies/providers/ecotrack/seed-sql.ts";
import { ECOTRACK_COURIERS } from "../../cod-shared/lib/ecotrack-couriers.ts";

const remote = process.argv.includes("--remote");
const dryRun = process.argv.includes("--dry-run");

const statements = buildAllEcotrackCompanyUpserts(ECOTRACK_COURIERS);
const sql = statements.join("\n");

if (dryRun) {
  console.log(`[seed-ecotrack] dry-run — ${statements.length} upserts, nothing executed`);
  console.log(sql);
  process.exit(0);
}

const sqlFile = join(tmpdir(), `seed-ecotrack-companies-${Date.now()}.sql`);
writeFileSync(sqlFile, sql);

const target = remote
  ? "--remote -y"
  : "--local --persist-to ../.wrangler-shared";

try {
  execSync(
    `npx wrangler d1 execute codflow-os-db ${target} --file ${sqlFile}`,
    { cwd: process.cwd(), stdio: "inherit" }
  );
  console.log(`\n[seed-ecotrack] ✓ ${statements.length} companies upserted (${remote ? "remote" : "local"} D1)`);
  console.log(`  couriers   : ${ECOTRACK_COURIERS.length} (all seeded inactive, no tokens)`);
  console.log(`  next step  : add a courier's API token, run Test-connection, then activate`);
} finally {
  rmSync(sqlFile, { force: true });
}
