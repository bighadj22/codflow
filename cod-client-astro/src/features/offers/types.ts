export type OfferDiscountType = "free" | "free_shipping";
export type OfferStatus = "active" | "inactive";

export interface OfferProduct {
  id: string;
  name: string;
  handle: string;
}

export interface OfferVariant {
  id: string;
  label: string;
}

export interface Offer {
  id: string;
  name: string;
  status: OfferStatus;
  triggerQuantity: number;
  rewardQuantity: number;
  discountType: OfferDiscountType;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
  triggerProduct: OfferProduct | null;
  triggerVariant: OfferVariant | null;
  rewardProduct: OfferProduct | null;
  rewardVariant: OfferVariant | null;
}

export interface OfferFormValues {
  name: string;
  discountType: OfferDiscountType;
  triggerProductId: string;
  triggerVariantId: string;
  triggerQuantity: string;
  rewardProductId: string;
  rewardVariantId: string;
  rewardQuantity: string;
  startsAt: string;
  endsAt: string;
  status: OfferStatus;
}

export interface CreateOfferData {
  name: string;
  discountType: OfferDiscountType;
  triggerProductId: string;
  triggerVariantId?: string;
  triggerQuantity: number;
  rewardProductId?: string;
  rewardVariantId?: string;
  rewardQuantity: number;
  startsAt?: string;
  endsAt?: string;
  status: OfferStatus;
}
