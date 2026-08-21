#!/usr/bin/env node
/**
 * CodFlow Automated Local Setup Script
 *
 * Automates:
 * 1. Dependency verification & installation order
 * 2. .dev.vars generation with cryptographic secrets
 * 3. Local D1 database migrations (shared state in .wrangler-shared)
 * 4. Sample store and product seeding
 * 5. Admin user creation
 *
 * Usage:
 *   node scripts/setup-local.mjs
 *   ADMIN_EMAIL=me@store.dz ADMIN_NAME="Store Owner" node scripts/setup-local.mjs
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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

function run(cmd, cwd = repoRoot) {
  return execSync(cmd, { cwd, stdio: "inherit" });
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║         CodFlow Local Environment Automated Setup        ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  // Step 1: Check Node & dependencies
  logStep(1, "Checking package dependencies");
  const packages = [
    { name: "cod-shared", dir: resolve(repoRoot, "cod-shared") },
    { name: "cod-server", dir: resolve(repoRoot, "cod-server") },
    { name: "cod-client", dir: resolve(repoRoot, "cod-client") },
    { name: "cod-astro/theme01", dir: resolve(repoRoot, "cod-astro/theme01") },
  ];

  for (const pkg of packages) {
    if (!existsSync(resolve(pkg.dir, "node_modules"))) {
      console.log(`  Installing dependencies in ${pkg.name}...`);
      run("npm install", pkg.dir);
      logSuccess(`Installed ${pkg.name} dependencies`);
    } else {
      logSuccess(`${pkg.name} dependencies ready`);
    }
  }

  // Step 2: Configure .dev.vars across packages
  logStep(2, "Configuring local environment files (.dev.vars)");

  // 2a. cod-server .dev.vars
  const serverDevVarsPath = resolve(repoRoot, "cod-server/.dev.vars");
  if (!existsSync(serverDevVarsPath)) {
    const serverDevVars = `# Local development secrets for cod-server
STORE_API_KEY=codflow-dev-store-key
ENVIRONMENT=development
WORKER_URL=http://localhost:8787
WORKER_SELF_URL=http://localhost:8787/
BETTER_AUTH_URL=http://localhost:3000/api/auth
MEDIA_DOMAIN=media.example.com
R2_BUCKET_NAME=codflow-images
ALLOWED_ORIGINS=*
`;
    writeFileSync(serverDevVarsPath, serverDevVars, "utf8");
    logSuccess("Created cod-server/.dev.vars");
  } else {
    logSuccess("cod-server/.dev.vars exists");
  }

  // 2b. cod-client .dev.vars
  const clientDevVarsPath = resolve(repoRoot, "cod-client/.dev.vars");
  let betterAuthSecret = randomBytes(32).toString("base64");
  if (!existsSync(clientDevVarsPath)) {
    const clientDevVars = `# Local development secrets for cod-client
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WORKER_URL=http://localhost:8787
BETTER_AUTH_SECRET=${betterAuthSecret}
`;
    writeFileSync(clientDevVarsPath, clientDevVars, "utf8");
    logSuccess("Created cod-client/.dev.vars with generated BETTER_AUTH_SECRET");
  } else {
    const existingContent = readFileSync(clientDevVarsPath, "utf8");
    const match = existingContent.match(/^BETTER_AUTH_SECRET=(.+)$/m);
    if (match && match[1].trim()) {
      betterAuthSecret = match[1].trim();
    }
    logSuccess("cod-client/.dev.vars exists");
  }

  // 2c. cod-astro/theme01 .dev.vars
  const astroDevVarsPath = resolve(repoRoot, "cod-astro/theme01/.dev.vars");
  if (!existsSync(astroDevVarsPath)) {
    const astroDevVars = `# Local development secrets for cod-astro storefront
STORE_API_KEY=codflow-dev-store-key
COD_SERVER_URL=http://localhost:8787
`;
    writeFileSync(astroDevVarsPath, astroDevVars, "utf8");
    logSuccess("Created cod-astro/theme01/.dev.vars");
  } else {
    logSuccess("cod-astro/theme01/.dev.vars exists");
  }

  // Step 3: Run local D1 migrations and seed demo store
  logStep(3, "Applying local database migrations & seeding sample products");
  run("npm run db:setup:local", resolve(repoRoot, "cod-server"));
  logSuccess("Applied migrations and seeded store-local-dev to .wrangler-shared");

  // Step 4: Seed admin user
  logStep(4, "Creating local admin account");
  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const name = process.env.ADMIN_NAME ?? "Admin";
  const password = process.env.ADMIN_PASSWORD ?? randomBytes(9).toString("base64url");

  const seedAdminCmd = `ADMIN_EMAIL="${email}" ADMIN_NAME="${name}" node scripts/seed-admin.mjs "${password}"`;
  run(seedAdminCmd, resolve(repoRoot, "cod-client"));
  logSuccess("Admin account created successfully");

  // Step 5: Summary
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║                 Local Setup Complete!                    ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log("║  Backend API   : http://localhost:8787                   ║");
  console.log("║  Swagger Docs  : http://localhost:8787/api/docs          ║");
  console.log("║  OpenAPI Spec  : http://localhost:8787/api/openapi.json  ║");
  console.log("║  Dashboard UI  : http://localhost:3000                   ║");
  console.log("║  Storefront    : http://localhost:4321                   ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(`║  Admin Email   : ${email.padEnd(39)} ║`);
  console.log(`║  Admin Pass    : ${password.padEnd(39)} ║`);
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("\nTo start all services, open three terminals:\n");
  console.log("  Terminal 1: cd cod-server && npm run dev");
  console.log("  Terminal 2: cd cod-client && npm run dev");
  console.log("  Terminal 3: cd cod-astro/theme01 && npm run dev\n");
}

main().catch((err) => {
  console.error("\n❌ Setup failed:", err.message);
  process.exit(1);
});
