// ─── Product Catalog Types ────────────────────────────────────────────────────

export type ProductType = "PHYSICAL" | "DIGITAL";
export type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

// ─── Category ─────────────────────────────────────────────────────────────────

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
  imageUrl?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  position: number;
  productsCount?: number;
  children?: ProductCategory[];
  createdAt: string;
  updatedAt: string;
}

// ─── Variant Options ──────────────────────────────────────────────────────────

export interface VariantOptionValue {
  value: string;
  hexColor?: string | null;
}

export interface VariantOption {
  name: string;
  values: VariantOptionValue[];
}

// ─── Product Variant ──────────────────────────────────────────────────────────

export interface ProductVariant {
  id: string;
  productId: string;
  variations: Record<string, string>; // {"Color": "Red", "Size": "M"}
  currency: string;
  price: number;            // in DZD
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

// ─── Product ──────────────────────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  handle: string;
  currency: string;
  price: number;            // base price in DZD
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

// ─── Product Image ────────────────────────────────────────────────────────────

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

// ─── Form State ───────────────────────────────────────────────────────────────

export interface ProductFormState {
  name: string;
  description: string;
  handle: string;
  price: string;
  compareAtPrice: string;
  costPrice: string;
  type: ProductType;
  hasVariants: boolean;
  variantOptions: VariantOptionFormState[];
  sku: string;
  inventory: string;
  trackInventory: boolean;
  categoryId: string;
  tags: string[];
  visibility: boolean;
  status: ProductStatus;
}

export interface VariantOptionFormState {
  id: string; // temp UI key
  name: string;
  values: VariantOptionValueFormState[];
}

export interface VariantOptionValueFormState {
  id: string; // temp UI key
  value: string;
  hexColor: string;
}
