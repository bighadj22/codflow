/**
 * createUser account-row shape — regression test
 *
 * Better Auth >= 1.7 password sign-in looks up the credential account with
 * provider_id = 'credential' AND issuer = 'local:credential' AND
 * account_id = USER ID (migration 0010 + seed-admin semantics). The invite
 * flow once inserted account_id = email with no issuer, so every invited
 * member's first sign-in 401'd. This pins the shape.
 */

import { describe, it, expect, vi } from "vitest";
import { createUser } from "./queries";

vi.mock("@/rbac/permissions", () => ({ clearScopeCache: vi.fn() }));
vi.mock("@/db", () => ({ getDb: vi.fn(() => ({})) }));

import { users, userScopes, accounts } from "@/db/schema";

function makeDb() {
  const inserts: Array<{ table: unknown; values: unknown[] }> = [];
  const db = {
    insert: vi.fn((table: unknown) => ({
      values: vi.fn(async (values: unknown) => {
        inserts.push({ table, values: Array.isArray(values) ? values : [values] });
      }),
    })),
    run: vi.fn(async () => undefined),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(async () => undefined),
        })),
      })),
    })),
  } as any;
  return { db, inserts };
}

const staffUser = {
  id: "a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8",
  email: "amina@example.com",
  name: "Amina",
  role: "staff" as const,
  status: "active" as const,
  apiKey: "cod_key",
  passwordHash: "salt:hash",
};

describe("createUser credential account row", () => {
  it("inserts a better-auth 1.7 compatible accounts row (issuer + account_id = user id)", async () => {
    const { db, inserts } = makeDb();

    await createUser(db, staffUser, ["orders:read"], "granter");

    const accountInsert = inserts.find((i) => i.table === accounts);
    expect(accountInsert).toBeDefined();
    expect(accountInsert!.values[0]).toMatchObject({
      userId: staffUser.id,
      accountId: staffUser.id,
      providerId: "credential",
      issuer: "local:credential",
      password: staffUser.passwordHash,
    });

    // The users row and initial scopes still land.
    expect(inserts.find((i) => i.table === users)).toBeDefined();
    expect(inserts.find((i) => i.table === userScopes)?.values[0]).toMatchObject({
      userId: staffUser.id,
      scope: "orders:read",
    });
  });

  it("stores the invite language on the users row", async () => {
    const { db, inserts } = makeDb();

    await createUser(db, { ...staffUser, language: "ar" }, [], "granter");

    expect(inserts.find((i) => i.table === users)?.values[0]).toMatchObject({
      language: "ar",
    });
  });
});
