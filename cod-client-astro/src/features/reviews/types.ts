export type ReviewStatus = "pending" | "approved" | "rejected";

export interface Review {
  id: string;
  storeId: string;
  productId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  helpfulCount: number;
  productName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewListResult {
  rows: Review[];
  total: number;
  pendingCount: number;
}
