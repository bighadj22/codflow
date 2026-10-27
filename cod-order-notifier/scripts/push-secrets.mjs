import { writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./env.mjs";

const env = loadLocalEnv();
const names = ["COD_API_KEY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"];
const payload = {};
const missing = [];

for (const name of names) {
  if (env[name]) payload[name] = env[name];
  else missing.push(name);
}

if (missing.length > 0) {
  console.error(`Missing in .dev.vars: ${missing.join(", ")}`);
  process.exit(1);
}

const tmp = new URL("../.dev.vars.bulk.json", import.meta.url);
const projectDir = fileURLToPath(new URL("..", import.meta.url));
writeFileSync(tmp, JSON.stringify(payload));

try {
  const res = spawnSync("npx", ["wrangler", "secret", "bulk", ".dev.vars.bulk.json"], {
    cwd: projectDir,
    stdio: "inherit",
    shell: true,
  });
  if (res.status !== 0) process.exit(res.status ?? 1);
} finally {
  rmSync(tmp, { force: true });
}

console.log(`Uploaded ${names.length} secret(s). Values were never printed.`);
