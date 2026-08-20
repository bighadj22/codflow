/**
 * Users — Unit Tests
 *
 * Coverage:
 *  1. Validation schemas (Zod) — no DB required
 *  2. getUserById — null for missing; admin → scopes=["*"]; staff → scopes from DB
 *  3. createUser — admin skips scope INSERT; staff inserts scopes
 *  4. grantScope — throws if already granted; returns updated user if not
 */

import { describe, it, expect } from "vitest";
import {
  createUserSchema,
  updateUserSchema,
  userFiltersSchema,
  grantScopeSchema,
} from "./validation";
import { getUserById, createUser, grantScope } from "./queries";
import { makeMockDb, f, a, userRow, NOW } from "@/test-utils/mock-db";

// userScopes row: id, user_id, scope, granted_by, granted_at (5 cols, schema order)
function scopeRow(scope: string): Record<string, unknown> {
  return {
    id: "sc_1",
    user_id: "user_1",
    scope,
    granted_by: "admin_1",
    granted_at: NOW,
  };
}

// ─── createUserSchema ──────────────────────────────────────────────────────────

describe("createUserSchema", () => {
  const validBase = {
    email: "ahmed@example.com",
    name: "Ahmed Benali",
  };

  it("accepts a valid user payload", () => {
    expect(createUserSchema.safeParse(validBase).success).toBe(true);
  });

  it("rejects invalid email format", () => {
    expect(createUserSchema.safeParse({ ...validBase, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects empty name", () => {
    expect(createUserSchema.safeParse({ ...validBase, name: "" }).success).toBe(false);
  });

  it("defaults role to 'staff'", () => {
    expect(createUserSchema.parse(validBase).role).toBe("staff");
  });

  it("defaults scopes to empty array", () => {
    expect(createUserSchema.parse(validBase).scopes).toEqual([]);
  });

  it("accepts role = 'admin'", () => {
    expect(createUserSchema.safeParse({ ...validBase, role: "admin" }).success).toBe(true);
  });

  it("rejects unknown role", () => {
    expect(createUserSchema.safeParse({ ...validBase, role: "superuser" }).success).toBe(false);
  });

  it("accepts status = 'inactive'", () => {
    expect(createUserSchema.safeParse({ ...validBase, status: "inactive" }).success).toBe(true);
  });

  it("accepts scopes array", () => {
    expect(
      createUserSchema.safeParse({ ...validBase, scopes: ["orders.read", "products.read"] }).success
    ).toBe(true);
  });
});

// ─── updateUserSchema ──────────────────────────────────────────────────────────

describe("updateUserSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(updateUserSchema.safeParse({}).success).toBe(true);
  });

  it("rejects invalid email if provided", () => {
    expect(updateUserSchema.safeParse({ email: "bad-email" }).success).toBe(false);
  });

  it("rejects empty name if provided", () => {
    expect(updateUserSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("accepts partial update with only status", () => {
    expect(updateUserSchema.safeParse({ status: "inactive" }).success).toBe(true);
  });
});

// ─── userFiltersSchema ─────────────────────────────────────────────────────────

describe("userFiltersSchema", () => {
  it("defaults limit to 50", () => {
    expect(userFiltersSchema.parse({}).limit).toBe(50);
  });

  it("defaults offset to 0", () => {
    expect(userFiltersSchema.parse({}).offset).toBe(0);
  });

  it("coerces limit from string to number", () => {
    expect(userFiltersSchema.parse({ limit: "20" }).limit).toBe(20);
  });

  it("rejects limit > 100", () => {
    expect(userFiltersSchema.safeParse({ limit: "101" }).success).toBe(false);
  });

  it("rejects negative offset", () => {
    expect(userFiltersSchema.safeParse({ offset: "-1" }).success).toBe(false);
  });

  it("accepts role filter", () => {
    expect(userFiltersSchema.parse({ role: "staff" }).role).toBe("staff");
  });

  it("rejects unknown role filter", () => {
    expect(userFiltersSchema.safeParse({ role: "manager" }).success).toBe(false);
  });

  it("accepts status filter", () => {
    expect(userFiltersSchema.parse({ status: "inactive" }).status).toBe("inactive");
  });

  it("accepts search filter", () => {
    expect(userFiltersSchema.parse({ search: "Ahmed" }).search).toBe("Ahmed");
  });
});

// ─── grantScopeSchema ─────────────────────────────────────────────────────────

describe("grantScopeSchema", () => {
  it("accepts a valid scope string", () => {
    expect(grantScopeSchema.safeParse({ scope: "orders.read" }).success).toBe(true);
  });

  it("rejects empty scope", () => {
    expect(grantScopeSchema.safeParse({ scope: "" }).success).toBe(false);
  });

  it("rejects missing scope field", () => {
    expect(grantScopeSchema.safeParse({}).success).toBe(false);
  });
});

// ─── getUserById ───────────────────────────────────────────────────────────────

describe("getUserById", () => {
  it("returns null when user does not exist", async () => {
    const db = makeMockDb([f(null)]);
    const result = await getUserById(db as any, "user_missing");
    expect(result).toBeNull();
  });

  it("returns admin user with scopes = ['*'] (no DB scope query)", async () => {
    // Admin → no second query for scopes
    const db = makeMockDb([f(userRow({ role: "admin" }))]);
    const result = await getUserById(db as any, "user_1");
    expect(result).not.toBeNull();
    expect(result!.scopes).toEqual(["*"]);
  });

  it("returns staff user with empty scopes when none are assigned", async () => {
    // Staff → queries userScopes table (partial select: { scope })
    const db = makeMockDb([
      f(userRow({ role: "staff" })),
      a([]),  // no scopes
    ]);
    const result = await getUserById(db as any, "user_1");
    expect(result!.scopes).toEqual([]);
  });

  it("returns staff user with scopes from DB", async () => {
    // Partial select row: { scope: "orders.read" } — 1 column
    const db = makeMockDb([
      f(userRow({ role: "staff" })),
      a([{ scope: "orders.read" }, { scope: "products.read" }]),
    ]);
    const result = await getUserById(db as any, "user_1");
    expect(result!.scopes).toEqual(["orders.read", "products.read"]);
  });

  it("returns correct user fields", async () => {
    const db = makeMockDb([
      f(userRow({ id: "user_2", email: "fatima@example.com", name: "Fatima Zahra", role: "admin" })),
    ]);
    const result = await getUserById(db as any, "user_2");
    expect(result!.email).toBe("fatima@example.com");
    expect(result!.name).toBe("Fatima Zahra");
  });
});

// ─── createUser ────────────────────────────────────────────────────────────────

describe("createUser", () => {
  it("creates admin user and skips scope INSERT", async () => {
    // INSERT users (run) → skip scopes → getUserById → users.get()
    const db = makeMockDb([f(userRow({ role: "admin" }))]);
    const result = await createUser(
      db as any,
      { id: "user_1", email: "admin@example.com", name: "Admin", role: "admin", status: "active", apiKey: "codflow_test", passwordHash: "salt:hash" },
      ["orders.read"],  // scopes ignored for admin
      "system"
    );
    expect(result).not.toBeNull();
    expect(result!.scopes).toEqual(["*"]);
  });

  it("creates staff user with initial scopes", async () => {
    // INSERT users (run) → INSERT scopes (run) → getUserById → users.get() + scopes.select()
    const db = makeMockDb([
      f(userRow({ role: "staff" })),
      a([{ scope: "orders.read" }]),
    ]);
    const result = await createUser(
      db as any,
      { id: "user_1", email: "staff@example.com", name: "Staff", role: "staff", status: "active", apiKey: "codflow_test", passwordHash: "salt:hash" },
      ["orders.read"],
      "admin_1"
    );
    expect(result!.scopes).toEqual(["orders.read"]);
  });

  it("creates staff user with no scopes — skips scope INSERT", async () => {
    // No scope INSERT when initialScopes is empty
    const db = makeMockDb([
      f(userRow({ role: "staff" })),
      a([]),
    ]);
    const result = await createUser(
      db as any,
      { id: "user_1", email: "staff@example.com", name: "Staff", role: "staff", status: "active", apiKey: "codflow_test", passwordHash: "salt:hash" },
      [],  // empty → no INSERT
      "admin_1"
    );
    expect(result!.scopes).toEqual([]);
  });
});

// ─── grantScope ────────────────────────────────────────────────────────────────

describe("grantScope", () => {
  it("throws when scope is already granted to user", async () => {
    // userScopes.get() → returns existing row → throws
    const db = makeMockDb([f(scopeRow("orders.read"))]);
    await expect(
      grantScope(db as any, "user_1", "orders.read", "admin_1")
    ).rejects.toThrow("Scope already granted to user");
  });

  it("succeeds when scope is not yet granted", async () => {
    // userScopes.get() → null → INSERT (run) → getUserById: users.get() + scopes.select()
    const db = makeMockDb([
      f(null),                                         // no existing scope
      f(userRow({ role: "staff" })),                  // getUserById → user
      a([{ scope: "orders.read" }]),                  // getUserById → scopes
    ]);
    const result = await grantScope(db as any, "user_1", "orders.read", "admin_1");
    expect(result).not.toBeNull();
    expect(result!.scopes).toEqual(["orders.read"]);
  });
});

