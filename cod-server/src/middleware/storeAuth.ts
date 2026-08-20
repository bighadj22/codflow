/**
 * Store Authentication Middleware
 *
 * Validates the X-Store-API-Key header by comparing a SHA-256 hash
 * of the provided key against the stored hash in store_api_keys.
 */

import { Context, Next } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import { storeApiKeys } from "@/db/schema";
import { eq } from "drizzle-orm";

async function sha256hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function storeAuthMiddleware(c: Context<AppContext>, next: Next) {
  const rawKey = c.req.header("X-Store-API-Key");
  if (!rawKey) {
    return c.json({ error: "Missing store API key" }, 401);
  }

  try {
    const db = getDb(c.env.DB);
    const keyHash = await sha256hex(rawKey);

    const record = await db
      .select()
      .from(storeApiKeys)
      .where(eq(storeApiKeys.keyHash, keyHash))
      .get();

    if (!record) {
      return c.json({ error: "Invalid store API key" }, 401);
    }

    c.set("storeId", record.storeId);

    // Update lastUsedAt fire-and-forget (non-critical)
    db.update(storeApiKeys)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(eq(storeApiKeys.id, record.id))
      .run()
      .catch(() => {});

    await next();
  } catch (err) {
    console.error("[storeAuth]", err);
    return c.json({ error: "Authentication failed" }, 500);
  }
}
