/**
 * Route-level integration tests for Users OpenAPIHono router.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { ERROR_CODES, ERROR_CATEGORIES } from "../../../../cod-shared/errors/codes";
import usersRouter from "./routes";
import * as queries from "./queries";

const mockDb = {
  select: vi.fn(),
} as any;

vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}));
vi.mock("./queries");
// Email side effect — its own contract is pinned in invite-email.test.ts.
vi.mock("./invite-email", () => ({
  sendInviteEmail: vi.fn().mockResolvedValue({ sent: false, error: null }),
}));
vi.mock("@/lib/activity", () => ({
  logActivity: vi.fn(),
  ACTIONS: {
    USER_CREATED: "user.created",
    USER_UPDATED: "user.updated",
    USER_ROLE_CHANGED: "user.role_changed",
    USER_SCOPE_GRANTED: "user.scope_granted",
    USER_SCOPE_REVOKED: "user.scope_revoked",
  },
}));

const NOW = new Date().toISOString();

function userRow(overrides: Record<string, any> = {}) {
  return {
    id: "a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8",
    name: "Ahmed Benali",
    email: "staff@example.com",
    emailVerified: true,
    image: null,
    role: "staff" as const,
    status: "active" as const,
    language: "en",
    createdAt: new Date(NOW),
    updatedAt: new Date(NOW),
    scopes: ["orders:read", "customers:read"],
    ...overrides,
  };
}

describe("Users routes (OpenAPIHono)", () => {
  let app: OpenAPIHono<AppContext>;

  beforeEach(() => {
    app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
    app.use("*", async (c, next) => {
      c.env = { DB: mockDb } as any;
      c.set("user", {
        id: "admin_user_001",
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
        status: "active",
        apiKey: null,
        createdAt: NOW,
        updatedAt: NOW,
      } as any);
      await next();
    });
    app.onError(errorHandler);
    app.route("/api/users", usersRouter);
    vi.clearAllMocks();
  });

  describe("GET /api/users", () => {
    it("returns 200 with users and count", async () => {
      vi.mocked(queries.getAllUsers).mockResolvedValue([userRow()]);

      const res = await app.request("/api/users");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.count).toBe(1);
      expect(body.data[0].scopes).toEqual(["orders:read", "customers:read"]);
    });

    it("passes query parameters to queries.getAllUsers", async () => {
      vi.mocked(queries.getAllUsers).mockResolvedValue([]);

      const res = await app.request("/api/users?role=staff&status=active&search=ahmed&limit=10&offset=5");

      expect(res.status).toBe(200);
      expect(queries.getAllUsers).toHaveBeenCalledWith(mockDb, {
        role: "staff",
        status: "active",
        search: "ahmed",
        limit: 10,
        offset: 5,
      });
    });

    it("returns 400 for invalid role filter", async () => {
      const res = await app.request("/api/users?role=superadmin");

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        category: ERROR_CATEGORIES.VALIDATION,
        code: ERROR_CODES.VALIDATION_FAILED,
      });
    });
  });

  describe("POST /api/users", () => {
    it("creates a user and returns one-time apiKey and tempPassword", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      });
      const created = userRow({ id: "new_user_001" });
      vi.mocked(queries.createUser).mockResolvedValue(created);

      const res = await app.request("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "staff@example.com",
          name: "Ahmed Benali",
          role: "staff",
          scopes: ["orders:read"],
        }),
      });

      expect(res.status).toBe(201);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe("new_user_001");
      expect(body.apiKey).toMatch(/^cod_/);
      expect(typeof body.tempPassword).toBe("string");
      expect(body.tempPassword.length).toBeGreaterThan(0);
    });

    it("returns 409 DUPLICATE_EMAIL when email already exists", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ id: "existing_user" }),
          }),
        }),
      });

      const res = await app.request("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "staff@example.com",
          name: "Ahmed Benali",
        }),
      });

      expect(res.status).toBe(409);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.DUPLICATE_EMAIL,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: { email: "staff@example.com" },
      });
    });

    it("returns 400 for invalid email format", async () => {
      const res = await app.request("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email", name: "Ahmed" }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        category: ERROR_CATEGORIES.VALIDATION,
      });
    });
  });

  describe("GET /api/users/:id", () => {
    it("returns 200 with user detail including scopes", async () => {
      vi.mocked(queries.getUserById).mockResolvedValue(userRow());

      const res = await app.request("/api/users/user_123");

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.scopes).toBeDefined();
    });

    it("returns 404 when user is not found", async () => {
      vi.mocked(queries.getUserById).mockResolvedValue(null);

      const res = await app.request("/api/users/user_missing");

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.USER_NOT_FOUND,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
      });
    });
  });

  describe("PATCH /api/users/:id", () => {
    it("updates user successfully", async () => {
      vi.mocked(queries.updateUser).mockResolvedValue(userRow({ name: "Updated Name" }));

      const res = await app.request("/api/users/user_123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.name).toBe("Updated Name");
    });

    it("returns 404 when user is not found", async () => {
      vi.mocked(queries.updateUser).mockResolvedValue(null);

      const res = await app.request("/api/users/user_missing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Whatever" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/users/:id/role", () => {
    it("updates role successfully", async () => {
      vi.mocked(queries.updateUser).mockResolvedValue(userRow({ role: "admin", scopes: ["*"] }));

      const res = await app.request("/api/users/user_123/role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "admin" }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.role).toBe("admin");
      expect(body.message).toBe("User role updated successfully");
    });

    it("returns 400 for invalid role value", async () => {
      const res = await app.request("/api/users/user_123/role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "superadmin" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 404 when user is not found", async () => {
      vi.mocked(queries.updateUser).mockResolvedValue(null);

      const res = await app.request("/api/users/user_missing/role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "staff" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/users/:id/scopes", () => {
    it("grants a scope successfully", async () => {
      vi.mocked(queries.getUserById).mockResolvedValue(userRow());
      vi.mocked(queries.grantScope).mockResolvedValue(
        userRow({ scopes: ["orders:read", "customers:read"] })
      );

      const res = await app.request("/api/users/user_123/scopes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "customers:read" }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.message).toBe("Scope granted successfully");
    });

    it("returns 409 DUPLICATE_ENTITY when scope is already granted", async () => {
      vi.mocked(queries.getUserById).mockResolvedValue(userRow());
      vi.mocked(queries.grantScope).mockRejectedValue(
        new Error("Scope already granted to user")
      );

      const res = await app.request("/api/users/user_123/scopes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "customers:read" }),
      });

      expect(res.status).toBe(409);
      const body: any = await res.json();
      expect(body).toMatchObject({
        code: ERROR_CODES.DUPLICATE_ENTITY,
        context: { userId: "user_123", scope: "customers:read" },
      });
    });

    it("returns 404 when user is not found", async () => {
      vi.mocked(queries.getUserById).mockResolvedValue(null);

      const res = await app.request("/api/users/user_missing/scopes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "customers:read" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/users/:id/scopes/:scope", () => {
    it("revokes a scope successfully", async () => {
      vi.mocked(queries.getUserById).mockResolvedValue(userRow());
      vi.mocked(queries.revokeScope).mockResolvedValue(userRow({ scopes: [] }));

      const res = await app.request("/api/users/user_123/scopes/customers:read", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.message).toBe("Scope revoked successfully");
    });

    it("succeeds silently when the scope was not granted", async () => {
      vi.mocked(queries.getUserById).mockResolvedValue(userRow());
      vi.mocked(queries.revokeScope).mockResolvedValue(userRow());

      const res = await app.request("/api/users/user_123/scopes/nonexistent:scope", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/users/:id/api-key/rotate", () => {
    it("rotates the API key and returns it once", async () => {
      vi.mocked(queries.getUserById).mockResolvedValue(userRow());
      vi.mocked(queries.rotateApiKey).mockResolvedValue({ apiKey: "cod_new_key" });

      const res = await app.request("/api/users/user_123/api-key/rotate", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.apiKey).toBe("cod_new_key");
      expect(body.message).toBe("API key rotated successfully");
    });

    it("returns 404 when user is not found", async () => {
      vi.mocked(queries.getUserById).mockResolvedValue(null);

      const res = await app.request("/api/users/user_missing/api-key/rotate", {
        method: "POST",
      });

      expect(res.status).toBe(404);
    });
  });
});
