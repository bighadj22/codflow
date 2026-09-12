/**
 * Landing-pages MCP tools — unit tests for the two-layer validation contract.
 *
 * Proves the Slice-1 hygiene guarantees:
 *   • publishLandingPage never reports success for a nonexistent page (F4)
 *   • publishing an empty stack returns an explicit warning (F4)
 *   • unknown fields are REJECTED, never silently stripped (F5) — the model
 *     gets an actionable error it can recover from
 *   • the STOREFRONT_URL fallback flows from the registry env into every
 *     publicUrl the tools return (F7)
 *
 * And the Slice-3 upload contract:
 *   • uploadLandingPageImage: XOR of imageUrl/imageBase64, magic-byte sniff,
 *     8 MB cap, data-URI tolerance, existence guard, workflow enqueue shapes
 *   • getLandingPageImageUploadStatus: full InstanceStatus mapping + the
 *     retention-expiry "unknown" path
 *
 * The queries module and the cod-shared URL helpers are mocked — these tests
 * cover the tool layer's own logic, not D1 behavior (that lives in the e2e
 * suites). Sniffing, minting, and base64 decoding run for real.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const landingQueries = vi.hoisted(() => ({
  listLandingPages: vi.fn(),
  getLandingPageById: vi.fn(),
  getLandingPageStats: vi.fn(),
  createLandingPage: vi.fn(),
  updateLandingPage: vi.fn(),
  publishLandingPage: vi.fn(),
  unpublishLandingPage: vi.fn(),
  archiveLandingPage: vi.fn(),
  duplicateLandingPage: vi.fn(),
  deleteLandingPageWithGuard: vi.fn(),
  getLandingPageImage: vi.fn(),
  getLandingPageImages: vi.fn(),
  deleteLandingPageImage: vi.fn(),
  countOtherLandingPageImageReferences: vi.fn(),
  reorderLandingPageImagesChecked: vi.fn(),
}));

vi.mock("./queries", () => landingQueries);

const sharedLandingQueries = vi.hoisted(() => ({
  resolveStorefrontBaseUrl: vi.fn(),
  buildLandingPagePublicUrl: vi.fn(
    (baseUrl: string | null, slug: string) => (baseUrl ? `${baseUrl}/lp/${slug}` : `/lp/${slug}`),
  ),
}));

vi.mock("../../../../cod-shared/queries/landing-pages", () => sharedLandingQueries);

import {
  getLandingPageTools,
  LANDING_PAGE_TOOL_OUTPUT_SCHEMAS,
  mapUploadJobStatus,
} from "./ai-tools";

const db = {} as never;
const ENV = { STOREFRONT_URL: "https://fallback.example.com" };
/** Valid RFC 9562 v4 UUID — zod 4's uuid() enforces version + variant nibbles. */
const UUID = "6f0c9b8e-3d2a-4e5f-8a7b-9c1d2e3f4a5b";

type Executable = { execute?: (args: unknown, options: unknown) => Promise<unknown> };

const SESSION = { userId: "user-1", role: "staff" as const, name: "Ada", email: "ada@example.com" };

async function call(
  toolName: string,
  args: unknown,
  env: Record<string, unknown> = ENV,
  session: unknown = SESSION,
): Promise<Record<string, unknown>> {
  const bundle = getLandingPageTools(
    db,
    env as never,
    session as never,
  ) as unknown as Record<string, Executable>;
  const t = bundle[toolName];
  if (!t?.execute) throw new Error(`tool ${toolName} has no execute`);
  return (await t.execute(args, { toolCallId: "test" })) as Record<string, unknown>;
}

