/**
 * Local Development Seed Script
 *
 * Seeds the local D1 database with:
 *   - Store record + matching store API key
 *   - 4 product categories
 *   - 6 products (mix of simple + variants, some featured) — real UUID ids
 *   - Product images served from the store's own R2 media domain (seed/ folder)
 *
 * Product ids are REAL UUIDs (crypto.randomUUID) — the same format production
 * queries generate — so MCP tools and API clients see one consistent id shape.
 *
 * Usage:
 *   node scripts/seed-local.mjs            # local D1 (.wrangler-shared)
 *   node scripts/seed-local.mjs --remote   # remote Cloudflare D1
 *
 * Reads STORE_API_KEY from $STORE_API_KEY, cod-astro/theme01/.dev.vars, or a
 * dev default (in that order).
 * Safe to run multiple times — uses INSERT OR REPLACE throughout.
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import path from "path";
import { getCloudEnv } from "./cloud-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const remote = process.argv.includes("--remote");
const { dbName } = getCloudEnv();

// ── 1. Resolve the store API key ────────────────────────────────────────────
// Precedence: $STORE_API_KEY env var → cod-astro/theme01/.dev.vars → dev default.
const devVarsPath = path.resolve(root, "../cod-astro/theme01/.dev.vars");
let rawKey = process.env.STORE_API_KEY;
if (rawKey) {
  console.log("[seed-local] Using STORE_API_KEY from environment");
} else {
  try {
    const content = readFileSync(devVarsPath, "utf8");
    const match = content.match(/^STORE_API_KEY=(.+)$/m);
    if (match) rawKey = match[1].trim();
  } catch { /* fall through to default */ }
}
if (!rawKey) {
  console.warn("[seed-local] STORE_API_KEY not found (env or cod-astro/theme01/.dev.vars). Using a dev default key.");
  console.warn("             Set STORE_API_KEY or create .dev.vars to use your own key.");
  rawKey = "codflow-dev-store-key";
}

// ── 2. Compute SHA-256 hash (matches storeAuthMiddleware) ─────────────────────
const keyHash = createHash("sha256").update(rawKey).digest("hex");

const ts      = new Date().toISOString();
const storeId = "store-local-dev";
const keyId   = "key-local-dev";

// ── 3. Seed data ──────────────────────────────────────────────────────────────
// Real UUIDs — deterministic per run is unnecessary; readability comes from
// names/handles, ids match what production queries generate.
const uuid = () => crypto.randomUUID();

const categories = [
  { id: "cat-accessories", name: "إكسسوارات",  slug: "aksswarat",   position: 1 },
  { id: "cat-electronics", name: "إلكترونيات", slug: "elektroniyat", position: 2 },
];

// 6 products across 2 categories. 3 featured. Images are the store's own
// media-domain objects (seed/ folder in R2) — no third-party placeholders.
const MEDIA = "https://media.codflow.store/seed";

