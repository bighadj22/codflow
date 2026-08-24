#!/usr/bin/env node
/**
 * Seed the admin user into D1 (local and/or remote).
 *
 * Usage:
 *   node scripts/seed-admin.mjs [password]            # local only
 *   node scripts/seed-admin.mjs [password] --remote   # local + remote
 *
 * The admin email/name come from $ADMIN_EMAIL / $ADMIN_NAME (defaults to
 * admin@example.com / Admin). Set them when you run the script:
 *   ADMIN_EMAIL=you@example.com ADMIN_NAME=You node scripts/seed-admin.mjs
 *
 * Uses the same scrypt params as @better-auth/utils/password so the hash
 * is verifiable by better-auth at runtime (both Node.js and CF Workers).
 */

import { scrypt, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { writeFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const scryptAsync = promisify(scrypt);

// Must match @better-auth/utils/password config exactly
const SCRYPT = { N: 16384, r: 16, p: 1, dkLen: 64 };

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scryptAsync(
    password.normalize("NFKC"),
    salt,
    SCRYPT.dkLen,
    { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 128 * SCRYPT.N * SCRYPT.r * 2 }
  );
  return `${salt}:${key.toString("hex")}`;
}

function uid() {
  // better-auth uses nanoid-style IDs; a 32-hex is compatible with most adapters
  return randomBytes(16).toString("hex");
}

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

async function main() {
  const args = process.argv.slice(2);
  const remote = args.includes("--remote");
  const passwordArg = args.find((a) => !a.startsWith("--"));
  const password = passwordArg ?? randomBytes(12).toString("base64url");

  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const name  = process.env.ADMIN_NAME ?? "Admin";
  const now   = Date.now();

  const userId    = uid();
  const accountId = uid();
  const apiKey    = `cod_${randomBytes(16).toString("hex")}`;
  const hashedPw  = await hashPassword(password);

  // Build idempotent SQL
  // INSERT OR IGNORE so re-running doesn't fail if admin already exists.
  // UPDATE ensures api_key is always refreshed to the new value so it's shown to the admin.
  //
  // Credential accounts must match Better Auth >= 1.7 lookup semantics
  // (see better-auth/dist/api/routes/sign-in.mjs): provider_id = 'credential',
  // issuer = 'local:credential', account_id = user id (NOT the email).
  const sql = `
INSERT OR IGNORE INTO users
  (id, name, email, email_verified, role, status, api_key, created_at, updated_at)
VALUES
  ('${userId}', '${name}', '${email}', 1, 'admin', 'active', '${apiKey}', ${now}, ${now});

UPDATE users SET api_key = '${apiKey}', updated_at = ${now}
WHERE email = '${email}';

INSERT OR IGNORE INTO accounts
  (id, user_id, account_id, provider_id, issuer, password, created_at, updated_at)
SELECT '${accountId}', u.id, u.id, 'credential', 'local:credential', '${hashedPw}', ${now}, ${now}
FROM   users u
WHERE  u.email = '${email}'
  AND  NOT EXISTS (
    SELECT 1 FROM accounts a WHERE a.user_id = u.id AND a.provider_id = 'credential'
  );

UPDATE accounts SET password = '${hashedPw}', issuer = 'local:credential', account_id = user_id, updated_at = ${now}
WHERE user_id = (SELECT id FROM users WHERE email = '${email}') AND provider_id = 'credential';
`.trim();

  // Write SQL to a temp file (wrangler --file is more reliable than --command for multi-line)
  const tmpFile = join(tmpdir(), `seed-admin-${Date.now()}.sql`);
  writeFileSync(tmpFile, sql, "utf8");

  try {
    console.log("\n=== Seeding admin (local) ===");
    run(`npx wrangler d1 execute codflow-os-db --local --persist-to ../.wrangler-shared --file "${tmpFile}"`);

    if (remote) {
      console.log("\n=== Seeding admin (remote) ===");
      run(`npx wrangler d1 execute codflow-os-db --remote --file "${tmpFile}"`);
    }
  } finally {
    unlinkSync(tmpFile);
  }

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║                 Admin user seeded                       ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(`║  Email    : ${email.padEnd(44)} ║`);
  console.log(`║  Password : ${password.padEnd(44)} ║`);
  console.log(`║  API Key  : ${apiKey.padEnd(44)} ║`);
  console.log(`║  Role     : admin                                        ║`);
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("\nSave these credentials — they won't be shown again.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
