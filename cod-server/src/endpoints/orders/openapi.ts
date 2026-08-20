/**
 * Orders OpenAPI Paths
 */

const orderSchema = { $ref: "#/components/schemas/Order" };
const errorSchema = { $ref: "#/components/schemas/Error" };
const validationErrorSchema = { $ref: "#/components/schemas/ValidationError" };
const json = (schema: object) => ({ "application/json": { schema } });

export const orderPaths = {
  "/api/orders": {
    get: {
      tags: ["Orders"],
      summary: "List orders",
      operationId: "listOrders",
      parameters: [
        {
          name: "status",
          in: "query",
          description: "Filter by status. One of: new, confirmed, unreachable, preparing, ready, assigned, out_for_delivery, delivered, returned, cancelled",
          schema: { type: "string" },
        },
        { name: "wilayaId", in: "query", schema: { type: "integer", minimum: 1, maximum: 58 } },
        { name: "search", in: "query", description: "Search by customer name, phone, or order number", schema: { type: "string" } },
        { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 100 } },
        { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
      ],
      responses: {
        "200": {
          description: "List of orders",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: orderSchema },
              count: { type: "integer" },
            },
          }),
        },
        "400": {
          description: "Invalid query parameter — e.g. unknown status value",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Validation failed" },
              code: { type: "string", example: "VALIDATION_FAILED" },
              category: { type: "string", example: "VALIDATION" },
              context: {
                type: "object",
                properties: {
                  fields: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        path: { type: "string", example: "status" },
                        message: { type: "string", example: "Invalid option: expected one of \"new\"|\"preparing\"|..." },
                        code: { type: "string", example: "invalid_value" },
                      },
                    },
                  },
                },
              },
            },
          }),
        },
        "401": {
          description: "Missing or invalid API key",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Missing API key" },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    post: {
      tags: ["Orders"],
      summary: "Create order",
      operationId: "createOrder",
      description: `Creates a new order.

**Auto-customer creation:** If \`customerId\` is not found in the customers table (e.g. walk-in / manual entry), the customer is automatically created using \`customerName\`, \`phone\`, \`wilayaId\`, and \`address\`. Pass a client-generated UUID (e.g. \`crypto.randomUUID()\`) as \`customerId\` in this case.

**Inventory:** Products with \`trackInventory\` enabled will have their stock decremented automatically.

**companyId:** If provided, the delivery company must exist — returns 404 if not found.`,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["customerId", "customerName", "phone", "wilayaId", "communeId", "price", "deliveryType", "deliveryFee", "products"],
              properties: {
                customerId: {
                  type: "string",
                  description: "Customer ID. If this ID does not exist in the database, the customer is auto-created from customerName, phone, wilayaId, and address.",
                  example: "550e8400-e29b-41d4-a716-446655440000",
                },
                customerName: { type: "string", example: "Ahmed Benali" },
                phone: {
                  type: "string",
                  pattern: "^0[5-7]\\d{8}$",
                  description: "Algerian mobile number starting with 05, 06, or 07",
                  example: "0551234567",
                },
                wilayaId: { type: "integer", minimum: 1, maximum: 58, example: 16 },
                communeId: {
                  type: "string",
                  minLength: 1,
                  description: "Required. Commune ID from /api/wilayas/{id}/communes.",
                },
                city: { type: "string", nullable: true },
                address: {
                  type: "string",
                  nullable: true,
                  example: "12 Rue Didouche Mourad",
                  description: "**Required when `deliveryType` is `home`.** Street address for delivery.",
                },
                price: { type: "number", exclusiveMinimum: 0, description: "Product subtotal (excluding delivery fee)", example: 9000 },
                notes: { type: "string", nullable: true },
                orderType: { type: "string", enum: ["online", "offline"], default: "online" },
                deliveryType: { type: "string", enum: ["home", "stop_desk"], default: "home" },
                deliveryFee: { type: "number", minimum: 0, default: 0, example: 400 },
                companyId: {
                  type: "string",
                  nullable: true,
                  description: "Delivery company ID to pre-assign (optional — can also assign later via dispatch)",
                },
                products: {
                  type: "array",
                  minItems: 1,
                  items: {
                    type: "object",
                    required: ["productId", "productName", "quantity", "pricePerUnit", "lineTotal"],
                    properties: {
                      productId: { type: "string", description: "Product ID", example: "550e8400-e29b-41d4-a716-446655440000" },
                      productName: { type: "string", description: "Denormalized product name at time of order", example: "Samsung Galaxy A54" },
                      variantId: {
                        type: "string",
                        nullable: true,
                        description: "Variant ID — omit or set null for products without variants",
                      },
                      variantLabel: {
                        type: "string",
                        nullable: true,
                        description: "Human-readable variant label, e.g. \"أحمر / XL\"",
                      },
                      quantity: { type: "integer", minimum: 1, example: 2 },
                      pricePerUnit: { type: "number", exclusiveMinimum: 0, example: 4500 },
                      lineTotal: { type: "number", exclusiveMinimum: 0, example: 9000 },
                    },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Order created successfully",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "object",
                properties: {
                  id: { type: "string", description: "Newly created order ID" },
                  orderNumber: { type: "string", example: "ORD-20260327-0042" },
                  deliveryFee: { type: "number", description: "Calculated delivery fee (from shipping profile or admin override)", example: 600 },
                  price: { type: "number", description: "Product subtotal (excluding delivery fee)", example: 2500 },
                  codAmount: { type: "number", description: "Total amount to collect (price + deliveryFee)", example: 3100 },
                  customerId: { type: "string", description: "Customer ID" },
                  customerName: { type: "string", description: "Customer name", example: "Ahmed Benali" },
                  phone: { type: "string", description: "Customer phone", example: "0551234567" },
                  wilayaId: { type: "integer", description: "Wilaya ID", example: 16 },
                  communeId: { type: "string", nullable: true, description: "Commune ID" },
                  deliveryType: { type: "string", enum: ["home", "stop_desk"], description: "Delivery type" },
                  orderType: { type: "string", enum: ["online", "offline"], description: "Order type" },
                  status: { type: "string", example: "new", description: "Initial order status" },
                },
                required: ["id", "orderNumber", "deliveryFee", "price", "codAmount"],
              },
              message: { type: "string", example: "Order created successfully" },
            },
          }),
        },
        "400": {
          description: "Validation error",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Validation failed" },
              code: { type: "string", example: "VALIDATION_FAILED" },
              category: { type: "string", example: "VALIDATION" },
              context: {
                type: "object",
                properties: {
                  fields: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        path: { type: "string", example: "customerName" },
                        message: { type: "string", example: "Invalid input: expected string, received undefined" },
                        code: { type: "string", example: "invalid_type" },
                      },
                    },
                  },
                },
              },
            },
            example: {
              error: "Validation failed",
              code: "VALIDATION_FAILED",
              category: "VALIDATION",
              context: {
                fields: [
                  {
                    path: "customerName",
                    message: "Invalid input: expected string, received undefined",
                    code: "invalid_type",
                  },
                ],
              },
            },
          }),
        },
        "404": {
          description: "Delivery company not found — returned when `companyId` is provided but does not exist",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Delivery company with ID xxx not found" },
              code: { type: "string", example: "DELIVERY_COMPANY_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "Delivery company" },
                  id: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                },
              },
            },
          }),
        },
        "401": {
          description: "Missing or invalid API key",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Invalid API key" },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
  "/api/orders/{id}": {
    get: {
      tags: ["Orders"],
      summary: "Get order",
      operationId: "getOrder",
      description: "Returns full order detail including products and status history.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Order details",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: orderSchema,
            },
          }),
        },
        "404": {
          description: "Order not found",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Order with ID 550e8400-e29b-41d4-a716-446655440000 not found" },
              code: { type: "string", example: "ORDER_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "Order" },
                  id: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    delete: {
      tags: ["Orders"],
      summary: "Delete order",
      operationId: "deleteOrder",
      description: "Permanently deletes the order and all child records (order products, shipments) from the database.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Order deleted",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: { type: "string", example: "Order deleted" },
            },
          }),
        },
        "404": {
          description: "Order not found",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Order with ID 550e8400-e29b-41d4-a716-446655440000 not found" },
              code: { type: "string", example: "ORDER_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "Order" },
                  id: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
  "/api/orders/{id}/status": {
    patch: {
      tags: ["Orders"],
      summary: "Update order status",
      operationId: "updateOrderStatus",
      description: `Updates the order status and appends a record to status history.

**Valid statuses:** \`new\` → \`confirmed\` → \`preparing\` → \`ready\` → \`assigned\` → \`out_for_delivery\` → \`delivered\` / \`returned\`

**Branching statuses:**
- \`confirmed\`: confirms the order after a successful call with the customer (required before preparing)
- \`unreachable\`: customer didn't answer — parks the order. Can retry back to \`confirmed\` or cancel

**Transition guard:** Only forward moves in the flow are accepted. Invalid moves (e.g. \`delivered → new\`, \`cancelled → preparing\`) return \`400 INVALID_STATUS_TRANSITION\` with the list of allowed next statuses.

**Side effects:**
- **delivered**: sets \`deliveryTime\`; increments driver's \`totalDelivered\` and \`totalEarnings\` if assigned
- **cancelled / returned**: restores inventory for products with \`trackInventory\` enabled (double-cancel/return is safe)`,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["status"],
              properties: {
                status: {
                  type: "string",
                  enum: ["new", "confirmed", "unreachable", "preparing", "ready", "assigned", "out_for_delivery", "delivered", "returned", "cancelled"],
                },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Status updated",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: { type: "string", example: "Order status updated" },
            },
          }),
        },
        "400": {
          description: "Validation error or invalid status transition",
          content: json({
            type: "object",
            oneOf: [
              {
                description: "Unknown status value in the request body",
                properties: {
                  error: { type: "string", example: "Validation failed" },
                  code: { type: "string", example: "VALIDATION_FAILED" },
                  category: { type: "string", example: "VALIDATION" },
                  context: {
                    type: "object",
                    properties: {
                      fields: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            path: { type: "string", example: "status" },
                            message: { type: "string", example: "Invalid enum value" },
                            code: { type: "string", example: "invalid_value" },
                          },
                        },
                      },
                    },
                  },
                },
              },
              {
                description: "Transition not allowed by the flow guard (e.g. delivered → new, cancelled → preparing)",
                properties: {
                  error: { type: "string", example: "Cannot transition from \"cancelled\" to \"new\"" },
                  code: { type: "string", example: "INVALID_STATUS_TRANSITION" },
                  context: {
                    type: "object",
                    properties: {
                      currentStatus: {
                        type: "string",
                        enum: ["new", "confirmed", "unreachable", "preparing", "ready", "assigned", "out_for_delivery", "delivered", "returned", "cancelled"],
                        example: "cancelled",
                        description: "The order's current status",
                      },
                      targetStatus: {
                        type: "string",
                        enum: ["new", "confirmed", "unreachable", "preparing", "ready", "assigned", "out_for_delivery", "delivered", "returned", "cancelled"],
                        example: "new",
                        description: "The status that was requested",
                      },
                      allowedTransitions: {
                        type: "array",
                        items: { type: "string" },
                        example: [],
                        description: "Which statuses are valid from the current one. Empty array means the order is in a terminal state.",
                      },
                    },
                  },
                },
              },
            ],
          }),
        },
        "404": {
          description: "Order not found",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Order with ID 550e8400-e29b-41d4-a716-446655440000 not found" },
              code: { type: "string", example: "ORDER_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "Order" },
                  id: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
  "/api/orders/{id}/assign-driver": {
    patch: {
      tags: ["Orders"],
      summary: "Assign driver to order",
      operationId: "assignDriver",
      description: `Assigns a driver for manual delivery.

**Business rules — returns 422 if:**
- The order already has a tracking number (dispatched to a company)
- The order's \`deliveryMethod\` is \`"company"\`
- The order status is \`out_for_delivery\`, \`delivered\`, \`returned\`, or \`cancelled\``,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["driverId"],
              properties: {
                driverId: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Driver assigned",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: { type: "string", example: "Driver assigned successfully" },
            },
          }),
        },
        "400": {
          description: "Validation error — missing or invalid driverId",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Validation failed" },
              code: { type: "string", example: "VALIDATION_FAILED" },
              category: { type: "string", example: "VALIDATION" },
              context: {
                type: "object",
                properties: {
                  fields: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        path: { type: "string", example: "driverId" },
                        message: { type: "string", example: "Invalid input: expected string, received undefined" },
                        code: { type: "string", example: "invalid_type" },
                      },
                    },
                  },
                },
              },
            },
          }),
        },
        "404": {
          description: "Order or driver not found",
          content: json({
            type: "object",
            oneOf: [
              {
                properties: {
                  error: { type: "string", example: "Order with ID 550e8400-e29b-41d4-a716-446655440000 not found" },
                  code: { type: "string", example: "ORDER_NOT_FOUND" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                  context: {
                    type: "object",
                    properties: {
                      entity: { type: "string", example: "Order" },
                      id: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                    },
                  },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "Driver with ID 550e8400-e29b-41d4-a716-446655440001 not found" },
                  code: { type: "string", example: "DRIVER_NOT_FOUND" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                  context: {
                    type: "object",
                    properties: {
                      entity: { type: "string", example: "Driver" },
                      id: { type: "string", example: "550e8400-e29b-41d4-a716-446655440001" },
                    },
                  },
                },
              },
            ],
          }),
        },
        "422": {
          description: "Business logic error - Order already dispatched or invalid status transition",
          content: json({
            type: "object",
            oneOf: [
              {
                properties: {
                  error: { type: "string", example: "This order is already dispatched to a delivery company (tracking: NE123456789DZ). Driver assignment is not allowed." },
                  code: { type: "string", example: "ORDER_ALREADY_DISPATCHED" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                  context: {
                    type: "object",
                    properties: {
                      orderId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                      trackingNumber: { type: "string", example: "NE123456789DZ" },
                    },
                  },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "Cannot assign a driver — order is already \"delivered\"." },
                  code: { type: "string", example: "INVALID_STATUS_TRANSITION" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                  context: {
                    type: "object",
                    properties: {
                      orderId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                      currentStatus: { type: "string", example: "delivered" },
                    },
                  },
                },
              },
            ],
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
  "/api/orders/{id}/unassign": {
    patch: {
      tags: ["Orders"],
      summary: "Unassign driver from order",
      operationId: "unassignDriver",
      description: `Removes the currently assigned driver. Clears \`driverId\` and \`driverFee\`,
resets \`deliveryMethod\` to \`"unassigned"\`, and rolls the status back from
\`assigned\` → \`ready\` when applicable.

**Business rules — returns 422 if:**
- The order has no driver assigned
- The order status is \`out_for_delivery\`, \`delivered\`, \`returned\`, or \`cancelled\``,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Driver unassigned",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: { type: "string", example: "Driver unassigned" },
            },
          }),
        },
        "404": {
          description: "Order not found",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Order with ID 550e8400-e29b-41d4-a716-446655440000 not found" },
              code: { type: "string", example: "ORDER_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
            },
          }),
        },
        "422": {
          description: "Business logic error — no driver assigned or order past dispatch",
          content: json({
            type: "object",
            oneOf: [
              {
                properties: {
                  error: { type: "string", example: "Order has no driver assigned." },
                  code: { type: "string", example: "INVALID_STATUS_TRANSITION" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "Cannot unassign driver — order is already \"out_for_delivery\"." },
                  code: { type: "string", example: "INVALID_STATUS_TRANSITION" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                },
              },
            ],
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
  "/api/orders/{id}/products/{productLineId}/return": {
    patch: {
      tags: ["Orders"],
      summary: "Record partial or full return for a single order line",
      operationId: "returnOrderProduct",
      description: `Records how many units on a specific order line the customer refused at the door.
Supports the Algerian "open the box at delivery" workflow where the customer inspects
items and may keep some while returning others.

**Behavior:**
- Server restocks the **delta** between the new and previously-recorded \`returnedQuantity\`
  (so repeated calls are idempotent; decreasing the value un-restocks to correct an error).
- Server derives \`status\` from the ratio:
  - \`returnedQuantity = 0\` → \`fulfilled\`
  - \`returnedQuantity = quantity\` → \`returned\`
  - otherwise → \`partially_returned\`
- Logs a \`stock_movement\` with \`type=ORDER_RETURNED\` (delta may be negative on correction).

**Guards — returns 422 if:**
- The order itself is already \`returned\` or \`cancelled\` (stock is reconciled — further edits would desync).

**Guards — returns 400 if:**
- \`returnedQuantity\` is negative or greater than the line's \`quantity\`.`,
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
        { name: "productLineId", in: "path", required: true, schema: { type: "string" } },
      ],
      requestBody: {
        required: true,
        content: json({
          type: "object",
          required: ["returnedQuantity"],
          properties: {
            returnedQuantity: {
              type: "integer",
              minimum: 0,
              description: "New total units returned on this line. Must be ≤ line.quantity.",
              example: 1,
            },
          },
        }),
      },
      responses: {
        "200": {
          description: "Return recorded",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "object",
                properties: {
                  id: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                  status: { type: "string", enum: ["fulfilled", "partially_returned", "returned"] },
                  returnedQuantity: { type: "integer", example: 1 },
                  quantity: { type: "integer", example: 3 },
                },
              },
              message: { type: "string", example: "Return recorded" },
            },
          }),
        },
        "400": {
          description: "returnedQuantity out of range, or order line not found",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "returnedQuantity must be between 0 and 3 (got 5)" },
              code: { type: "string", example: "VALUE_OUT_OF_RANGE" },
              category: { type: "string", example: "VALIDATION" },
            },
          }),
        },
        "404": {
          description: "Order not found",
          content: json({ type: "object", properties: { error: { type: "string" }, code: { type: "string", example: "ORDER_NOT_FOUND" } } }),
        },
        "422": {
          description: "Order already in terminal state (returned / cancelled)",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Cannot edit returns on a returned order — stock was already reconciled." },
              code: { type: "string", example: "INVALID_STATUS_TRANSITION" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
  "/api/orders/bulk-dispatch": {
    post: {
      tags: ["Orders"],
      summary: "Bulk dispatch orders to delivery company",
      operationId: "bulkDispatch",
      description: `Dispatches multiple existing orders to a delivery company in a single API call.
Uses the provider's bulk creation endpoint (up to 100 orders per request).

**What happens per order:**
1. Validates order is not already dispatched (tracking number exists) — skipped with error if dispatched
2. Validates order has wilaya and commune set — skipped with error if missing
3. Validates stop-desk orders have station code — skipped with error if missing
4. Calls \`createShipmentsBulk()\` on the provider adapter (one API call for all valid orders)
5. Records tracking numbers and label URLs in database
6. Auto-advances order status to \`out_for_delivery\`
7. Auto-validates each shipment (required by NOEST, no-op for others)
8. Logs all API calls for audit trail

**Provider support (verified 2026-04-25):**
- ✅ **NOEST**: POST /api/public/create/orders (up to 100) — fully tested, 100% working
- ✅ **Yalidine**: POST /v1/parcels/ (array body) — fully tested, 100% working
- ✅ **ZR Express**: POST /api/v1/parcels/bulk — fully tested, 100% working
- ✅ **EcoTrack**: POST /api/v1/create/orders (up to 100) — adapter implemented, production ready

**Performance:**
- Single API call to provider (not N calls)
- Batch database operations (inserts/updates)
- Typical: 10-50 orders dispatched in 2-5 seconds
- Maximum: 100 orders per request

**Error Handling:**
- Partial success supported (some orders succeed, some fail)
- Per-order error messages returned
- Failed orders remain in current status
- Successful orders advance to \`out_for_delivery\`

**⚠️ Important Notes:**
- Must be called at \`/api/orders/bulk-dispatch\` (not \`/api/orders/{id}/dispatch\`)
- Orders must have wilaya and commune set before dispatch
- Stop-desk orders must have station code set
- Maximum 100 orders per request (provider limitation)`,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["companyId", "orderIds"],
              properties: {
                companyId: {
                  type: "string",
                  description: "ID of the delivery company to dispatch to.",
                  example: "9a7c2e58-b3f1-4d09-8e26-3a0c5f71d824",
                },
                orderIds: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 1,
                  maxItems: 100,
                  description: "IDs of orders to dispatch. Maximum 100 per request.",
                  example: [
                    "550e8400-e29b-41d4-a716-446655440001",
                    "550e8400-e29b-41d4-a716-446655440002",
                  ],
                },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "At least one shipment was created successfully. Per-order results are always included.",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: { type: "string", example: "Bulk dispatch: 2 succeeded, 0 failed" },
              data: {
                type: "object",
                properties: {
                  successCount: {
                    type: "integer",
                    description: "Number of orders successfully dispatched",
                    example: 2,
                  },
                  failureCount: {
                    type: "integer",
                    description: "Number of orders that failed to dispatch",
                    example: 0,
                  },
                  results: {
                    type: "array",
                    description: "Per-order results (success or failure)",
                    items: {
                      type: "object",
                      properties: {
                        orderId: {
                          type: "string",
                          description: "Order ID from request",
                          example: "550e8400-e29b-41d4-a716-446655440001",
                        },
                        orderNumber: {
                          type: "string",
                          nullable: true,
                          description: "Human-readable order number",
                          example: "ORD-20260425-0042",
                        },
                        trackingNumber: {
                          type: "string",
                          nullable: true,
                          description: "Tracking number from the provider. Present on success, null on failure.",
                          example: "LHA-19D-16325722",
                        },
                        labelUrl: {
                          type: "string",
                          nullable: true,
                          description: "PDF label URL if provided by the company. Yalidine and NOEST return this immediately.",
                          example: "https://api.yalidine.app/app/bordereau.php?tracking=yal-SP44MM&token=...",
                        },
                        error: {
                          type: "string",
                          nullable: true,
                          description: "Error message if this order failed. Null on success.",
                          example: "Order already dispatched — tracking number: NE123456789DZ",
                        },
                      },
                      required: ["orderId"],
                    },
                  },
                },
                required: ["successCount", "failureCount", "results"],
              },
            },
            example: {
              success: true,
              message: "Bulk dispatch: 2 succeeded, 0 failed",
              data: {
                successCount: 2,
                failureCount: 0,
                results: [
                  {
                    orderId: "550e8400-e29b-41d4-a716-446655440001",
                    orderNumber: "ORD-20260425-0042",
                    trackingNumber: "yal-SP44MM",
                    labelUrl: "https://api.yalidine.app/app/bordereau.php?tracking=yal-SP44MM&token=...",
                    error: null,
                  },
                  {
                    orderId: "550e8400-e29b-41d4-a716-446655440002",
                    orderNumber: "ORD-20260425-0043",
                    trackingNumber: "LHA-19D-16325722",
                    labelUrl: "https://app.noest-dz.com/api/public/get/order/label?tracking=LHA-19D-16325722",
                    error: null,
                  },
                ],
              },
            },
          }),
        },
        "400": {
          description: "Validation error (empty or too-large orderIds array) or all orders failed.",
          content: json({
            type: "object",
            oneOf: [
              {
                description: "Validation — invalid request body",
                properties: {
                  error: { type: "string", example: "Validation failed" },
                  code: { type: "string", example: "VALIDATION_FAILED" },
                  category: { type: "string", example: "VALIDATION" },
                  context: {
                    type: "object",
                    properties: {
                      fields: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            path: { type: "string", example: "orderIds" },
                            message: { type: "string", example: "Array must contain at least 1 element(s)" },
                            code: { type: "string", example: "too_small" },
                          },
                        },
                      },
                    },
                  },
                },
                example: {
                  error: "Validation failed",
                  code: "VALIDATION_FAILED",
                  category: "VALIDATION",
                  context: {
                    fields: [
                      {
                        path: "orderIds",
                        message: "Array must contain at least 1 element(s)",
                        code: "too_small",
                      },
                    ],
                  },
                },
              },
              {
                description: "All orders failed (no shipments created)",
                properties: {
                  success: { type: "boolean", example: false },
                  message: { type: "string", example: "No valid orders to dispatch" },
                  data: {
                    type: "object",
                    properties: {
                      successCount: { type: "integer", example: 0 },
                      failureCount: { type: "integer", example: 2 },
                      results: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            orderId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440001" },
                            orderNumber: { type: "string", nullable: true, example: "ORD-20260425-0042" },
                            trackingNumber: { type: "string", nullable: true, example: null },
                            labelUrl: { type: "string", nullable: true, example: null },
                            error: { type: "string", example: "Order already dispatched — tracking number: NE123456789DZ" },
                          },
                        },
                      },
                    },
                  },
                },
                example: {
                  success: false,
                  message: "No valid orders to dispatch",
                  data: {
                    successCount: 0,
                    failureCount: 2,
                    results: [
                      {
                        orderId: "550e8400-e29b-41d4-a716-446655440001",
                        orderNumber: "ORD-20260425-0042",
                        trackingNumber: null,
                        labelUrl: null,
                        error: "Order already dispatched — tracking number: NE123456789DZ",
                      },
                      {
                        orderId: "550e8400-e29b-41d4-a716-446655440002",
                        orderNumber: "ORD-20260425-0043",
                        trackingNumber: null,
                        labelUrl: null,
                        error: "Order must have wilaya and commune selected before dispatching",
                      },
                    ],
                  },
                },
              },
            ],
          }),
        },
        "404": {
          description: "Delivery company not found",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Delivery company with ID xxx not found" },
              code: { type: "string", example: "ENTITY_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
            },
          }),
        },
        "422": {
          description: "Company inactive, provider not supported, or provider bulk API failed",
          content: json({
            type: "object",
            properties: {
              error: { type: "string" },
              code: {
                type: "string",
                enum: [
                  "COMPANY_INACTIVE",
                  "PROVIDER_NOT_SUPPORTED",
                  "OPERATION_NOT_SUPPORTED",
                  "SHIPMENT_CREATION_FAILED",
                ],
              },
              category: { type: "string" },
              context: { type: "object" },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/orders/{id}/dispatch": {
    post: {
      tags: ["Orders"],
      summary: "Dispatch order to delivery company",
      operationId: "dispatchToCompany",
      description: `Creates a shipment via the assigned delivery company's API (NOEST, ZR Express, Yalidine, Packers/EcoTrack, etc.).

**What happens:**
1. Validates business rules (not already dispatched, wilaya + commune set, station code for stop-desk)
2. Calls the provider adapter to create the shipment
3. Records the tracking number on the order
4. For NOEST: automatically calls the validate endpoint to make the parcel visible to logistics
5. Logs the API call for audit

**Supported provider codes:** noest | zr_express | yalidine | ecotrack (used by Packers)

**Body fields are all optional** — they override values stored on the order.`,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                companyId: { type: "string", description: "Override the order's assigned company" },
                stationCode: {
                  type: "string",
                  description: "Stop-desk station code. Required when deliveryType is stop_desk",
                },
                remarks: { type: "string", description: "Delivery remarks passed to the provider" },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Shipment created successfully",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "object",
                properties: {
                  shipmentId: { type: "string", description: "Internal shipment record ID" },
                  trackingNumber: { type: "string", example: "NE123456789DZ" },
                  labelUrl: { type: "string", nullable: true, description: "PDF label URL, if provided by the company" },
                },
                required: ["shipmentId", "trackingNumber", "labelUrl"],
              },
              message: { type: "string", example: "Shipment created successfully" },
            },
          }),
        },
        "400": {
          description: "Validation error — no delivery company, missing wilaya/commune, or missing station code",
          content: json({
            type: "object",
            oneOf: [
              {
                properties: {
                  error: { type: "string", example: "Select a delivery company to dispatch" },
                  code: { type: "string", example: "REQUIRED_FIELD_MISSING" },
                  category: { type: "string", example: "VALIDATION" },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "Order must have wilaya and commune selected before dispatching" },
                  code: { type: "string", example: "MISSING_WILAYA_COMMUNE" },
                  category: { type: "string", example: "VALIDATION" },
                  context: {
                    type: "object",
                    properties: {
                      orderId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                    },
                  },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "Stop-desk orders require a station code. Select a pickup-point station before dispatching." },
                  code: { type: "string", example: "MISSING_STATION_CODE" },
                  category: { type: "string", example: "VALIDATION" },
                  context: {
                    type: "object",
                    properties: {
                      orderId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                      deliveryType: { type: "string", example: "stop_desk" },
                    },
                  },
                },
              },
            ],
          }),
        },
        "404": {
          description: "Order or delivery company not found",
          content: json({
            type: "object",
            oneOf: [
              {
                properties: {
                  error: { type: "string", example: "Order with ID 550e8400-e29b-41d4-a716-446655440000 not found" },
                  code: { type: "string", example: "ORDER_NOT_FOUND" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                  context: {
                    type: "object",
                    properties: {
                      entity: { type: "string", example: "Order" },
                      id: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                    },
                  },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "Delivery company with ID 550e8400-e29b-41d4-a716-446655440000 not found" },
                  code: { type: "string", example: "DELIVERY_COMPANY_NOT_FOUND" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                  context: {
                    type: "object",
                    properties: {
                      entity: { type: "string", example: "Delivery company" },
                      id: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                    },
                  },
                },
              },
            ],
          }),
        },
        "422": {
          description: "Business logic error - Order already dispatched, driver assigned, company inactive, or provider not supported",
          content: json({
            type: "object",
            oneOf: [
              {
                properties: {
                  error: { type: "string", example: "Order already dispatched — tracking number: NE123456789DZ" },
                  code: { type: "string", example: "ORDER_ALREADY_DISPATCHED" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                  context: {
                    type: "object",
                    properties: {
                      orderId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                      trackingNumber: { type: "string", example: "NE123456789DZ" },
                    },
                  },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "Order is assigned to a driver for manual delivery. Remove the driver assignment first." },
                  code: { type: "string", example: "DRIVER_ALREADY_ASSIGNED" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                  context: {
                    type: "object",
                    properties: {
                      orderId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                      driverId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440001" },
                      driverName: { type: "string", example: "Ahmed Benali" },
                    },
                  },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "Delivery company is inactive" },
                  code: { type: "string", example: "COMPANY_INACTIVE" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                  context: {
                    type: "object",
                    properties: {
                      companyId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                    },
                  },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "Provider not available" },
                  code: { type: "string", example: "PROVIDER_NOT_SUPPORTED" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                  context: {
                    type: "object",
                    properties: {
                      companyId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                      provider: { type: "string", example: "noest" },
                    },
                  },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "Failed to create shipment" },
                  code: { type: "string", example: "SHIPMENT_CREATION_FAILED" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                  context: {
                    type: "object",
                    properties: {
                      provider: { type: "string", example: "noest" },
                      orderId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                    },
                  },
                },
              },
            ],
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
  "/api/orders/{id}/validate-shipment": {
    post: {
      tags: ["Orders"],
      summary: "Manually validate shipment at carrier",
      operationId: "validateShipmentManually",
      description: `Manually validates a dispatched shipment at the carrier API.

**When to use:**
- Only meaningful when the delivery company has \`autoValidate=false\` (e.g. EcoTrack/Packers)
- After dispatch, the shipment exists at the carrier but is still in "draft" state
- This endpoint calls the carrier's validate endpoint to make the parcel visible to logistics
- On success, advances order status from \`dispatched\` → \`out_for_delivery\`

**Business rules — returns 422 if:**
- Order status is not \`dispatched\` (must be dispatched first)
- Order has no tracking number (must be dispatched first)
- Order has no delivery company assigned

**Provider support:**
- ✅ **EcoTrack** (Packers): POST /api/v1/valid/order — fully working
- ✅ **NOEST**: POST /api/public/valid/order — fully working
- ✅ **ZR Express**: Auto-validated on creation (this endpoint is a no-op)
- ✅ **Yalidine**: POST /validate — fully working

**What happens:**
1. Calls provider's \`validateShipment(trackingNumber)\` method
2. If successful, marks shipment as validated in database
3. Advances order status to \`out_for_delivery\`
4. Logs API call for audit trail
5. Records activity log entry`,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Order ID" }],
      responses: {
        "200": {
          description: "Shipment validated successfully",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: { type: "string", example: "Shipment validated — order is now out for delivery" },
            },
          }),
        },
        "400": {
          description: "Validation returned false from carrier",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: false },
              message: { type: "string", example: "Validation returned false" },
            },
          }),
        },
        "404": {
          description: "Order or delivery company not found",
          content: json({
            type: "object",
            oneOf: [
              {
                properties: {
                  error: { type: "string", example: "Order with ID 550e8400-e29b-41d4-a716-446655440000 not found" },
                  code: { type: "string", example: "ORDER_NOT_FOUND" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                  context: {
                    type: "object",
                    properties: {
                      entity: { type: "string", example: "Order" },
                      id: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                    },
                  },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "Delivery company with ID xxx not found" },
                  code: { type: "string", example: "DELIVERY_COMPANY_NOT_FOUND" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                  context: {
                    type: "object",
                    properties: {
                      entity: { type: "string", example: "Delivery company" },
                      id: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                    },
                  },
                },
              },
            ],
          }),
        },
        "422": {
          description: "Business logic error — order not in dispatched state, no tracking number, company inactive, or provider not supported",
          content: json({
            type: "object",
            oneOf: [
              {
                properties: {
                  error: { type: "string", example: "Order is not in dispatched state — current status: new" },
                  code: { type: "string", example: "INVALID_STATUS_TRANSITION" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                  context: {
                    type: "object",
                    properties: {
                      orderId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                      currentStatus: { type: "string", example: "new" },
                    },
                  },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "Order has no tracking number — dispatch it first" },
                  code: { type: "string", example: "REQUIRED_FIELD_MISSING" },
                  category: { type: "string", example: "VALIDATION" },
                  context: {
                    type: "object",
                    properties: {
                      orderId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                    },
                  },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "Delivery company is inactive" },
                  code: { type: "string", example: "COMPANY_INACTIVE" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                  context: {
                    type: "object",
                    properties: {
                      companyId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                    },
                  },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "Provider not available" },
                  code: { type: "string", example: "PROVIDER_NOT_SUPPORTED" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                  context: {
                    type: "object",
                    properties: {
                      companyId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                      provider: { type: "string", example: "noest" },
                    },
                  },
                },
              },
            ],
          }),
        },
        "502": {
          description: "External API error — carrier API returned an error",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "EcoTrack API error: Invalid tracking number" },
              code: { type: "string", example: "EXTERNAL_API_ERROR" },
              category: { type: "string", example: "EXTERNAL" },
              context: {
                type: "object",
                properties: {
                  provider: { type: "string", example: "ecotrack" },
                  orderId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
  "/api/orders/{id}/update-shipment": {
    patch: {
      tags: ["Orders"],
      summary: "Update shipment info at carrier",
      operationId: "updateShipmentInfo",
      description: `Updates an existing shipment at the carrier API.

**What it does:**
- Updates customer information (name, phone, address, commune)
- Updates COD amount
- Updates delivery preferences (fragile, weight, remarks)
- Syncs changed fields back to the database so the order record stays in sync with the carrier

**⚠️ IMPORTANT: Provider-specific update restrictions**

**EcoTrack (Packers):**
- ✅ Updates work BEFORE and AFTER validation
- ⚠️ Tested 2026-04-25: Updates succeed even after validation (contrary to previous documentation)
- Uses different field names than create: \`client\` (not \`nom_client\`), \`tel\` (not \`telephone\`), \`wilaya\` (not \`code_wilaya\`)

**NOEST:**
- ✅ Updates work BEFORE validation only
- ❌ Updates rejected AFTER validation with error: "Commande non trouvée dans l'étape de modification"
- Validation lock enforced correctly

**Yalidine:**
- ✅ Updates work when status is "En préparation"
- ❌ Updates rejected if label has been printed (even if status is still "En préparation")
- ⚠️ Response data is privacy-masked - do NOT use PATCH response for database updates, use GET instead

**ZR Express:**
- ✅ Updates work flexibly across most parcel states
- Uses separate endpoints for amount, customer, and address updates
- More flexible than other providers

**Business rules — returns 422 if:**
- Order has no tracking number (must be dispatched first)
- Order has no delivery company assigned
- For NOEST: order status is not \`dispatched\` (already validated)
- For Yalidine: label has been printed or status changed from "En préparation"

**Provider support:**
- ✅ **EcoTrack** (Packers): POST /api/v1/update/order — fully working (BEFORE and AFTER validation)
- ✅ **NOEST**: POST /api/public/update/order — fully working (BEFORE validation only)
- ✅ **Yalidine**: PATCH /v1/parcels/{trackingNumber} — fully working (status "En préparation" + label not printed)
- ✅ **ZR Express**: PATCH /api/v1/parcels/{parcelId}/amount, /customer, /deliveryAddress — fully working

**Request body:**
All fields are optional. Omitted fields will use current order values. EcoTrack requires ALL fields on every update call, so the server pre-fills from the order record and applies your overrides.`,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Order ID" }],
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                customerName: { type: "string", description: "Customer full name", example: "Ahmed Benali" },
                phone: { type: "string", pattern: "^0[5-7]\\d{8}$", description: "Algerian mobile number", example: "0551234567" },
                phone2: { type: "string", pattern: "^0[5-7]\\d{8}$", description: "Secondary phone number (optional)", example: "0661234567" },
                address: { type: "string", description: "Delivery address", example: "12 Rue Didouche Mourad, Alger Centre" },
                commune: { type: "string", description: "Commune name in French", example: "Alger Centre" },
                wilayaId: { type: "integer", minimum: 1, maximum: 58, description: "Wilaya ID (1-58)", example: 16 },
                amount: { type: "number", exclusiveMinimum: 0, description: "COD amount to collect", example: 9500 },
                remarks: { type: "string", description: "Delivery remarks/notes", example: "Appeler avant livraison" },
                fragile: { type: "boolean", description: "Mark as fragile package", example: false },
                weight: { type: "number", minimum: 0, description: "Package weight in kg", example: 1.5 },
              },
            },
            example: {
              customerName: "Ahmed Benali",
              phone: "0551234567",
              address: "12 Rue Didouche Mourad, Alger Centre",
              commune: "Alger Centre",
              amount: 9500,
              remarks: "Appeler avant livraison",
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Shipment updated successfully",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: { type: "string", example: "Shipment updated successfully" },
            },
          }),
        },
        "404": {
          description: "Order or delivery company not found",
          content: json({
            type: "object",
            oneOf: [
              {
                properties: {
                  error: { type: "string", example: "Order with ID 550e8400-e29b-41d4-a716-446655440000 not found" },
                  code: { type: "string", example: "ORDER_NOT_FOUND" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "Delivery company with ID xxx not found" },
                  code: { type: "string", example: "DELIVERY_COMPANY_NOT_FOUND" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                },
              },
            ],
          }),
        },
        "422": {
          description: "Business logic error — no tracking number, provider not supported, or order already validated (EcoTrack only)",
          content: json({
            type: "object",
            oneOf: [
              {
                properties: {
                  error: { type: "string", example: "Order has no tracking number — dispatch it first" },
                  code: { type: "string", example: "REQUIRED_FIELD_MISSING" },
                  category: { type: "string", example: "VALIDATION" },
                  context: {
                    type: "object",
                    properties: {
                      orderId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                    },
                  },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "The noest provider does not support updating shipments" },
                  code: { type: "string", example: "OPERATION_NOT_SUPPORTED" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                  context: {
                    type: "object",
                    properties: {
                      provider: { type: "string", example: "noest" },
                    },
                  },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "EcoTrack orders can only be updated before validation. This order is already validated (status: out_for_delivery)." },
                  code: { type: "string", example: "OPERATION_NOT_SUPPORTED" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                  context: {
                    type: "object",
                    properties: {
                      orderId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                      status: { type: "string", example: "out_for_delivery" },
                    },
                  },
                },
              },
            ],
          }),
        },
        "502": {
          description: "External API error — carrier API returned an error",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "ecotrack API error: Invalid tracking number" },
              code: { type: "string", example: "EXTERNAL_API_ERROR" },
              category: { type: "string", example: "EXTERNAL" },
              context: {
                type: "object",
                properties: {
                  provider: { type: "string", example: "ecotrack" },
                  orderId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
  "/api/orders/{id}/cancel-shipment": {
    post: {
      tags: ["Orders"],
      summary: "Cancel/delete shipment at carrier",
      operationId: "cancelShipment",
      description: `Deletes/cancels a shipment at the carrier API (before validation only).

**What it does:**
1. Calls the carrier's delete/cancel endpoint
2. Clears the tracking number from the order
3. Resets order status to \`ready\` so it can be re-dispatched
4. Marks the shipment record as not validated
5. Logs API call for audit trail

**Use case:**
- Cancel a shipment that was dispatched by mistake
- Cancel before validation to avoid carrier fees
- Re-dispatch to a different carrier

**⚠️ Note:** Uses POST method (not DELETE) to avoid routing ambiguity with DELETE /orders/:id

**Business rules — returns 422 if:**
- Order has no tracking number (nothing to cancel)
- Order has no delivery company assigned
- Provider does not support cancellation

**Provider support:**
- ✅ **EcoTrack** (Packers): DELETE /api/v1/delete/order — fully working (before validation only)
- ✅ **NOEST**: POST /api/public/delete/order — fully working (before validation only)
- ✅ **Yalidine**: DELETE /v1/parcels/{trackingNumber} — fully working (status must be "En préparation")
- ❌ **ZR Express**: POST /api/v1/parcels/bulk/by-tracking-number — **NOT WORKING** (returns HTTP 405 - Method Not Allowed)

**⚠️ ZR Express Delete Issue:**
Tested 2026-04-25: The ZR Express delete endpoint returns HTTP 405. This functionality may not be available or may require special permissions. Contact ZR Express support for clarification.`,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Order ID" }],
      responses: {
        "200": {
          description: "Shipment cancelled successfully",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: { type: "string", example: "Shipment cancelled — order reset to ready" },
            },
          }),
        },
        "404": {
          description: "Order or delivery company not found",
          content: json({
            type: "object",
            oneOf: [
              {
                properties: {
                  error: { type: "string", example: "Order with ID 550e8400-e29b-41d4-a716-446655440000 not found" },
                  code: { type: "string", example: "ORDER_NOT_FOUND" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "Delivery company with ID xxx not found" },
                  code: { type: "string", example: "DELIVERY_COMPANY_NOT_FOUND" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                },
              },
            ],
          }),
        },
        "422": {
          description: "Business logic error — no tracking number or provider not supported",
          content: json({
            type: "object",
            oneOf: [
              {
                properties: {
                  error: { type: "string", example: "Order has no tracking number — nothing to cancel at the carrier" },
                  code: { type: "string", example: "REQUIRED_FIELD_MISSING" },
                  category: { type: "string", example: "VALIDATION" },
                  context: {
                    type: "object",
                    properties: {
                      orderId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                    },
                  },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "The noest provider does not support cancelling shipments" },
                  code: { type: "string", example: "OPERATION_NOT_SUPPORTED" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                  context: {
                    type: "object",
                    properties: {
                      provider: { type: "string", example: "noest" },
                    },
                  },
                },
              },
            ],
          }),
        },
        "502": {
          description: "External API error — carrier API returned an error",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "ecotrack API error: Shipment already validated, cannot delete" },
              code: { type: "string", example: "EXTERNAL_API_ERROR" },
              category: { type: "string", example: "EXTERNAL" },
              context: {
                type: "object",
                properties: {
                  provider: { type: "string", example: "ecotrack" },
                  orderId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
  "/api/orders/{id}/add-remark": {
    post: {
      tags: ["Orders"],
      summary: "Add remark/note to shipment",
      operationId: "addShipmentRemark",
      description: `Adds a remark/note to the shipment at the carrier API.

**What it does:**
- Sends a text note to the carrier's system
- Visible to both sender and carrier/driver
- Can be added at any time after dispatch (before or after validation)
- Useful for delivery instructions, customer requests, or operational notes

**Use cases:**
- "Customer requested morning delivery"
- "Building code: 1234"
- "Call before arrival"
- "Leave with concierge if absent"

**Business rules — returns 422 if:**
- Order has no tracking number (must be dispatched first)
- Order has no delivery company assigned
- Remark content is empty or missing
- Provider does not support remarks

**Provider support:**
- ✅ **EcoTrack** (Packers): POST /api/v1/add/maj — fully working
- ✅ **NOEST**: POST /api/public/add/maj — fully working
- ❌ **Yalidine**: Not supported (returns false)
- ❌ **ZR Express**: Not supported (returns false)`,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Order ID" }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["content"],
              properties: {
                content: {
                  type: "string",
                  minLength: 1,
                  description: "Remark text content",
                  example: "Appeler le client 30 minutes avant la livraison",
                },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Remark added successfully",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: { type: "string", example: "Remark added" },
            },
          }),
        },
        "400": {
          description: "Validation error — remark content is required",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Remark content is required" },
              code: { type: "string", example: "REQUIRED_FIELD_MISSING" },
              category: { type: "string", example: "VALIDATION" },
            },
          }),
        },
        "404": {
          description: "Order or delivery company not found",
          content: json({
            type: "object",
            oneOf: [
              {
                properties: {
                  error: { type: "string", example: "Order with ID 550e8400-e29b-41d4-a716-446655440000 not found" },
                  code: { type: "string", example: "ORDER_NOT_FOUND" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "Delivery company with ID xxx not found" },
                  code: { type: "string", example: "DELIVERY_COMPANY_NOT_FOUND" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                },
              },
            ],
          }),
        },
        "422": {
          description: "Business logic error — no tracking number or provider not supported",
          content: json({
            type: "object",
            oneOf: [
              {
                properties: {
                  error: { type: "string", example: "Order has no tracking number" },
                  code: { type: "string", example: "REQUIRED_FIELD_MISSING" },
                  category: { type: "string", example: "VALIDATION" },
                  context: {
                    type: "object",
                    properties: {
                      orderId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                    },
                  },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "The noest provider does not support adding remarks" },
                  code: { type: "string", example: "OPERATION_NOT_SUPPORTED" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                  context: {
                    type: "object",
                    properties: {
                      provider: { type: "string", example: "noest" },
                    },
                  },
                },
              },
            ],
          }),
        },
        "502": {
          description: "External API error — carrier API returned an error",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "ecotrack API error: Invalid tracking number" },
              code: { type: "string", example: "EXTERNAL_API_ERROR" },
              category: { type: "string", example: "EXTERNAL" },
              context: {
                type: "object",
                properties: {
                  provider: { type: "string", example: "ecotrack" },
                  orderId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
  "/api/orders/{id}/remarks": {
    get: {
      tags: ["Orders"],
      summary: "Fetch shipment remarks from carrier",
      operationId: "getShipmentRemarks",
      description: `Fetches the list of remarks/notes for a shipment from the carrier API.

**What it returns:**
- All remarks added by the sender (via add-remark endpoint)
- All remarks added by the carrier/driver (e.g. delivery attempts, customer unavailable)
- Chronological list with timestamps and author information

**Use cases:**
- View delivery history and communication log
- Check driver notes about delivery attempts
- Audit trail of all shipment-related communications

**Business rules — returns 422 if:**
- Order has no tracking number (must be dispatched first)
- Order has no delivery company assigned
- Provider does not support fetching remarks

**Provider support:**
- ✅ **EcoTrack** (Packers): GET /api/v1/get/maj — fully working
- ❌ **NOEST**: Not supported (no API endpoint available)
- ❌ **Yalidine**: Not supported
- ❌ **ZR Express**: Not supported

**Note:** Only EcoTrack provides an endpoint to fetch remarks. Verified 2026-04-25.

**Response format:**
Returns an array of remark objects. Each remark includes:
- Content/text of the remark
- Timestamp when it was added
- Author (sender or carrier/driver name)
- Any additional metadata from the carrier`,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Order ID" }],
      responses: {
        "200": {
          description: "Remarks fetched successfully",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "array",
                description: "Array of remarks from the carrier. Structure varies by provider.",
                items: {
                  type: "object",
                  description: "Remark object (structure depends on carrier API)",
                  additionalProperties: true,
                },
                example: [
                  {
                    content: "Appeler le client 30 minutes avant",
                    author: "Sender",
                    timestamp: "2026-04-25T10:30:00Z",
                  },
                  {
                    content: "Client injoignable - 1ère tentative",
                    author: "Driver: Ahmed",
                    timestamp: "2026-04-25T14:15:00Z",
                  },
                ],
              },
            },
          }),
        },
        "404": {
          description: "Order or delivery company not found",
          content: json({
            type: "object",
            oneOf: [
              {
                properties: {
                  error: { type: "string", example: "Order with ID 550e8400-e29b-41d4-a716-446655440000 not found" },
                  code: { type: "string", example: "ORDER_NOT_FOUND" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "Delivery company with ID xxx not found" },
                  code: { type: "string", example: "DELIVERY_COMPANY_NOT_FOUND" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                },
              },
            ],
          }),
        },
        "422": {
          description: "Business logic error — no tracking number or provider not supported",
          content: json({
            type: "object",
            oneOf: [
              {
                properties: {
                  error: { type: "string", example: "Order has no tracking number" },
                  code: { type: "string", example: "REQUIRED_FIELD_MISSING" },
                  category: { type: "string", example: "VALIDATION" },
                  context: {
                    type: "object",
                    properties: {
                      orderId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                    },
                  },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "The noest provider does not support fetching remarks" },
                  code: { type: "string", example: "OPERATION_NOT_SUPPORTED" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                  context: {
                    type: "object",
                    properties: {
                      provider: { type: "string", example: "noest" },
                    },
                  },
                },
              },
            ],
          }),
        },
        "502": {
          description: "External API error — carrier API returned an error",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "ecotrack API error: Invalid tracking number" },
              code: { type: "string", example: "EXTERNAL_API_ERROR" },
              category: { type: "string", example: "EXTERNAL" },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
  "/api/orders/{id}/tracking-events": {
    get: {
      tags: ["Orders"],
      summary: "Fetch tracking history from carrier",
      operationId: "getShipmentTracking",
      description: `Fetches the full tracking history for a shipment from the carrier API.

**What it returns:**
- Chronological list of all tracking events
- Event types: pickup, hub reception, in transit, out for delivery, delivery attempts, delivered, returned
- Timestamps and location information for each event
- Status updates and driver notes

**Use cases:**
- Display shipment journey to customer
- Monitor delivery progress
- Investigate delivery issues or delays
- Audit trail of shipment lifecycle

**Business rules — returns 422 if:**
- Order has no tracking number (must be dispatched first)
- Order has no delivery company assigned
- Provider does not support live tracking

**Provider support:**
- ✅ **EcoTrack** (Packers): GET /api/v1/get/tracking/info — fully working
- ✅ **NOEST**: POST /api/public/get/trackings/info — fully working
- ✅ **Yalidine**: GET /v1/histories/{trackingNumber} — fully working
- ✅ **ZR Express**: GET /api/v1/parcels/{parcelId}/state-history — fully working

**Note:** All 4 providers support tracking events. Verified 2026-04-25.

**Response format:**
Returns an array of tracking event objects. Each event includes:
- Event type/status (e.g. "picked_up", "in_transit", "delivered")
- Timestamp when the event occurred
- Location (hub, city, or delivery address)
- Description/notes from the carrier
- Driver information (if applicable)`,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Order ID" }],
      responses: {
        "200": {
          description: "Tracking events fetched successfully",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "array",
                description: "Array of tracking events from the carrier. Structure varies by provider.",
                items: {
                  type: "object",
                  description: "Tracking event object (structure depends on carrier API)",
                  additionalProperties: true,
                },
                example: [
                  {
                    status: "picked_up",
                    timestamp: "2026-04-25T09:00:00Z",
                    location: "Alger Centre Hub",
                    description: "Colis récupéré par le coursier",
                  },
                  {
                    status: "in_transit",
                    timestamp: "2026-04-25T11:30:00Z",
                    location: "Hub Régional Alger",
                    description: "En transit vers le centre de distribution",
                  },
                  {
                    status: "out_for_delivery",
                    timestamp: "2026-04-25T14:00:00Z",
                    location: "Alger",
                    description: "En cours de livraison",
                    driver: "Ahmed Benali",
                  },
                  {
                    status: "delivered",
                    timestamp: "2026-04-25T16:45:00Z",
                    location: "Alger Centre",
                    description: "Livré au client",
                    driver: "Ahmed Benali",
                  },
                ],
              },
            },
          }),
        },
        "404": {
          description: "Order or delivery company not found",
          content: json({
            type: "object",
            oneOf: [
              {
                properties: {
                  error: { type: "string", example: "Order with ID 550e8400-e29b-41d4-a716-446655440000 not found" },
                  code: { type: "string", example: "ORDER_NOT_FOUND" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "Delivery company with ID xxx not found" },
                  code: { type: "string", example: "DELIVERY_COMPANY_NOT_FOUND" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                },
              },
            ],
          }),
        },
        "422": {
          description: "Business logic error — no tracking number or provider not supported",
          content: json({
            type: "object",
            oneOf: [
              {
                properties: {
                  error: { type: "string", example: "Order has no tracking number" },
                  code: { type: "string", example: "REQUIRED_FIELD_MISSING" },
                  category: { type: "string", example: "VALIDATION" },
                  context: {
                    type: "object",
                    properties: {
                      orderId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                    },
                  },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "The noest provider does not support live tracking" },
                  code: { type: "string", example: "OPERATION_NOT_SUPPORTED" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                  context: {
                    type: "object",
                    properties: {
                      provider: { type: "string", example: "noest" },
                    },
                  },
                },
              },
            ],
          }),
        },
        "502": {
          description: "External API error — carrier API returned an error",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "ecotrack API error: Invalid tracking number" },
              code: { type: "string", example: "EXTERNAL_API_ERROR" },
              category: { type: "string", example: "EXTERNAL" },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
  "/api/orders/{id}/label": {
    get: {
      tags: ["Orders"],
      summary: "Proxy shipment label PDF",
      operationId: "proxyShipmentLabel",
      description: `Proxies the shipment label PDF from the carrier API.

**Why this endpoint exists:**
EcoTrack label URLs require a Bearer token — they are not publicly accessible. This endpoint fetches the PDF server-side using the stored API credentials and streams it to the client, so the browser never needs to hold the API token.

**What it does:**
1. Retrieves the label URL from the shipment record (or constructs it from tracking number)
2. Fetches the PDF from the carrier API with authentication
3. Follows any redirects (302) to the actual file
4. Streams the PDF to the client with proper headers
5. Sets Content-Disposition to \`inline\` so it opens in browser tab

**Business rules — returns 422 if:**
- Order has no tracking number (must be dispatched first)
- Order has no delivery company assigned
- Delivery company has no API token configured

**Provider support:**
- ✅ **EcoTrack** (Packers): GET /api/v1/get/order/label?tracking=XXX — fully working (requires auth, 35-36KB)
- ✅ **NOEST**: GET /api/public/get/order/label?tracking=XXX — label URL stored in database (56KB)
- ✅ **Yalidine**: Label URL with token provided on creation — stored in database (110KB)
- ✅ **ZR Express**: POST /api/v1/parcels/labels/individual/pdf — returns temporary SAS URL (121KB, expires ~1 hour)

**⚠️ ZR Express Note:**
ZR Express returns temporary Azure Blob Storage SAS URLs that expire after approximately 1 hour. Labels should be downloaded and cached immediately after generation. Verified 2026-04-25.

**Response:**
- Content-Type: application/pdf
- Content-Disposition: inline; filename="label-{trackingNumber}.pdf"
- Cache-Control: no-store
- Body: PDF file stream

**Use cases:**
- Display label in browser for printing
- Download label for batch printing
- Embed label in customer portal`,
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Order ID" }],
      responses: {
        "200": {
          description: "PDF label file",
          content: {
            "application/pdf": {
              schema: {
                type: "string",
                format: "binary",
                description: "PDF file stream",
              },
            },
          },
          headers: {
            "Content-Type": {
              schema: { type: "string", example: "application/pdf" },
              description: "MIME type of the response",
            },
            "Content-Disposition": {
              schema: { type: "string", example: 'inline; filename="label-NE123456789DZ.pdf"' },
              description: "Disposition header to open PDF in browser",
            },
            "Cache-Control": {
              schema: { type: "string", example: "no-store" },
              description: "Prevents caching of the PDF",
            },
          },
        },
        "404": {
          description: "Order or delivery company not found",
          content: json({
            type: "object",
            oneOf: [
              {
                properties: {
                  error: { type: "string", example: "Order with ID 550e8400-e29b-41d4-a716-446655440000 not found" },
                  code: { type: "string", example: "ORDER_NOT_FOUND" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "Delivery company with ID xxx not found" },
                  code: { type: "string", example: "DELIVERY_COMPANY_NOT_FOUND" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                },
              },
            ],
          }),
        },
        "422": {
          description: "Business logic error — no tracking number, no API token, or missing credentials",
          content: json({
            type: "object",
            oneOf: [
              {
                properties: {
                  error: { type: "string", example: "Order has no tracking number" },
                  code: { type: "string", example: "REQUIRED_FIELD_MISSING" },
                  category: { type: "string", example: "VALIDATION" },
                  context: {
                    type: "object",
                    properties: {
                      orderId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                    },
                  },
                },
              },
              {
                properties: {
                  error: { type: "string", example: "Delivery company has no API token configured" },
                  code: { type: "string", example: "MISSING_API_CREDENTIALS" },
                  category: { type: "string", example: "BUSINESS_LOGIC" },
                  context: {
                    type: "object",
                    properties: {
                      companyId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                    },
                  },
                },
              },
            ],
          }),
        },
        "502": {
          description: "External API error — failed to fetch label from carrier",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "ecotrack API error: Failed to fetch label: Carrier returned HTTP 404" },
              code: { type: "string", example: "EXTERNAL_API_ERROR" },
              category: { type: "string", example: "EXTERNAL" },
              context: {
                type: "object",
                properties: {
                  provider: { type: "string", example: "ecotrack" },
                  orderId: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
                  trackingNumber: { type: "string", example: "NE123456789DZ" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
};
