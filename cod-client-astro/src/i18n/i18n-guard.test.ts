import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { SCOPE_CATEGORIES } from "../../../cod-shared/rbac/scopes";

const ROOT = join(import.meta.dirname, "../..");
const SRC = join(ROOT, "src");
const LOCALES = join(ROOT, "locales");
const LANGS = ["en", "ar", "fr"] as const;
const NAMESPACES = [
  "orders", "auth", "common", "navigation", "dashboard", "customers",
  "customer-groups", "customer-tags", "reviews", "products", "product-groups",
  "offers", "delivery", "delivery_companies", "settings", "team", "mcp",
  "profile",
] as const;
const EXTENSIONS = new Set([".astro", ".js", ".jsx", ".ts", ".tsx"]);

const ORDER_STATUSES = [
  "new", "confirmed", "unreachable", "preparing", "ready", "assigned",
  "dispatched", "out_for_delivery", "delivered", "returned", "cancelled",
];
const STOCK_MOVEMENT_TYPES = [
  "PURCHASE", "ADJUSTMENT_ADD", "ADJUSTMENT_REMOVE", "ORDER_DEDUCTED",
  "ORDER_CANCELLED", "ORDER_RETURNED", "OFFLINE_SALE",
];

function sourceFiles(directory: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) sourceFiles(path, acc);
    else if (
      EXTENSIONS.has(extname(entry.name)) &&
      !entry.name.includes(".test.")
    )
      acc.push(path);
  }
  return acc;
}

function loadDicts(): Record<(typeof LANGS)[number], Record<string, unknown>> {
  const out = {} as Record<(typeof LANGS)[number], Record<string, unknown>>;
  for (const lang of LANGS) {
    out[lang] = {};
    for (const ns of NAMESPACES) {
      out[lang][ns] = JSON.parse(
        readFileSync(join(LOCALES, lang, `${ns}.json`), "utf8"),
      );
    }
  }
  return out;
}

function flatten(
  node: unknown,
  prefix = "",
  out: Record<string, string> = {},
): Record<string, string> {
  if (node && typeof node === "object" && !Array.isArray(node)) {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      flatten(value, prefix ? `${prefix}.${key}` : key, out);
    }
  } else if (node != null) {
    out[prefix] = String(node);
  }
  return out;
}

function referencedKeys(): { ns: string; key: string }[] {
  const refs: { ns: string; key: string }[] = [];
  const STR =
    "`(?:[^`\\\\]|\\\\.)*`|\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*'";
  for (const file of sourceFiles(SRC)) {
    const src = readFileSync(file, "utf8");
    const bindings = Array.from(
      src.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*useT\(\s*["']([^"']+)["']\s*\)/g),
      (m) => [m[1], m[2]] as const,
    );
    for (const [varName, ns] of bindings) {
      const re = new RegExp(`\\b${varName}\\s*\\(\\s*(${STR})`, "g");
      let call;
      while ((call = re.exec(src))) {
        const raw = call[1].slice(1, -1);
        const isTemplate = call[1][0] === "`";
        if (!isTemplate || !/\$\{/.test(raw)) refs.push({ ns, key: raw });
      }
    }
    const reInline = new RegExp(
      `useT\\(\\s*["']([^"']+)["']\\s*\\)\\s*\\(\\s*(${STR})`,
      "g",
    );
    let ic;
    while ((ic = reInline.exec(src))) {
      const raw = ic[2].slice(1, -1);
      const isTemplate = ic[2][0] === "`";
      if (!isTemplate || !/\$\{/.test(raw)) refs.push({ ns: ic[1], key: raw });
    }
  }
  return refs;
}

describe("i18n dictionaries", () => {
  const dicts = loadDicts();
  const enFlat = Object.fromEntries(
    NAMESPACES.map((ns) => [ns, flatten(dicts.en[ns])]),
  );

  it("translates every static key referenced in code (no raw-key leaks)", () => {
    const missing = referencedKeys().filter(
      ({ ns, key }) => !(key in (enFlat[ns] ?? {})),
    );
    expect(missing).toEqual([]);
  });

  it("keeps ar and fr dictionaries identical in shape to en (no silent fallback)", () => {
    for (const lang of ["ar", "fr"] as const) {
      const drift: string[] = [];
      for (const ns of NAMESPACES) {
        const en = new Set(Object.keys(enFlat[ns]));
        const other = new Set(Object.keys(flatten(dicts[lang][ns])));
        for (const key of en) if (!other.has(key)) drift.push(`${ns}.${key} (missing in ${lang})`);
        for (const key of other) if (!en.has(key)) drift.push(`${ns}.${key} (extra in ${lang})`);
      }
      expect(drift).toEqual([]);
    }
  });

  it("translates every RBAC scope category and action", () => {
    const team = dicts.en.team as {
      scope_categories: Record<string, string>;
      scope_actions: Record<string, string>;
    };
    const missingCategories = Object.keys(SCOPE_CATEGORIES).filter(
      (key) => !(key in team.scope_categories),
    );
    expect(missingCategories).toEqual([]);

    const missingActions = Object.values(SCOPE_CATEGORIES)
      .flatMap((group) => group.scopes)
      .map((scope) => scope.split(":").pop() ?? "")
      .filter((action) => !(action in team.scope_actions));
    expect(missingActions).toEqual([]);
  });

  it("translates every order status and stock movement type", () => {
    const orders = dicts.en.orders as { status: Record<string, string> };
    const common = dicts.en.common as { statuses: Record<string, string> };
    for (const status of ORDER_STATUSES) {
      expect(orders.status[status], `orders.status.${status}`).toBeTruthy();
      expect(common.statuses[status], `common.statuses.${status}`).toBeTruthy();
    }
    const products = dicts.en.products as {
      stock_history: { movement_types: Record<string, string> };
    };
    for (const type of STOCK_MOVEMENT_TYPES) {
      expect(
        products.stock_history.movement_types[type],
        `products.stock_history.movement_types.${type}`,
      ).toBeTruthy();
    }
  });
});
