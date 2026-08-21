import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import * as queries from "./queries";
import { updateStoreSchema } from "./validation";
import { NotFoundError, SystemError } from "@/lib/errors/classes";
import { getPixelConfig as queryPixelConfig, upsertPixelConfig } from "../../../../cod-shared/queries/pixel-config";
import { z } from "zod";

export async function getMyStore(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const store = await queries.getStore(db);
  
  if (!store) {
    throw new NotFoundError("Store");
  }
  
  return c.json({ success: true, data: store }, 200);
}

export async function updateMyStore(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const store = await queries.getStore(db);

  if (!store) {
    throw new NotFoundError("Store");
  }

  const jsonBody: any = (c.req as any).valid?.("json");
  const validated = jsonBody ?? updateStoreSchema.parse(await c.req.json());
  const updated = await queries.updateStore(db, store.id, validated);
  if (!updated) {
    throw new SystemError("Failed to update store");
  }
  return c.json({ success: true, data: updated }, 200);
}

const pixelConfigSchema = z.object({
  pixelId: z.string().min(1),
  accessToken: z.string().default(""),
  testEventCode: z.string().optional().nullable(),
  enabled: z.boolean().optional(),
});

export async function getPixelConfig(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const store = await queries.getStore(db);
  if (!store) throw new NotFoundError("Store");
  const config = await queryPixelConfig(db, store.id);
  return c.json({ success: true, data: config ?? null }, 200);
}

export async function savePixelConfig(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const store = await queries.getStore(db);
  if (!store) throw new NotFoundError("Store");
  const jsonBody: any = (c.req as any).valid?.("json");
  const validated = jsonBody ?? pixelConfigSchema.parse(await c.req.json());
  const result = await upsertPixelConfig(db, store.id, validated);
  if (!result) {
    throw new SystemError("Failed to save pixel config");
  }
  return c.json({ success: true, data: result }, 200);
}
