/**
 * Users Routes
 *
 * Team-member management: CRUD, role changes, scope grant/revoke, and API-key
 * rotation. Every route is admin-only (requireAdmin) — staff are rejected
 * regardless of scopes.
 *
 * Migrated to @hono/zod-openapi: route definitions below are the single
 * source of truth for validation and the OpenAPI spec. Handlers are
 * unchanged and remain independently mountable/testable.
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { requireAdmin } from "@/rbac/middleware";
import * as handlers from "./handlers";
import {
  UserSchema,
  ErrorResponseSchema,
  SuccessResponseSchema,
  ListResponseSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

const errorResponse = (description: string) => ({
  description,
  content: jsonContent(ErrorResponseSchema),
});

const idParams = z.object({
  id: z.string().openapi({ description: "User ID", example: "a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8" }),
});

const listUsersRoute = createRoute({
  method: "get",
  path: "/",
  middleware: [requireAdmin()],
  tags: ["Users"],
  summary: "List users",
  description:
    'Returns a paginated list of team members. Each user includes their `scopes` array (`["*"]` for admins).',
  operationId: "listUsers",
  request: {
    query: z.object({
      role: z.enum(["admin", "staff"]).optional(),
      status: z.enum(["active", "inactive"]).optional(),
      search: z.string().optional().openapi({ description: "Search by name or email" }),
      limit: z.coerce.number().int().positive().max(100).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }),
  },
  responses: {
    200: {
      description: "List of users",
      content: jsonContent(ListResponseSchema(UserSchema)),
    },
    400: errorResponse("Validation error (invalid query parameters)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Admin role required"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const createUserRoute = createRoute({
  method: "post",
  path: "/",
  middleware: [requireAdmin()],
  tags: ["Users"],
  summary: "Create user",
  description:
    "Creates a new team member. **Admin only.**\n\n" +
    "**What happens:**\n" +
    "1. A user account is created in the database with a secure temporary password\n" +
    "2. The password is hashed using scrypt (same algorithm as better-auth)\n" +
    "3. An API key is generated for programmatic access\n" +
    "4. Initial permission scopes are assigned (if role is staff)\n\n" +
    "**Authentication:**\n" +
    "- The new user receives a temporary password (returned once in this response)\n" +
    "- They can sign in using email + temporary password\n" +
    "- They should change their password on first login for security\n\n" +
    '**Note:** `scopes` are ignored for `admin` users — admins always have `["*"]`.',
  operationId: "createUser",
  request: {
    body: {
      required: true,
      content: jsonContent(
        z.object({
          email: z.string().email("Invalid email format").openapi({ example: "staff@example.com" }),
          name: z.string().min(1, "Name is required").openapi({ example: "Ahmed Benali" }),
          role: z.enum(["admin", "staff"]).default("staff").openapi({
            description: "Defaults to `staff`.",
          }),
          scopes: z.array(z.string()).default([]).openapi({
            description: "Initial permission scopes. Ignored if role is `admin`.",
            example: ["orders:read", "customers:read"],
          }),
        })
      ),
    },
  },
  responses: {
    201: {
      description:
        "User created. **The `apiKey` and `tempPassword` fields are returned only in this response — store them immediately.**",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: UserSchema,
          apiKey: z.string().openapi({
            description:
              "The raw API key for the new user — returned once at creation. Use POST /{id}/api-key/rotate to issue a new key.",
            example: "cod_a1b2c3d4e5f6...",
          }),
          tempPassword: z.string().openapi({
            description:
              "Temporary password for the new user — returned once at creation. Share this with the user securely. They should change it on first login.",
            example: "a1b2c3d4e5f6g7h8i9j0",
          }),
          message: z.string().openapi({
            example: "User created. Share the tempPassword with the user — it will not be shown again.",
          }),
        })
      ),
    },
    400: errorResponse("Validation error (invalid email, missing required fields)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Admin access required"),
    409: errorResponse("A user with this email already exists (code: DUPLICATE_EMAIL)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const getUserRoute = createRoute({
  method: "get",
  path: "/{id}",
  middleware: [requireAdmin()],
  tags: ["Users"],
  summary: "Get user",
  description: "Returns full user record including their `scopes` array.",
  operationId: "getUser",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "User detail with scopes",
      content: jsonContent(SuccessResponseSchema(UserSchema)),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Admin role required"),
    404: errorResponse("User not found"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const updateUserRoute = createRoute({
  method: "patch",
  path: "/{id}",
  middleware: [requireAdmin()],
  tags: ["Users"],
  summary: "Update user",
  description:
    "Partial update — only include fields you want to change. To change scopes, use `POST /{id}/scopes` and `DELETE /{id}/scopes/{scope}`. To change role only, prefer `PATCH /{id}/role`.",
  operationId: "updateUser",
  request: {
    params: idParams,
    body: {
      required: true,
      content: jsonContent(
        z.object({
          email: z.string().email("Invalid email format").optional(),
          name: z.string().min(1, "Name is required").optional(),
          role: z.enum(["admin", "staff"]).optional(),
          status: z.enum(["active", "inactive"]).optional(),
        })
      ),
    },
  },
  responses: {
    200: {
      description: "User updated",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: UserSchema,
          message: z.string().openapi({ example: "User updated successfully" }),
        })
      ),
    },
    400: errorResponse("Validation error (invalid email format)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Admin role required"),
    404: errorResponse("User not found"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const updateUserRoleRoute = createRoute({
  method: "patch",
  path: "/{id}/role",
  middleware: [requireAdmin()],
  tags: ["Users"],
  summary: "Update user role",
  description:
    'Dedicated endpoint for role-only changes. Changing to `admin` effectively grants `["*"]` scope.',
  operationId: "updateUserRole",
  request: {
    params: idParams,
    body: {
      required: true,
      content: jsonContent(
        z.object({
          role: z.enum(["admin", "staff"]),
        })
      ),
    },
  },
  responses: {
    200: {
      description: "Role updated",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: UserSchema,
          message: z.string().openapi({ example: "User role updated successfully" }),
        })
      ),
    },
    400: errorResponse("Validation error (invalid role value)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Admin role required"),
    404: errorResponse("User not found"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const grantScopeRoute = createRoute({
  method: "post",
  path: "/{id}/scopes",
  middleware: [requireAdmin()],
  tags: ["Users"],
  summary: "Grant scope to user",
  description: "Grants a single permission scope to the user. Returns the full updated user record.",
  operationId: "grantScope",
  request: {
    params: idParams,
    body: {
      required: true,
      content: jsonContent(
        z.object({
          scope: z.string().min(1, "Scope is required").openapi({ example: "customers:read" }),
        })
      ),
    },
  },
  responses: {
    200: {
      description: "Scope granted",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: UserSchema,
          message: z.string().openapi({ example: "Scope granted successfully" }),
        })
      ),
    },
    400: errorResponse("Validation error (empty scope)"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Admin role required"),
    404: errorResponse("User not found"),
    409: errorResponse("Scope already granted to user (code: DUPLICATE_ENTITY)"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const revokeScopeRoute = createRoute({
  method: "delete",
  path: "/{id}/scopes/{scope}",
  middleware: [requireAdmin()],
  tags: ["Users"],
  summary: "Revoke scope from user",
  description:
    "Removes a permission scope from the user. If the scope was not granted, the operation succeeds silently.",
  operationId: "revokeScope",
  request: {
    params: z.object({
      ...idParams.shape,
      scope: z.string().openapi({ description: "The scope to revoke", example: "customers:read" }),
    }),
  },
  responses: {
    200: {
      description: "Scope revoked. Returns full updated user record.",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: UserSchema,
          message: z.string().openapi({ example: "Scope revoked successfully" }),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Admin role required"),
    404: errorResponse("User not found"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const rotateApiKeyRoute = createRoute({
  method: "post",
  path: "/{id}/api-key/rotate",
  middleware: [requireAdmin()],
  tags: ["Users"],
  summary: "Rotate API key",
  description:
    "Generates a new API key for the user, invalidating the previous one. **Admin only. The raw key is returned only once** — store it securely.",
  operationId: "rotateApiKey",
  request: {
    params: idParams,
  },
  responses: {
    200: {
      description: "New API key issued. The raw key is shown only in this response.",
      content: jsonContent(
        z.object({
          success: z.boolean().openapi({ example: true }),
          data: z.object({
            apiKey: z.string().openapi({
              description: "The new raw API key — store it immediately, it cannot be retrieved again",
              example: "cod_a1b2c3d4e5f6...",
            }),
          }),
          message: z.string().openapi({ example: "API key rotated successfully" }),
        })
      ),
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Admin access required"),
    404: errorResponse("User not found"),
  },
  security: [{ ApiKeyAuth: [] }],
});

const router = new OpenAPIHono<AppContext>();

router.openapi(listUsersRoute, handlers.listUsers);
router.openapi(createUserRoute, handlers.createUser);
router.openapi(getUserRoute, handlers.getUser);
router.openapi(updateUserRoute, handlers.updateUser);
router.openapi(updateUserRoleRoute, handlers.updateUserRole);
router.openapi(grantScopeRoute, handlers.grantScope);
router.openapi(revokeScopeRoute, handlers.revokeScope);
router.openapi(rotateApiKeyRoute, handlers.rotateApiKey);

export default router;
