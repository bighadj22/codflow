/**
 * CodMcpAgent — the Durable Object class that runs one MCP session.
 *
 * The Cloudflare `agents` package treats each MCP session as a Durable
 * Object instance, so session state (transport, elicitation promises,
 * initialize request) survives the streaming lifetime of a single
 * streamable-HTTP connection. We subclass `McpAgent` — the only parts we
 * override are:
 *
 *   • `server`  — the `@modelcontextprotocol/sdk` McpServer that holds
 *                 tools and advertises elicitation support.
 *   • `init()`  — called once per session; we read `this.props` (populated
 *                 by the /mcp Hono route) and register exactly the tools
 *                 this user's OAuth scopes allow. Gated at registration
 *                 time, not execute time — see `./registry.ts`.
 *
 * Every tool is wrapped with:
 *   1. `maybeConfirm()` — HITL elicitation for DANGEROUS_TOOLS.
 *   2. The existing Vercel AI SDK `execute()` the tool was built with.
 *   3. An activity-log entry tagged `via="mcp"` (wired in MCP-12).
 *
 * The agent is completely stateless across sessions — `SessionState = {}`.
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Env } from "@/types/env";
import type { McpProps } from "./props";
import { buildToolsForUser } from "./registry";
import { maybeConfirm } from "./elicit";
import type { Tool } from "ai";
import { getDb } from "@/db";
import { ACTIONS, logActivity } from "@/lib/activity";

// Import validation schemas for proper MCP tool schemas
import { 
  createCustomerSchema, 
  updateCustomerSchema, 
  customerFiltersSchema 
} from "@/endpoints/customers/validation";
import { 
  createDriverSchema, 
  updateDriverSchema, 
  updateDriverStatusSchema, 
  driverFiltersSchema 
} from "@/endpoints/drivers/validation";
import { createPaymentSchema } from "@/endpoints/driver-payments/validation";
import {
  createProductSchema,
  updateProductSchema,
  updateStatusSchema as productUpdateStatusSchema,
  productFiltersSchema,
} from "@/endpoints/products/validation";
import {
  createGroupSchema,
  updateGroupSchema,
  groupFiltersSchema,
} from "@/endpoints/product-groups/validation";
import {
  createOfferSchema,
  updateOfferSchema,
} from "@/endpoints/offers/validation";
import {
  createVariantSchema,
  updateVariantSchema,
} from "@/endpoints/variants/validation";
import { wilayaFiltersSchema } from "@/endpoints/wilayas/validation";
import {
  adjustStockSchema,
  updateThresholdSchema,
  stockAlertsFiltersSchema,
  MOVEMENT_TYPES,
} from "@/endpoints/stock/validation";
import {
  createProfileSchema,
  updateProfileSchema,
  bulkRulesSchema,
  communeOverrideSchema,
} from "@/endpoints/shipping-profiles/validation";
// Reviews has no separate validation.ts — schemas are defined inline in ai-tools.ts
import {
  createCustomerGroupSchema,
  updateCustomerGroupSchema,
  customerGroupFiltersSchema,
} from "@/endpoints/customer-groups/validation";
import {
  createCustomerTagSchema,
  updateCustomerTagSchema,
  customerTagFiltersSchema,
} from "@/endpoints/customer-tags/validation";
import {
  createOrderSchema,
  updateOrderStatusSchema,
  assignDriverSchema,
  returnOrderProductSchema,
  orderFiltersSchema,
  ORDER_STATUSES,
} from "@/endpoints/orders/validation";

type SessionState = Record<string, never>;

/**
 * Mapping of tool names to their proper Zod validation schemas.
 * This ensures MCP clients know what parameters each tool expects.
 */
