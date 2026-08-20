import { z } from "zod";

export const createPaymentSchema = z.object({
  driverId: z.string().min(1).describe("The UUID of the driver receiving or making the payment"),
  type: z.enum(["cod_remittance", "fee_payment", "net_settlement"]).describe("The type of payment: 'cod_remittance' (remitting cash to business), 'fee_payment' (business paying driver fees), or 'net_settlement' (both at once)"),
  orderIds: z.array(z.string().min(1)).min(1, "Select at least one order").describe("List of order UUIDs to settle in this payment. Orders must be in 'delivered' status."),
  notes: z.string().optional().describe("Internal notes about this payment record"),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
