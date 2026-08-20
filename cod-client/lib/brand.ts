import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { dashboardBrand, stores } from "@/db/schema";

export type DashboardBrand = {
  brandName:    string;
  logoUrl:      string | null;
  primaryColor: string;
  metaTitle:    string | null;
  faviconUrl:   string | null;
};

const FALLBACK: DashboardBrand = {
  brandName:    "Dashboard",
  logoUrl:      null,
  primaryColor: "#7c3aed",
  metaTitle:    null,
  faviconUrl:   null,
};

/**
 * Reads dashboard white-label brand config directly from D1.
 * Uses the same DB binding as auth — no API call to cod-server needed.
 * Returns safe fallback values if the row doesn't exist yet.
 */
export async function getDashboardBrand(): Promise<DashboardBrand> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    const row = await db.select().from(dashboardBrand).get();
    if (!row) return FALLBACK;
    return {
      brandName:    row.brandName,
      logoUrl:      row.logoUrl,
      primaryColor: row.primaryColor,
      metaTitle:    row.metaTitle    ?? null,
      faviconUrl:   row.faviconUrl   ?? null,
    };
  } catch {
    return FALLBACK;
  }
}

/**
 * Reads the store domain from the stores table.
 * Returns null if no store exists or domain is not set.
 */
export async function getStoreDomain(): Promise<string | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const db = getDb(env.DB);
    const store = await db.select({ domain: stores.domain }).from(stores).get();
    return store?.domain ?? null;
  } catch {
    return null;
  }
}
