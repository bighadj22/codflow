/**
 * Customers OpenAPI Paths
 */

const customerSchema = { $ref: "#/components/schemas/Customer" };
const errorSchema = { $ref: "#/components/schemas/Error" };
const validationErrorSchema = { $ref: "#/components/schemas/ValidationError" };
const json = (schema: object) => ({ "application/json": { schema } });

// Error response examples
const customerNotFoundError = {
  error: "Customer with ID 550e8400-e29b-41d4-a716-446655440000 not found",
  code: "CUSTOMER_NOT_FOUND",
  category: "BUSINESS_LOGIC",
  context: {
    entity: "Customer",
    id: "550e8400-e29b-41d4-a716-446655440000",
  },
};

const customerHasOrdersError = {
  error: "Cannot delete customer with existing orders",
  code: "CUSTOMER_HAS_ORDERS",
  category: "BUSINESS_LOGIC",
  context: {
    customerId: "550e8400-e29b-41d4-a716-446655440000",
    orderCount: 5,
  },
};

const duplicatePhoneError = {
  error: "A customer with this phone number already exists",
  code: "DUPLICATE_PHONE",
  category: "BUSINESS_LOGIC",
  context: {
    phone: "0551234567",
    existingCustomerId: "550e8400-e29b-41d4-a716-446655440000",
  },
};

const phoneField = {
  type: "string",
  pattern: "^0[5-7]\\d{8}$",
  description: "Algerian mobile number starting with 05, 06, or 07",
  example: "0551234567",
};