const TOOL_SCHEMAS: Record<string, Record<string, any>> = {
  // Customer tools
  "listCustomers": customerFiltersSchema.shape,
  "getCustomerDetails": { customerId: z.string().describe("UUID of the customer") },
  "findCustomerByPhone": { phone: z.string().regex(/^0[5-7]\d{8}$/).describe("Algerian phone number (e.g., 0555123456)") },
  "getCustomerOrderHistory": { customerId: z.string().describe("UUID of the customer") },
  "getCustomerMemberships": { customerId: z.string().describe("UUID of the customer") },
  "createNewCustomer": createCustomerSchema.shape,
  "updateCustomerProfile": {
    customerId: z.string().describe("UUID of the customer to update"),
    updates: z.object(updateCustomerSchema.shape).describe("Fields to update")
  },
  "deleteCustomer": { customerId: z.string().describe("UUID of the customer to delete") },

  // Driver tools  
  "listDrivers": driverFiltersSchema.shape,
  "getDriverDetails": { driverId: z.string().describe("UUID of the driver") },
  "createNewDriver": createDriverSchema.shape,
  "updateDriverProfile": {
    driverId: z.string().describe("UUID of the driver to update"),
    updates: z.object(updateDriverSchema.shape).describe("Fields to update")
  },
  "updateDriverStatus": {
    driverId: z.string().describe("UUID of the driver"),
    ...updateDriverStatusSchema.shape
  },
  "deleteDriver": { driverId: z.string().describe("UUID of the driver to delete") },

  // Driver payment tools
  "listDriverPayments": { driverId: z.string().describe("UUID of the driver") },
  "getPendingSettlements": { driverId: z.string().describe("UUID of the driver") },
  "createDriverSettlement": {
    ...createPaymentSchema.shape,
    agentName: z.string().describe("Name of the agent processing this settlement")
  },

  // Product tools
  "listProducts": productFiltersSchema.shape,
  "getProductDetails": { productId: z.string().describe("UUID of the product") },
  "createNewProduct": createProductSchema.shape,
  "updateProductDetails": {
    productId: z.string().describe("UUID of the product to update"),
    updates: z.object(updateProductSchema.shape).describe("Fields to update (all optional)")
  },
  "updateProductStatus": {
    productId: z.string().describe("UUID of the product"),
    ...productUpdateStatusSchema.shape,
  },
  "deleteProduct": { productId: z.string().describe("UUID of the product to delete") },

  // Product group tools
  "listProductGroups": groupFiltersSchema.shape,
  "getProductGroupDetails": { groupId: z.string().describe("UUID of the product group") },
  "createProductGroup": createGroupSchema.shape,
  "updateProductGroup": {
    groupId: z.string().describe("UUID of the product group to update"),
    updates: z.object(updateGroupSchema.shape).describe("Fields to update (all optional)")
  },
  "deleteProductGroup": { groupId: z.string().describe("UUID of the product group to delete") },

  // Offer tools
  "listOffers": {},
  "getOfferDetails": { offerId: z.string().describe("UUID of the offer") },
  "createOffer": createOfferSchema.shape,
  "updateOffer": {
    offerId: z.string().describe("UUID of the offer to update"),
    updates: z.object(updateOfferSchema.shape).describe("Fields to update (all optional)")
  },
  "deleteOffer": { offerId: z.string().describe("UUID of the offer to delete") },

  // Variant tools
  "listProductVariants": { productId: z.string().describe("UUID of the parent product") },
  "getVariantDetails": { variantId: z.string().describe("UUID of the variant") },
  "createProductVariant": {
    productId: z.string().describe("UUID of the parent product"),
    variant: z.object(createVariantSchema.shape).describe("Variant data to create")
  },
  "updateVariant": {
    variantId: z.string().describe("UUID of the variant to update"),
    updates: z.object(updateVariantSchema.shape).describe("Fields to update (all optional)")
  },
  "deleteProductVariant": { variantId: z.string().describe("UUID of the variant to delete") },

  // Wilaya tools
  "listWilayas": wilayaFiltersSchema.shape,
  "listWilayaCommunes": {
    wilayaId: z.number().int().min(1).max(58).describe("Integer ID of the wilaya (1–58)")
  },

  // Stock tools
  "getStockOverview": {},
  "getStockAlerts": stockAlertsFiltersSchema.shape,
  "getProductStockHistory": {
    productId: z.string().describe("UUID of the product"),
    variantId: z.string().optional().describe("UUID of a specific variant to filter history"),
    limit: z.number().int().positive().max(100).optional().describe("Max results (default 20)"),
    offset: z.number().int().min(0).optional().describe("Pagination offset (default 0)"),
  },
  "adjustProductStock": {
    productId: z.string().describe("UUID of the simple product"),
    agentName: z.string().describe("Name of the agent making this adjustment"),
    ...adjustStockSchema.shape,
  },
  "adjustVariantStock": {
    productId: z.string().describe("UUID of the parent product"),
    variantId: z.string().describe("UUID of the variant to adjust"),
    agentName: z.string().describe("Name of the agent making this adjustment"),
    ...adjustStockSchema.shape,
  },
  "updateProductStockThreshold": {
    productId: z.string().describe("UUID of the simple product"),
    lowStockThreshold: updateThresholdSchema.shape.lowStockThreshold,
  },
  "updateVariantStockThreshold": {
    productId: z.string().describe("UUID of the parent product"),
    variantId: z.string().describe("UUID of the variant"),
    lowStockThreshold: updateThresholdSchema.shape.lowStockThreshold,
  },

  // Shipping profile tools
  "listShippingProfiles": {},
  "getShippingProfile": { profileId: z.string().describe("ID of the shipping profile") },
  "getDefaultShippingRules": {},
  "createShippingProfile": createProfileSchema.shape,
  "updateShippingProfile": {
    profileId: z.string().describe("ID of the shipping profile to update"),
    updates: z.object(updateProfileSchema.shape).describe("Fields to update (all optional)")
  },
  "deleteShippingProfile": { profileId: z.string().describe("ID of the shipping profile to delete") },
  "setShippingProfileRules": {
    profileId: z.string().describe("ID of the shipping profile"),
    rules: bulkRulesSchema.shape.rules,
  },
  "listCommuneOverrides": {
    profileId: z.string().describe("ID of the shipping profile"),
    wilayaId: z.number().int().min(1).max(58).describe("Wilaya integer ID (1–58)"),
  },
  "setShippingCommuneOverride": {
    profileId: z.string().describe("ID of the shipping profile"),
    wilayaId: z.number().int().min(1).max(58).describe("Wilaya integer ID (1–58)"),
    communeId: z.string().describe("UUID of the commune"),
    override: z.object(communeOverrideSchema.shape).describe("Override fields (null = inherit from wilaya rule)"),
  },
  "resetShippingCommuneOverride": {
    profileId: z.string().describe("ID of the shipping profile"),
    wilayaId: z.number().int().min(1).max(58).describe("Wilaya integer ID (1–58)"),
    communeId: z.string().describe("UUID of the commune to reset"),
  },

  // Review tools
  "listReviews": {
    status: z.enum(["pending", "approved", "rejected"]).optional().describe("Filter by moderation status"),
    productId: z.string().optional().describe("Filter by product UUID"),
    limit: z.number().int().min(1).max(100).optional().describe("Max results (default 20)"),
    offset: z.number().int().min(0).optional().describe("Pagination offset (default 0)"),
  },
  "moderateReview": {
    reviewId: z.string().describe("UUID of the review to moderate"),
    status: z.enum(["pending", "approved", "rejected"]).describe("New moderation status"),
  },
  "deleteReview": { reviewId: z.string().describe("UUID of the review to delete") },

  // Customer group tools
  "listCustomerGroups": customerGroupFiltersSchema.shape,
  "getCustomerGroupDetails": {
    groupId: z.string().describe("UUID of the customer group"),
    withMembers: z.boolean().optional().describe("Include full member list (default false)"),
  },
  "createCustomerGroup": createCustomerGroupSchema.shape,
  "updateCustomerGroup": {
    groupId: z.string().describe("UUID of the group to update"),
    updates: z.object(updateCustomerGroupSchema.shape).describe("Fields to update (all optional)"),
  },
  "deleteCustomerGroup": { groupId: z.string().describe("UUID of the customer group to delete") },
  "addCustomerToGroup": {
    groupId: z.string().describe("UUID of the customer group"),
    customerId: z.string().describe("UUID of the customer to add"),
  },
  "removeCustomerFromGroup": {
    groupId: z.string().describe("UUID of the customer group"),
    customerId: z.string().describe("UUID of the customer to remove"),
  },

  // Customer tag tools
  "listCustomerTags": customerTagFiltersSchema.shape,
  "getCustomerTagDetails": {
    tagId: z.string().describe("UUID of the customer tag"),
    withCustomers: z.boolean().optional().describe("Include full list of assigned customers (default false)"),
  },
  "createCustomerTag": createCustomerTagSchema.shape,
  "updateCustomerTag": {
    tagId: z.string().describe("UUID of the tag to update"),
    updates: z.object(updateCustomerTagSchema.shape).describe("Fields to update (all optional)"),
  },
  "deleteCustomerTag": { tagId: z.string().describe("UUID of the customer tag to delete") },
  "assignTagToCustomer": {
    tagId: z.string().describe("UUID of the customer tag"),
    customerId: z.string().describe("UUID of the customer to tag"),
  },
  "unassignTagFromCustomer": {
    tagId: z.string().describe("UUID of the customer tag"),
    customerId: z.string().describe("UUID of the customer to untag"),
  },

  // Order tools
  "listOrders": orderFiltersSchema.shape,
  "getOrderDetails": { orderId: z.string().describe("UUID of the order") },
  "createOrder": createOrderSchema.shape,
  "updateOrderStatus": {
    orderId: z.string().describe("UUID of the order"),
    status: updateOrderStatusSchema.shape.status,
  },
  "assignDriverToOrder": {
    orderId: z.string().describe("UUID of the order"),
    driverId: z.string().describe("UUID of the driver to assign"),
  },
  "unassignDriverFromOrder": { orderId: z.string().describe("UUID of the order") },
  "recordOrderProductReturn": {
    orderId: z.string().describe("UUID of the order"),
    productLineId: z.string().describe("UUID of the order product line"),
    returnedQuantity: returnOrderProductSchema.shape.returnedQuantity,
  },
  "deleteOrder": { orderId: z.string().describe("UUID of the order to delete") },
};

