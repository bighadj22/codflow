// Driver related types
import type { Order } from "./order.types";

export type DriverStatus = "available" | "busy" | "inactive";
export type VehicleType = "motorcycle" | "car" | "van";
export type DriverPaymentType = "cod_remittance" | "fee_payment" | "net_settlement";

export interface DriverPayment {
  id: string;
  driverId: string;
  type: DriverPaymentType;
  /** Settled amount (COD, fee, or net depending on type). */
  amount: number;
  orderCount: number;
  notes: string | null;
  /** User ID of the team member who recorded this payment. */
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

/**
 * Per-wilaya payroll entry for a driver — only configured rows.
 *
 * The server's list endpoint returns a sparse overlay of all 58 wilayas with
 * `feePerDelivery: null` for unconfigured ones; `getDriverCompensations`
 * filters those out so consumers always see non-null configured rows.
 *
 * `createdAt`/`updatedAt` are present on PUT responses but absent on the list
 * overlay, hence optional.
 */
export interface DriverCompensation {
  wilayaId: number;
  wilayaName?: string;
  wilayaNameAr?: string;
  feePerDelivery: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  phone2?: string | null;
  vehicleType?: VehicleType | null;
  status: DriverStatus;
  /** Number of wilayas this driver has a compensation row for. Populated by list + detail queries. */
  compensationWilayaCount?: number;
  totalDelivered: number;
  totalEarnings: number;
  pendingCash: number;
  totalPaid: number;
  notes?: string | null;
  /** Last 10 orders for this driver — populated when fetching by ID. */
  recentOrders?: Order[];
  createdAt: string;
  updatedAt: string;
}
