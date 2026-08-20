/**
 * Drivers OpenAPI Paths
 */

const driverSchema = { $ref: "#/components/schemas/Driver" };
const errorSchema = { $ref: "#/components/schemas/Error" };
const validationErrorSchema = { $ref: "#/components/schemas/ValidationError" };
const json = (schema: object) => ({ "application/json": { schema } });

// Error response examples for drivers endpoint
const driverNotFoundError = {
  error: "Driver with ID abc123 not found",
  code: "DRIVER_NOT_FOUND",
  category: "BUSINESS_LOGIC",
  context: { entity: "Driver", id: "abc123" }
};

const driverHasActiveOrdersError = {
  error: "Cannot delete driver with active orders",
  code: "DRIVER_HAS_ACTIVE_ORDERS",
  category: "BUSINESS_LOGIC",
  context: { driverId: "abc123", activeOrderCount: 3 }
};

const driverUnavailableError = {
  error: "Driver is not available for assignment",
  code: "DRIVER_UNAVAILABLE",
  category: "BUSINESS_LOGIC",
  context: { driverId: "abc123", status: "inactive" }
};

const driverCompensationNotFoundError = {
  error: "Driver compensation with ID driver=abc123 wilaya=17 not found",
  code: "DRIVER_COMPENSATION_NOT_FOUND",
  category: "BUSINESS_LOGIC",
  context: { entity: "Driver compensation", id: "driver=abc123 wilaya=17" }
};

const phoneField = {
  type: "string",
  pattern: "^0[5-7]\\d{8}$",
  description: "Algerian mobile number starting with 05, 06, or 07",
  example: "0551234567",
};

