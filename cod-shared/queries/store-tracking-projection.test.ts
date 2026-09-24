/**
 * The tracking half of the public storefront config.
 *
 * `getStoreConfig` produces the payload theme01 renders into every page. It
 * may carry the pixel id — that is public by definition, it appears in the
 * page source — but the Conversions API access token is a credential that must
 * never leave the server, exactly like the Turnstile secret next door.
 *
 * Pinned here because this is the seam where the resolver's output becomes
 * HTML. Real D1: the payload is assembled from four tables and the mock db
 * cannot tell them apart.
 */
/// <reference types="vitest/globals" />

import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { createTestD1, type TestD1 } from "@/test-utils/d1";
import * as schema from "@/db/schema";
import { getStoreConfig } from "./store";

let harness: TestD1;
const NOW = () => new Date().toISOString();
const STORE_ID = "store-stp";

beforeAll(async () => {
  harness = await createTestD1();
}, 120_000);

afterAll(async () => {
  await harness?.dispose();
});

beforeEach(async () => {
  await harness.db.delete(schema.storePixelConfig);
  await harness.db.delete(schema.stores);
  await harness.db.insert(schema.stores).values({
    id: STORE_ID,
    name: "Test Store",
    createdAt: NOW(),
    updatedAt: NOW(),
  });
});

async function setTracking(overrides: Partial<typeof schema.storePixelConfig.$inferInsert> = {}) {
  await harness.db.insert(schema.storePixelConfig).values({
    id: "spc-stp",
    storeId: STORE_ID,
    pixelId: "7777777777",
    accessToken: "EAAG-must-never-ship",
    conversionEvent: "Purchase",
    testMode: false,
    enabled: true,
    createdAt: NOW(),
    updatedAt: NOW(),
    ...overrides,
  });
}

describe("getStoreConfig — the tracking projection", () => {
  it("exposes the pixel id and the conversion event under the keys the theme reads", async () => {
    await setTracking({ pixelId: "7777777777", conversionEvent: "Lead" });

    const config = await getStoreConfig(harness.db, STORE_ID);

    expect(config?.pixelId).toBe("7777777777");
    expect(config?.conversionEvent).toBe("Lead");
  });

  it("never carries the access token, in any form", async () => {
    await setTracking();

    const config = await getStoreConfig(harness.db, STORE_ID);

    const serialised = JSON.stringify(config);
    expect(serialised).not.toContain("EAAG-must-never-ship");
    expect(serialised).not.toContain("accessToken");
    expect(serialised).not.toContain("access_token");
  });

  it("loads no pixel when tracking is switched off", async () => {
    await setTracking({ enabled: false, conversionEvent: "Lead" });

    const config = await getStoreConfig(harness.db, STORE_ID);

    expect(config?.pixelId).toBeNull();
    expect(config?.conversionEvent).toBe("Purchase");
  });

  it("loads no pixel when the store has never configured tracking", async () => {
    const config = await getStoreConfig(harness.db, STORE_ID);

    expect(config?.pixelId).toBeNull();
    expect(config?.conversionEvent).toBe("Purchase");
  });
});
