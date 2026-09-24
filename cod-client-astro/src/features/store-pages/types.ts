export type StorePageKind = "terms" | "privacy" | "refund" | "shipping" | "custom";
export type StorePageStatus = "published" | "draft";
export type PageLocale = "ar" | "en" | "fr";
export type TranslationSource = "template" | "merchant";

export interface StorePageTranslationSummary {
  locale: PageLocale;
  title: string;
  source: TranslationSource;
  updatedAt: string;
}

export interface StorePageSummary {
  id: string;
  kind: StorePageKind;
  slug: string;
  status: StorePageStatus;
  showInFooter: boolean;
  position: number;
  templateVersion: number | null;
  createdAt: string;
  updatedAt: string;
  translations: StorePageTranslationSummary[];
}

export interface StorePageTranslationBody {
  pageId: string;
  locale: PageLocale;
  title: string;
  bodyHtml: string;
  bodyPlain: string;
  metaTitle: string | null;
  metaDescription: string | null;
  source: TranslationSource;
  updatedAt: string;
}

export interface StorePageDetail extends StorePageSummary {
  bodies: Partial<Record<PageLocale, StorePageTranslationBody>>;
}

export interface StoreLegalProfile {
  storeId: string;
  legalName: string | null;
  rcNumber: string | null;
  nif: string | null;
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  returnWindowDays: number;
  deliveryMinDays: number;
  deliveryMaxDays: number;
  updatedAt: string;
}

export interface CreateCustomPageInput {
  slug: string;
  locale: PageLocale;
  title: string;
  bodyHtml: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  showInFooter?: boolean;
  position?: number;
}

export interface UpdateStorePageMetaInput {
  slug?: string;
  status?: StorePageStatus;
  showInFooter?: boolean;
  position?: number;
}

export interface SaveTranslationInput {
  title: string;
  bodyHtml: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export interface UpsertLegalProfileInput {
  legalName?: string | null;
  rcNumber?: string | null;
  nif?: string | null;
  address?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  returnWindowDays?: number;
  deliveryMinDays?: number;
  deliveryMaxDays?: number;
}
