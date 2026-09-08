#!/usr/bin/env node
/**
 * setup-r2.mjs
 *
 * Initializes the R2 images bucket end to end: creates it when missing,
 * applies the CORS rules from ./r2-cors.json (browsers PUT straight to R2 via
 * presigned URLs), and verifies the result.
 *
 * Credentials and resource values both come from the unified root .env — see
 * ./cloud-env.mjs. Nothing has to be typed by hand.
 *
 *   R2_ACCESS_KEY_ID     — R2 API token key id
 *   R2_SECRET_ACCESS_KEY — R2 API token secret
 *   CF_ACCOUNT_ID        — optional; falls back to COD_ACCOUNT_ID
 *   COD_R2_BUCKET_NAME   — bucket to initialize
 *
 * Usage:
 *   npm run setup:r2
 *   npm run setup:r2 -- --push-secrets   # also sync the creds to the Worker
 *
 * Create the token at: Cloudflare Dashboard → R2 → Manage R2 API Tokens
 * → Create API Token, with "Object Read & Write" on the target bucket.
 */

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} from "@aws-sdk/client-s3";
import { getCloudEnv, getR2Credentials } from "./cloud-env.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const SERVER_DIR = fileURLToPath(new URL("..", import.meta.url));

const pushSecrets = process.argv.includes("--push-secrets");

const { bucketName, mediaDomain } = getCloudEnv();
const { accountId, accessKeyId, secretAccessKey } = getR2Credentials();

const missing = [
  !accountId && "CF_ACCOUNT_ID (or COD_ACCOUNT_ID)",
  !accessKeyId && "R2_ACCESS_KEY_ID",
  !secretAccessKey && "R2_SECRET_ACCESS_KEY",
  !bucketName && "COD_R2_BUCKET_NAME",
].filter(Boolean);

if (missing.length) {
  console.error(`
Error: missing required values in <repo-root>/.env:
${missing.map((m) => `  - ${m}`).join("\n")}

Create an R2 API token at:
  Cloudflare Dashboard → R2 → Manage R2 API Tokens → Create API Token
  (needs "Object Read & Write" permission for the target bucket)

Then add to <repo-root>/.env:
  R2_ACCESS_KEY_ID=...
  R2_SECRET_ACCESS_KEY=...
`);
  process.exit(1);
}

const corsRules = JSON.parse(readFileSync(HERE + "r2-cors.json", "utf8"));

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

const statusOf = (err) => err?.$metadata?.httpStatusCode;

async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log(`✓ Bucket "${bucketName}" already exists.`);
    return;
  } catch (err) {
    const status = statusOf(err);
    if (status === 403) {
      console.log(`• Token cannot inspect "${bucketName}" (403) — assuming it exists.`);
      return;
    }
    if (status !== 404 && err?.name !== "NotFound" && err?.name !== "NoSuchBucket") {
      throw err;
    }
  }

  console.log(`Creating bucket "${bucketName}"…`);
  try {
    await s3.send(new CreateBucketCommand({ Bucket: bucketName }));
    console.log(`✓ Bucket "${bucketName}" created.`);
  } catch (err) {
    if (err?.name === "BucketAlreadyOwnedByYou" || err?.name === "BucketAlreadyExists") {
      console.log(`✓ Bucket "${bucketName}" already exists.`);
      return;
    }
    throw err;
  }
}

async function applyCors() {
  console.log("Applying CORS configuration…");
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: { CORSRules: corsRules },
    })
  );
  const verify = await s3.send(new GetBucketCorsCommand({ Bucket: bucketName }));
  console.log("✓ CORS applied and verified:");
  console.log(JSON.stringify(verify.CORSRules, null, 2));
}

function pushWorkerSecrets() {
  const secrets = {
    CF_ACCOUNT_ID: accountId,
    R2_ACCESS_KEY_ID: accessKeyId,
    R2_SECRET_ACCESS_KEY: secretAccessKey,
  };
  console.log("");
  console.log("Pushing credentials to the cod-server Worker…");
  for (const [name, value] of Object.entries(secrets)) {
    execFileSync("npx", ["wrangler", "secret", "put", name], {
      cwd: SERVER_DIR,
      input: value,
      stdio: ["pipe", "inherit", "inherit"],
      shell: process.platform === "win32",
    });
  }
  console.log("✓ Worker secrets set.");
}

async function main() {
  console.log(`Account: ${accountId}`);
  console.log(`Bucket : ${bucketName}`);
  console.log("");

  await ensureBucket();
  await applyCors();

  if (pushSecrets) pushWorkerSecrets();

  console.log("");
  console.log("Done. Presigned uploads can now write to this bucket.");
  if (!pushSecrets) {
    console.log("Re-run with --push-secrets to set CF_ACCOUNT_ID, R2_ACCESS_KEY_ID");
    console.log("and R2_SECRET_ACCESS_KEY on the Worker as well.");
  }
  console.log(`Public reads are served from https://${mediaDomain} — attach that`);
  console.log("custom domain to the bucket in the Cloudflare dashboard if it is not set.");
}

main().catch((err) => {
  console.error("Failed:", err?.message ?? err);
  process.exit(1);
});
