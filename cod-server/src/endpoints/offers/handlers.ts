import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import * as queries from "./queries";
import { createOfferSchema, updateOfferSchema } from "./validation";
import { NotFoundError, SystemError } from "@/lib/errors/classes";

export async function listOffers(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const data = await queries.listOffers(db);
  return c.json({ success: true, data, count: data.length }, 200);
}

export async function getOffer(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;
  const data = await queries.getOfferById(db, id);
  if (!data) throw new NotFoundError("Offer", id);
  return c.json({ success: true, data }, 200);
}

export async function createOffer(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const body: any = (c.req as any).valid?.("json");
  const data =
    body ?? createOfferSchema.parse(await c.req.json());
  const { id } = await queries.createOffer(db, data);
  const result = await queries.getOfferById(db, id);
  if (!result) throw new SystemError("Failed to load created offer");
  return c.json({ success: true, data: result }, 201);
}

export async function updateOffer(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;

  const existing = await queries.getOfferById(db, id);
  if (!existing) throw new NotFoundError("Offer", id);

  const body: any = (c.req as any).valid?.("json");
  const data =
    body ?? updateOfferSchema.parse(await c.req.json());
  await queries.updateOffer(db, id, data);
  const result = await queries.getOfferById(db, id);
  if (!result) throw new SystemError("Failed to load updated offer");
  return c.json({ success: true, data: result }, 200);
}

export async function deleteOffer(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;

  const existing = await queries.getOfferById(db, id);
  if (!existing) throw new NotFoundError("Offer", id);

  await queries.deleteOffer(db, id);
  return c.json({ success: true }, 200);
}