export class CodMcpAgent extends McpAgent<Env, SessionState, McpProps> {
  // Elicitation is a CLIENT capability (the MCP client has to support it),
  // so the server doesn't advertise it here. `elicitInput()` still works;
  // the SDK gates it at call time based on the client's announced caps.
  server = new McpServer({ name: "CodFlow CRM", version: "1.0.0" });

  async init(): Promise<void> {
    const props = this.props;
    if (!props) {
      // Safety net: should never happen because the /mcp route stashes props
      // BEFORE delegating to the agent. Register zero tools and let the MCP
      // client see an empty tool list rather than crash the session.
      return;
    }

    const tools = buildToolsForUser(this.env, props);
    for (const [name, definition] of Object.entries(tools)) {
      this.registerTool(name, definition);
    }
  }

  /**
   * Adapt one Vercel-AI-SDK tool to the MCP SDK's `server.tool(name, schema, handler)`
   * API. The MCP SDK expects 3 parameters, not 4. Descriptions should be in the
   * Zod schema using .describe().
   */
  private registerTool(name: string, tool: Tool): void {
    const schema = TOOL_SCHEMAS[name] ?? {};
    const description = typeof tool.description === "string" ? tool.description : `Tool: ${name}`;

    this.server.tool(
      name,
      description,
      schema,
      async (args: unknown) => {
        const props = this.props!;
        const db = getDb(this.env.DB);
        const actor = { id: props.userId, name: props.name || props.email, role: props.role };

        // HITL gate. Returns "accepted" instantly for non-dangerous tools.
        const decision = await maybeConfirm(this.server, name, args, "");
        if (decision === "declined") {
          await logActivity(db, actor, ACTIONS.MCP_TOOL_DECLINED, {
            type: "tool", id: name, label: name,
          }, { via: "mcp", args });
          return {
            content: [{ type: "text", text: "Action cancelled by user." }],
          };
        }

        let result: unknown;
        let ok = true;
        let errorMessage: string | undefined;
        try {
          const execute = (tool as { execute?: (args: unknown, ctx: unknown) => unknown }).execute;
          if (typeof execute !== "function") {
            throw new Error(`Tool ${name} has no execute()`);
          }
          result = await execute(args, { toolCallId: "" });
          // ai-tools convention: `{ success: false, error }` on handled failure.
          if (result && typeof result === "object" && (result as { success?: boolean }).success === false) {
            ok = false;
            errorMessage = (result as { error?: string }).error;
          }
        } catch (err) {
          ok = false;
          errorMessage = err instanceof Error ? err.message : String(err);
          await logActivity(db, actor, ACTIONS.MCP_TOOL_CALLED, {
            type: "tool", id: name, label: name,
          }, { via: "mcp", args, ok: false, error: errorMessage });
          return {
            content: [{ type: "text", text: JSON.stringify({ success: false, error: errorMessage }) }],
            isError: true,
          };
        }

        await logActivity(db, actor, ACTIONS.MCP_TOOL_CALLED, {
          type: "tool", id: name, label: name,
        }, { via: "mcp", args, ok, ...(errorMessage ? { error: errorMessage } : {}) });

        return {
          content: [{ type: "text", text: safeJSON(result) }],
        };
      },
    );
  }
}

function safeJSON(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
