import { eq, desc } from "drizzle-orm";
import { offers, products, productVariants } from "../db/schema";
import type { AppDb } from "../db/client";

export type OfferDiscountType = "free" | "free_shipping";
export type OfferStatus = "active" | "inactive";

export interface CreateOfferData {
  name: string;
  discountType: OfferDiscountType;
  triggerProductId: string;
  triggerVariantId?: string | null;
  triggerQuantity: number;
  rewardProductId?: string | null;
  rewardVariantId?: string | null;
  rewardQuantity: number;
  startsAt?: string | null;
  endsAt?: string | null;
  status: OfferStatus;
}

export interface UpdateOfferData {
  name?: string;
  discountType?: OfferDiscountType;
  triggerProductId?: string;
  triggerVariantId?: string | null;
  triggerQuantity?: number;
  rewardProductId?: string | null;
  rewardVariantId?: string | null;
  rewardQuantity?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  status?: OfferStatus;
}

async function resolveOfferDetail(
  db: AppDb,
  offer: typeof offers.$inferSelect,
) {
  const [triggerProduct, rewardProduct] = await Promise.all([
    db
      .select({ id: products.id, name: products.name, handle: products.handle })
      .from(products)
      .where(eq(products.id, offer.triggerProductId))
      .get(),
    offer.rewardProductId
      ? db
          .select({ id: products.id, name: products.name, handle: products.handle })
          .from(products)
          .where(eq(products.id, offer.rewardProductId))
          .get()
      : Promise.resolve(null),
  ]);

  const [triggerVariant, rewardVariant] = await Promise.all([
    offer.triggerVariantId
      ? db
          .select({ id: productVariants.id, variations: productVariants.variations })
          .from(productVariants)
          .where(eq(productVariants.id, offer.triggerVariantId))
          .get()
      : Promise.resolve(null),
    offer.rewardVariantId
      ? db
          .select({ id: productVariants.id, variations: productVariants.variations })
          .from(productVariants)
          .where(eq(productVariants.id, offer.rewardVariantId))
          .get()
      : Promise.resolve(null),
  ]);

  return {
    id: offer.id,
    name: offer.name,
    status: offer.status,
    triggerQuantity: offer.triggerQuantity,
    rewardQuantity: offer.rewardQuantity,
    discountType: offer.discountType,
    startsAt: offer.startsAt ?? null,
    endsAt: offer.endsAt ?? null,
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
    triggerProduct: triggerProduct ?? null,
    triggerVariant: triggerVariant
      ? {
          id: triggerVariant.id,
          label: Object.values(
            JSON.parse(triggerVariant.variations) as Record<string, string>,
          ).join(" / "),
        }
      : null,
    rewardProduct: rewardProduct ?? null,
    rewardVariant: rewardVariant
      ? {
          id: rewardVariant.id,
          label: Object.values(
            JSON.parse(rewardVariant.variations) as Record<string, string>,
          ).join(" / "),
        }
      : null,
  };
}

export async function listOffers(db: AppDb) {
  const rows = await db
    .select()
    .from(offers)
    .orderBy(desc(offers.createdAt))
    .all();

  return Promise.all(rows.map((row) => resolveOfferDetail(db, row)));
}

export async function getOfferById(db: AppDb, id: string) {
  const offer = await db
    .select()
    .from(offers)
    .where(eq(offers.id, id))
    .get();

  if (!offer) return null;
  return resolveOfferDetail(db, offer);
}

export async function createOffer(
  db: AppDb,
  data: CreateOfferData,
): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(offers).values({
    id,
    name: data.name,
    discountType: data.discountType,
    triggerProductId: data.triggerProductId,
    triggerVariantId: data.triggerVariantId ?? null,
    triggerQuantity: data.triggerQuantity,
    rewardProductId: data.rewardProductId ?? null,
    rewardVariantId: data.rewardVariantId ?? null,
    rewardQuantity: data.rewardQuantity,
    startsAt: data.startsAt ?? null,
    endsAt: data.endsAt ?? null,
    status: data.status,
    createdAt: now,
    updatedAt: now,
  });

  return { id };
}

export async function updateOffer(
  db: AppDb,
  id: string,
  data: UpdateOfferData,
) {
  const now = new Date().toISOString();

  await db
    .update(offers)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.discountType !== undefined && { discountType: data.discountType }),
      ...(data.triggerProductId !== undefined && {
        triggerProductId: data.triggerProductId,
      }),
      ...(data.triggerVariantId !== undefined && {
        triggerVariantId: data.triggerVariantId ?? null,
      }),
      ...(data.triggerQuantity !== undefined && {
        triggerQuantity: data.triggerQuantity,
      }),
      ...(data.rewardProductId !== undefined && {
        rewardProductId: data.rewardProductId ?? null,
      }),
      ...(data.rewardVariantId !== undefined && {
        rewardVariantId: data.rewardVariantId ?? null,
      }),
      ...(data.rewardQuantity !== undefined && {
        rewardQuantity: data.rewardQuantity,
      }),
      ...(data.startsAt !== undefined && { startsAt: data.startsAt ?? null }),
      ...(data.endsAt !== undefined && { endsAt: data.endsAt ?? null }),
      ...(data.status !== undefined && { status: data.status }),
      updatedAt: now,
    })
    .where(eq(offers.id, id));
}

export async function deleteOffer(db: AppDb, id: string) {
  await db.delete(offers).where(eq(offers.id, id));
}
