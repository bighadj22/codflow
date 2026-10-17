/**
 * listOrders MCP tool — output-schema conformance, real D1.
 *
 * Guards the production bug where an order whose wilaya/commune cannot be
 * resolved (LEFT JOIN miss, or a null commune_id — the common case) made the
 * whole listOrders payload fail its declared output schema. executeMcpTool
 * then omitted structuredContent, and MCP clients rejected the call with
 * "Tool listOrders has an output schema but no structured content was
 * provided".
 *
 * Verifies, against the real migrations on an in-memory miniflare D1:
 *   • the empty result set validates against the declared output schema;
 *   • a multi-order result validates — including one order with null
 *     wilaya/commune and one with a driver + carrier tracking number;
 *   • the tools/call result builder (executeMcpTool) always attaches
 *     schema-valid structuredContent for listOrders and never marks it isError.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db";
import type { Tool } from "ai";
import { getOrderTools, ORDER_TOOL_OUTPUT_SCHEMAS } from "./ai-tools";
import { executeMcpTool, type McpActor } from "@/mcp/execute-tool";

const outputSchema = ORDER_TOOL_OUTPUT_SCHEMAS["listOrders"]!;
const actor: McpActor = { id: "user-list-e2e", name: "List E2E", role: "staff" };

const registry: Miniflare[] = [];
let db: AppDb;
let communeNameValue: string | null = null;

type Executable = { execute: (args: unknown, options: unknown) => Promise<unknown> };

function listOrdersTool(target: AppDb): Tool {
  const tools = getOrderTools(target) as unknown as Record<string, Executable>;
  const tool = tools["listOrders"];
  if (!tool) throw new Error("listOrders tool is not registered");
  return tool as unknown as Tool;
}

beforeAll(async () => {
  const mf = new Miniflare({
    script: "export default { fetch() { return new Response('ok'); } }",
    modules: true,
    d1Databases: { DB: "test-db" },
  });
  registry.push(mf);
  const d1 = await mf.getD1Database("DB");
  const dir = resolve(__dirname, "../../db/migrations");
  const preparedStatements: D1PreparedStatement[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const statements = readFileSync(`${dir}/${file}`, "utf8")
      .split("--> statement-breakpoint")
      .flatMap((s) => s.split(/;\s*\n/))
      .map((s) => s.replace(/;+\s*$/, "").trim())
      .filter((s) => s.replace(/--[^\n]*/g, "").trim().length > 0);
    for (const statement of statements) {
      preparedStatements.push(d1.prepare(statement));
    }
  }
  for (let i = 0; i < preparedStatements.length; i += 50) {
    await d1.batch(preparedStatements.slice(i, i + 50));
  }
  db = drizzle(d1 as unknown as D1Database, { schema }) as unknown as AppDb;

  const commune = await db
    .select({ id: schema.communes.id, nameAr: schema.communes.nameAr })
    .from(schema.communes)
    .where(eq(schema.communes.wilayaId, 16))
    .get();
  communeNameValue = commune?.nameAr ?? null;

  const now = new Date().toISOString();
  const earlier = "2025-12-01T00:00:00.000Z";

  await db.insert(schema.customers).values([
    {
      id: "cust-list-a", name: "Full Buyer", phone: "0770000101",
      wilaya: "الجزائر", commune: commune?.nameAr ?? null,
      wilayaId: 16, communeId: commune?.id ?? null, createdAt: now,
    },
    {
      id: "cust-list-b", name: "Bare Buyer", phone: "0770000102",
      wilaya: "ولاية 99", createdAt: now,
    },
  ]);
  await db.insert(schema.drivers).values({
    id: "drv-list", firstName: "Karim", lastName: "Hammadi", phone: "0555000101",
    createdAt: now, updatedAt: now,
  });

  // Order A — wilaya + commune + driver + carrier tracking.
  await db.insert(schema.orders).values({
    id: "ord-list-a", orderNumber: "ORD-LIST-A", customerId: "cust-list-a",
    customerName: "Full Buyer", phone: "0770000101",
    wilayaId: 16, communeId: commune?.id ?? null,
    price: 3000, status: "new", deliveryMethod: "driver", deliveryType: "home",
    deliveryFee: 400, driverFee: 0, codAmount: 3400,
    driverId: "drv-list", trackingNumber: "TRK-LIST-A",
    createdAt: now, updatedAt: now,
  });

  // Order B — no wilaya, no commune, no driver (the LEFT JOIN-miss case).
  await db.insert(schema.orders).values({
    id: "ord-list-b", orderNumber: "ORD-LIST-B", customerId: "cust-list-b",
    customerName: "Bare Buyer", phone: "0770000102",
    price: 1500, status: "confirmed", deliveryMethod: "unassigned", deliveryType: "home",
    deliveryFee: 0, driverFee: 0, codAmount: 1500,
    createdAt: earlier, updatedAt: earlier,
  });
}, 120_000);

afterAll(async () => {
  for (const mf of registry) await mf.dispose();
});

describe("listOrders output-schema conformance (real D1)", () => {
  it("empty result set validates against the declared output schema", async () => {
    const result = await (listOrdersTool(db) as unknown as Executable).execute(
      { search: "NO-SUCH-ORDER-ANYWHERE" },
      { toolCallId: "t" },
    );

    expect(result).toMatchObject({ success: true, count: 0, orders: [] });
    expect(outputSchema.safeParse(result).success).toBe(true);
  });

  it("multiple orders (incl. null wilaya/commune) validate against the declared output schema", async () => {
    const result = (await (listOrdersTool(db) as unknown as Executable).execute(
      {},
      { toolCallId: "t" },
    )) as { success: boolean; count: number; orders: Array<Record<string, unknown>> };

    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(result.orders).toHaveLength(2);

    const parsed = outputSchema.safeParse(result);
    if (!parsed.success) {
      throw new Error(
        `listOrders output does not match its schema: ${parsed.error.issues
          .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
          .join("; ")}`,
      );
    }

    const bare = result.orders.find((o) => o.id === "ord-list-b")!;
    expect(bare.wilaya).toBeNull();
    expect(bare.commune).toBeNull();

    const full = result.orders.find((o) => o.id === "ord-list-a")!;
    expect(full.wilaya).toBe("الجزائر");
    expect(full.commune).toBe(communeNameValue);
    expect(full.driverName).toBe("Karim Hammadi");
    expect(full.trackingNumber).toBe("TRK-LIST-A");
  });

  it("executeMcpTool always attaches schema-valid structuredContent and never errors", async () => {
    const tool = listOrdersTool(db);
    const mcp = await executeMcpTool({ db, actor, name: "listOrders", tool, args: {} });

    expect(mcp.isError).toBeUndefined();
    expect(mcp.structuredContent).toBeDefined();
    expect(outputSchema.safeParse(mcp.structuredContent).success).toBe(true);
    expect(mcp.content[0]).toMatchObject({ type: "text" });
    expect(JSON.parse((mcp.content[0] as { text: string }).text)).toEqual(mcp.structuredContent);
  });

  it("executeMcpTool attaches structuredContent for the empty result too", async () => {
    const tool = listOrdersTool(db);
    const mcp = await executeMcpTool({
      db, actor, name: "listOrders", tool, args: { search: "NO-SUCH-ORDER-ANYWHERE" },
    });

    expect(mcp.isError).toBeUndefined();
    expect(mcp.structuredContent).toMatchObject({ success: true, count: 0 });
    expect(outputSchema.safeParse(mcp.structuredContent).success).toBe(true);
  });
});
