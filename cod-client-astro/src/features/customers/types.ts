import type { OrderStatus } from "@/features/orders/types";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  phone2: string | null;
  wilayaId: number | null;
  communeId: string | null;
  wilaya: string;
  commune: string | null;
  address: string | null;
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
  lastOrderAt: string | null;
  recentOrders?: Array<Record<string, unknown>>;
}

export interface CustomerOrderStatus {
  id: string;
  orderId: string;
  status: string;
  timestamp: string;
  by: string | null;
}

export interface CustomerOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  price: number;
  createdAt: string;
  wilayaId: number | null;
  communeId: string | null;
  wilaya: string | null;
  commune: string | null;
  statusHistory: CustomerOrderStatus[];
}

export interface CustomerGroup {
  id: string;
  name: string;
  description: string | null;
  color: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerTag {
  id: string;
  name: string;
  color: string;
  assignmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export type CustomerGroupMembership = CustomerGroup & { assignedAt: string };
export type CustomerTagMembership = CustomerTag & { assignedAt: string };
export type CustomerOrderStatusValue = OrderStatus | string;

export interface CustomerFormValues {
  name: string;
  phone: string;
  phone2: string;
  wilayaId: string;
  communeId: string;
  address: string;
}
