import { writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadLocalEnv } from "./env.mjs";
import { STATE_KEY, MAX_SEEN_IDS } from "../src/notifier.mjs";

const env = loadLocalEnv();
const projectDir = fileURLToPath(new URL("..", import.meta.url));

if (!env.COD_API_KEY || !env.COD_SERVER_URL) {
  console.error("Missing COD_API_KEY / COD_SERVER_URL in .dev.vars");
  process.exit(1);
}

const res = await fetch(`${env.COD_SERVER_URL.replace(/\/+$/, "")}/api/orders?limit=100`, {
  headers: { "X-API-Key": env.COD_API_KEY, Accept: "application/json" },
});
if (!res.ok) {
  console.error(`Orders API returned HTTP ${res.status}`);
  process.exit(1);
}
const body = await res.json();
const orders = Array.isArray(body?.data) ? body.data : [];

if (orders.length === 0) {
  console.error("No orders returned by the API");
  process.exit(1);
}

orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
const newestId = orders[0].id;

const baseline = orders
  .filter((o) => o.id && o.id !== newestId)
  .map((o) => o.id)
  .slice(0, MAX_SEEN_IDS);

const state = { seeded: true, ids: baseline };
const tmp = join(tmpdir(), "codflow-kv-state.json");

try {
  writeFileSync(tmp, JSON.stringify(state));
  const result = spawnSync(
    "npx",
    ["wrangler", "kv", "key", "put", "--binding=ORDER_NOTIFY_KV", STATE_KEY, `--path=${tmp}`, "--remote"],
    { cwd: projectDir, stdio: "inherit", shell: true },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
} finally {
  rmSync(tmp, { force: true });
}

console.log(
  JSON.stringify(
    {
      baseline: baseline.length,
      excludedFromBaseline: newestId,
      note: "the excluded (newest) order is kept unseen so the next poll notifies it",
    },
    null,
    2,
  ),
);