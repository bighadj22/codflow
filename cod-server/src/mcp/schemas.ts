import { z } from "zod";
import { CUSTOMER_TOOL_SCHEMAS, CUSTOMER_TOOL_OUTPUT_SCHEMAS } from "@/endpoints/customers/ai-tools";
import { DRIVER_TOOL_SCHEMAS, DRIVER_TOOL_OUTPUT_SCHEMAS } from "@/endpoints/drivers/ai-tools";
import { DRIVER_PAYMENT_TOOL_SCHEMAS, DRIVER_PAYMENT_TOOL_OUTPUT_SCHEMAS } from "@/endpoints/driver-payments/ai-tools";
import { PRODUCT_TOOL_SCHEMAS, PRODUCT_TOOL_OUTPUT_SCHEMAS } from "@/endpoints/products/ai-tools";
import { PRODUCT_GROUP_TOOL_SCHEMAS, PRODUCT_GROUP_TOOL_OUTPUT_SCHEMAS } from "@/endpoints/product-groups/ai-tools";
import { OFFER_TOOL_SCHEMAS, OFFER_TOOL_OUTPUT_SCHEMAS } from "@/endpoints/offers/ai-tools";
import {
  LANDING_PAGE_TOOL_SCHEMAS,
  LANDING_PAGE_TOOL_META,
  LANDING_PAGE_TOOL_OUTPUT_SCHEMAS,
} from "@/endpoints/landing-pages/ai-tools";
import { VARIANT_TOOL_SCHEMAS, VARIANT_TOOL_OUTPUT_SCHEMAS } from "@/endpoints/variants/ai-tools";
import { WILAYA_TOOL_SCHEMAS, WILAYA_TOOL_OUTPUT_SCHEMAS } from "@/endpoints/wilayas/ai-tools";
import { STOCK_TOOL_SCHEMAS, STOCK_TOOL_OUTPUT_SCHEMAS } from "@/endpoints/stock/ai-tools";
import { SHIPPING_PROFILE_TOOL_SCHEMAS, SHIPPING_PROFILE_TOOL_OUTPUT_SCHEMAS } from "@/endpoints/shipping-profiles/ai-tools";
import { REVIEW_TOOL_SCHEMAS, REVIEW_TOOL_OUTPUT_SCHEMAS } from "@/endpoints/reviews/ai-tools";
import { CUSTOMER_GROUP_TOOL_SCHEMAS, CUSTOMER_GROUP_TOOL_OUTPUT_SCHEMAS } from "@/endpoints/customer-groups/ai-tools";
import { CUSTOMER_TAG_TOOL_SCHEMAS, CUSTOMER_TAG_TOOL_OUTPUT_SCHEMAS } from "@/endpoints/customer-tags/ai-tools";
import { ORDER_TOOL_SCHEMAS, ORDER_TOOL_OUTPUT_SCHEMAS } from "@/endpoints/orders/ai-tools";

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
  LANDING_PAGE_TOOL_SCHEMAS,
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

/**
 * Tool name → Zod output schema, advertised as the tool descriptor's
 * outputSchema (tools/list) and enforced against every result's
 * structuredContent (tools/call — see src/mcp/execute-tool.ts). Same
 * per-domain merge pattern as TOOL_SCHEMAS: every tool's success payload and
 * handled-failure envelope are described by the union built in
 * src/lib/tool-output-schema.ts.
 */
const OUTPUT_SCHEMA_SOURCES: Record<string, z.ZodType>[] = [
  CUSTOMER_TOOL_OUTPUT_SCHEMAS,
  DRIVER_TOOL_OUTPUT_SCHEMAS,
  DRIVER_PAYMENT_TOOL_OUTPUT_SCHEMAS,
  PRODUCT_TOOL_OUTPUT_SCHEMAS,
  PRODUCT_GROUP_TOOL_OUTPUT_SCHEMAS,
  OFFER_TOOL_OUTPUT_SCHEMAS,
  LANDING_PAGE_TOOL_OUTPUT_SCHEMAS,
  VARIANT_TOOL_OUTPUT_SCHEMAS,
  WILAYA_TOOL_OUTPUT_SCHEMAS,
  STOCK_TOOL_OUTPUT_SCHEMAS,
  SHIPPING_PROFILE_TOOL_OUTPUT_SCHEMAS,
  REVIEW_TOOL_OUTPUT_SCHEMAS,
  CUSTOMER_GROUP_TOOL_OUTPUT_SCHEMAS,
  CUSTOMER_TAG_TOOL_OUTPUT_SCHEMAS,
  ORDER_TOOL_OUTPUT_SCHEMAS,
];

export const TOOL_OUTPUT_SCHEMAS: Record<string, z.ZodType> = Object.assign(
  {},
  ...OUTPUT_SCHEMA_SOURCES,
);

/**
 * Tool name → tool-descriptor `_meta` (client-specific extensions), attached
 * at registration time in server-factory.ts. Sources are per-domain maps
 * exported from the ai-tools modules — a tool with no entry registers
 * without `_meta`.
 *
 * Current use: `openai/fileParams` (ChatGPT file-object inputs) — the
 * supported way for the ChatGPT runtime to pass conversation files to a
 * tool call, since arguments are model-generated JSON and can never carry
 * image bytes.
 */
const META_SOURCES: Record<string, Record<string, unknown>>[] = [LANDING_PAGE_TOOL_META];

export const TOOL_META: Record<string, Record<string, unknown>> = Object.assign(
  {},
  ...META_SOURCES,
);
