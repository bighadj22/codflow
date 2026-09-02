export interface CustomerTag {
  id: string;
  name: string;
  color: string;
  assignmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerTagAssigned {
  id: string;
  name: string;
  phone: string;
  wilaya: string;
  totalOrders: number;
  totalSpent: number;
  assignedAt: string;
}

export interface CustomerTagWithCustomers extends CustomerTag {
  customers: CustomerTagAssigned[];
}

export interface CustomerTagFormValues {
  name: string;
  color: string;
}
