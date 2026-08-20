/**
 * Users OpenAPI Paths
 */

const userSchema = { $ref: "#/components/schemas/User" };
const errorSchema = { $ref: "#/components/schemas/ErrorResponse" };
const json = (schema: object) => ({ "application/json": { schema } });

export const userPaths = {
  "/api/users": {
    get: {
      tags: ["Users"],
      summary: "List users",
      description: "Returns a paginated list of team members. Each user includes their `scopes` array (`[\"*\"]` for admins).",
      operationId: "listUsers",
      parameters: [
        { name: "role", in: "query", schema: { type: "string", enum: ["admin", "staff"] } },
        { name: "status", in: "query", schema: { type: "string", enum: ["active", "inactive"] } },
        { name: "search", in: "query", description: "Search by name or email", schema: { type: "string" } },
        { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 100 } },
        { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
      ],
      responses: {
        "200": {
          description: "List of users",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: { type: "array", items: userSchema },
              count: { type: "integer" },
            },
          }),
        },
        "400": {
          description: "Validation error (invalid query parameters)",
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
                        path: { type: "string", example: "limit" },
                        message: { type: "string", example: "Number must be less than or equal to 100" },
                      },
                    },
                  },
                },
              },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Admin role required", content: json(errorSchema) },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    post: {
      tags: ["Users"],
      summary: "Create user",
      operationId: "createUser",
      description: `Creates a new team member. **Admin only.**

**What happens:**
1. A user account is created in the database with a secure temporary password
2. The password is hashed using scrypt (same algorithm as better-auth)
3. An API key is generated for programmatic access
4. Initial permission scopes are assigned (if role is staff)

**Authentication:**
- The new user receives a temporary password (returned once in this response)
- They can sign in using email + temporary password
- They should change their password on first login for security

**Note:** \`scopes\` are ignored for \`admin\` users — admins always have \`["*"]\`.`,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email", "name"],
              properties: {
                email: { type: "string", format: "email", example: "staff@example.com" },
                name: { type: "string", example: "Ahmed Benali" },
                role: { type: "string", enum: ["admin", "staff"], default: "staff" },
                scopes: {
                  type: "array",
                  items: { type: "string" },
                  default: [],
                  description: "Initial permission scopes. Ignored if role is `admin`.",
                  example: ["orders:read", "customers:read"],
                },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "User created. **The `apiKey` and `tempPassword` fields are returned only in this response — store them immediately.**",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: userSchema,
              apiKey: {
                type: "string",
                example: "cod_a1b2c3d4e5f6...",
                description: "The raw API key for the new user — returned once at creation. Use POST /api/users/{id}/api-key/rotate to issue a new key.",
              },
              tempPassword: {
                type: "string",
                example: "a1b2c3d4e5f6g7h8i9j0",
                description: "Temporary password for the new user — returned once at creation. Share this with the user securely. They should change it on first login.",
              },
              message: { type: "string", example: "User created. Share the tempPassword with the user — it will not be shown again." },
            },
          }),
        },
        "400": {
          description: "Validation error (invalid email, missing required fields)",
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
                        path: { type: "string", example: "email" },
                        message: { type: "string", example: "Invalid email" },
                      },
                    },
                  },
                },
              },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Admin access required", content: json(errorSchema) },
        "409": {
          description: "A user with this email already exists",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "A user with this email already exists" },
              code: { type: "string", example: "DUPLICATE_EMAIL" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  email: { type: "string", example: "staff@example.com" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/users/{id}": {
    get: {
      tags: ["Users"],
      summary: "Get user",
      operationId: "getUser",
      description: "Returns full user record including their `scopes` array.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "User detail with scopes",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: userSchema,
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Admin role required", content: json(errorSchema) },
        "404": {
          description: "User not found",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "User with ID user_123 not found" },
              code: { type: "string", example: "USER_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "User" },
                  id: { type: "string", example: "user_123" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
    patch: {
      tags: ["Users"],
      summary: "Update user",
      operationId: "updateUser",
      description: "Partial update — only include fields you want to change. To change scopes, use `POST /{id}/scopes` and `DELETE /{id}/scopes/{scope}`. To change role only, prefer `PATCH /{id}/role`.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                email: { type: "string", format: "email" },
                name: { type: "string" },
                role: { type: "string", enum: ["admin", "staff"] },
                status: { type: "string", enum: ["active", "inactive"] },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "User updated",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: userSchema,
              message: { type: "string", example: "User updated successfully" },
            },
          }),
        },
        "400": {
          description: "Validation error (invalid email format)",
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
                        path: { type: "string", example: "email" },
                        message: { type: "string", example: "Invalid email" },
                      },
                    },
                  },
                },
              },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Admin role required", content: json(errorSchema) },
        "404": {
          description: "User not found",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "User with ID user_123 not found" },
              code: { type: "string", example: "USER_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "User" },
                  id: { type: "string", example: "user_123" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/users/{id}/role": {
    patch: {
      tags: ["Users"],
      summary: "Update user role",
      operationId: "updateUserRole",
      description: "Dedicated endpoint for role-only changes. Changing to `admin` effectively grants `[\"*\"]` scope.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["role"],
              properties: {
                role: { type: "string", enum: ["admin", "staff"] },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Role updated",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: userSchema,
              message: { type: "string", example: "User role updated successfully" },
            },
          }),
        },
        "400": {
          description: "Validation error (invalid role value)",
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
                        path: { type: "string", example: "role" },
                        message: { type: "string", example: "Invalid enum value" },
                      },
                    },
                  },
                },
              },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Admin role required", content: json(errorSchema) },
        "404": {
          description: "User not found",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "User with ID user_123 not found" },
              code: { type: "string", example: "USER_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "User" },
                  id: { type: "string", example: "user_123" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/users/{id}/scopes": {
    post: {
      tags: ["Users"],
      summary: "Grant scope to user",
      operationId: "grantScope",
      description: "Grants a single permission scope to the user. Returns the full updated user record.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["scope"],
              properties: {
                scope: { type: "string", example: "customers:read" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Scope granted",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: userSchema,
              message: { type: "string", example: "Scope granted successfully" },
            },
          }),
        },
        "400": {
          description: "Validation error (empty scope)",
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
                        path: { type: "string", example: "scope" },
                        message: { type: "string", example: "String must contain at least 1 character(s)" },
                      },
                    },
                  },
                },
              },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Admin role required", content: json(errorSchema) },
        "404": {
          description: "User not found",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "User with ID user_123 not found" },
              code: { type: "string", example: "USER_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "User" },
                  id: { type: "string", example: "user_123" },
                },
              },
            },
          }),
        },
        "409": {
          description: "Scope already granted to user",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "Scope already granted to user" },
              code: { type: "string", example: "DUPLICATE_ENTITY" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  userId: { type: "string", example: "user_123" },
                  scope: { type: "string", example: "customers:read" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/users/{id}/scopes/{scope}": {
    delete: {
      tags: ["Users"],
      summary: "Revoke scope from user",
      operationId: "revokeScope",
      description: "Removes a permission scope from the user. If the scope was not granted, the operation succeeds silently.",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
        { name: "scope", in: "path", required: true, schema: { type: "string" }, example: "customers:read" },
      ],
      responses: {
        "200": {
          description: "Scope revoked. Returns full updated user record.",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: userSchema,
              message: { type: "string", example: "Scope revoked successfully" },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Admin role required", content: json(errorSchema) },
        "404": {
          description: "User not found",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "User with ID user_123 not found" },
              code: { type: "string", example: "USER_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "User" },
                  id: { type: "string", example: "user_123" },
                },
              },
            },
          }),
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  },

  "/api/users/{id}/api-key/rotate": {
    post: {
      tags: ["Users"],
      summary: "Rotate API key",
      operationId: "rotateApiKey",
      description: "Generates a new API key for the user, invalidating the previous one. **Admin only. The raw key is returned only once** — store it securely.",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        "200": {
          description: "New API key issued. The raw key is shown only in this response.",
          content: json({
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: {
                type: "object",
                properties: {
                  apiKey: { type: "string", example: "cod_a1b2c3d4e5f6...", description: "The new raw API key — store it immediately, it cannot be retrieved again" },
                },
                required: ["apiKey"],
              },
              message: { type: "string", example: "API key rotated successfully" },
            },
          }),
        },
        "401": { description: "Missing or invalid API key", content: json(errorSchema) },
        "403": { description: "Admin access required", content: json(errorSchema) },
        "404": {
          description: "User not found",
          content: json({
            type: "object",
            properties: {
              error: { type: "string", example: "User with ID user_123 not found" },
              code: { type: "string", example: "USER_NOT_FOUND" },
              category: { type: "string", example: "BUSINESS_LOGIC" },
              context: {
                type: "object",
                properties: {
                  entity: { type: "string", example: "User" },
                  id: { type: "string", example: "user_123" },
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
