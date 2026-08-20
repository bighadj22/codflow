/**
 * ZR Express API — Request / Response Types
 * Base URL: https://api.zrexpress.app
 * Auth: X-Api-Key: {secretKey}  +  X-Tenant: {tenantId}
 * API Version: v1
 */

// ─── Territory Search ─────────────────────────────────────────────────────────

export interface ZrSearchTerritoriesRequest {
  keyword?: string | null;
  pageSize: number;
  pageNumber: number;
  id?: string | null;
  deliveryType?: { value?: string | null } | null;
  includeUnavailable?: boolean;
}

export interface ZrTerritoryItem {
  id: string;
  /** Integer code — matches Algeria wilaya ID (1–58) for wilaya-level territories. */
  code: number;
  name: string | null;
  /** Level string, e.g. "state", "city", "district". */
  level: string | null;
  parentId: string | null;
  postalCode: string | null;
  delivery?: { hasHomeDelivery: boolean; hasPickupPoint: boolean } | null;
}

export interface ZrPagedListTerritories {
  /** Spec field name is "items" (PagedList_TerritoryResponse). */
  items: ZrTerritoryItem[] | null;
  pageNumber?: number;
  pageSize?: number;
  totalCount?: number;
  totalPages?: number;
}

// ─── Customer ─────────────────────────────────────────────────────────────────

/** POST /api/v1/customers/individual */
export interface ZrCreateCustomerRequest {
  name?: string | null;
  phone: {
    number1: string;
    number2?: string | null;
  };
}

export interface ZrCreateCustomerResponse {
  /** UUID of the created customer. */
  id: string;
}

// ─── Shared sub-types ─────────────────────────────────────────────────────────

export interface ZrOrderedProductDto {
  productId?: string | null;
  productName?: string | null;
  productSku?: string | null;
  unitPrice: number;
  quantity: number;
  /** "local" | "warehouse" | "none" */
  stockType: string;
}

export interface ZrParcelCustomerDto {
  /** Required: UUID of a pre-existing ZR customer. */
  customerId: string;
  name?: string | null;
  phone?: {
    number1: string;
    number2?: string | null;
  } | null;
}

export interface ZrDeliveryAddressInputDto {
  cityTerritoryId: string;
  districtTerritoryId: string;
  street?: string | null;
}

// ─── Create Single Parcel ─────────────────────────────────────────────────────

/** POST /api/v1/parcels */
export interface ZrCreateParcelRequest {
  customer: ZrParcelCustomerDto;
  deliveryAddress: ZrDeliveryAddressInputDto;
  /** "home" or "pickup-point" */
  deliveryType: string;
  amount: number;
  description?: string | null;
  externalId?: string | null;
  orderedProducts: ZrOrderedProductDto[];
  /**
   * Pickup-point hub UUID — required when deliveryType === "pickup-point".
   * For our flow this is the same value as the pickup-point territory UUID
   * surfaced by `getStopDesks` (i.e. `stationCode` on the order). Mirrors the
   * `hubId` on ZrUpdateDeliveryAddressRequest.
   */
  hubId?: string | null;
}

export interface ZrCreateParcelResponse {
  /** UUID of the created parcel — NOT the tracking number. */
  id: string;
}

// ─── Get Parcel ───────────────────────────────────────────────────────────────

export interface ZrGetParcelResponse {
  id: string;
  trackingNumber: string | null;
  state?: {
    id?: string;
    name: string | null;
    description: string | null;
  } | null;
  situation?: {
    id?: string;
    name?: string | null;
  } | null;
  createdAt?: string | null;
  amount?: number | null;
  deliveryType?: string | null;
  description?: string | null;
  productsDescription?: string | null;
}

// ─── Create Bulk Parcels ──────────────────────────────────────────────────────

/** Single entry for POST /api/v1/parcels/bulk */
export interface ZrSingleParcelCreationRequest {
  customer?: ZrParcelCustomerDto | null;
  deliveryAddress?: ZrDeliveryAddressInputDto | null;
  orderedProducts?: ZrOrderedProductDto[] | null;
  /** "home" or "pickup-point" */
  deliveryType?: string | null;
  description?: string | null;
  amount: number;
  externalId?: string | null;
  /** Required when deliveryType === "pickup-point". See ZrCreateParcelRequest.hubId. */
  hubId?: string | null;
}

/** POST /api/v1/parcels/bulk */
export interface ZrCreateBulkParcelsRequest {
  parcels: ZrSingleParcelCreationRequest[] | null;
}

export interface ZrBulkParcelSuccess {
  /** 0-based index in the input `parcels` array. */
  index: number;
  parcelId: string;
  trackingNumber: string | null;
  externalId: string | null;
}

export interface ZrBulkParcelFailure {
  /** 0-based index in the input `parcels` array. */
  index: number;
  errorCode: string | null;
  errorMessage: string | null;
  externalId: string | null;
}

export interface ZrCreateBulkParcelsResponse {
  totalRequested: number;
  successCount: number;
  failureCount: number;
  successes: ZrBulkParcelSuccess[] | null;
  failures: ZrBulkParcelFailure[] | null;
}

// ─── State History ────────────────────────────────────────────────────────────

export interface ZrStateHistoryItem {
  id: string;
  createdAt: string;
  newState: {
    id: string;
    name: string;
    description: string;
    isBlocking: boolean;
    isLocked: boolean;
    visibleFor?: number;
    editableBy?: number;
    color?: string;
  };
  modifiedBy?: {
    id: string;
    fullName: string;
  };
  situations: unknown[];
}

export type ZrStateHistoryResponse = ZrStateHistoryItem[];

// ─── Delete Bulk Parcels ──────────────────────────────────────────────────────

export interface ZrDeleteBulkSuccess {
  index: number;
  parcelId: string;
  trackingNumber: string;
}

export interface ZrDeleteBulkFailure {
  index: number;
  errorCode: string | null;
  errorMessage: string | null;
  trackingNumber: string | null;
}

export interface ZrDeleteBulkResponse {
  totalRequested: number;
  successCount: number;
  failureCount: number;
  successes: ZrDeleteBulkSuccess[] | null;
  failures: ZrDeleteBulkFailure[] | null;
}

// ─── Update Parcels ───────────────────────────────────────────────────────────

export interface ZrUpdateAmountRequest {
  parcelId: string;
  amount: number;
}

export interface ZrUpdateCustomerRequest {
  parcelId: string;
  name?: string | null;
  phone?: string | null;
}

export interface ZrDeliveryAddressInputDtoUpdate {
  street?: string | null;
  cityTerritoryId?: string;
  districtTerritoryId?: string;
}

export interface ZrUpdateDeliveryAddressRequest {
  parcelId: string;
  deliveryAddress: ZrDeliveryAddressInputDtoUpdate;
  hubId?: string | null;
}

// ─── Label Generation ─────────────────────────────────────────────────────────

export interface ZrGenerateLabelRequest {
  trackingNumbers: string[];
  format?: "a4" | "a6"; // a4 = 4 labels per page, a6 = 1 label per page
}

export interface ZrParcelLabelFile {
  trackingNumber: string;
  fileUrl: string;
}

export interface ZrGenerateLabelResponse {
  parcelLabelFiles: ZrParcelLabelFile[] | null;
  failedTrackingNumbers: string[] | null;
}
