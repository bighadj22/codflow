export type ProductType = "PHYSICAL" | "DIGITAL";
export type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
  imageUrl?: string | null;
  position: number;
  productsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingProfile {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface VariantOptionValue {
  value: string;
  hexColor?: string | null;
}

export interface VariantOption {
  name: string;
  values: VariantOptionValue[];
}

export interface ProductVariant {
  id: string;
  productId: string;
  variations: Record<string, string>;
  currency: string;
  price: number;
  compareAtPrice?: number | null;
  sku?: string | null;
  barcode?: string | null;
  inventory: number;
  lowStockThreshold?: number;
  weightKg?: number | null;
  imageId?: string | null;
  isDefault: boolean;
  active: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  handle: string;
  currency: string;
  price: number;
  compareAtPrice?: number | null;
  costPrice?: number | null;
  type: ProductType;
  hasVariants: boolean;
  variantOptions?: VariantOption[] | null;
  sku?: string | null;
  inventory: number;
  lowStockThreshold?: number;
  trackInventory: boolean;
  categoryId?: string | null;
  shippingProfileId?: string | null;
  tags: string[];
  visibility: boolean;
  status: ProductStatus;
  showInStore: boolean;
  storeFeatured: boolean;
  isUpsell: boolean;
  deletedAt?: string | null;
  publishedAt?: string | null;
  category?: ProductCategory | null;
  variants: ProductVariant[];
  images: ProductImage[];
  variantsCount?: number;
  totalInventory?: number;
  primaryImageSrc?: string | null;
  reviewCount?: number;
  avgRating?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  id: string;
  productId: string;
  src: string;
  r2Key?: string | null;
  srcSm?: string | null;
  srcMd?: string | null;
  srcLg?: string | null;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
  type: number;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export type StockMovementType =
  | "PURCHASE"
  | "ADJUSTMENT_ADD"
  | "ADJUSTMENT_REMOVE"
  | "ORDER_DEDUCTED"
  | "ORDER_CANCELLED"
  | "ORDER_RETURNED"
  | "OFFLINE_SALE";

export interface StockMovement {
  id: string;
  productId: string;
  variantId: string | null;
  type: StockMovementType;
  delta: number;
  qtyBefore: number;
  qtyAfter: number;
  reason: string | null;
  reference: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface StockAlertItem {
  productId: string;
  variantId: string | null;
  productName: string;
  variantLabel: string | null;
  inventory: number;
  lowStockThreshold: number;
  isOutOfStock: boolean;
}

export interface StockOverview {
  totalSkus: number;
  outOfStockCount: number;
  lowStockCount: number;
  totalInventoryValue: number;
  currency: string;
  outOfStockItems: StockAlertItem[];
  lowStockItems: StockAlertItem[];
  allItems: StockAlertItem[];
}

export interface StockHistoryResponse {
  movements: StockMovement[];
  total: number;
}

export interface AdjustStockInput {
  type: StockMovementType;
  delta: number;
  reason?: string;
}

export interface StockAdjustStockResult {
  movement: StockMovement;
  currentInventory: number;
}

export interface VariantOptionFormState {
  id: string;
  name: string;
  values: VariantOptionValueFormState[];
}

export interface VariantOptionValueFormState {
  id: string;
  value: string;
  hexColor: string;
}

export interface ProductFormValues {
  name: string;
  description: string;
  handle: string;
  sku: string;
  categoryId: string;
  shippingProfileId: string;
  price: string;
  compareAtPrice: string;
  costPrice: string;
  status: ProductStatus;
  trackInventory: boolean;
  inventory: string;
  lowStockThreshold: string;
  hasVariants: boolean;
}

/** An upsell offer attached to a product, as returned by the upsells API. */
export interface ProductUpsell {
  id: string;
  productId: string;
  upsellProductId: string;
  name: string;
  description: string | null;
  sku: string | null;
  hasVariants: boolean;
  /** Effective unit price: override, else the upsell product's own price. */
  price: number;
  /** Raw override (null = inherit the upsell product's price). */
  overridePrice: number | null;
  compareAtPrice: number | null;
  variantId: string | null;
  variantLabel: string | null;
  primaryImageSrc: string | null;
  isActive: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUpsellData {
  upsellProductId: string;
  price?: number | null;
  compareAtPrice?: number | null;
  isActive?: boolean;
  position?: number;
}

export type UpdateUpsellData = Omit<Partial<CreateUpsellData>, "upsellProductId">;
