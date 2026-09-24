#!/usr/bin/env -S npx tsx
/**
 * Seeds a store's four legal pages (Terms, Privacy, Refund, Shipping) —
 * report-md/LEGAL_PAGES_PLAN.md. The one-time step a store needs after it is
 * created: without it, Meta Ads rejects the storefront for missing policy
 * pages.
 *
 * This is a THIN wrapper around the same templates the app uses at runtime
 * (cod-shared/legal) — never a hand-copied duplicate of their text, which is
 * exactly the trap that would let this script's output drift from
 * `seedStorePages`'s. It writes raw SQL via `wrangler d1 execute`, the same
 * way scripts/seed-local.mjs seeds demo products: no HTTP call, no running
 * dev server required, safe to run as part of store setup.
 *
 * Idempotent: `INSERT OR IGNORE` against the same unique index
 * `seedStorePages` relies on (`idx_store_pages_kind` — one row per store per
 * legal kind) — running this twice never duplicates a page. It does not
 * derive `body_plain` through the real HTMLRewriter-based `toPlainText`
 * (unavailable outside a Workers runtime, and this script runs in plain
 * Node) — a simple tag-strip stands in for it here only; the moment a
 * merchant touches a page from the dashboard, the real write chokepoint
 * re-derives it properly.
 *
 * Usage:
 *   npx tsx scripts/seed-store-pages.ts                       # local D1, store-local-dev
 *   npx tsx scripts/seed-store-pages.ts --remote               # remote D1, store-local-dev
 *   npx tsx scripts/seed-store-pages.ts --store-id=store-abc123 --remote
 */
import { execSync } from "node:child_process";
import { getCloudEnv } from "./cloud-env.mjs";
import {
  LEGAL_PAGE_KINDS,
  LEGAL_PAGE_DEFAULTS,
  TEMPLATE_VERSION,
  PAGE_LOCALES,
  renderLegalTemplate,
  legalFactsFrom,
} from "../../cod-shared/legal";

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const storeIdArg = args.find((a) => a.startsWith("--store-id="));
const storeId = storeIdArg ? storeIdArg.slice("--store-id=".length) : "store-local-dev";

const { dbName } = getCloudEnv();
const target = remote ? "--remote -y" : "--local --persist-to ../.wrangler-shared";

function run(sql: string): string {
  return execSync(
    `npx wrangler d1 execute ${dbName} ${target} --json --command "${sql.replace(/"/g, '\\"')}"`,
    { cwd: __dirname + "/..", stdio: "pipe" },
  ).toString();
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const storeRow = (() => {
  try {
    const out = run(`SELECT id, name FROM stores WHERE id = ${sqlString(storeId)}`);
    const parsed = JSON.parse(out) as Array<{ results?: Array<{ id: string; name: string }> }>;
    return parsed[0]?.results?.[0] ?? null;
  } catch (err) {
    console.error("[seed-store-pages] Failed to read the store row:", (err as Error).message);
    return null;
  }
})();

if (!storeRow) {
  console.error(`[seed-store-pages] No store found with id "${storeId}" — create the store row first.`);
  process.exit(1);
}

const facts = legalFactsFrom({ name: storeRow.name }, null);
const ts = new Date().toISOString();
const statements: string[] = [];

for (const kind of LEGAL_PAGE_KINDS) {
  const pageId = `sp-${storeId}-${kind}`;
  const defaults = LEGAL_PAGE_DEFAULTS[kind];

  statements.push(
    `INSERT OR IGNORE INTO store_pages (id, store_id, kind, slug, status, show_in_footer, position, template_version, created_at, updated_at) VALUES (${sqlString(pageId)}, ${sqlString(storeId)}, ${sqlString(kind)}, ${sqlString(defaults.slug)}, 'published', 1, ${defaults.position}, ${TEMPLATE_VERSION}, ${sqlString(ts)}, ${sqlString(ts)})`,
  );

  for (const locale of PAGE_LOCALES) {
    const rendered = renderLegalTemplate(kind, locale, facts);
    const bodyPlain = stripTags(rendered.bodyHtml);
    statements.push(
      `INSERT OR IGNORE INTO store_page_translations (page_id, locale, title, body_html, body_plain, meta_title, meta_description, source, updated_at) VALUES (${sqlString(pageId)}, ${sqlString(locale)}, ${sqlString(rendered.title)}, ${sqlString(rendered.bodyHtml)}, ${sqlString(bodyPlain)}, NULL, ${sqlString(rendered.metaDescription)}, 'template', ${sqlString(ts)})`,
    );
  }
}

let ok = 0;
for (const stmt of statements) {
  try {
    run(stmt);
    ok++;
  } catch (err) {
    console.error(`[seed-store-pages] ✗ Failed: ${stmt.slice(0, 90)}...`);
    console.error("  " + ((err as { stderr?: Buffer })?.stderr?.toString().split("\n").pop() ?? (err as Error).message));
  }
}

console.log(`\n[seed-store-pages] ✓ ${ok}/${statements.length} statements executed`);
console.log(`  store  : ${storeId} (${storeRow.name})`);
console.log(`  pages  : ${LEGAL_PAGE_KINDS.length} kinds × ${PAGE_LOCALES.length} locales`);
console.log(`  target : ${remote ? `remote D1 (${dbName})` : "local D1 (.wrangler-shared)"}\n`);
console.log("  Existing pages for this store were left untouched (INSERT OR IGNORE).");
console.log("  To re-apply an updated template, use the dashboard's \"Reset to CodFlow template\" per page,");
console.log("  or POST /api/store-pages/{id}/translations/{locale}/reset.\n");