const lpWithImages = {
  id: UUID,
  slug: "lp-abc12345",
  name: "Test page",
  status: "draft",
  productId: "prod-1",
  imageGap: 0,
  views: 0,
  publishedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  images: [
    {
      id: "img-1",
      landingPageId: UUID,
      r2Key: "landing/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png",
      src: "https://media.example.com/landing/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png",
      altText: null,
      source: "upload",
      position: 1,
      width: 1080,
      height: 1350,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "img-2",
      landingPageId: UUID,
      r2Key: "landing/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.png",
      src: "https://media.example.com/landing/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.png",
      altText: null,
      source: "ai",
      position: 2,
      width: null,
      height: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  product: null,
  stats: { views: 0, orders: 0, revenue: 0 },
};

const lpEmptyStack = { ...lpWithImages, images: [] };

describe("publishLandingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sharedLandingQueries.resolveStorefrontBaseUrl.mockResolvedValue("https://fallback.example.com");
  });

  it("returns failure for a nonexistent landing page and never publishes (F4)", async () => {
    landingQueries.getLandingPageById.mockResolvedValue(null);

    const res = await call("publishLandingPage", { landingPageId: UUID });

    expect(res.success).toBe(false);
    expect(res.error).toContain("not found");
    expect(landingQueries.publishLandingPage).not.toHaveBeenCalled();
  });

  it("publishes but warns when the image stack is empty, with the fallback URL (F4 + F7)", async () => {
    landingQueries.getLandingPageById.mockResolvedValue(lpEmptyStack);

    const res = await call("publishLandingPage", { landingPageId: UUID });

    expect(res.success).toBe(true);
    expect(res.warning).toEqual(expect.stringContaining("EMPTY image stack"));
    expect(res.publicUrl).toBe("https://fallback.example.com/lp/lp-abc12345");
    expect(sharedLandingQueries.resolveStorefrontBaseUrl).toHaveBeenCalledWith(
      db,
      "https://fallback.example.com",
    );
  });

  it("publishes without a warning when the stack has images", async () => {
    landingQueries.getLandingPageById.mockResolvedValue(lpWithImages);

    const res = await call("publishLandingPage", { landingPageId: UUID });

    expect(res.success).toBe(true);
    expect(res.warning).toBeUndefined();
  });

  it("rejects unknown fields", async () => {
    const res = await call("publishLandingPage", { landingPageId: UUID, force: true });

    expect(res.success).toBe(false);
    expect(res.error).toContain("force");
    expect(landingQueries.getLandingPageById).not.toHaveBeenCalled();
  });
});

describe("createLandingPage — strict layer-2 (F5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sharedLandingQueries.resolveStorefrontBaseUrl.mockResolvedValue("https://fallback.example.com");
  });

  it("rejects an `images` field instead of silently stripping it", async () => {
    const res = await call("createLandingPage", {
      name: "My page",
      productId: UUID,
      images: [{ src: "https://x/y.png" }],
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("images");
    expect(landingQueries.createLandingPage).not.toHaveBeenCalled();
  });

  it("rejects a hallucinated `status` field", async () => {
    const res = await call("createLandingPage", {
      name: "My page",
      productId: UUID,
      status: "published",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("status");
    expect(landingQueries.createLandingPage).not.toHaveBeenCalled();
  });

  it("creates a valid draft and returns the fallback publicUrl", async () => {
    landingQueries.createLandingPage.mockResolvedValue({ id: UUID, slug: "lp-abc12345" });
    landingQueries.getLandingPageById.mockResolvedValue(lpWithImages);

    const res = await call("createLandingPage", { name: "My page", productId: UUID });

    expect(res.success).toBe(true);
    expect(res.publicUrl).toBe("https://fallback.example.com/lp/lp-abc12345");
    expect(sharedLandingQueries.resolveStorefrontBaseUrl).toHaveBeenCalledWith(
      db,
      "https://fallback.example.com",
    );
  });
});

describe("updateLandingPage — strict layer-2 (F5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an unknown field inside updates", async () => {
    const res = await call("updateLandingPage", {
      landingPageId: UUID,
      updates: { imageGap: 10, images: ["a"] },
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("images");
    expect(landingQueries.updateLandingPage).not.toHaveBeenCalled();
  });

  it("applies a valid partial update", async () => {
    landingQueries.getLandingPageById.mockResolvedValue(lpWithImages);

    const res = await call("updateLandingPage", {
      landingPageId: UUID,
      updates: { imageGap: 10 },
    });

    expect(res.success).toBe(true);
    expect(landingQueries.updateLandingPage).toHaveBeenCalledWith(db, UUID, { imageGap: 10 });
  });
});

describe("listLandingPages — strict layer-2 + pagination (F5, Slice 5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sharedLandingQueries.resolveStorefrontBaseUrl.mockResolvedValue(null);
  });

  it("rejects unknown filter fields", async () => {
    const res = await call("listLandingPages", { productId: UUID, sortBy: "views" });

    expect(res.success).toBe(false);
    expect(res.error).toContain("sortBy");
  });

  it("rejects an out-of-range limit", async () => {
    const res = await call("listLandingPages", { limit: 500 });

    expect(res.success).toBe(false);
    expect(res.error).toContain("limit");
    expect(landingQueries.listLandingPages).not.toHaveBeenCalled();
  });

  it("defaults to limit 50, offset 0 — the LLM context stays bounded", async () => {
    landingQueries.listLandingPages.mockResolvedValue([]);

    const res = await call("listLandingPages", {});

    expect(res.success).toBe(true);
    expect(res.count).toBe(0);
    expect(landingQueries.listLandingPages).toHaveBeenCalledWith(db, {}, { limit: 50, offset: 0 });
    expect(sharedLandingQueries.resolveStorefrontBaseUrl).toHaveBeenCalledWith(
      db,
      "https://fallback.example.com",
    );
  });

  it("passes explicit paging through to the query layer", async () => {
    landingQueries.listLandingPages.mockResolvedValue([]);

    await call("listLandingPages", { limit: 20, offset: 40, status: "published" });

    expect(landingQueries.listLandingPages).toHaveBeenCalledWith(
      db,
      { status: "published" },
      { limit: 20, offset: 40 },
    );
  });
});

