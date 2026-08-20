import { Context } from "hono";
import type { AppContext } from "@/types";
import { getDb } from "@/db";
import * as queries from "./queries";
import { createOfferSchema, updateOfferSchema } from "./validation";
import { NotFoundError, BusinessLogicError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";

export async function listOffers(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const data = await queries.listOffers(db);
  return c.json({ success: true, data, count: data.length });
}

export async function getOffer(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;
  const data = await queries.getOfferById(db, id);
  if (!data) throw new NotFoundError("Offer", id);
  return c.json({ success: true, data });
}

export async function createOffer(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const body = await c.req.json();
  const data = createOfferSchema.parse(body);
  const { id } = await queries.createOffer(db, data);
  const result = await queries.getOfferById(db, id);
  return c.json({ success: true, data: result }, 201);
}

export async function updateOffer(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;
  const body = await c.req.json();

  const existing = await queries.getOfferById(db, id);
  if (!existing) throw new NotFoundError("Offer", id);

  const data = updateOfferSchema.parse(body);
  await queries.updateOffer(db, id, data);
  const result = await queries.getOfferById(db, id);
  return c.json({ success: true, data: result });
}

export async function deleteOffer(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const id = c.req.param("id")!;

  const existing = await queries.getOfferById(db, id);
  if (!existing) throw new NotFoundError("Offer", id);

  await queries.deleteOffer(db, id);
  return c.json({ success: true });
}
