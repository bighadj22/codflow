import { z } from "zod";
import { CUSTOMER_TOOL_SCHEMAS } from "@/endpoints/customers/ai-tools";
import { DRIVER_TOOL_SCHEMAS } from "@/endpoints/drivers/ai-tools";
import { DRIVER_PAYMENT_TOOL_SCHEMAS } from "@/endpoints/driver-payments/ai-tools";
import { PRODUCT_TOOL_SCHEMAS } from "@/endpoints/products/ai-tools";
import { PRODUCT_GROUP_TOOL_SCHEMAS } from "@/endpoints/product-groups/ai-tools";
import { OFFER_TOOL_SCHEMAS } from "@/endpoints/offers/ai-tools";
import { VARIANT_TOOL_SCHEMAS } from "@/endpoints/variants/ai-tools";
import { WILAYA_TOOL_SCHEMAS } from "@/endpoints/wilayas/ai-tools";
import { STOCK_TOOL_SCHEMAS } from "@/endpoints/stock/ai-tools";
import { SHIPPING_PROFILE_TOOL_SCHEMAS } from "@/endpoints/shipping-profiles/ai-tools";
import { REVIEW_TOOL_SCHEMAS } from "@/endpoints/reviews/ai-tools";
import { CUSTOMER_GROUP_TOOL_SCHEMAS } from "@/endpoints/customer-groups/ai-tools";
import { CUSTOMER_TAG_TOOL_SCHEMAS } from "@/endpoints/customer-tags/ai-tools";
import { ORDER_TOOL_SCHEMAS } from "@/endpoints/orders/ai-tools";

/**
 * Tool name → Zod input shape, registered as `z.object(shape)` on the MCP
 * server. Derived by merging the per-domain maps exported from each ai-tools
 * module — the same schema objects their execute() bodies validate against,
 * so the advertised tools/list inputSchema and the executed validation cannot
 * drift apart.
 */
const SCHEMA_SOURCES: Record<string, z.ZodRawShape>[] = [
  CUSTOMER_TOOL_SCHEMAS,
  DRIVER_TOOL_SCHEMAS,
  DRIVER_PAYMENT_TOOL_SCHEMAS,
  PRODUCT_TOOL_SCHEMAS,
  PRODUCT_GROUP_TOOL_SCHEMAS,
  OFFER_TOOL_SCHEMAS,
  VARIANT_TOOL_SCHEMAS,
  WILAYA_TOOL_SCHEMAS,
  STOCK_TOOL_SCHEMAS,
  SHIPPING_PROFILE_TOOL_SCHEMAS,
  REVIEW_TOOL_SCHEMAS,
  CUSTOMER_GROUP_TOOL_SCHEMAS,
  CUSTOMER_TAG_TOOL_SCHEMAS,
  ORDER_TOOL_SCHEMAS,
];

export const TOOL_SCHEMAS: Record<string, z.ZodRawShape> = Object.assign(
  {},
  ...SCHEMA_SOURCES,
);

export const TOOL_NAMES = Object.keys(TOOL_SCHEMAS).sort();