describe("deleteLandingPage — strict layer-2 (F5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unknown fields", async () => {
    const res = await call("deleteLandingPage", { landingPageId: UUID, force: true });

    expect(res.success).toBe(false);
    expect(res.error).toContain("force");
    expect(landingQueries.getLandingPageStats).not.toHaveBeenCalled();
  });
});

/** Real 1x1 px PNG — the sniff/decode path runs against real bytes. */
const PNG_1x1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const KEY_HEX = "a".repeat(32);
const R2_KEY = `landing/${KEY_HEX}.png`;

const LANDING_PAGE = {
  id: UUID,
  slug: "lp-abc12345",
  name: "Zinc page",
  status: "draft",
  images: [],
  product: null,
  stats: { views: 0, orders: 0, revenue: 0 },
};

interface WorkflowMock {
  create: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
}

function makeUploadEnv(statusToReturn?: Record<string, unknown>, getThrows = false): {
  env: Record<string, unknown>;
  workflow: WorkflowMock;
  put: ReturnType<typeof vi.fn>;
} {
  const workflow = {
    create: vi.fn(async ({ id }: { id: string }) => ({ id })),
    get: vi.fn(async () => {
      if (getThrows) throw new Error("instance not found");
      return { status: async () => statusToReturn ?? { status: "running" } };
    }),
  };
  const put = vi.fn(async () => undefined);
  const env = {
    STOREFRONT_URL: "https://fallback.example.com",
    MEDIA_DOMAIN: "media.example.com",
    IMAGES: { put },
    LP_IMAGE_UPLOAD_WORKFLOW: workflow,
  };
  return { env, workflow, put };
}

