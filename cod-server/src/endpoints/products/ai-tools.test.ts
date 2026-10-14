import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const productQueries = vi.hoisted(() => ({
  getProductById: vi.fn(),
}));

vi.mock("./queries", () => productQueries);

import { getProductTools } from "./ai-tools";

type Executable = { execute?: (args: unknown, options: unknown) => Promise<unknown> };

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const PRODUCT_ID = "6f0c9b8e-3d2a-4e5f-8a7b-9c1d2e3f4a5b";
const insertValues = vi.fn();
const imagePositions = [{ position: 1 }];
const db = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        all: vi.fn().mockResolvedValue(imagePositions),
      })),
    })),
  })),
  insert: vi.fn(() => ({ values: insertValues })),
} as never;

const put = vi.fn();
const remove = vi.fn();
const env = {
  IMAGES: { put, delete: remove },
  MEDIA_DOMAIN: "media.example.com",
};

async function upload(args: unknown): Promise<Record<string, unknown>> {
  const tools = getProductTools(db, env as never) as unknown as Record<string, Executable>;
  const execute = tools.uploadProductImage?.execute;
  if (!execute) throw new Error("uploadProductImage tool is not registered");
  return (await execute(args, { toolCallId: "test" })) as Record<string, unknown>;
}

describe("uploadProductImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    productQueries.getProductById.mockResolvedValue({ id: PRODUCT_ID });
    insertValues.mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(PNG_BYTES, { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("downloads a ChatGPT file object, stores it, and attaches it to the product", async () => {
    const result = await upload({
      productId: PRODUCT_ID,
      image: {
        download_url: "https://files.oaiusercontent.example/generated.png?sig=abc",
        file_id: "file_abc",
        mime_type: "image/png",
        file_name: "generated.png",
      },
      altText: "Product cover",
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain("attached");
    expect(fetch).toHaveBeenCalledWith(
      "https://files.oaiusercontent.example/generated.png?sig=abc",
      { redirect: "follow" },
    );
    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/^products\/[a-f0-9]{32}\.png$/),
      PNG_BYTES,
      {
        httpMetadata: {
          contentType: "image/png",
          cacheControl: "public, max-age=31536000, immutable",
        },
        customMetadata: { source: "ai", uploadedAt: expect.any(String) },
      },
    );
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: PRODUCT_ID,
        src: expect.stringMatching(/^https:\/\/media\.example\.com\/products\//),
        r2Key: expect.stringMatching(/^products\/[a-f0-9]{32}\.png$/),
        altText: "Product cover",
        position: 2,
      }),
    );
  });

  it("accepts a bare download URL string — the model-visible form of the file param", async () => {
    const result = await upload({
      productId: PRODUCT_ID,
      image: "  https://files.oaiusercontent.example/from-conversation.png?sig=str  ",
    });

    expect(result.success).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "https://files.oaiusercontent.example/from-conversation.png?sig=str",
      { redirect: "follow" },
    );
    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/^products\/[a-f0-9]{32}\.png$/),
      PNG_BYTES,
      expect.anything(),
    );
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ productId: PRODUCT_ID, altText: null }),
    );
  });

  it("rejects an opaque file reference that carries no fetchable URL", async () => {
    const result = await upload({ productId: PRODUCT_ID, image: "file_opaque123" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("http(s)");
    expect(fetch).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("rejects non-image downloads without writing or attaching them", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>nope</html>")));

    const result = await upload({
      productId: PRODUCT_ID,
      image: {
        download_url: "https://files.oaiusercontent.example/not-an-image",
        file_id: "file_bad",
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not a supported");
    expect(put).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("rejects non-http URLs and oversized image responses before storing bytes", async () => {
    const invalidUrl = await upload({
      productId: PRODUCT_ID,
      image: { download_url: "ftp://files.example.com/image.png", file_id: "file_ftp" },
    });
    expect(invalidUrl.success).toBe(false);
    expect(invalidUrl.error).toContain("http(s)");
    expect(fetch).not.toHaveBeenCalled();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(PNG_BYTES, {
          status: 200,
          headers: { "content-length": String(10 * 1024 * 1024 + 1) },
        }),
      ),
    );
    const oversized = await upload({
      productId: PRODUCT_ID,
      image: {
        download_url: "https://files.oaiusercontent.example/oversized",
        file_id: "file_large",
      },
    });

    expect(oversized.success).toBe(false);
    expect(oversized.error).toContain("10 MB");
    expect(put).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
  });
});
