/**
 * store_email_config queries — unit tests
 *
 * Pins the safe-default contract the whole feature rests on:
 *   no row → email sending disabled, and the Sendili API key never leaves
 *   the raw accessor.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getEmailConfig,
  getEmailConfigRaw,
  upsertEmailConfig,
} from "./email-config";

function makeDb(row: unknown | undefined) {
  const get = vi.fn(async () => row);
  const returningGet = vi.fn(async () => row);
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ get })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => ({ get: returningGet })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async () => undefined),
    })),
  } as any;
  return { db, get, returningGet };
}

describe("getEmailConfig", () => {
  it("returns undefined when no row exists (feature inert)", async () => {
    const { db } = makeDb(undefined);
    expect(await getEmailConfig(db, "store-1")).toBeUndefined();
  });

  it("returns the safe projection — apiKey is not selected", async () => {
    const { db } = makeDb({
      storeId: "store-1",
      fromEmail: "noreply@acme.com",
      fromName: "Acme",
      enabled: true,
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-01T00:00:00Z",
    });
    const config = await getEmailConfig(db, "store-1");
    expect(config).toMatchObject({
      storeId: "store-1",
      enabled: true,
      fromEmail: "noreply@acme.com",
      fromName: "Acme",
    });
    expect(JSON.stringify(config)).not.toContain("apiKey");
    expect(JSON.stringify(config)).not.toContain("api_key");
    expect(JSON.stringify(config)).not.toContain("sk_live");
  });
});

describe("getEmailConfigRaw", () => {
  it("returns the full row including the API key (server-side callers only)", async () => {
    const { db } = makeDb({
      storeId: "store-1",
      apiKey: "sk_live_secret",
      fromEmail: "noreply@acme.com",
      fromName: null,
      enabled: true,
    });
    const raw = await getEmailConfigRaw(db, "store-1");
    expect(raw?.apiKey).toBe("sk_live_secret");
  });
});

describe("upsertEmailConfig", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("inserts a new row with defaults (enabled, no from name) and returns the safe shape", async () => {
    const { db } = makeDb(undefined);
    const selectGet = vi.fn(async () => undefined);
    db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ get: selectGet })),
      })),
    })) as any;

    const result = await upsertEmailConfig(db, "store-1", {
      apiKey: "sk_live_secret",
      fromEmail: "noreply@acme.com",
    });

    expect(db.insert).toHaveBeenCalledOnce();
    const valuesCall = (db.insert.mock.results[0].value as any).values.mock.calls[0][0];
    expect(valuesCall).toMatchObject({
      storeId: "store-1",
      apiKey: "sk_live_secret",
      fromEmail: "noreply@acme.com",
      fromName: null,
      enabled: true,
    });
    expect(result).toMatchObject({ storeId: "store-1", enabled: true });
    expect(JSON.stringify(result)).not.toContain("sk_live_secret");
  });

  it("stores fromName and enabled=false when provided", async () => {
    const { db } = makeDb(undefined);
    const selectGet = vi.fn(async () => undefined);
    db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ get: selectGet })),
      })),
    })) as any;

    await upsertEmailConfig(db, "store-1", {
      apiKey: "sk_live_secret",
      fromEmail: "noreply@acme.com",
      fromName: "Acme Store",
      enabled: false,
    });

    const valuesCall = (db.insert.mock.results[0].value as any).values.mock.calls[0][0];
    expect(valuesCall).toMatchObject({ fromName: "Acme Store", enabled: false });
  });

  it("updates an existing row instead of inserting", async () => {
    const { db, returningGet } = makeDb({
      storeId: "store-1",
      fromEmail: "noreply@acme.com",
      fromName: null,
      enabled: false,
      createdAt: "t",
      updatedAt: "t2",
    });
    const selectGet = vi.fn(async () => ({ id: "row-1" }));
    db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ get: selectGet })),
      })),
    })) as any;

    const result = await upsertEmailConfig(db, "store-1", {
      apiKey: "sk_live_new",
      fromEmail: "hello@acme.com",
      fromName: "Acme",
      enabled: true,
    });

    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ enabled: false, fromEmail: "noreply@acme.com" });
    expect(returningGet).toHaveBeenCalled();
  });
});
