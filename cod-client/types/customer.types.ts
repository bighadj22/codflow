// Customer related types

export interface Customer {
  id: string;
  name: string;
  phone: string;
  phone2?: string;
  wilayaId?: number;
  communeId?: string;
  wilaya: string;
  commune?: string;
  address?: string;
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
  lastOrderAt?: string;
}

export interface CustomerFormState {
  name: string;
  phone: string;
  phone2?: string;
  wilaya: string;
  commune?: string;
  address?: string;
}
