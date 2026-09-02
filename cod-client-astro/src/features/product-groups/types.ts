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

export interface ProductCategoryFormValues {
  name: string;
  slug: string;
  description: string;
  parentId: string;
  imageUrl: string;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
}
