/**
 * Local Development Seed Script
 *
 * Seeds the local D1 database with:
 *   - Store record + matching store API key
 *   - 4 product categories
 *   - 6 products (mix of simple + variants, some featured)
 *   - Product images (picsum.photos placeholders)
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const remote = process.argv.includes("--remote");

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

const categories = [
  { id: "cat-1", name: "ملابس",       slug: "malabes",     position: 1 },
  { id: "cat-2", name: "إكسسوارات",  slug: "aksswarat",   position: 2 },
  { id: "cat-3", name: "أحذية",       slug: "ahdhiya",     position: 3 },
  { id: "cat-4", name: "إلكترونيات", slug: "elektroniyat", position: 4 },
];

// 8 products across 4 categories. 4 featured.
const products = [
  // ── cat-1: ملابس (Clothing) ──
  {
    id: "prod-1", name: "قميص كلاسيكي", handle: "qamis-classiki",
    description: "قميص أنيق بقصة كلاسيكية مريحة، متوفر بألوان متعددة.",
    price: 2800, compareAtPrice: 3500, categoryId: "cat-1",
    hasVariants: 1, inventory: 0, trackInventory: 0,
    storeFeatured: 1, tags: '["ملابس","قميص"]',
    variantOptions: JSON.stringify([
      { name: "اللون", values: [{ value: "أبيض", hexColor: "#ffffff" }, { value: "أسود", hexColor: "#000000" }, { value: "أزرق", hexColor: "#3b82f6" }] },
      { name: "المقاس", values: [{ value: "S" }, { value: "M" }, { value: "L" }, { value: "XL" }] },
    ]),
  },
  {
    id: "prod-2", name: "بنطال جينز", handle: "bantalon-jeans",
    description: "بنطال جينز عالي الجودة بقصة مستقيمة مريحة.",
    price: 3500, compareAtPrice: null, categoryId: "cat-1",
    hasVariants: 0, inventory: 25, trackInventory: 1,
    storeFeatured: 1, tags: '["جينز","بنطال"]',
    variantOptions: null,
  },
  // ── cat-2: إكسسوارات (Accessories) ──
  {
    id: "prod-3", name: "حقيبة يد", handle: "haqiba-yad",
    description: "حقيبة يد عملية وأنيقة مناسبة لجميع المناسبات.",
    price: 3800, compareAtPrice: null, categoryId: "cat-2",
    hasVariants: 0, inventory: 15, trackInventory: 1,
    storeFeatured: 0, tags: '["حقيبة","إكسسوار"]',
    variantOptions: null,
  },
  {
    id: "prod-4", name: "حزام جلد", handle: "hizam-jild",
    description: "حزام جلد أصلي بإبزيم معدني متين.",
    price: 1500, compareAtPrice: 1800, categoryId: "cat-2",
    hasVariants: 0, inventory: 3, trackInventory: 1,
    storeFeatured: 0, tags: '["حزام","إكسسوار"]',
    variantOptions: null,
  },
  // ── cat-3: أحذية (Shoes) ──
  {
    id: "prod-5", name: "حذاء رياضي", handle: "hidha-riyadi",
    description: "حذاء رياضي خفيف ومريح للاستخدام اليومي.",
    price: 4500, compareAtPrice: 5500, categoryId: "cat-3",
    hasVariants: 1, inventory: 0, trackInventory: 0,
    storeFeatured: 1, tags: '["أحذية","رياضي"]',
    variantOptions: JSON.stringify([
      { name: "اللون", values: [{ value: "أبيض", hexColor: "#ffffff" }, { value: "أسود", hexColor: "#000000" }] },
      { name: "المقاس", values: [{ value: "40" }, { value: "41" }, { value: "42" }, { value: "43" }] },
    ]),
  },
  {
    id: "prod-6", name: "صندل صيفي", handle: "sandal-sayfi",
    description: "صندل مريح وعصري مناسب لفصل الصيف.",
    price: 2200, compareAtPrice: null, categoryId: "cat-3",
    hasVariants: 0, inventory: 20, trackInventory: 1,
    storeFeatured: 0, tags: '["أحذية","صندل"]',
    variantOptions: null,
  },
  // ── cat-4: إلكترونيات (Electronics) ──
  {
    id: "prod-7", name: "ساعة ذكية", handle: "saaa-dhakiya",
    description: "ساعة ذكية بشاشة لمس وميزات صحية متقدمة.",
    price: 7500, compareAtPrice: 9000, categoryId: "cat-4",
    hasVariants: 0, inventory: 8, trackInventory: 1,
    storeFeatured: 1, tags: '["إلكترونيات","ساعة"]',
    variantOptions: null,
  },
  {
    id: "prod-8", name: "سماعات بلوتوث", handle: "samaat-bluetooth",
    description: "سماعات لاسلكية بجودة صوت عالية وبطارية طويلة.",
    price: 3200, compareAtPrice: 4000, categoryId: "cat-4",
    hasVariants: 0, inventory: 12, trackInventory: 1,
    storeFeatured: 0, tags: '["إلكترونيات","سماعات"]',
    variantOptions: null,
  },
];

// Variants for products with hasVariants=1
// prod-1: قميص — representative colour/size combos
const variants = [
  { id: "var-1-1", productId: "prod-1", variations: JSON.stringify({ "اللون": "أبيض", "المقاس": "M" }), price: 2800, compareAtPrice: 3500, inventory: 10, isDefault: 1 },
  { id: "var-1-2", productId: "prod-1", variations: JSON.stringify({ "اللون": "أسود", "المقاس": "M" }), price: 2800, compareAtPrice: 3500, inventory: 8,  isDefault: 0 },
  { id: "var-1-3", productId: "prod-1", variations: JSON.stringify({ "اللون": "أزرق", "المقاس": "L" }), price: 2800, compareAtPrice: 3500, inventory: 5,  isDefault: 0 },
  // prod-5: حذاء رياضي — colour/size combos
  { id: "var-5-1", productId: "prod-5", variations: JSON.stringify({ "اللون": "أبيض", "المقاس": "42" }), price: 4500, compareAtPrice: 5500, inventory: 6, isDefault: 1 },
  { id: "var-5-2", productId: "prod-5", variations: JSON.stringify({ "اللون": "أسود", "المقاس": "43" }), price: 4500, compareAtPrice: 5500, inventory: 4, isDefault: 0 },
];

// One cover image per product (picsum — consistent per seed number)
const images = [
  { id: "img-1", productId: "prod-1", src: "https://picsum.photos/seed/prod1/600/600", position: 0 },
  { id: "img-2", productId: "prod-2", src: "https://picsum.photos/seed/prod2/600/600", position: 0 },
  { id: "img-3", productId: "prod-3", src: "https://picsum.photos/seed/prod3/600/600", position: 0 },
  { id: "img-4", productId: "prod-4", src: "https://picsum.photos/seed/prod4/600/600", position: 0 },
  { id: "img-5", productId: "prod-5", src: "https://picsum.photos/seed/prod5/600/600", position: 0 },
  { id: "img-6", productId: "prod-6", src: "https://picsum.photos/seed/prod6/600/600", position: 0 },
  { id: "img-7", productId: "prod-7", src: "https://picsum.photos/seed/prod7/600/600", position: 0 },
  { id: "img-8", productId: "prod-8", src: "https://picsum.photos/seed/prod8/600/600", position: 0 },
];

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

// Variants
for (const v of variants) {
  const variations = v.variations.replace(/'/g, "''");
  const compAt = v.compareAtPrice !== null ? v.compareAtPrice : "NULL";
  const sku = `${v.productId}-${v.id}`;
  statements.push(
    `INSERT OR REPLACE INTO product_variants (id, product_id, variations, currency, price, compare_at_price, sku, inventory, is_default, active, position, image_id, created_at, updated_at) VALUES ('${v.id}', '${v.productId}', '${variations}', 'DZD', ${v.price}, ${compAt}, '${sku}', ${v.inventory}, ${v.isDefault}, 1, 0, NULL, '${ts}', '${ts}')`
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
    `npx wrangler d1 execute codflow-os-db ${target} --command "${sql.replace(/"/g, '\\"')}"`,
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
console.log(`\n  target     : ${remote ? "remote D1 (codflow-os-db)" : "local D1 (.wrangler-shared)"}\n`);