export const driverPaths = {
  "/api/drivers": {
    get: {
      tags: ["Drivers"],
      summary: "List drivers",
      description: "Returns a paginated list of drivers. Each item includes `compensationWilayaCount` — the number of wilayas with a configured per-delivery fee for this driver.",
      operationId: "listDrivers",
      parameters: [
        {
          name: "wilayaId",
          in: "query",
          description: "Filter to drivers with a configured compensation row for this wilaya (1–58)",
          schema: { type: "integer", minimum: 1, maximum: 58 },
        },
        { name: "status", in: "query", description: "Filter by availability status", schema: { type: "string", enum: ["available", "busy", "inactive"] } },
        { name: "vehicleType", in: "query", description: "Filter by vehicle type", schema: { type: "string", enum: ["motorcycle", "car", "van"] } },
        { name: "search", in: "query", description: "Search by first name, last name, or phone", schema: { type: "string" } },
        { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 100 } },
        { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
      ],
      responses: {
        "200": {
          description: "List of drivers",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: driverSchema },
              count: { type: "integer", description: "Total number of drivers in this response (same as data.length)" },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing delivery:read scope", content: json(errorSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    post: {
      tags: ["Drivers"],
      summary: "Create driver",
      operationId: "createDriver",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["firstName", "lastName", "phone"],
              properties: {
                firstName: { type: "string", example: "Mohamed", description: "Driver's first name" },
                lastName: { type: "string", example: "Amiri", description: "Driver's last name" },
                phone: phoneField,
                phone2: { ...phoneField, nullable: true, description: "Optional secondary phone number" },
                vehicleType: { type: "string", enum: ["motorcycle", "car", "van"], nullable: true, description: "Type of vehicle. Omit or null if unknown." },
                status: { type: "string", enum: ["available", "busy", "inactive"], default: "available", description: "Availability status. Defaults to `available`." },
                notes: { type: "string", nullable: true, description: "Internal notes about the driver (not visible to customers)" },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Driver created. Returns full driver record including `compensationWilayaCount` and `recentOrders`.",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: driverSchema,
              message: { type: "string", example: "Driver created successfully" },
            },
          }),
        },
        "400": { description: "Validation error (invalid phone format, missing required fields)", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing delivery:manage scope", content: json(errorSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/drivers/{id}": {
    get: {
      tags: ["Drivers"],
      summary: "Get driver",
      operationId: "getDriver",
      description: "Returns full driver detail including `compensationWilayaCount` and `recentOrders` (up to 10 most recent orders assigned to this driver). Use `GET /api/drivers/{id}/compensations` for the per-wilaya pay grid.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Driver detail",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: driverSchema,
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing delivery:read scope", content: json(errorSchema) },
        "404": { 
          description: "Driver not found (DRIVER_NOT_FOUND)", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: driverNotFoundError.error },
              code: { type: "string", example: driverNotFoundError.code },
              category: { type: "string", example: driverNotFoundError.category },
              context: { type: "object", example: driverNotFoundError.context }
            },
            example: driverNotFoundError
          })
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    patch: {
      tags: ["Drivers"],
      summary: "Update driver",
      operationId: "updateDriver",
      description: "Partial update — only include fields you want to change. Use `PATCH /{id}/status` to change availability status.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              description: "Only include fields you want to change. Omitted fields are left unchanged.",
              properties: {
                firstName: { type: "string", description: "Updated first name" },
                lastName: { type: "string", description: "Updated last name" },
                phone: phoneField,
                phone2: { ...phoneField, nullable: true, description: "Updated secondary phone. Send `null` to clear it." },
                vehicleType: { type: "string", enum: ["motorcycle", "car", "van"], nullable: true, description: "Updated vehicle type. Send `null` to clear it." },
                notes: { type: "string", nullable: true, description: "Updated internal notes. Send `null` to clear." },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Driver updated. Returns full updated driver record.",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: driverSchema,
              message: { type: "string", example: "Driver updated successfully" },
            },
          }),
        },
        "400": { description: "Validation error (invalid phone format)", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing delivery:manage scope", content: json(errorSchema) },
        "404": { 
          description: "Driver not found (DRIVER_NOT_FOUND)", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: driverNotFoundError.error },
              code: { type: "string", example: driverNotFoundError.code },
              category: { type: "string", example: driverNotFoundError.category },
              context: { type: "object", example: driverNotFoundError.context }
            },
            example: driverNotFoundError
          })
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    delete: {
      tags: ["Drivers"],
      summary: "Delete driver",
      operationId: "deleteDriver",
      description: "Permanently deletes the driver. **Returns 409 if the driver has orders in `assigned` or `out_for_delivery` status** — resolve those orders first.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Driver deleted",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: { type: "string", example: "Driver deleted successfully" },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing delivery:manage scope", content: json(errorSchema) },
        "404": { 
          description: "Driver not found (DRIVER_NOT_FOUND)", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: driverNotFoundError.error },
              code: { type: "string", example: driverNotFoundError.code },
              category: { type: "string", example: driverNotFoundError.category },
              context: { type: "object", example: driverNotFoundError.context }
            },
            example: driverNotFoundError
          })
        },
        "409": {
          description: "Cannot delete driver with active orders (DRIVER_HAS_ACTIVE_ORDERS)",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: driverHasActiveOrdersError.error },
              code: { type: "string", example: driverHasActiveOrdersError.code },
              category: { type: "string", example: driverHasActiveOrdersError.category },
              context: { type: "object", example: driverHasActiveOrdersError.context }
            },
            example: driverHasActiveOrdersError
          })
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/drivers/{id}/status": {
    patch: {
      tags: ["Drivers"],
      summary: "Update driver status",
      operationId: "updateDriverStatus",
      description: "Updates driver availability status. Returns the full updated driver record.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["status"],
              properties: {
                status: { type: "string", enum: ["available", "busy", "inactive"] },
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
              data: driverSchema,
              message: { type: "string", example: "Driver status updated" },
            },
          }),
        },
        "400": { description: "Validation error (invalid status value)", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing delivery:manage scope", content: json(errorSchema) },
        "404": { 
          description: "Driver not found (DRIVER_NOT_FOUND)", 
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: driverNotFoundError.error },
              code: { type: "string", example: driverNotFoundError.code },
              category: { type: "string", example: driverNotFoundError.category },
              context: { type: "object", example: driverNotFoundError.context }
            },
            example: driverNotFoundError
          })
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/drivers/{id}/compensations": {
    get: {
      tags: ["Drivers"],
      summary: "List driver compensations",
      operationId: "listDriverCompensations",
      description:
        "Returns all 58 wilayas with the driver's configured per-delivery fee. `feePerDelivery` is `null` when no row has been configured for that wilaya (in which case the assigned order's driver fee defaults to 0).",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "Per-wilaya compensation grid for this driver.",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    wilayaId: { type: "integer", example: 16 },
                    wilayaName: { type: "string", example: "Alger" },
                    wilayaNameAr: { type: "string", example: "الجزائر" },
                    feePerDelivery: {
                      type: "number",
                      nullable: true,
                      example: 350,
                      description: "DZD per delivery; `null` when not configured.",
                    },
                  },
                },
              },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing delivery:read scope", content: json(errorSchema) },
        "404": {
          description: "Driver not found (DRIVER_NOT_FOUND)",
          content: json({ type: "object", example: driverNotFoundError }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/drivers/{id}/compensations/{wilayaId}": {
    put: {
      tags: ["Drivers"],
      summary: "Upsert driver compensation for one wilaya",
      operationId: "setDriverCompensation",
      description:
        "Sets (or updates) the per-delivery fee this driver is paid for the given wilaya. Idempotent.",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
        { name: "wilayaId", in: "path", required: true, schema: { type: "integer", minimum: 1, maximum: 58 } },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["feePerDelivery"],
              properties: {
                feePerDelivery: {
                  type: "number",
                  minimum: 0,
                  example: 350,
                  description: "DZD per delivery in this wilaya.",
                },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Compensation saved.",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  driverId: { type: "string" },
                  wilayaId: { type: "integer" },
                  feePerDelivery: { type: "number" },
                  createdAt: { type: "string", format: "date-time" },
                  updatedAt: { type: "string", format: "date-time" },
                },
              },
              message: { type: "string", example: "Compensation saved" },
            },
          }),
        },
        "400": { description: "Validation error (negative fee, invalid wilayaId)", content: json(validationErrorSchema) },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing delivery:manage scope", content: json(errorSchema) },
        "404": {
          description: "Driver not found (DRIVER_NOT_FOUND)",
          content: json({ type: "object", example: driverNotFoundError }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    delete: {
      tags: ["Drivers"],
      summary: "Remove driver compensation for one wilaya",
      operationId: "deleteDriverCompensation",
      description:
        "Removes the per-delivery fee row for this driver/wilaya pair. Future assignments in that wilaya will compute driverFee = 0 until a new row is set.",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
        { name: "wilayaId", in: "path", required: true, schema: { type: "integer", minimum: 1, maximum: 58 } },
      ],
      responses: {
        "200": {
          description: "Compensation removed.",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: { type: "string", example: "Compensation removed" },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Missing delivery:manage scope", content: json(errorSchema) },
        "404": {
          description: "Driver not found (`DRIVER_NOT_FOUND`) **or** no compensation row exists for this (driver, wilaya) pair (`DRIVER_COMPENSATION_NOT_FOUND`). Distinguish via the `code` field.",
          content: json({
            type: "object",
            example: driverCompensationNotFoundError,
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },
};