describe("uploadLandingPageImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    landingQueries.getLandingPageById.mockResolvedValue(LANDING_PAGE);
  });

  it("enqueues a url upload and returns the polling contract", async () => {
    const { env, workflow, put } = makeUploadEnv();

    const res = await call(
      "uploadLandingPageImage",
      {
        landingPageId: UUID,
        imageUrl: "https://images.openai.example/gen.png",
        contentType: "image/png",
        altText: "Hero",
      },
      env,
    );

    expect(res.success).toBe(true);
    expect(res.status).toBe("processing");
    expect(res.uploadJobId).toMatch(/^lpimg-[a-f0-9]{32}$/);
    expect(res.r2Key).toMatch(/^landing\/[a-f0-9]{32}\.png$/);
    expect(res.src).toBe(`https://media.example.com/${res.r2Key}`);
    expect(res.note).toContain("getLandingPageImageUploadStatus");

    expect(put).not.toHaveBeenCalled();
    expect(workflow.create).toHaveBeenCalledTimes(1);
    const createArgs = workflow.create.mock.calls[0][0];
    expect(createArgs.id).toBe(res.uploadJobId);
    expect(createArgs.params).toMatchObject({
      kind: "url",
      landingPageId: UUID,
      r2Key: res.r2Key,
      contentType: "image/png",
      imageUrl: "https://images.openai.example/gen.png",
      altText: "Hero",
      actor: { id: "user-1", name: "Ada", role: "staff" },
    });
  });

  it("writes base64 bytes to R2 then enqueues a bytes verification job", async () => {
    const { env, workflow, put } = makeUploadEnv();

    const res = await call(
      "uploadLandingPageImage",
      { landingPageId: UUID, imageBase64: PNG_1x1_BASE64, contentType: "image/png" },
      env,
    );

    expect(res.success).toBe(true);
    expect(put).toHaveBeenCalledWith(
      res.r2Key,
      expect.any(Uint8Array),
      {
        httpMetadata: {
          contentType: "image/png",
          cacheControl: "public, max-age=31536000, immutable",
        },
        customMetadata: { source: "ai", uploadedAt: expect.any(String) },
      },
    );
    const createArgs = workflow.create.mock.calls[0][0];
    expect(createArgs.params).toMatchObject({ kind: "bytes", r2Key: res.r2Key });
    expect(createArgs.params.imageUrl).toBeUndefined();
  });

  it("tolerates a data-URI prefix and whitespace in imageBase64", async () => {
    const { env, put } = makeUploadEnv();
    const dataUri = `data:image/png;base64,\n${PNG_1x1_BASE64.slice(0, 20)}\n${PNG_1x1_BASE64.slice(20)}`;

    const res = await call(
      "uploadLandingPageImage",
      { landingPageId: UUID, imageBase64: dataUri, contentType: "image/png" },
      env,
    );

    expect(res.success).toBe(true);
    expect(put).toHaveBeenCalled();
  });

  it("rejects providing both imageUrl and imageBase64", async () => {
    const { env, workflow } = makeUploadEnv();
    const res = await call(
      "uploadLandingPageImage",
      {
        landingPageId: UUID,
        imageUrl: "https://x/y.png",
        imageBase64: PNG_1x1_BASE64,
        contentType: "image/png",
      },
      env,
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain("exactly one");
    expect(workflow.create).not.toHaveBeenCalled();
  });

  it("rejects providing neither image, imageUrl, nor imageBase64", async () => {
    const { env } = makeUploadEnv();
    const res = await call(
      "uploadLandingPageImage",
      { landingPageId: UUID, contentType: "image/png" },
      env,
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain("exactly one");
  });

  describe("image file object (openai/fileParams — ChatGPT path)", () => {
    it("enqueues a url upload using the client-provided download_url", async () => {
      const { env, workflow, put } = makeUploadEnv();

      const res = await call(
        "uploadLandingPageImage",
        {
          landingPageId: UUID,
          image: {
            download_url: "https://files.oaiusercontent.example/file_abc123?sig=xyz",
            file_id: "file_abc123",
            mime_type: "image/png",
            file_name: "generated.png",
          },
          contentType: "image/png",
        },
        env,
      );

      expect(res.success).toBe(true);
      expect(res.uploadJobId).toMatch(/^lpimg-[a-f0-9]{32}$/);
      expect(put).not.toHaveBeenCalled();
      const createArgs = workflow.create.mock.calls[0][0];
      expect(createArgs.params).toMatchObject({
        kind: "url",
        landingPageId: UUID,
        r2Key: res.r2Key,
        contentType: "image/png",
        imageUrl: "https://files.oaiusercontent.example/file_abc123?sig=xyz",
      });
    });

    it("rejects combining the image file object with imageUrl", async () => {
      const { env, workflow } = makeUploadEnv();
      const res = await call(
        "uploadLandingPageImage",
        {
          landingPageId: UUID,
          image: { download_url: "https://x/y.png", file_id: "f1" },
          imageUrl: "https://x/y.png",
          contentType: "image/png",
        },
        env,
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain("exactly one");
      expect(workflow.create).not.toHaveBeenCalled();
    });

    it("rejects combining the image file object with imageBase64", async () => {
      const { env, workflow } = makeUploadEnv();
      const res = await call(
        "uploadLandingPageImage",
        {
          landingPageId: UUID,
          image: { download_url: "https://x/y.png", file_id: "f1" },
          imageBase64: PNG_1x1_BASE64,
          contentType: "image/png",
        },
        env,
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain("exactly one");
      expect(workflow.create).not.toHaveBeenCalled();
    });

    it("rejects a file object missing download_url (schema contract)", async () => {
      const { env, workflow } = makeUploadEnv();
      const res = await call(
        "uploadLandingPageImage",
        {
          landingPageId: UUID,
          image: { file_id: "f1" },
          contentType: "image/png",
        },
        env,
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain("download_url");
      expect(workflow.create).not.toHaveBeenCalled();
    });

    it("rejects a non-http download_url with an actionable error", async () => {
      const { env, workflow } = makeUploadEnv();
      const res = await call(
        "uploadLandingPageImage",
        {
          landingPageId: UUID,
          image: { download_url: "ftp://x/y.png", file_id: "f1" },
          contentType: "image/png",
        },
        env,
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain("http(s)");
      expect(workflow.create).not.toHaveBeenCalled();
    });
  });

  it("rejects non-http(s) imageUrl", async () => {
    const { env, workflow } = makeUploadEnv();
    const res = await call(
      "uploadLandingPageImage",
      { landingPageId: UUID, imageUrl: "ftp://x/y.png", contentType: "image/png" },
      env,
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain("http(s)");
    expect(workflow.create).not.toHaveBeenCalled();
  });

  it("rejects a content mismatch before writing anything", async () => {
    const { env, workflow, put } = makeUploadEnv();
    const res = await call(
      "uploadLandingPageImage",
      { landingPageId: UUID, imageBase64: PNG_1x1_BASE64, contentType: "image/jpeg" },
      env,
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain("Content mismatch");
    expect(put).not.toHaveBeenCalled();
    expect(workflow.create).not.toHaveBeenCalled();
  });

  it("rejects invalid base64", async () => {
    const { env, put } = makeUploadEnv();
    const res = await call(
      "uploadLandingPageImage",
      { landingPageId: UUID, imageBase64: "!!!not-base64!!!", contentType: "image/png" },
      env,
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain("valid base64");
    expect(put).not.toHaveBeenCalled();
  });

  it("rejects an oversized decoded payload", async () => {
    const { env, put, workflow } = makeUploadEnv();
    const oversized = Buffer.alloc(8 * 1024 * 1024 + 128, 65).toString("base64");

    const res = await call(
      "uploadLandingPageImage",
      { landingPageId: UUID, imageBase64: oversized, contentType: "image/png" },
      env,
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain("8 MB cap");
    expect(put).not.toHaveBeenCalled();
    expect(workflow.create).not.toHaveBeenCalled();
  });

  it("rejects a disallowed contentType", async () => {
    const { env } = makeUploadEnv();
    const res = await call(
      "uploadLandingPageImage",
      { landingPageId: UUID, imageUrl: "https://x/y.svg", contentType: "image/svg+xml" },
      env,
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain("contentType");
  });

  it("refuses to enqueue for a nonexistent landing page", async () => {
    landingQueries.getLandingPageById.mockResolvedValue(null);
    const { env, workflow } = makeUploadEnv();

    const res = await call(
      "uploadLandingPageImage",
      { landingPageId: UUID, imageUrl: "https://x/y.png", contentType: "image/png" },
      env,
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain("not found");
    expect(workflow.create).not.toHaveBeenCalled();
  });

  it("fails gracefully when the workflow binding is missing", async () => {
    const res = await call(
      "uploadLandingPageImage",
      { landingPageId: UUID, imageUrl: "https://x/y.png", contentType: "image/png" },
      { STOREFRONT_URL: "https://fallback.example.com" },
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain("not provisioned");
  });

  it("fails closed when no session identity is attached", async () => {
    const { env, workflow } = makeUploadEnv();

    const res = await call(
      "uploadLandingPageImage",
      { landingPageId: UUID, imageUrl: "https://x/y.png", contentType: "image/png" },
      env,
      null,
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain("session identity");
    expect(workflow.create).not.toHaveBeenCalled();
  });
});

describe("getLandingPageImageUploadStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps running states to 'processing'", async () => {
    for (const state of ["queued", "running", "waiting", "waitingForPause"]) {
      const { env } = makeUploadEnv({ status: state });
      const res = await call(
        "getLandingPageImageUploadStatus",
        { uploadJobId: "lpimg-abc" },
        env,
      );
      expect(res.status).toBe("processing");
      expect(res.success).toBe(true);
    }
  });

  it("returns the image record on 'complete'", async () => {
    const { env } = makeUploadEnv({
      status: "complete",
      output: { imageId: "img-9", r2Key: "landing/x.png", position: 1 },
    });

    const res = await call("getLandingPageImageUploadStatus", { uploadJobId: "lpimg-abc" }, env);

    expect(res.status).toBe("complete");
    expect(res.image).toMatchObject({ imageId: "img-9" });
    expect(res.advice).toContain("publishLandingPage");
  });

  it("surfaces the failure message on 'errored'", async () => {
    const { env } = makeUploadEnv({
      status: "errored",
      error: { name: "NonRetryableError", message: "Image URL returned HTTP 404 — not publicly fetchable" },
    });

    const res = await call("getLandingPageImageUploadStatus", { uploadJobId: "lpimg-abc" }, env);

    expect(res.status).toBe("failed");
    expect(res.error).toContain("not publicly fetchable");
  });

  it("maps paused/terminated to 'stopped'", async () => {
    for (const state of ["paused", "terminated"]) {
      const { env } = makeUploadEnv({ status: state });
      const res = await call("getLandingPageImageUploadStatus", { uploadJobId: "lpimg-abc" }, env);
      expect(res.status).toBe("stopped");
    }
  });

  it("reports 'unknown' with recovery advice when the instance is gone (retention expiry)", async () => {
    const { env } = makeUploadEnv(undefined, true);

    const res = await call("getLandingPageImageUploadStatus", { uploadJobId: "lpimg-old" }, env);

    expect(res.success).toBe(true);
    expect(res.status).toBe("unknown");
    expect(res.advice).toContain("getLandingPageDetails");
  });

  it("rejects unknown fields", async () => {
    const { env } = makeUploadEnv();
    const res = await call(
      "getLandingPageImageUploadStatus",
      { uploadJobId: "lpimg-abc", verbose: true },
      env,
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain("verbose");
  });
});

describe("mapUploadJobStatus (pure)", () => {
  it("maps every InstanceStatus literal to its view status", () => {
    const views = [
      "queued",
      "running",
      "waiting",
      "waitingForPause",
      "paused",
      "terminated",
      "errored",
      "complete",
      "unknown",
    ].map((status) => mapUploadJobStatus({ status }).status);
    expect(views).toEqual([
      "processing",
      "processing",
      "processing",
      "processing",
      "stopped",
      "stopped",
      "failed",
      "complete",
      "unknown",
    ]);
  });

  it("any unmapped status falls through to 'unknown'", () => {
    expect(mapUploadJobStatus({ status: "something-new" }).status).toBe("unknown");
  });
});

describe("removeLandingPageImage", () => {
  const IMG_UUID = "7d1e0c9a-4b3f-4c6d-9e8a-1f2a3b4c5d6e";
  const imageRow = { id: IMG_UUID, landingPageId: UUID, r2Key: R2_KEY, position: 1 };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes the R2 object on the last reference, then the row, and returns the stack", async () => {
    landingQueries.getLandingPageImage.mockResolvedValue(imageRow);
    landingQueries.countOtherLandingPageImageReferences.mockResolvedValue(0);
    landingQueries.deleteLandingPageImage.mockResolvedValue(undefined);
    landingQueries.getLandingPageImages.mockResolvedValue([]);

    const put = vi.fn();
    const del = vi.fn(async () => undefined);
    const env = {
      STOREFRONT_URL: "https://fallback.example.com",
      IMAGES: { put, delete: del },
    };

    const res = await call(
      "removeLandingPageImage",
      { landingPageId: UUID, imageId: IMG_UUID },
      env,
    );

    expect(res.success).toBe(true);
    expect(res.images).toEqual([]);
    expect(res.count).toBe(0);
    expect(del).toHaveBeenCalledWith(R2_KEY);
    expect(landingQueries.deleteLandingPageImage).toHaveBeenCalledWith(db, UUID, IMG_UUID);
  });

  it("keeps the shared R2 object when another page still references it", async () => {
    landingQueries.getLandingPageImage.mockResolvedValue(imageRow);
    landingQueries.countOtherLandingPageImageReferences.mockResolvedValue(2);
    landingQueries.deleteLandingPageImage.mockResolvedValue(undefined);
    landingQueries.getLandingPageImages.mockResolvedValue([]);

    const del = vi.fn();
    const env = {
      STOREFRONT_URL: "https://fallback.example.com",
      IMAGES: { put: vi.fn(), delete: del },
    };

    const res = await call(
      "removeLandingPageImage",
      { landingPageId: UUID, imageId: IMG_UUID },
      env,
    );

    expect(res.success).toBe(true);
    expect(del).not.toHaveBeenCalled();
    expect(landingQueries.deleteLandingPageImage).toHaveBeenCalled();
  });

  it("aborts before the DB delete when the R2 delete fails", async () => {
    landingQueries.getLandingPageImage.mockResolvedValue(imageRow);
    landingQueries.countOtherLandingPageImageReferences.mockResolvedValue(0);

    const del = vi.fn(async () => {
      throw new Error("R2 is down");
    });
    const env = {
      STOREFRONT_URL: "https://fallback.example.com",
      IMAGES: { put: vi.fn(), delete: del },
    };

    const res = await call(
      "removeLandingPageImage",
      { landingPageId: UUID, imageId: IMG_UUID },
      env,
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain("storage");
    expect(landingQueries.deleteLandingPageImage).not.toHaveBeenCalled();
  });

  it("fails for an image that does not exist on that landing page", async () => {
    landingQueries.getLandingPageImage.mockResolvedValue(null);

    const res = await call("removeLandingPageImage", { landingPageId: UUID, imageId: IMG_UUID }, {
      STOREFRONT_URL: "https://fallback.example.com",
      IMAGES: { put: vi.fn(), delete: vi.fn() },
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("not found");
  });

  it("rejects unknown fields", async () => {
    const res = await call(
      "removeLandingPageImage",
      { landingPageId: UUID, imageId: IMG_UUID, force: true },
      { STOREFRONT_URL: "https://fallback.example.com" },
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain("force");
  });
});

describe("reorderLandingPageImages", () => {
  const ID_A = "8a2f1d3b-5c4e-4f60-8b7c-9d0e1f2a3b4c";
  const ID_B = "9b3a2e4c-6d5f-4a71-9c8d-0e1f2a3b4c5d";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies the complete ordered set and returns the new stack", async () => {
    const ordered = [
      { id: ID_B, position: 1 },
      { id: ID_A, position: 2 },
    ];
    landingQueries.reorderLandingPageImagesChecked.mockResolvedValue(ordered);

    const res = await call("reorderLandingPageImages", {
      landingPageId: UUID,
      imageIds: [ID_B, ID_A],
    });

    expect(res.success).toBe(true);
    expect(res.images).toEqual(ordered);
    expect(landingQueries.reorderLandingPageImagesChecked).toHaveBeenCalledWith(db, UUID, [
      ID_B,
      ID_A,
    ]);
  });

  it("surfaces the checked wrapper's validation failures", async () => {
    landingQueries.reorderLandingPageImagesChecked.mockRejectedValue(
      new Error("imageIds must not contain duplicates"),
    );

    const res = await call("reorderLandingPageImages", {
      landingPageId: UUID,
      imageIds: [ID_A, ID_A],
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("duplicates");
  });

  it("rejects an empty imageIds array at the schema layer", async () => {
    const res = await call("reorderLandingPageImages", { landingPageId: UUID, imageIds: [] });

    expect(res.success).toBe(false);
    expect(landingQueries.reorderLandingPageImagesChecked).not.toHaveBeenCalled();
  });
});

describe("duplicateLandingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sharedLandingQueries.resolveStorefrontBaseUrl.mockResolvedValue("https://fallback.example.com");
  });

  it("returns the fresh draft with its new slug and link", async () => {
    landingQueries.duplicateLandingPage.mockResolvedValue("new-id-1");
    landingQueries.getLandingPageById.mockResolvedValue({ ...lpWithImages, id: "new-id-1", slug: "lp-copy0001" });

    const res = await call("duplicateLandingPage", { landingPageId: UUID });

    expect(res.success).toBe(true);
    expect(res.publicUrl).toBe("https://fallback.example.com/lp/lp-copy0001");
    expect(res.note).toContain("zero");
  });

  it("fails for a nonexistent landing page", async () => {
    landingQueries.duplicateLandingPage.mockResolvedValue(null);

    const res = await call("duplicateLandingPage", { landingPageId: UUID });

    expect(res.success).toBe(false);
    expect(res.error).toContain("not found");
  });
});

describe("unpublishLandingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sharedLandingQueries.resolveStorefrontBaseUrl.mockResolvedValue("https://fallback.example.com");
  });

  it("returns the page to draft and reports the (now dead) link", async () => {
    landingQueries.getLandingPageById.mockResolvedValue({ ...lpWithImages, status: "published" });
    landingQueries.unpublishLandingPage.mockResolvedValue(undefined);

    const res = await call("unpublishLandingPage", { landingPageId: UUID });

    expect(res.success).toBe(true);
    expect(landingQueries.unpublishLandingPage).toHaveBeenCalledWith(db, UUID);
    expect(res.publicUrl).toBe("https://fallback.example.com/lp/lp-abc12345");
  });

  it("fails for a nonexistent landing page and never unpublishes", async () => {
    landingQueries.getLandingPageById.mockResolvedValue(null);

    const res = await call("unpublishLandingPage", { landingPageId: UUID });

    expect(res.success).toBe(false);
    expect(res.error).toContain("not found");
    expect(landingQueries.unpublishLandingPage).not.toHaveBeenCalled();
  });
});

describe("archiveLandingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("archives and returns the page state with history preserved", async () => {
    landingQueries.getLandingPageById.mockResolvedValue({ ...lpWithImages, status: "published" });
    landingQueries.archiveLandingPage.mockResolvedValue(undefined);

    const res = await call("archiveLandingPage", { landingPageId: UUID });

    expect(res.success).toBe(true);
    expect(res.message).toContain("preserved");
    expect(landingQueries.archiveLandingPage).toHaveBeenCalledWith(db, UUID);
  });

  it("fails for a nonexistent landing page and never archives", async () => {
    landingQueries.getLandingPageById.mockResolvedValue(null);

    const res = await call("archiveLandingPage", { landingPageId: UUID });

    expect(res.success).toBe(false);
    expect(res.error).toContain("not found");
    expect(landingQueries.archiveLandingPage).not.toHaveBeenCalled();
  });

  it("rejects unknown fields", async () => {
    const res = await call("archiveLandingPage", { landingPageId: UUID, keepStats: true });

    expect(res.success).toBe(false);
    expect(res.error).toContain("keepStats");
  });
});

describe("output schemas match what the tools actually return (structuredContent contract)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sharedLandingQueries.resolveStorefrontBaseUrl.mockResolvedValue("https://fallback.example.com");
  });

  it("listLandingPages result validates against its output schema", async () => {
    landingQueries.listLandingPages.mockResolvedValue([
      {
        id: UUID,
        slug: "lp-abc12345",
        name: "Zinc page",
        status: "published",
        productId: "p1",
        productName: "Zinc",
        productHandle: "zinc",
        imageCount: 3,
        views: 10,
        orders: 2,
        revenue: 9000,
        publishedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const res = await call("listLandingPages", {});

    expect(LANDING_PAGE_TOOL_OUTPUT_SCHEMAS["listLandingPages"]!.safeParse(res).success).toBe(true);
  });

  it("publishLandingPage empty-stack warning variant validates (warning is declared)", async () => {
    landingQueries.getLandingPageById.mockResolvedValue(lpEmptyStack);

    const res = await call("publishLandingPage", { landingPageId: UUID });

    expect(res.warning).toBeDefined();
    expect(LANDING_PAGE_TOOL_OUTPUT_SCHEMAS["publishLandingPage"]!.safeParse(res).success).toBe(true);
  });

  it("publishLandingPage handled failure validates against the failure envelope", async () => {
    landingQueries.getLandingPageById.mockResolvedValue(null);

    const res = await call("publishLandingPage", { landingPageId: UUID });

    expect(res.success).toBe(false);
    expect(LANDING_PAGE_TOOL_OUTPUT_SCHEMAS["publishLandingPage"]!.safeParse(res).success).toBe(true);
  });

  it("uploadLandingPageImage + status results validate (the ChatGPT pipeline contract)", async () => {
    const { env } = makeUploadEnv();
    const upload = await call(
      "uploadLandingPageImage",
      { landingPageId: UUID, imageUrl: "https://x/y.png", contentType: "image/png" },
      env,
    );
    expect(LANDING_PAGE_TOOL_OUTPUT_SCHEMAS["uploadLandingPageImage"]!.safeParse(upload).success).toBe(true);

    const { env: envDone } = makeUploadEnv({
      status: "complete",
      output: {
        imageId: "img-9",
        r2Key: R2_KEY,
        src: `https://media.example.com/${R2_KEY}`,
        position: 1,
        width: 1080,
        height: 1350,
        altText: null,
      },
    });
    const done = await call("getLandingPageImageUploadStatus", { uploadJobId: "lpimg-abc" }, envDone);
    expect(LANDING_PAGE_TOOL_OUTPUT_SCHEMAS["getLandingPageImageUploadStatus"]!.safeParse(done).success).toBe(true);

    const { env: envFailed } = makeUploadEnv({
      status: "errored",
      error: { name: "NonRetryableError", message: "Image URL returned HTTP 404" },
    });
    const failed = await call("getLandingPageImageUploadStatus", { uploadJobId: "lpimg-abc" }, envFailed);
    expect(LANDING_PAGE_TOOL_OUTPUT_SCHEMAS["getLandingPageImageUploadStatus"]!.safeParse(failed).success).toBe(true);
  });

  it("archiveLandingPage and reorderLandingPageImages results validate", async () => {
    landingQueries.getLandingPageById.mockResolvedValue(lpWithImages);
    landingQueries.archiveLandingPage.mockResolvedValue(undefined);
    const archived = await call("archiveLandingPage", { landingPageId: UUID });
    expect(LANDING_PAGE_TOOL_OUTPUT_SCHEMAS["archiveLandingPage"]!.safeParse(archived).success).toBe(true);

    landingQueries.reorderLandingPageImagesChecked.mockResolvedValue([
      { id: "img-1", position: 1, r2Key: R2_KEY, src: "s", altText: null, width: 1, height: 1, source: "ai", createdAt: "2026-01-01T00:00:00.000Z" },
    ]);
    const reordered = await call("reorderLandingPageImages", {
      landingPageId: UUID,
      imageIds: ["8a2f1d3b-5c4e-4f60-8b7c-9d0e1f2a3b4c"],
    });
    expect(LANDING_PAGE_TOOL_OUTPUT_SCHEMAS["reorderLandingPageImages"]!.safeParse(reordered).success).toBe(true);
  });
});
