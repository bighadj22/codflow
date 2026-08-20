export interface CustomerGroup {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerGroupMember {
  id: string;
  name: string;
  phone: string;
  wilaya: string;
  totalOrders: number;
  totalSpent: number;
  assignedAt: string;
}

export interface CustomerGroupWithMembers extends CustomerGroup {
  members: CustomerGroupMember[];
}

export interface CustomerGroupSummary {
  id: string;
  name: string;
  color: string;
  assignedAt: string;
}
