/**
 * getStoreConfig turnstile projection — unit tests
 *
 * Pins the public-config contract: the storefront payload may carry the
 * site key (public by design) but NEVER the siteverify secret. No row or a
 * disabled row → feature inert (false + null).
 */

import { describe, it, expect, vi } from "vitest";
import { getStoreConfig } from "./store";

const STORE_ROW = {
  id: "store-1",
  name: "Test Store",
  domain: null,
  status: "active",
};

/**
 * Each chain is awaitable directly (mirrors a real Drizzle query builder), so
 * a caller that ends on `.orderBy()` — getFooterPages, which returns an array
 * and never calls `.get()` — pulls a queued value exactly like one ending on
 * `.get()` does.
 *
 * The value is shifted off the queue the INSTANT `select()` is called, not
 * inside `.get()`/`.then()`. That matters: `await someThenable` defers the
 * engine's call to `.then()` by a microtask (PromiseResolveThenableJob),
 * while `.get()` — a plain async function with no internal await — runs its
 * body, and so `queue.shift()`, synchronously at call time. Shifting lazily
 * inside each meant the two styles drained the queue in different orders
 * once getStoreConfig's Promise.all mixed both in one array, silently
 * handing getFooterPages a value meant for a later call. Shifting at
 * `select()` — the one call every chain makes first, synchronously, in
 * textual/array order — keeps consumption order identical to construction
 * order regardless of how each chain ends.
 */
function makeDb(rows: unknown[]) {
  const queue = [...rows];
  function chain(): any {
    const value = queue.shift();
    const c: any = {
      from: () => c,
      where: () => c,
      innerJoin: () => c,
      orderBy: () => c,
      get: vi.fn(async () => value),
      then: (resolve: (v: unknown) => void) => resolve(value),
    };
    return c;
  }
  const db = { select: vi.fn(() => chain()) } as any;
  return db;
}

describe("getStoreConfig turnstile projection", () => {
  it("no turnstile row → turnstileEnabled=false, turnstileSiteKey=null (feature inert)", async () => {
    const db = makeDb([
      STORE_ROW,
      { pixelId: "px-1", enabled: false, conversionEvent: "Purchase" },
      undefined,
      undefined,
      [],
      undefined,
    ]);

    const config = await getStoreConfig(db, "store-1");

    expect(config?.turnstileEnabled).toBe(false);
    expect(config?.turnstileSiteKey).toBeNull();
    expect(config?.otpEnabled).toBe(false);
  });

  it("enabled turnstile row → turnstileEnabled=true and the public siteKey is exposed", async () => {
    const db = makeDb([
      STORE_ROW,
      { pixelId: "px-1", enabled: true, conversionEvent: "Purchase" },
      { enabled: false },
      { enabled: true, siteKey: "0x4AAA-site" },
      [],
      undefined,
    ]);

    const config = await getStoreConfig(db, "store-1");

    expect(config?.turnstileEnabled).toBe(true);
    expect(config?.turnstileSiteKey).toBe("0x4AAA-site");
  });

  it("disabled turnstile row → turnstileEnabled=false and siteKey hidden", async () => {
    const db = makeDb([STORE_ROW, undefined, undefined, { enabled: false, siteKey: "0x4AAA-site" }, [], undefined]);

    const config = await getStoreConfig(db, "store-1");

    expect(config?.turnstileEnabled).toBe(false);
    expect(config?.turnstileSiteKey).toBeNull();
  });

  it("the projection never includes the secret key column", async () => {
    const db = makeDb([
      STORE_ROW,
      undefined,
      undefined,
      { enabled: true, siteKey: "0x4AAA-site", secretKey: "0x4AAA-secret" },
      [],
      undefined,
    ]);

    const config = await getStoreConfig(db, "store-1");

    expect(JSON.stringify(config)).not.toContain("0x4AAA-secret");
    expect(JSON.stringify(config)).not.toContain("secretKey");
    expect(JSON.stringify(config)).not.toContain("secret_key");
  });
});
