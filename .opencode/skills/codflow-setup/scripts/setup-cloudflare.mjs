#!/usr/bin/env node
/**
 * CodFlow Cloudflare Remote Setup Script
 *
 * Automates:
 * 1. Cloudflare authentication check (wrangler whoami)
 * 2. Remote Cloudflare resource creation (D1, R2, KV)
 * 3. Configuration of wrangler.toml files (database_id, bucket_name, kv id)
 * 4. Secret generation & upload to Cloudflare (BETTER_AUTH_SECRET, STORE_API_KEY)
 * 5. Remote D1 database migration execution
 * 6. Remote admin account seeding
 *
 * Usage:
 *   node scripts/setup-cloudflare.mjs
 *   PROJECT_NAME=mystore ADMIN_EMAIL=admin@mystore.dz ADMIN_NAME="Store Admin" node scripts/setup-cloudflare.mjs
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function findRepoRoot(startDir) {
  let dir = startDir;
  while (dir !== dirname(dir)) {
    if (existsSync(resolve(dir, "cod-server")) && existsSync(resolve(dir, "cod-client"))) {
      return dir;
    }
    dir = dirname(dir);
  }
  return process.cwd();
}

const repoRoot = findRepoRoot(__dirname);

function logStep(step, message) {
  console.log(`\n\x1b[1m\x1b[36m[Step ${step}]\x1b[0m \x1b[1m${message}\x1b[0m`);
}

function logSuccess(message) {
  console.log(`  \x1b[32m✓\x1b[0m ${message}`);
}

function run(cmd, cwd = repoRoot, capture = false) {
  if (capture) {
    return execSync(cmd, { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  }
  return execSync(cmd, { cwd, stdio: "inherit" });
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║      CodFlow Cloudflare Production Automated Setup       ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  // Step 1: Check Cloudflare Authentication
  logStep(1, "Checking Cloudflare Authentication");
  try {
    const whoami = run("npx wrangler whoami", repoRoot, true);
    console.log(whoami.trim());
    logSuccess("Authenticated with Cloudflare");
  } catch (err) {
    console.error("\n❌ Cloudflare authentication required.");
    console.error("The developer must log into Cloudflare before deploying or creating resources.");
    console.error("\nTo authenticate:");
    console.error("  1. Run: npx wrangler login");
    console.error("  2. Wrangler will open a browser window for Cloudflare OAuth authorization.");
    console.error("  3. Approve the connection in the browser.");
    console.error("  4. Re-run this setup script.\n");
    process.exit(1);
  }

  const projectName = process.env.PROJECT_NAME || "codflow";
  const dbName = `${projectName}-db`;
  const bucketName = `${projectName}-images`;
  const kvName = `RATE_LIMIT_KV`;

  console.log(`\nUsing Resource Names:`);
  console.log(`  D1 Database : ${dbName}`);
  console.log(`  R2 Bucket   : ${bucketName}`);
  console.log(`  KV Namespace: ${kvName}`);

  // Step 2: Create or retrieve D1 Database
  logStep(2, `Provisioning D1 Database: ${dbName}`);
  let databaseId = "";
  try {
    const d1Output = run(`npx wrangler d1 create ${dbName}`, repoRoot, true);
    const idMatch = d1Output.match(/database_id\s*=\s*"([^"]+)"/);
    if (idMatch) {
      databaseId = idMatch[1];
      logSuccess(`Created D1 database with ID: ${databaseId}`);
    }
  } catch (err) {
    const combined = (err.stdout || "") + (err.stderr || "") + err.message;
    if (combined.includes("already exists") || combined.includes("A database with that name already exists")) {
      console.log(`  Database ${dbName} already exists. Fetching info...`);
      try {
        const listOutput = run("npx wrangler d1 list --json", repoRoot, true);
        const list = JSON.parse(listOutput);
        const found = list.find((db) => db.name === dbName);
        if (found) {
          databaseId = found.uuid;
          logSuccess(`Found existing D1 database ID: ${databaseId}`);
        }
      } catch (listErr) {
        console.warn("  Could not fetch D1 list automatically.");
      }
    } else {
      console.error("  Error creating D1:", combined);
    }
  }

  if (!databaseId) {
    console.error("\n❌ Could not resolve D1 database_id. Please check your Cloudflare dashboard.");
    process.exit(1);
  }

  // Step 3: Provision R2 Bucket
  logStep(3, `Provisioning R2 Bucket: ${bucketName}`);
  try {
    run(`npx wrangler r2 bucket create ${bucketName}`, repoRoot, true);
    logSuccess(`Created R2 bucket: ${bucketName}`);
  } catch (err) {
    const combined = (err.stdout || "") + (err.stderr || "") + err.message;
    if (combined.includes("already exists")) {
      logSuccess(`R2 bucket ${bucketName} already exists`);
    } else {
      console.warn(`\n  ⚠️  R2 Provisioning Notice: ${combined.trim()}`);
      console.warn("  ─────────────────────────────────────────────────────────────");
      console.warn("  Cloudflare requires R2 to be activated on your account.");
      console.warn("  While R2 has a generous Free Tier (10 GB storage, 1M writes,");
      console.warn("  10M reads per month), Cloudflare requires a card on file to");
      console.warn("  activate the R2 service.");
      console.warn("");
      console.warn("  To activate R2:");
      console.warn("    1. Go to https://dash.cloudflare.com → R2 Object Storage");
      console.warn("    2. Click 'Enable R2' or 'Purchase R2' (Free Tier selected)");
      console.warn("    3. After enabling, run: npx wrangler r2 bucket create " + bucketName);
      console.warn("  ─────────────────────────────────────────────────────────────\n");
    }
  }

  // Step 4: Provision KV Namespace
  logStep(4, `Provisioning KV Namespace: ${kvName}`);
  let kvId = "";
  try {
    const kvOutput = run(`npx wrangler kv namespace create ${kvName}`, repoRoot, true);
    const idMatch = kvOutput.match(/id\s*=\s*"([^"]+)"/);
    if (idMatch) {
      kvId = idMatch[1];
      logSuccess(`Created KV namespace with ID: ${kvId}`);
    }
  } catch (err) {
    const combined = (err.stdout || "") + (err.stderr || "") + err.message;
    if (combined.includes("already exists")) {
      try {
        const kvList = JSON.parse(run("npx wrangler kv namespace list", repoRoot, true));
        const found = kvList.find((kv) => kv.title && kv.title.includes(kvName));
        if (found) {
          kvId = found.id;
          logSuccess(`Found existing KV ID: ${kvId}`);
        }
      } catch (listErr) {
        console.warn("  Could not automatically resolve KV ID from list.");
      }
    } else {
      console.warn(`  KV Notice: ${combined.trim()}`);
    }
  }

  if (!kvId) {
    kvId = "00000000000000000000000000000000";
    console.warn("  ⚠️ Warning: KV ID not resolved automatically. Using placeholder.");
  }

  // Step 5: Update wrangler.toml files
  logStep(5, "Updating configuration files (wrangler.toml)");

  // 5a. cod-server/wrangler.toml
  const serverWranglerPath = resolve(repoRoot, "cod-server/wrangler.toml");
  let serverWrangler = readFileSync(serverWranglerPath, "utf8");
  serverWrangler = serverWrangler.replace(/database_name\s*=\s*"[^"]+"/, `database_name = "${dbName}"`);
  serverWrangler = serverWrangler.replace(/database_id\s*=\s*"[^"]+"/, `database_id = "${databaseId}"`);
  serverWrangler = serverWrangler.replace(/bucket_name\s*=\s*"[^"]+"/g, `bucket_name = "${bucketName}"`);
  serverWrangler = serverWrangler.replace(/R2_BUCKET_NAME\s*=\s*"[^"]+"/g, `R2_BUCKET_NAME = "${bucketName}"`);
  if (kvId !== "00000000000000000000000000000000") {
    serverWrangler = serverWrangler.replace(/id\s*=\s*"[0-9a-f]{32}"/, `id = "${kvId}"`);
  }
  writeFileSync(serverWranglerPath, serverWrangler, "utf8");
  logSuccess("Updated cod-server/wrangler.toml with D1, R2, and KV bindings");

  // 5b. cod-client/wrangler.toml
  const clientWranglerPath = resolve(repoRoot, "cod-client/wrangler.toml");
  let clientWrangler = readFileSync(clientWranglerPath, "utf8");
  clientWrangler = clientWrangler.replace(/database_name\s*=\s*"[^"]+"/, `database_name = "${dbName}"`);
  clientWrangler = clientWrangler.replace(/database_id\s*=\s*"[^"]+"/, `database_id = "${databaseId}"`);
  if (kvId !== "00000000000000000000000000000000") {
    clientWrangler = clientWrangler.replace(/id\s*=\s*"[0-9a-f]{32}"/, `id = "${kvId}"`);
  }
  writeFileSync(clientWranglerPath, clientWrangler, "utf8");
  logSuccess("Updated cod-client/wrangler.toml with D1 and KV bindings");

  // Step 6: Generate and Set Secrets
  logStep(6, "Generating and uploading production secrets");
  const betterAuthSecret = process.env.BETTER_AUTH_SECRET || randomBytes(32).toString("base64");
  const storeApiKey = process.env.STORE_API_KEY || randomBytes(16).toString("hex");

  // Put secret to cod-server
  try {
    execSync(`echo "${betterAuthSecret}" | npx wrangler secret put BETTER_AUTH_SECRET`, {
      cwd: resolve(repoRoot, "cod-server"),
      stdio: "pipe",
    });
    logSuccess("Configured BETTER_AUTH_SECRET on cod-server");
  } catch (e) {
    console.warn("  Could not put secret to cod-server:", e.message);
  }

  // Put secret to cod-client
  try {
    execSync(`echo "${betterAuthSecret}" | npx wrangler secret put BETTER_AUTH_SECRET`, {
      cwd: resolve(repoRoot, "cod-client"),
      stdio: "pipe",
    });
    logSuccess("Configured BETTER_AUTH_SECRET on cod-client");
  } catch (e) {
    console.warn("  Could not put secret to cod-client:", e.message);
  }

  // Put secret to cod-astro/theme01
  try {
    execSync(`echo "${storeApiKey}" | npx wrangler secret put STORE_API_KEY`, {
      cwd: resolve(repoRoot, "cod-astro/theme01"),
      stdio: "pipe",
    });
    logSuccess("Configured STORE_API_KEY on cod-astro/theme01");
  } catch (e) {
    console.warn("  Could not put secret to cod-astro/theme01:", e.message);
  }

  // Step 7: Apply remote D1 migrations
  logStep(7, "Applying migrations to remote D1 database");
  run("npm run db:migrate:remote", resolve(repoRoot, "cod-server"));
  logSuccess("Applied all schema migrations to remote D1");

  // Step 8: Seed remote admin account
  logStep(8, "Creating remote admin account");
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminName = process.env.ADMIN_NAME || "Admin";
  const adminPassword = process.env.ADMIN_PASSWORD || randomBytes(9).toString("base64url");

  const seedAdminRemoteCmd = `ADMIN_EMAIL="${adminEmail}" ADMIN_NAME="${adminName}" node scripts/seed-admin.mjs "${adminPassword}" --remote`;
  run(seedAdminRemoteCmd, resolve(repoRoot, "cod-client"));
  logSuccess("Seeded admin user to remote D1");

  // Step 9: Summary & Next Steps
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║         Cloudflare Resource Provisioning Complete!       ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(`║  D1 Database ID: ${databaseId.padEnd(39)} ║`);
  console.log(`║  R2 Bucket     : ${bucketName.padEnd(39)} ║`);
  console.log(`║  Admin Email   : ${adminEmail.padEnd(39)} ║`);
  console.log(`║  Admin Pass    : ${adminPassword.padEnd(39)} ║`);
  console.log(`║  Store API Key : ${storeApiKey.padEnd(39)} ║`);
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("\nTo deploy the applications to Cloudflare Workers:\n");
  console.log("  1. cd cod-server && npm run deploy");
  console.log("  2. cd cod-client && npm run deploy");
  console.log("  3. cd cod-astro/theme01 && npm run deploy\n");
}

main().catch((err) => {
  console.error("\n❌ Remote setup failed:", err.message);
  process.exit(1);
});
