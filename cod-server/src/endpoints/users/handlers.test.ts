/**
 * Integration Tests for Users Endpoint
 * 
 * Tests error scenarios for users endpoints.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { ERROR_CODES, ERROR_CATEGORIES } from "../../../../cod-shared/errors/codes";
import * as handlers from "./handlers";
import * as queries from "./queries";

// Mock the queries module
vi.mock("./queries");

// Mock the database
const mockDb = {} as any;
vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}));

// Mock activity logging
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


describe("Users Endpoint - Error Scenarios", () => {
  let app: Hono<AppContext>;

  beforeEach(() => {
    app = new Hono<AppContext>();
    
    // Add middleware to inject mock env and user
    app.use("*", async (c, next) => {
      c.env = { DB: mockDb } as any;
      c.set("user", {
        id: "user-123",
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
        status: "active",
        apiKey: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
      await next();
    });
    
    app.onError(errorHandler);
    app.get("/users", handlers.listUsers);
    app.get("/users/:id", handlers.getUser);
    app.post("/users", handlers.createUser);
    app.patch("/users/:id", handlers.updateUser);
    app.patch("/users/:id/role", handlers.updateUserRole);
    app.post("/users/:id/scopes", handlers.grantScope);
    app.delete("/users/:id/scopes/:scope", handlers.revokeScope);
    app.post("/users/:id/api-key/rotate", handlers.rotateApiKey);
    
    vi.clearAllMocks();
  });

  describe("GET /users/:id", () => {
    it("should return 404 with USER_NOT_FOUND code when user does not exist", async () => {
      // Mock getUserById to return null
      vi.mocked(queries.getUserById).mockResolvedValue(null);

      const res = await app.request("/users/user_nonexistent", {
        method: "GET",
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "User with ID user_nonexistent not found",
        code: "USER_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "User",
          id: "user_nonexistent",
        },
      });
    });
  });

  describe("PATCH /users/:id", () => {
    it("should return 404 with USER_NOT_FOUND code when user does not exist", async () => {
      // Mock updateUser to return null
      vi.mocked(queries.updateUser).mockResolvedValue(null);

      const res = await app.request("/users/user_nonexistent", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Updated Name",
        }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "User with ID user_nonexistent not found",
        code: "USER_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "User",
          id: "user_nonexistent",
        },
      });
    });
  });

  describe("PATCH /users/:id/role", () => {
    it("should return 404 with USER_NOT_FOUND code when user does not exist", async () => {
      // Mock updateUser to return null
      vi.mocked(queries.updateUser).mockResolvedValue(null);

      const res = await app.request("/users/user_nonexistent/role", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "staff",
        }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "User with ID user_nonexistent not found",
        code: "USER_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "User",
          id: "user_nonexistent",
        },
      });
    });
  });

  describe("POST /users/:id/scopes", () => {
    it("should return 404 with USER_NOT_FOUND code when user does not exist", async () => {
      // Mock getUserById to return null
      vi.mocked(queries.getUserById).mockResolvedValue(null);

      const res = await app.request("/users/user_nonexistent/scopes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scope: "orders:read",
        }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "User with ID user_nonexistent not found",
        code: "USER_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "User",
          id: "user_nonexistent",
        },
      });
    });

    it("should return 409 with DUPLICATE_ENTITY code when scope already granted", async () => {
      // Mock getUserById to return a user
      vi.mocked(queries.getUserById).mockResolvedValue({
        id: "user_123",
        email: "staff@example.com",
        name: "Staff User",
        emailVerified: true,
        image: null,
        role: "staff",
        status: "active",
        language: "en",
        scopes: ["orders:read"],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock grantScope to throw error
      vi.mocked(queries.grantScope).mockRejectedValue(
        new Error("Scope already granted to user")
      );

      const res = await app.request("/users/user_123/scopes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scope: "orders:read",
        }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "Scope already granted to user",
        code: "DUPLICATE_ENTITY",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          userId: "user_123",
          scope: "orders:read",
        },
      });
    });
  });

  describe("DELETE /users/:id/scopes/:scope", () => {
    it("should return 404 with USER_NOT_FOUND code when user does not exist", async () => {
      // Mock getUserById to return null
      vi.mocked(queries.getUserById).mockResolvedValue(null);

      const res = await app.request("/users/user_nonexistent/scopes/orders:read", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "User with ID user_nonexistent not found",
        code: "USER_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "User",
          id: "user_nonexistent",
        },
      });
    });
  });

  describe("POST /users/:id/api-key/rotate", () => {
    it("should return 404 with USER_NOT_FOUND code when user does not exist", async () => {
      // Mock getUserById to return null
      vi.mocked(queries.getUserById).mockResolvedValue(null);

      const res = await app.request("/users/user_nonexistent/api-key/rotate", {
        method: "POST",
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "User with ID user_nonexistent not found",
        code: "USER_NOT_FOUND",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "User",
          id: "user_nonexistent",
        },
      });
    });
  });

  describe("POST /users", () => {
    it("should return 409 with DUPLICATE_EMAIL code when email already exists", async () => {
      // Mock the DB select to return an existing user (duplicate email check)
      mockDb.select = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ id: "existing-id" }),
          }),
        }),
      });

      const res = await app.request("/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "existing@example.com",
          name: "Existing User",
          role: "staff",
        }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body).toMatchObject({
        error: "A user with this email already exists",
        code: "DUPLICATE_EMAIL",
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: { email: "existing@example.com" },
      });
    });
  });

  describe("Error Response Structure", () => {
    it("should always include error, code, and category fields in error responses", async () => {
      vi.mocked(queries.getUserById).mockResolvedValue(null);

      const res = await app.request("/users/user_nonexistent", {
        method: "GET",
      });

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toHaveProperty("error");
      expect(body).toHaveProperty("code");
      expect(body).toHaveProperty("category");
      expect(typeof body.error).toBe("string");
      expect(typeof body.code).toBe("string");
      expect(typeof body.category).toBe("string");
    });

    it("should include context field when available", async () => {
      vi.mocked(queries.getUserById).mockResolvedValue(null);

      const res = await app.request("/users/user_123", {
        method: "GET",
      });

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toHaveProperty("context");
      expect(body.context).toMatchObject({
        entity: "User",
        id: "user_123",
      });
    });
  });
});
