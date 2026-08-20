/**
 * setup-r2-cors.mjs
 *
 * One-time script: configures CORS on the R2 bucket so browsers can PUT
 * images directly via presigned URLs.
 *
 * Usage:
 *   CF_ACCOUNT_ID=xxx R2_ACCESS_KEY_ID=yyy R2_SECRET_ACCESS_KEY=zzz R2_BUCKET_NAME=my-bucket node scripts/setup-r2-cors.mjs
 *
 * Or edit the CONFIG block below and run:
 *   node scripts/setup-r2-cors.mjs
 *
 * Requires: @aws-sdk/client-s3 (already in package.json)
 */

import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// Values are read from env vars first. Edit the fallbacks if you prefer.
const ACCOUNT_ID       = process.env.CF_ACCOUNT_ID        ?? "";
const ACCESS_KEY_ID    = process.env.R2_ACCESS_KEY_ID     ?? "";
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? "";
const BUCKET_NAME      = process.env.R2_BUCKET_NAME       ?? "codflow-images";

// CORS: allow PUT + GET from any origin (browsers need PUT for presigned upload)
// Restrict AllowedOrigins to your specific domain in production if preferred.
const CORS_RULES = [
  {
    AllowedOrigins: ["*"],
    AllowedMethods: ["PUT", "GET", "HEAD"],
    AllowedHeaders: ["Content-Type", "Content-Length"],
    ExposeHeaders: ["ETag"],
    MaxAgeSeconds: 3600,
  },
];
// ─────────────────────────────────────────────────────────────────────────────

if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
  console.error(`
Error: Missing required credentials.

Set these environment variables before running:
  CF_ACCOUNT_ID        — your Cloudflare account ID
  R2_ACCESS_KEY_ID     — R2 API token key ID
  R2_SECRET_ACCESS_KEY — R2 API token secret
  R2_BUCKET_NAME       — bucket name (default: codflow-images)

Get R2 API tokens from:
  Cloudflare Dashboard → R2 → Manage R2 API Tokens → Create API Token
  (needs "Object Read & Write" permission for the target bucket)
`);
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

async function main() {
  console.log(`Bucket : ${BUCKET_NAME}`);
  console.log(`Account: ${ACCOUNT_ID}`);
  console.log("");

  // Apply CORS
  console.log("Applying CORS configuration…");
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: BUCKET_NAME,
      CORSConfiguration: { CORSRules: CORS_RULES },
    })
  );
  console.log("✓ CORS applied.");

  // Verify
  console.log("Verifying…");
  const verify = await s3.send(new GetBucketCorsCommand({ Bucket: BUCKET_NAME }));
  console.log("✓ CORS rules confirmed:");
  console.log(JSON.stringify(verify.CORSRules, null, 2));
  console.log("");
  console.log("Done. Browsers can now PUT images directly to this bucket via presigned URLs.");
}

main().catch((err) => {
  console.error("Failed:", err.message ?? err);
  process.exit(1);
});
