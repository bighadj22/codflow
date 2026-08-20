export type VariantData = {
  id: string;
  price: number;
  compareAtPrice: number | null;
  inventory: number;
  variations: Record<string, string>;
  isDefault: boolean;
};

export type OfferData = {
  id: string;
  discountType: "free" | "free_shipping";
  triggerQuantity: number;
  triggerVariantId: string | null;
  rewardQuantity: number;
  rewardProductName: string;
  rewardVariantLabel: string | null;
};

export interface ProductContext {
  // -- Immutable config --
  variants: VariantData[];
  allOffers: OfferData[];
  cur: string;
  shippingCalc: string;
  shippingFree: string;
  communePlaceholder: string;
  communeLoading: string;
  communeDisabled: string;
  isRTL: boolean;
  trackInventory: boolean;
  outOfStockLabel: string;
  qtyMaxStockLabel: string;
  productInventory: number;

  // -- Mutable state --
  selectedOpts: Record<string, string>;
  currentPrice: number;
  currentShipping: number;
  currentOfferId: string | null;
  currentVariantMax: number;
  hasStockCap: boolean;
  rates: Record<string, { home: number; stopDesk: number }>;

  // -- DOM refs --
  tierLabels: NodeListOf<HTMLElement>;
  qtyInput: HTMLInputElement | null;
  offerIdInput: HTMLInputElement | null;
  variantSelectionsInput: HTMLInputElement | null;
  priceInput: HTMLInputElement | null;
  variantIdInput: HTMLInputElement | null;
  variantLabelInput: HTMLInputElement | null;
  wilayaSelect: HTMLSelectElement | null;
  gallery: HTMLElement | null;
  dots: NodeListOf<HTMLButtonElement>;
  thumbs: NodeListOf<HTMLButtonElement>;
  submitBtn: HTMLButtonElement | null;
  submitLabel: string;
  qtyPlusBtn: HTMLButtonElement | null;
  qtyStockHint: HTMLParagraphElement | null;

  // -- Cross-module callbacks (wired by orchestrator) --
  updatePriceUI: () => void;
  refreshShipping: () => void;
  updateTierPrices: () => void;
  updateTierVisibility: () => void;
  updateQtyState: () => void;
  updateVariantSelectionsInput: () => void;

  // -- Utility --
  fmt: (n: number) => string;
}
