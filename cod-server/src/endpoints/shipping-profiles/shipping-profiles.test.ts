/**
 * Shipping Profiles — Unit Tests
 *
 * Coverage:
 *  1. Validation schemas (Zod) — no DB required
 *  2. getProfileById — returns null for missing; returns profile with rules + counts
 *  3. createProfile — returns constructed profile (no DB reads)
 *  4. deleteProfile — returns false for missing, true when found
 *  5. setProfileRules — returns null for missing profile; skips zero-price rules
 */

import { describe, it, expect } from "vitest";
import {
  createProfileSchema,
  updateProfileSchema,
  bulkRulesSchema,
} from "./validation";
import { getProfileById, createProfile, deleteProfile, setProfileRules } from "./queries";
import { makeMockDb, f, a, shippingProfileRow, NOW } from "@/test-utils/mock-db";

// ─── createProfileSchema ───────────────────────────────────────────────────────

describe("createProfileSchema", () => {
  it("accepts a valid profile payload", () => {
    expect(createProfileSchema.safeParse({ name: "Standard DZ" }).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(createProfileSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("defaults isDefault to false", () => {
    expect(createProfileSchema.parse({ name: "Standard DZ" }).isDefault).toBe(false);
  });

  it("accepts isDefault: true", () => {
    expect(createProfileSchema.safeParse({ name: "Standard DZ", isDefault: true }).success).toBe(true);
  });

  it("accepts null notes", () => {
    expect(createProfileSchema.safeParse({ name: "Standard DZ", notes: null }).success).toBe(true);
  });

  it("accepts string notes", () => {
    expect(createProfileSchema.safeParse({ name: "Standard DZ", notes: "ملاحظة" }).success).toBe(true);
  });
});

// ─── updateProfileSchema ───────────────────────────────────────────────────────

describe("updateProfileSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(true);
  });

  it("rejects empty name if provided", () => {
    expect(updateProfileSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("accepts partial update with only notes", () => {
    expect(updateProfileSchema.safeParse({ notes: "ملاحظة" }).success).toBe(true);
  });

  it("accepts null notes to clear notes", () => {
    expect(updateProfileSchema.safeParse({ notes: null }).success).toBe(true);
  });
});

// ─── bulkRulesSchema ───────────────────────────────────────────────────────────

describe("bulkRulesSchema", () => {
  it("accepts an empty rules array", () => {
    expect(bulkRulesSchema.safeParse({ rules: [] }).success).toBe(true);
  });

  it("accepts valid rules", () => {
    const data = {
      rules: [
        { wilayaId: 16, homePrice: 300, stopDeskPrice: 250 },
        { wilayaId: 31, homePrice: 400, stopDeskPrice: 350 },
      ],
    };
    expect(bulkRulesSchema.safeParse(data).success).toBe(true);
  });

  it("rejects wilayaId = 0 (below range)", () => {
    expect(bulkRulesSchema.safeParse({ rules: [{ wilayaId: 0, homePrice: 300, stopDeskPrice: 250 }] }).success).toBe(false);
  });

  it("rejects wilayaId = 59 (above range)", () => {
    expect(bulkRulesSchema.safeParse({ rules: [{ wilayaId: 59, homePrice: 300, stopDeskPrice: 250 }] }).success).toBe(false);
  });

  it("defaults homePrice to 0", () => {
    const result = bulkRulesSchema.parse({ rules: [{ wilayaId: 16 }] });
    expect(result.rules[0].homePrice).toBe(0);
  });

  it("defaults stopDeskPrice to 0", () => {
    const result = bulkRulesSchema.parse({ rules: [{ wilayaId: 16 }] });
    expect(result.rules[0].stopDeskPrice).toBe(0);
  });

  it("rejects negative homePrice", () => {
    expect(bulkRulesSchema.safeParse({ rules: [{ wilayaId: 16, homePrice: -1, stopDeskPrice: 0 }] }).success).toBe(false);
  });
});

// ─── getProfileById ────────────────────────────────────────────────────────────

describe("getProfileById", () => {
  it("returns null when profile does not exist", async () => {
    const db = makeMockDb([f(null)]);
    const result = await getProfileById(db as any, "prof_missing");
    expect(result).toBeNull();
  });

  it("returns profile with empty rules and zero counts when no associations", async () => {
    // shippingProfiles.get → Promise.all[shippingRules.all, products.all]
    const db = makeMockDb([
      f(shippingProfileRow()),
      a([]),  // rules (Promise.all[0])
      a([]),  // products (Promise.all[1])
    ]);
    const result = await getProfileById(db as any, "prof_1");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("prof_1");
    expect(result!.rules).toEqual([]);
    expect(result!.productCount).toBe(0);
  });

  it("returns profile with rules when rules exist", async () => {
    const ruleEntry = {
      id: "rule_1",
      profile_id: "prof_1",
      wilaya_id: 16,
      wilaya_name: "Alger",
      wilaya_name_ar: "الجزائر",
      home_price: 300,
      stop_desk_price: 250,
      created_at: NOW,
    };
    const db = makeMockDb([
      f(shippingProfileRow()),
      a([ruleEntry]),              // rules (Promise.all[0])
      a([{ id: "prd_1" }, { id: "prd_2" }]),  // products (Promise.all[1])
    ]);
    const result = await getProfileById(db as any, "prof_1");
    expect(result!.rules).toHaveLength(1);
    expect(result!.rules[0].wilayaId).toBe(16);
    expect(result!.rules[0].homePrice).toBe(300);
    expect(result!.productCount).toBe(2);
  });

  it("maps isDefault boolean from DB integer", async () => {
    const db = makeMockDb([
      f(shippingProfileRow({ is_default: 1 })),
      a([]),  // rules
      a([]),  // products
    ]);
    const result = await getProfileById(db as any, "prof_1");
    expect(result!.isDefault).toBe(true);
  });
});

// ─── createProfile ─────────────────────────────────────────────────────────────

describe("createProfile", () => {
  it("creates and returns the profile without DB reads", async () => {
    const db = makeMockDb([]);  // only run() calls — no queue
    const result = await createProfile(db as any, { name: "Express DZ", isDefault: false });
    expect(result.name).toBe("Express DZ");
    expect(result.id).toBeDefined();
    expect(result.rules).toEqual([]);
    expect(result.productCount).toBe(0);
  });

  it("returns isDefault = true when specified", async () => {
    const db = makeMockDb([]);
    const result = await createProfile(db as any, { name: "Default Profile", isDefault: true });
    expect(result.isDefault).toBe(true);
  });

  it("accepts optional notes", async () => {
    const db = makeMockDb([]);
    const result = await createProfile(db as any, { name: "Express DZ", isDefault: false, notes: "ملاحظة" });
    expect(result.notes).toBe("ملاحظة");
  });
});

// ─── deleteProfile ─────────────────────────────────────────────────────────────

describe("deleteProfile", () => {
  it("returns false when profile does not exist", async () => {
    const db = makeMockDb([f(null)]);
    const result = await deleteProfile(db as any, "prof_missing");
    expect(result).toBe(false);
  });

  it("returns true when profile is found and deleted", async () => {
    const db = makeMockDb([f(shippingProfileRow())]);
    const result = await deleteProfile(db as any, "prof_1");
    expect(result).toBe(true);
  });
});

// ─── setProfileRules ───────────────────────────────────────────────────────────

describe("setProfileRules", () => {
  it("returns null when profile does not exist", async () => {
    const db = makeMockDb([f(null)]);
    const result = await setProfileRules(db as any, "prof_missing", { rules: [] });
    expect(result).toBeNull();
  });

  it("returns updated profile after setting rules", async () => {
    // 1. existing check → shippingProfiles.get()
    // 2. delete rules (run), insert rules (run), update profile updatedAt (run)
    // 3. getProfileById internally:
    //    - shippingProfiles.get() → entry 2
    //    - Promise.all[rules.all, products.all] → entries 3, 4
    const db = makeMockDb([
      f(shippingProfileRow()),  // existing check
      f(shippingProfileRow()),  // getProfileById → profile.get()
      a([]),                    // getProfileById → rules.all() (Promise.all[0])
      a([]),                    // getProfileById → products.all() (Promise.all[1])
    ]);
    const result = await setProfileRules(db as any, "prof_1", {
      rules: [{ wilayaId: 16, homePrice: 300, stopDeskPrice: 250, homeEnabled: true, stopDeskEnabled: false }],
    });
    expect(result).not.toBeNull();
    expect(result!.id).toBe("prof_1");
  });

  it("inserts all rules including zero-price (homeEnabled/stopDeskEnabled control availability)", async () => {
    const db = makeMockDb([
      f(shippingProfileRow()),  // existing check
      f(shippingProfileRow()),  // getProfileById → profile.get()
      a([]),                    // rules (Promise.all[0])
      a([]),                    // products (Promise.all[1])
    ]);
    const result = await setProfileRules(db as any, "prof_1", {
      rules: [
        { wilayaId: 16, homePrice: 0, stopDeskPrice: 0, homeEnabled: false, stopDeskEnabled: false },
        { wilayaId: 31, homePrice: 400, stopDeskPrice: 350, homeEnabled: true, stopDeskEnabled: false },
      ],
    });
    expect(result).not.toBeNull();
  });
});