const products = [
  // ── cat-accessories: إكسسوارات ──
  {
    id: uuid(), name: "حقيبة يد بيج", handle: "haqiba-yad-beige",
    description: "حقيبة يد بيج أنيقة وعملية، مناسبة لجميع المناسبات.",
    price: 3800, compareAtPrice: 4500, categoryId: "cat-accessories",
    hasVariants: 1, inventory: 0, trackInventory: 0,
    storeFeatured: 1, tags: '["حقيبة","إكسسوار"]',
    variantOptions: JSON.stringify([
      { name: "الخيار", values: [{ value: "الخيار الأول" }, { value: "الخيار الثاني" }] },
    ]),
    images: [`${MEDIA}/beige_crossbody_bag_option_1.webp`, `${MEDIA}/beige_crossbody_bag_option_2.webp`],
  },
  {
    id: uuid(), name: "قارورة حرارية بيضاء", handle: "qarorra-harariya-baida",
    description: "قارورة حرارية بيضاء تحفظ حرارة المشروبات لساعات طويلة.",
    price: 2200, compareAtPrice: null, categoryId: "cat-accessories",
    hasVariants: 0, inventory: 30, trackInventory: 1,
    storeFeatured: 0, tags: '["قارورة","إكسسوار"]',
    variantOptions: null,
    images: [`${MEDIA}/White-Insulated-Bottle.webp`],
  },
  // ── cat-electronics: إلكترونيات ──
  {
    id: uuid(), name: "ساعة أنيقة", handle: "saaa-aniqa",
    description: "ساعة أنيقة بتصميم عصري تناسب الإطلالات اليومية والرسمية.",
    price: 7500, compareAtPrice: 9000, categoryId: "cat-electronics",
    hasVariants: 1, inventory: 0, trackInventory: 0,
    storeFeatured: 1, tags: '["إلكترونيات","ساعة"]',
    variantOptions: JSON.stringify([
      { name: "الخيار", values: [{ value: "الخيار الأول" }, { value: "الخيار الثاني" }] },
    ]),
    images: [`${MEDIA}/watch_product_option_2.webp`, `${MEDIA}/watch_product_option_2%20(1).webp`],
  },
  {
    id: uuid(), name: "سماعات أنيقة", handle: "samaat-aniqa",
    description: "سماعات لاسلكية بتصميم أنيق وجودة صوت عالية وبطارية طويلة.",
    price: 3200, compareAtPrice: 4000, categoryId: "cat-electronics",
    hasVariants: 0, inventory: 12, trackInventory: 1,
    storeFeatured: 1, tags: '["إلكترونيات","سماعات"]',
    variantOptions: null,
    images: [`${MEDIA}/sleek-headphones.webp`],
  },
];

// Variants for products with hasVariants=1 — one variant per option image.
// product references resolved by index in the products array.
const variants = [
  { productIndex: 0, optionIndex: 0, variations: { "الخيار": "الخيار الأول" }, price: 3800, compareAtPrice: 4500, inventory: 10, isDefault: 1, imageIndex: 0 },
  { productIndex: 0, optionIndex: 1, variations: { "الخيار": "الخيار الثاني" }, price: 3800, compareAtPrice: 4500, inventory: 7,  isDefault: 0, imageIndex: 1 },
  { productIndex: 2, optionIndex: 0, variations: { "الخيار": "الخيار الأول" }, price: 7500, compareAtPrice: 9000, inventory: 6,  isDefault: 1, imageIndex: 0 },
  { productIndex: 2, optionIndex: 1, variations: { "الخيار": "الخيار الثاني" }, price: 7500, compareAtPrice: 9000, inventory: 4,  isDefault: 0, imageIndex: 1 },
];

// Images resolved from product definitions; positions follow array order.
const images = products.flatMap((p) =>
  p.images.map((src, index) => ({
    id: uuid(),
    productId: p.id,
    src,
    position: index,
  })),
);
const imageIdByProductAndSrc = new Map(images.map((img) => [`${img.productId}:${img.src}`, img.id]));

// ── 4. Build all SQL statements ───────────────────────────────────────────────
const statements = [];

// Store + API key
statements.push(`INSERT OR REPLACE INTO stores (id, name, domain, theme_id, primary_color, accent_color, bg_color, font_family, lang, currency, currency_symbol, reviews_enabled, status, created_at, updated_at) VALUES ('${storeId}', 'متجر التطوير', NULL, 'theme01', '#7c3aed', '#f59e0b', '#f8f8f8', 'Cairo, sans-serif', 'ar', 'DZD', 'دج', 1, 'active', '${ts}', '${ts}')`);
statements.push(`INSERT OR REPLACE INTO store_api_keys (id, store_id, key_hash, name, created_at) VALUES ('${keyId}', '${storeId}', '${keyHash}', 'default', '${ts}')`);

// Categories
for (const c of categories) {
  statements.push(`INSERT OR REPLACE INTO product_categories (id, name, slug, description, parent_id, image_url, position, created_at, updated_at) VALUES ('${c.id}', '${c.name}', '${c.slug}', NULL, NULL, NULL, ${c.position}, '${ts}', '${ts}')`);
}