export const customerPaths = {
  "/api/customers": {
    get: {
      tags: ["Customers"],
      summary: "List customers",
      description: "Returns a paginated list of customers. Use `groupId` or `tagId` to filter by segment. Use `wilayaId` to filter by wilaya.",
      operationId: "listCustomers",
      parameters: [
        {
          name: "wilayaId",
          in: "query",
          description: "Filter by wilaya ID (1–58)",
          schema: { type: "integer", minimum: 1, maximum: 58 },
        },
        { name: "search", in: "query", description: "Search by customer name or phone", schema: { type: "string" } },
        { name: "groupId", in: "query", description: "Filter to customers in a specific customer group", schema: { type: "string" } },
        { name: "tagId", in: "query", description: "Filter to customers with a specific tag", schema: { type: "string" } },
        { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 100 } },
        { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
      ],
      responses: {
        "200": {
          description: "List of customers",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: customerSchema },
              count: { type: "integer" },
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
        "403": { description: "Missing customers:read scope", content: json(errorSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    post: {
      tags: ["Customers"],
      summary: "Create customer",
      operationId: "createCustomer",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name", "phone", "wilayaId", "communeId"],
              properties: {
                name: { type: "string", example: "Ahmed Benali" },
                phone: phoneField,
                phone2: { ...phoneField, description: "Secondary phone number (optional)" },
                wilayaId: { type: "integer", minimum: 1, maximum: 58, description: "Official wilaya number (1–58)", example: 16 },
                communeId: { type: "string", minLength: 1, description: "Required. Commune UUID from /api/wilayas/{id}/communes", example: "550e8400-e29b-41d4-a716-446655440000" },
                address: { type: "string", example: "12 Rue Didouche Mourad" },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Customer created. Response includes the full customer record with recentOrders (empty array for new customers).",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: customerSchema,
              message: { type: "string", example: "Customer created successfully" },
            },
          }),
        },
        "400": { 
          description: "Validation error (invalid phone format, missing required fields)", 
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
                        path: { type: "string", example: "phone" },
                        message: { type: "string", example: "Invalid Algerian phone number" },
                        code: { type: "string", example: "invalid_format" },
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
                    path: "name",
                    message: "Invalid input: expected string, received undefined",
                    code: "invalid_type",
                  },
                ],
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
        "403": { description: "Missing customers:create scope", content: json(errorSchema) },
        "409": { 
          description: "Duplicate phone number - a customer with this phone already exists (code: DUPLICATE_PHONE)", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: duplicatePhoneError.error },
              code: { type: "string", example: duplicatePhoneError.code },
              category: { type: "string", example: duplicatePhoneError.category },
              context: { 
                type: "object",
                properties: {
                  phone: { type: "string", example: duplicatePhoneError.context.phone },
                  existingCustomerId: { type: "string", example: duplicatePhoneError.context.existingCustomerId },
                },
              },
            },
            example: duplicatePhoneError,
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
  "/api/customers/{id}": {
    get: {
      tags: ["Customers"],
      summary: "Get customer",
      operationId: "getCustomer",
      description: "Returns the full customer record plus `recentOrders` (up to 10 most recent orders).",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Customer detail including recentOrders",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: customerSchema,
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
        "403": { description: "Missing customers:read scope", content: json(errorSchema) },
        "404": { 
          description: "Customer not found (code: CUSTOMER_NOT_FOUND)", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: customerNotFoundError.error },
              code: { type: "string", example: customerNotFoundError.code },
              category: { type: "string", example: customerNotFoundError.category },
              context: { 
                type: "object",
                properties: {
                  entity: { type: "string", example: customerNotFoundError.context.entity },
                  id: { type: "string", example: customerNotFoundError.context.id },
                },
              },
            },
            example: customerNotFoundError,
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    patch: {
      tags: ["Customers"],
      summary: "Update customer",
      operationId: "updateCustomer",
      description: "Partial update — only include fields you want to change. `communeId` is required and must be a non-empty string.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                name: { type: "string", example: "Ahmed Benali" },
                phone: phoneField,
                phone2: { ...phoneField, nullable: true, description: "Secondary phone. Set to null to clear it." },
                wilayaId: { type: "integer", minimum: 1, maximum: 58, description: "Official wilaya number (1–58)", example: 16 },
                communeId: { type: "string", minLength: 1, description: "Required. Commune UUID from /api/wilayas/{id}/communes. Must be a non-empty string." },
                address: { type: "string", nullable: true, description: "Street address. Set to null to clear it." },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Customer updated. Returns the full updated customer record.",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: customerSchema,
              message: { type: "string", example: "Customer updated successfully" },
            },
          }),
        },
        "400": { 
          description: "Validation error (invalid phone format)", 
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
                        path: { type: "string", example: "phone" },
                        message: { type: "string", example: "Invalid Algerian phone number" },
                        code: { type: "string", example: "invalid_format" },
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
                    path: "phone",
                    message: "Invalid Algerian phone number",
                    code: "invalid_format",
                  },
                ],
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
        "403": { description: "Missing customers:update scope", content: json(errorSchema) },
        "404": { 
          description: "Customer not found (code: CUSTOMER_NOT_FOUND)", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: customerNotFoundError.error },
              code: { type: "string", example: customerNotFoundError.code },
              category: { type: "string", example: customerNotFoundError.category },
              context: { 
                type: "object",
                properties: {
                  entity: { type: "string", example: customerNotFoundError.context.entity },
                  id: { type: "string", example: customerNotFoundError.context.id },
                },
              },
            },
            example: customerNotFoundError,
          }),
        },
        "409": { 
          description: "Duplicate phone number - a customer with this phone already exists (code: DUPLICATE_PHONE)", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: duplicatePhoneError.error },
              code: { type: "string", example: duplicatePhoneError.code },
              category: { type: "string", example: duplicatePhoneError.category },
              context: { 
                type: "object",
                properties: {
                  phone: { type: "string", example: duplicatePhoneError.context.phone },
                  existingCustomerId: { type: "string", example: duplicatePhoneError.context.existingCustomerId },
                },
              },
            },
            example: duplicatePhoneError,
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    delete: {
      tags: ["Customers"],
      summary: "Delete customer",
      operationId: "deleteCustomer",
      description: "Permanently deletes the customer. **Returns 409 if the customer has any orders** — remove or reassign the orders first.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Customer permanently deleted",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: { type: "string", example: "Customer deleted successfully" },
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
        "403": { description: "Missing customers:delete scope", content: json(errorSchema) },
        "404": { 
          description: "Customer not found (code: CUSTOMER_NOT_FOUND)", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: customerNotFoundError.error },
              code: { type: "string", example: customerNotFoundError.code },
              category: { type: "string", example: customerNotFoundError.category },
              context: { 
                type: "object",
                properties: {
                  entity: { type: "string", example: customerNotFoundError.context.entity },
                  id: { type: "string", example: customerNotFoundError.context.id },
                },
              },
            },
            example: customerNotFoundError,
          }),
        },
        "422": { 
          description: "Cannot delete customer with existing orders (code: CUSTOMER_HAS_ORDERS). The context includes orderCount.", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: customerHasOrdersError.error },
              code: { type: "string", example: customerHasOrdersError.code },
              category: { type: "string", example: customerHasOrdersError.category },
              context: { 
                type: "object",
                properties: {
                  customerId: { type: "string", example: customerHasOrdersError.context.customerId },
                  orderCount: { type: "integer", example: customerHasOrdersError.context.orderCount },
                },
              },
            },
            example: customerHasOrdersError,
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
  "/api/customers/{id}/orders": {
    get: {
      tags: ["Customers"],
      summary: "Get customer orders",
      operationId: "getCustomerOrders",
      description: "Returns all orders for a customer in reverse chronological order, each with `statusHistory` included.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "List of customer orders (each includes statusHistory)",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: { $ref: "#/components/schemas/Order" } },
              count: { type: "integer" },
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
        "403": { description: "Missing customers:read scope", content: json(errorSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
  "/api/customers/{id}/groups": {
    get: {
      tags: ["Customers"],
      summary: "Get customer groups",
      operationId: "getCustomerGroups",
      description: "Returns all customer groups the customer belongs to, including the `assignedAt` timestamp for each membership.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "List of groups the customer belongs to",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "array",
                items: {
                  allOf: [
                    { $ref: "#/components/schemas/CustomerGroup" },
                    {
                      type: "object",
                      properties: {
                        assignedAt: { type: "string", format: "date-time", description: "When the customer was added to this group" },
                      },
                    },
                  ],
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
        "403": { description: "Missing customer_groups:read scope", content: json(errorSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
  "/api/customers/{id}/tags": {
    get: {
      tags: ["Customers"],
      summary: "Get customer tags",
      operationId: "getCustomerTags",
      description: "Returns all tags assigned to the customer, including the `assignedAt` timestamp for each assignment.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "List of tags assigned to the customer",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "array",
                items: {
                  allOf: [
                    { $ref: "#/components/schemas/CustomerTag" },
                    {
                      type: "object",
                      properties: {
                        assignedAt: { type: "string", format: "date-time", description: "When the tag was assigned to this customer" },
                      },
                    },
                  ],
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
        "403": { description: "Missing customer_tags:read scope", content: json(errorSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
};
