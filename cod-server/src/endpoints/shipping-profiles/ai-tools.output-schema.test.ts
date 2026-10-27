/**
 * Shipping-profile MCP tools — output-schema conformance for
 * `listCommuneOverrides`.
 *
 * The tool returns `CommuneWithOverride[]` straight from
 * cod-shared/queries/shipping-profiles.ts (getCommunesWithOverrides): each row
 * carries `communeId` / `communeName` / `communeNameAr` plus the RAW override
 * fields (nullable — null inherits the wilaya rule) and the RESOLVED effective
 * values. The advertised schema previously described an unrelated `{ id, name,
 * rule }` shape that the tool never produces, so the contract a model read did
 * not match the data it received. This test locks the schema to the real row:
 * raw fields nullable, effective fields required, plus the empty and
 * "no rule → error envelope" cases.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const shippingQueries = vi.hoisted(() => ({
  getWilayaRule: vi.fn(),
  getCommunesWithOverrides: vi.fn(),
}));

vi.mock("./queries", () => shippingQueries);

import { getShippingProfileTools, SHIPPING_PROFILE_TOOL_OUTPUT_SCHEMAS } from "./ai-tools";

type Executable = { execute: (args: unknown, options: unknown) => Promise<unknown> };

function tool(name: string): Executable {
  const tools = getShippingProfileTools({} as never) as unknown as Record<string, Executable>;
  const found = tools[name];
  if (!found) throw new Error(`${name} tool is not registered`);
  return found;
}

const ruleRow = {
  id: "rule_16",
  profileId: "profile_123",
  wilayaId: 16,
  homePrice: 400,
  stopDeskPrice: 250,
  homeEnabled: true,
  stopDeskEnabled: false,
};

const commune = (overrides: Record<string, unknown> = {}) => ({
  communeId: "c-16-163",
  communeName: "Bab Ezzouar",
  communeNameAr: "باب الزوار",
  postalCode: "16111" as string | null,
  homeEnabled: null as boolean | null,
  stopDeskEnabled: null as boolean | null,
  homePrice: null as number | null,
  stopDeskPrice: null as number | null,
  effectiveHomeEnabled: true,
  effectiveStopDeskEnabled: false,
  effectiveHomePrice: 400,
  effectiveStopDeskPrice: 250,
  hasOverride: false,
  ...overrides,
});

const args = { profileId: "profile_123", wilayaId: 16 };

describe("shipping-profile tool output-schema conformance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shippingQueries.getWilayaRule.mockResolvedValue(ruleRow);
  });

  it("listCommuneOverrides accepts an empty commune list", async () => {
    shippingQueries.getCommunesWithOverrides.mockResolvedValue([]);

    const result = await tool("listCommuneOverrides").execute(args, { toolCallId: "t" });

    const parsed = SHIPPING_PROFILE_TOOL_OUTPUT_SCHEMAS["listCommuneOverrides"]!.safeParse(result);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(result).toMatchObject({ success: true, count: 0, communes: [] });
  });

  it("listCommuneOverrides accepts multiple communes — override and inherited alike", async () => {
    shippingQueries.getCommunesWithOverrides.mockResolvedValue([
      commune({
        communeId: "c-16-163",
        homeEnabled: true,
        homePrice: 500,
        hasOverride: true,
        effectiveHomePrice: 500,
      }),
      commune({
        communeId: "c-16-164",
        communeName: "Bordj El Kiffan",
        communeNameAr: "برج الكيفان",
        postalCode: null,
      }),
    ]);

    const result = await tool("listCommuneOverrides").execute(args, { toolCallId: "t" });

    const parsed = SHIPPING_PROFILE_TOOL_OUTPUT_SCHEMAS["listCommuneOverrides"]!.safeParse(result);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);

    const payload = result as {
      communes: Array<{
        communeId: string;
        homeEnabled: boolean | null;
        effectiveHomePrice: number;
        hasOverride: boolean;
      }>;
    };
    expect(payload.communes[0]).toMatchObject({ homeEnabled: true, hasOverride: true });
    expect(payload.communes[1]).toMatchObject({
      homeEnabled: null,
      effectiveHomePrice: 400,
      hasOverride: false,
    });
  });

  it("listCommuneOverrides returns a schema-valid failure envelope when the wilaya has no rule", async () => {
    shippingQueries.getWilayaRule.mockResolvedValue(undefined);

    const result = await tool("listCommuneOverrides").execute(args, { toolCallId: "t" });

    const parsed = SHIPPING_PROFILE_TOOL_OUTPUT_SCHEMAS["listCommuneOverrides"]!.safeParse(result);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(result).toMatchObject({ success: false, error: expect.any(String) });
  });
});
