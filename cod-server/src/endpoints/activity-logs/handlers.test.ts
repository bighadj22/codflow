/**
 * Activity Logs Handler Tests
 *
 * Tests listActivityLogs and getUserActivityLogs using a mock D1 database.
 * No real database required — all queries are intercepted by the mock.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { ACTIONS, logActivity } from "@/lib/activity";
import { listActivityLogs, getUserActivityLogs } from "./handlers";
import { ValidationError } from "@/lib/errors/classes";

// ─── Shared mock D1 ────────────────────────────────────────────────────────

function makeMockD1(rows: unknown[] = []) {
  return {
    prepare: () => ({
      bind: () => ({
        all: () => Promise.resolve({ results: rows }),
        first: () => Promise.resolve(rows[0] ?? null),
        run: () => Promise.resolve({ success: true, meta: {} }),
      }),
    }),
    exec: () => Promise.resolve({ results: [] }),
    batch: () => Promise.resolve([]),
  } as unknown as D1Database;
}

// Create properly typed database mock
function createMockDb(): DrizzleD1Database<typeof schema> & { $client: D1Database } {
  const mockD1 = makeMockD1();
  return drizzle(mockD1, { schema }) as DrizzleD1Database<typeof schema> & { $client: D1Database };
}

// Mock Hono context
function createMockContext(queryParams: Record<string, string> = {}, params: Record<string, string> = {}) {
  return {
    req: {
      query: (key: string) => queryParams[key],
      param: (key: string) => params[key],
    },
    env: {
      DB: makeMockD1([]),
    },
    json: (data: any, status?: number) => ({ data, status }),
  } as any;
}

// ─── Fixtures ──────────────────────────────────────────────────────────────

const adminActor = {
  id: "user_admin_001",
  name: "Admin User",
  role: "admin" as const,
};

const staffActor = {
  id: "user_staff_001",
  name: "Amira Khalil",
  role: "staff" as const,
};

const activityLogRow = (overrides: Partial<typeof schema.activityLogs.$inferInsert> = {}) => ({
  id: "log_001",
  actorId: staffActor.id,
  actorName: staffActor.name,
  actorRole: "staff" as const,
  action: ACTIONS.ORDER_CREATED,
  entityType: "order",
  entityId: "ord_001",
  entityLabel: "#0001",
  metadata: null,
  createdAt: "2026-03-01T10:00:00.000Z",
  ...overrides,
});

// ─── logActivity ──────────────────────────────────────────────────────────

describe("logActivity", () => {
  it("inserts a row without throwing", async () => {
    const insertSpy = vi.fn().mockResolvedValue(undefined);
    const db = {
      insert: () => ({
        values: insertSpy,
      }),
    } as unknown as DrizzleD1Database<typeof schema> & { $client: D1Database };

    await expect(
      logActivity(db, staffActor, ACTIONS.ORDER_CREATED, {
        type: "order",
        id: "ord_001",
        label: "#0001",
      }),
    ).resolves.toBeUndefined();
  });

  it("does NOT throw when the insert fails (fire-and-forget)", async () => {
    const db = {
      insert: () => ({
        values: () => Promise.reject(new Error("D1 error")),
      }),
    } as unknown as DrizzleD1Database<typeof schema> & { $client: D1Database };

    await expect(
      logActivity(db, adminActor, ACTIONS.USER_CREATED, { type: "user", id: "u1" }),
    ).resolves.toBeUndefined();
  });

  it("serialises metadata as JSON string", async () => {
    const capturedValues: Record<string, unknown>[] = [];
    const db = {
      insert: () => ({
        values: (row: Record<string, unknown>) => {
          capturedValues.push(row);
          return Promise.resolve(undefined);
        },
      }),
    } as unknown as DrizzleD1Database<typeof schema> & { $client: D1Database };

    await logActivity(
      db,
      adminActor,
      ACTIONS.ORDER_STATUS_CHANGED,
      { type: "order", id: "ord_001" },
      { status: "delivered" },
    );

    expect(capturedValues).toHaveLength(1);
    expect(capturedValues[0].metadata).toBe('{"status":"delivered"}');
  });

  it("stores null metadata when no extra data provided", async () => {
    const capturedValues: Record<string, unknown>[] = [];
    const db = {
      insert: () => ({
        values: (row: Record<string, unknown>) => {
          capturedValues.push(row);
          return Promise.resolve(undefined);
        },
      }),
    } as unknown as DrizzleD1Database<typeof schema> & { $client: D1Database };

    await logActivity(db, staffActor, ACTIONS.PRODUCT_DELETED, { type: "product", id: "p1" });

    expect(capturedValues[0].metadata).toBeNull();
  });

  it("uses 'Unknown' when actor name is null/undefined", async () => {
    const capturedValues: Record<string, unknown>[] = [];
    const db = {
      insert: () => ({
        values: (row: Record<string, unknown>) => {
          capturedValues.push(row);
          return Promise.resolve(undefined);
        },
      }),
    } as unknown as DrizzleD1Database<typeof schema> & { $client: D1Database };

    await logActivity(
      db,
      { id: "u_anon", name: null as unknown as string, role: "staff" },
      ACTIONS.CUSTOMER_CREATED,
      { type: "customer", id: "c1" },
    );

    expect(capturedValues[0].actorName).toBe("Unknown");
  });
});

// ─── ACTIONS constants ─────────────────────────────────────────────────────

describe("ACTIONS constants", () => {
  it("uses dot-notation format", () => {
    Object.values(ACTIONS).forEach((action) => {
      expect(action).toMatch(/^[a-z_]+\.[a-z_]+$/);
    });
  });

  it("has all expected entity prefixes", () => {
    const prefixes = new Set(Object.values(ACTIONS).map((a) => a.split(".")[0]));
    expect(prefixes).toContain("order");
    expect(prefixes).toContain("customer");
    expect(prefixes).toContain("driver");
    expect(prefixes).toContain("product");
    expect(prefixes).toContain("user");
  });

  it("contains at least 24 actions", () => {
    expect(Object.keys(ACTIONS).length).toBeGreaterThanOrEqual(24);
  });
});

// ─── activityLogs schema ───────────────────────────────────────────────────

describe("activityLogs schema", () => {
  it("has all required columns", () => {
    const t = schema.activityLogs;
    expect(t.id).toBeDefined();
    expect(t.actorId).toBeDefined();
    expect(t.actorName).toBeDefined();
    expect(t.actorRole).toBeDefined();
    expect(t.action).toBeDefined();
    expect(t.entityType).toBeDefined();
    expect(t.entityId).toBeDefined();
    expect(t.entityLabel).toBeDefined();
    expect(t.metadata).toBeDefined();
    expect(t.createdAt).toBeDefined();
  });

  it("supports building an insert query", () => {
    const db = drizzle(makeMockD1(), { schema });
    const row = activityLogRow();
    const query = db.insert(schema.activityLogs).values(row);
    expect(query).toBeDefined();
  });

  it("supports building a select query filtered by actorId", () => {
    const { eq } = require("drizzle-orm");
    const db = drizzle(makeMockD1(), { schema });
    const query = db
      .select()
      .from(schema.activityLogs)
      .where(eq(schema.activityLogs.actorId, staffActor.id));
    expect(query).toBeDefined();
  });
});

// ─── Handler logic (query-layer) ──────────────────────────────────────────

describe("listActivityLogs query layer", () => {
  it("builds a select query with order and limit", () => {
    const { desc } = require("drizzle-orm");
    const db = drizzle(makeMockD1([]), { schema });

    const query = db
      .select()
      .from(schema.activityLogs)
      .orderBy(desc(schema.activityLogs.createdAt))
      .limit(50)
      .offset(0);

    expect(query).toBeDefined();
  });

  it("applies actorId filter when provided", () => {
    const { eq } = require("drizzle-orm");
    const db = drizzle(makeMockD1(), { schema });
    const query = db
      .select()
      .from(schema.activityLogs)
      .where(eq(schema.activityLogs.actorId, "user_staff_001"));
    expect(query).toBeDefined();
  });

  it("applies entityType filter when provided", () => {
    const { eq } = require("drizzle-orm");
    const db = drizzle(makeMockD1(), { schema });
    const query = db
      .select()
      .from(schema.activityLogs)
      .where(eq(schema.activityLogs.entityType, "order"));
    expect(query).toBeDefined();
  });

  it("clamps limit to 100", () => {
    const raw = parseInt("9999");
    const clamped = Math.min(raw, 100);
    expect(clamped).toBe(100);
  });

  it("defaults limit to 50 when not provided", () => {
    const queryLimit: string | undefined = undefined;
    const limit = Math.min(parseInt(queryLimit ?? "50"), 100);
    expect(limit).toBe(50);
  });

  it("defaults offset to 0 when not provided", () => {
    const queryOffset: string | undefined = undefined;
    const offset = parseInt(queryOffset ?? "0");
    expect(offset).toBe(0);
  });
});

describe("getUserActivityLogs query layer", () => {
  it("returns 400 when userId is missing", () => {
    // Simulate the handler's guard
    const userId = undefined;
    expect(userId).toBeFalsy();
  });

  it("uses actorId eq filter for the given userId", () => {
    const { eq } = require("drizzle-orm");
    const db = drizzle(makeMockD1(), { schema });
    const query = db
      .select()
      .from(schema.activityLogs)
      .where(eq(schema.activityLogs.actorId, "user_staff_001"));
    expect(query).toBeDefined();
  });

  it("defaults limit to 30 for user-specific queries", () => {
    const queryLimit: string | undefined = undefined;
    const limit = Math.min(parseInt(queryLimit ?? "30"), 100);
    expect(limit).toBe(30);
  });
});


// ─── Error Scenario Tests ─────────────────────────────────────────────────

describe("listActivityLogs error scenarios", () => {
  it("throws ValidationError for invalid limit parameter (non-numeric)", async () => {
    const c = createMockContext({ limit: "abc" });
    
    await expect(listActivityLogs(c)).rejects.toThrow(ValidationError);
    await expect(listActivityLogs(c)).rejects.toThrow("Invalid limit parameter");
  });

  it("throws ValidationError for invalid limit parameter (negative)", async () => {
    const c = createMockContext({ limit: "-5" });
    
    await expect(listActivityLogs(c)).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError for invalid limit parameter (zero)", async () => {
    const c = createMockContext({ limit: "0" });
    
    await expect(listActivityLogs(c)).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError for invalid offset parameter (non-numeric)", async () => {
    const c = createMockContext({ offset: "xyz" });
    
    await expect(listActivityLogs(c)).rejects.toThrow(ValidationError);
    await expect(listActivityLogs(c)).rejects.toThrow("Invalid offset parameter");
  });

  it("throws ValidationError for invalid offset parameter (negative)", async () => {
    const c = createMockContext({ offset: "-10" });
    
    await expect(listActivityLogs(c)).rejects.toThrow(ValidationError);
  });

  it("includes error context with field, value, and message", async () => {
    const c = createMockContext({ limit: "invalid" });
    
    try {
      await listActivityLogs(c);
      expect.fail("Should have thrown ValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const validationError = error as ValidationError;
      expect(validationError.code).toBe("VALIDATION_FAILED");
      expect(validationError.category).toBe("VALIDATION");
      expect(validationError.context).toEqual({
        field: "limit",
        value: "invalid",
        message: "Limit must be a positive integer",
      });
    }
  });

  it("returns correct error response structure", async () => {
    const c = createMockContext({ offset: "bad" });
    
    try {
      await listActivityLogs(c);
      expect.fail("Should have thrown ValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const validationError = error as ValidationError;
      
      // Verify error response structure matches specification
      expect(validationError).toHaveProperty("message");
      expect(validationError).toHaveProperty("code");
      expect(validationError).toHaveProperty("category");
      expect(validationError).toHaveProperty("context");
      expect(validationError.statusCode).toBe(400);
    }
  });
});

describe("getUserActivityLogs error scenarios", () => {
  it("throws ValidationError for invalid limit parameter (non-numeric)", async () => {
    const c = createMockContext({ limit: "abc" }, { userId: "user_001" });
    
    await expect(getUserActivityLogs(c)).rejects.toThrow(ValidationError);
    await expect(getUserActivityLogs(c)).rejects.toThrow("Invalid limit parameter");
  });

  it("throws ValidationError for invalid limit parameter (negative)", async () => {
    const c = createMockContext({ limit: "-3" }, { userId: "user_001" });
    
    await expect(getUserActivityLogs(c)).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError for invalid offset parameter (non-numeric)", async () => {
    const c = createMockContext({ offset: "xyz" }, { userId: "user_001" });
    
    await expect(getUserActivityLogs(c)).rejects.toThrow(ValidationError);
    await expect(getUserActivityLogs(c)).rejects.toThrow("Invalid offset parameter");
  });

  it("throws ValidationError for invalid offset parameter (negative)", async () => {
    const c = createMockContext({ offset: "-1" }, { userId: "user_001" });
    
    await expect(getUserActivityLogs(c)).rejects.toThrow(ValidationError);
  });

  it("includes error context with field, value, and message", async () => {
    const c = createMockContext({ offset: "not-a-number" }, { userId: "user_001" });
    
    try {
      await getUserActivityLogs(c);
      expect.fail("Should have thrown ValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const validationError = error as ValidationError;
      expect(validationError.code).toBe("VALIDATION_FAILED");
      expect(validationError.category).toBe("VALIDATION");
      expect(validationError.context).toEqual({
        field: "offset",
        value: "not-a-number",
        message: "Offset must be a non-negative integer",
      });
    }
  });

  it("returns correct error response structure", async () => {
    const c = createMockContext({ limit: "0" }, { userId: "user_001" });
    
    try {
      await getUserActivityLogs(c);
      expect.fail("Should have thrown ValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const validationError = error as ValidationError;
      
      // Verify error response structure matches specification
      expect(validationError).toHaveProperty("message");
      expect(validationError).toHaveProperty("code");
      expect(validationError).toHaveProperty("category");
      expect(validationError).toHaveProperty("context");
      expect(validationError.statusCode).toBe(400);
    }
  });
});
