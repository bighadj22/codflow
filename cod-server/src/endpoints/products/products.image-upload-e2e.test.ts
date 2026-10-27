/**
 * uploadProductImage — real-D1 E2E (the ChatGPT attachment contract).
 *
 * A chat client hands `image` to the tool in one of two shapes:
 *   • the openai/fileParams file object ({download_url, file_id, ...}) that
 *     ChatGPT dispatches at runtime, or
 *   • a bare http(s) download URL string — the model-visible masked form of
 *     the same file parameter.
 * Both must end the same way: real image bytes in R2, a product_images row on
 * the product, and the image returned by getProductDetails.
 *
 * The flow runs end to end against an in-memory Miniflare D1 carrying the
 * REAL migrations: createNewProduct → uploadProductImage → getProductDetails.
 * Only the network (fetch of the download URL) and R2 are faked — R2 by an
 * in-memory bucket so the stored bytes can be compared with the source image,
 * fetch by a stub serving a genuine 1×1 PNG file.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db";
import { getProductTools } from "./ai-tools";

type Executable = { execute?: (args: unknown, options: unknown) => Promise<unknown> };

type ToolResult = {
  success?: boolean;
  error?: string;
  message?: string;
  product?: { id: string; images?: Array<{ id: string; src: string; r2Key: string; altText: string | null; position: number }> };
  image?: { id: string; productId: string; src: string; r2Key: string; altText: string | null; position: number };
};

/** A genuine 1×1 RGBA PNG (70 bytes, IDAT inflates to 5 bytes). */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const PNG_BYTES = Uint8Array.from(Buffer.from(PNG_BASE64, "base64"));

const DOWNLOAD_URL = "https://files.oaiusercontent.example/conversation.png?sig=e2e";
const MEDIA_DOMAIN = "media.e2e.test";

type StoredObject = { bytes: Uint8Array; contentType?: string };
const bucket = new Map<string, StoredObject>();

function toBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new Error("unsupported R2 put payload");
}

const fakeImages = {
  put: async (key: string, value: unknown, options?: { httpMetadata?: { contentType?: string } }) => {
    bucket.set(key, { bytes: toBytes(value), contentType: options?.httpMetadata?.contentType });
  },
  delete: async (key: string) => {
    bucket.delete(key);
  },
};

const env = { IMAGES: fakeImages, MEDIA_DOMAIN } as never;

let db: AppDb;
const registry: Miniflare[] = [];

async function run(name: string, args: unknown): Promise<ToolResult> {
  const tools = getProductTools(db, env) as unknown as Record<string, Executable>;
  const execute = tools[name]?.execute;
  if (!execute) throw new Error(`tool ${name} is not registered`);
  return (await execute(args, { toolCallId: "e2e" })) as ToolResult;
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

  vi.stubGlobal(
    "fetch",
    // A fresh Response per call — a Response body can only be read once.
    vi.fn().mockImplementation(async () => new Response(PNG_BYTES, { status: 200 })),
  );
}, 180_000);

afterAll(async () => {
  vi.unstubAllGlobals();
  for (const mf of registry) await mf.dispose();
});

/** Structural check that what reached R2 really is a PNG file. */
function readPng(bytes: Uint8Array): { width: number; height: number } {
  const buf = Buffer.from(bytes);
  expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(buf.toString("ascii", 12, 16)).toBe("IHDR");
  expect(buf.toString("ascii", buf.length - 8, buf.length - 4)).toBe("IEND");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function createProduct(sku: string): Promise<string> {
  const created = await run("createNewProduct", {
    name: `E2E Product ${sku}`,
    price: 1500,
    sku,
  });
  expect(created.error).toBeUndefined();
  expect(created.success).toBe(true);
  return created.product!.id;
}

describe("uploadProductImage — real D1", () => {
  it(
    "creates a product, stores the conversation image, and returns it from getProductDetails",
    async () => {
      const productId = await createProduct("E2E-IMG-OBJ");

      const uploaded = await run("uploadProductImage", {
        productId,
        image: {
          download_url: DOWNLOAD_URL,
          file_id: "file_e2e_object",
          mime_type: "image/png",
          file_name: "conversation.png",
        },
        altText: "E2E cover",
      });

      expect(uploaded.error).toBeUndefined();
      expect(uploaded.success).toBe(true);
      expect(uploaded.message).toContain("attached");
      expect(fetch).toHaveBeenCalledWith(DOWNLOAD_URL, { redirect: "follow" });

      const image = uploaded.image!;
      expect(image.productId).toBe(productId);
      expect(image.position).toBe(1);
      expect(image.altText).toBe("E2E cover");
      expect(image.src).toBe(`https://${MEDIA_DOMAIN}/${image.r2Key}`);

      const stored = bucket.get(image.r2Key);
      expect(stored).toBeDefined();
      expect(stored!.contentType).toBe("image/png");
      expect(stored!.bytes).toEqual(PNG_BYTES);
      expect(readPng(stored!.bytes)).toEqual({ width: 1, height: 1 });

      const details = await run("getProductDetails", { productId });
      expect(details.error).toBeUndefined();
      expect(details.success).toBe(true);
      expect(details.product!.images).toHaveLength(1);
      expect(details.product!.images![0]).toMatchObject({
        id: image.id,
        src: image.src,
        r2Key: image.r2Key,
        altText: "E2E cover",
        position: 1,
      });
    },
    30_000,
  );

  it(
    "attaches an image supplied as a bare download URL string and stacks a second one",
    async () => {
      const productId = await createProduct("E2E-IMG-STR");

      const first = await run("uploadProductImage", {
        productId,
        image: `  ${DOWNLOAD_URL}  `,
      });
      expect(first.error).toBeUndefined();
      expect(first.success).toBe(true);
      expect(first.image!.position).toBe(1);
      expect(bucket.has(first.image!.r2Key)).toBe(true);

      const second = await run("uploadProductImage", {
        productId,
        image: {
          download_url: "https://files.oaiusercontent.example/second.png?sig=e2e",
          file_id: "file_e2e_second",
        },
      });
      expect(second.error).toBeUndefined();
      expect(second.success).toBe(true);
      expect(second.image!.position).toBe(2);
      expect(second.image!.r2Key).not.toBe(first.image!.r2Key);

      const details = await run("getProductDetails", { productId });
      expect(details.success).toBe(true);
      const images = details.product!.images!;
      expect(images.map((img) => img.position)).toEqual([1, 2]);
      expect(images.map((img) => img.src)).toEqual([
        first.image!.src,
        second.image!.src,
      ]);
    },
    30_000,
  );

  it(
    "rejects an opaque file reference that has no fetchable URL",
    async () => {
      const productId = await createProduct("E2E-IMG-BAD");
      const objectsBefore = bucket.size;

      const result = await run("uploadProductImage", {
        productId,
        image: "sediment://file_opaque123",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("http(s)");
      expect(bucket.size).toBe(objectsBefore);

      const details = await run("getProductDetails", { productId });
      expect(details.product!.images).toEqual([]);
    },
    30_000,
  );
});