// Products
for (const p of products) {
  const desc    = p.description.replace(/'/g, "''");
  const name    = p.name.replace(/'/g, "''");
  const tags    = p.tags.replace(/'/g, "''");
  const varOpts = p.variantOptions ? `'${p.variantOptions.replace(/'/g, "''")}'` : "NULL";
  const compAt  = p.compareAtPrice !== null ? p.compareAtPrice : "NULL";
  statements.push(
    `INSERT OR REPLACE INTO products (id, name, description, handle, currency, price, compare_at_price, cost_price, has_variants, variant_options, sku, inventory, track_inventory, category_id, tags, visibility, status, show_in_store, store_featured, deleted_at, created_at, updated_at) VALUES ('${p.id}', '${name}', '${desc}', '${p.handle}', 'DZD', ${p.price}, ${compAt}, NULL, ${p.hasVariants}, ${varOpts}, NULL, ${p.inventory}, ${p.trackInventory}, '${p.categoryId}', '${tags}', 1, 'ACTIVE', 1, ${p.storeFeatured}, NULL, '${ts}', '${ts}')`
  );
}

// Variants — linked to their product's option image when one exists.
for (const v of variants) {
  const product = products[v.productIndex];
  const variations = JSON.stringify(v.variations).replace(/'/g, "''");
  const compAt = v.compareAtPrice !== null ? v.compareAtPrice : "NULL";
  const variantId = uuid();
  const variantSku = `${product.handle}-${v.optionIndex + 1}`;
  const imgId = imageIdByProductAndSrc.get(`${product.id}:${product.images[v.imageIndex]}`) ?? null;
  statements.push(
    `INSERT OR REPLACE INTO product_variants (id, product_id, variations, currency, price, compare_at_price, sku, inventory, is_default, active, position, image_id, created_at, updated_at) VALUES ('${variantId}', '${product.id}', '${variations}', 'DZD', ${v.price}, ${compAt}, '${variantSku}', ${v.inventory}, ${v.isDefault}, 1, ${v.optionIndex}, ${imgId !== null ? `'${imgId}'` : "NULL"}, '${ts}', '${ts}')`
  );
}

// Images
for (const img of images) {
  statements.push(
    `INSERT OR REPLACE INTO product_images (id, product_id, src, r2_key, src_sm, src_md, src_lg, alt_text, width, height, type, position, created_at, updated_at) VALUES ('${img.id}', '${img.productId}', '${img.src}', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ${img.position}, '${ts}', '${ts}')`
  );
}

// ── 5. Execute ────────────────────────────────────────────────────────────────
function run(sql) {
  const target = remote ? "--remote -y" : "--local --persist-to ../.wrangler-shared";
  execSync(
    `npx wrangler d1 execute ${dbName} ${target} --command "${sql.replace(/"/g, '\\"')}"`,
    { cwd: root, stdio: "pipe" }
  );
}

let ok = 0;
for (const stmt of statements) {
  try {
    run(stmt);
    ok++;
  } catch (err) {
    console.error(`[seed-local] ✗ Failed: ${stmt.slice(0, 80)}...`);
    console.error("  " + (err.stderr?.toString().split("\n").pop() ?? err.message));
  }
}

console.log(`\n[seed-local] ✓ ${ok}/${statements.length} statements executed\n`);
console.log(`  store      : ${storeId} (متجر التطوير)`);
console.log(`  categories : ${categories.length}`);
console.log(`  products   : ${products.length} (${products.filter(p => p.storeFeatured).length} featured)`);
console.log(`  variants   : ${variants.length}`);
console.log(`  images     : ${images.length}`);
console.log(`\n  rawKey     : ${rawKey.slice(0, 24)}...`);
console.log(`\n  target     : ${remote ? `remote D1 (${dbName})` : "local D1 (.wrangler-shared)"}\n`);
