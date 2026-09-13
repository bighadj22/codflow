/**
 * CodLandingPageImageUploadWorkflow — payload validation and full run()
 * sequencing.
 *
 * The fake step executor runs each callback immediately (no caching) and
 * records step names in order; the environment (R2 bucket, fetch, D1 via
 * mocked modules) is injected through the test-stub WorkflowEntrypoint
 * constructor. Sniffing/dimension parsing run for real.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sharedQueries = vi.hoisted(() => ({
  getLandingPageById: vi.fn(),
  getLandingPageImages: vi.fn(),
  addLandingPageImage: vi.fn(),
}));

vi.mock("../../../cod-shared/queries/landing-pages", () => sharedQueries);

const activity = vi.hoisted(() => ({
  logActivity: vi.fn(async () => {}),
  ACTIONS: { LANDING_PAGE_UPDATED: "landing_page.updated" },
}));

vi.mock("@/lib/activity", () => activity);

vi.mock("@/db", () => ({ getDb: () => ({} as never) }));

import {
  CodLandingPageImageUploadParamsSchema,
  CodLandingPageImageUploadWorkflow,
} from "./landing-page-image-upload";
import { NonRetryableError } from "cloudflare:workflows";

/** Real 1x1 px PNG. */
const REAL_1X1_PNG = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  ),
);

const UUID = "6f0c9b8e-3d2a-4e5f-8a7b-9c1d2e3f4a5b";
const KEY_HEX = "a".repeat(32);
const R2_KEY = `landing/${KEY_HEX}.png`;

function urlPayload(overrides: Record<string, unknown> = {}) {
  return {
    kind: "url",
    landingPageId: UUID,
    r2Key: R2_KEY,
    imageUrl: "https://images.openai.example/generated.png",
    contentType: "image/png",
    altText: "Hero shot",
    actor: { id: "user-1", name: "Ada", role: "staff" },
    ...overrides,
  };
}

function bytesPayload(overrides: Record<string, unknown> = {}) {
  return {
    kind: "bytes",
    landingPageId: UUID,
    r2Key: R2_KEY,
    contentType: "image/png",
    actor: { id: "user-1", name: "Ada", role: "staff" },
    ...overrides,
  };
}

const STACK_ROW = {
  id: "img-row-1",
  landingPageId: UUID,
  r2Key: R2_KEY,
  src: `https://media.example.com/${R2_KEY}`,
  altText: null,
  source: "ai",
  position: 1,
  width: 1,
  height: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const LANDING_PAGE = { id: UUID, slug: "lp-abc12345", name: "Zinc page", images: [] };

interface FakeStepCall {
  name: string;
  config: unknown;
}

function makeFakeStep() {
  const calls: FakeStepCall[] = [];
  const step = {
    calls,
    async do(name: string, configOrCallback: unknown, maybeCallback?: unknown) {
      const callback =
        typeof configOrCallback === "function" ? configOrCallback : maybeCallback;
      const config = typeof configOrCallback === "function" ? undefined : configOrCallback;
      calls.push({ name, config });
      return (callback as () => unknown)();
    },
  };
  return step;
}

function makeWorkflow(envOverrides: Record<string, unknown> = {}) {
  const put = vi.fn(async () => undefined);
  const get = vi.fn(
    async (): Promise<{ arrayBuffer: () => Promise<ArrayBuffer> } | null> => ({
      arrayBuffer: async () => REAL_1X1_PNG.buffer.slice(0) as ArrayBuffer,
    }),
  );
  const env = {
    IMAGES: { put, get },
    MEDIA_DOMAIN: "media.example.com",
    DB: {} as never,
    ...envOverrides,
  };
  const workflow = new (CodLandingPageImageUploadWorkflow as unknown as new (
    ctx: unknown,
    env: unknown,
  ) => InstanceType<typeof CodLandingPageImageUploadWorkflow>)({}, env);
  return { workflow, put, get, env };
}

function okFetch(body: Uint8Array, headers: Record<string, string> = {}) {
  return async () =>
    new Response(body as unknown as BodyInit, { status: 200, headers });
}

describe("CodLandingPageImageUploadParamsSchema", () => {
  it("accepts a valid url payload", () => {
    expect(CodLandingPageImageUploadParamsSchema.safeParse(urlPayload()).success).toBe(true);
  });

  it("accepts a valid bytes payload", () => {
    expect(CodLandingPageImageUploadParamsSchema.safeParse(bytesPayload()).success).toBe(true);
  });

  it("rejects a url payload missing imageUrl", () => {
    const { imageUrl: _omitted, ...withoutUrl } = urlPayload();
    expect(CodLandingPageImageUploadParamsSchema.safeParse(withoutUrl).success).toBe(false);
  });

  it("rejects unknown fields", () => {
    expect(CodLandingPageImageUploadParamsSchema.safeParse(urlPayload({ force: true })).success).toBe(false);
  });

  it("rejects keys outside the landing/ namespace or with traversal", () => {
    expect(
      CodLandingPageImageUploadParamsSchema.safeParse(urlPayload({ r2Key: "../etc/passwd" })).success,
    ).toBe(false);
    expect(
      CodLandingPageImageUploadParamsSchema.safeParse(
        urlPayload({ r2Key: `products/${KEY_HEX}.png` }),
      ).success,
    ).toBe(false);
  });

  it("rejects content types outside the platform whitelist", () => {
    expect(
      CodLandingPageImageUploadParamsSchema.safeParse(urlPayload({ contentType: "image/svg+xml" })).success,
    ).toBe(false);
  });

  it("rejects malformed urls and actors", () => {
    expect(CodLandingPageImageUploadParamsSchema.safeParse(urlPayload({ imageUrl: "not-a-url" })).success).toBe(false);
    expect(
      CodLandingPageImageUploadParamsSchema.safeParse(
        urlPayload({ actor: { id: "u", role: "superadmin" } }),
      ).success,
    ).toBe(false);
  });
});

describe("CodLandingPageImageUploadWorkflow.run — url path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(okFetch(REAL_1X1_PNG, { "content-type": "image/png", "content-length": "70" })),
    );
    sharedQueries.getLandingPageById.mockResolvedValue(LANDING_PAGE);
    sharedQueries.getLandingPageImages.mockResolvedValue([]);
    sharedQueries.addLandingPageImage.mockResolvedValue([STACK_ROW]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches, stores to R2 with immutable metadata, inserts an ai-source row, and audits", async () => {
    const { workflow, put } = makeWorkflow();
    const step = makeFakeStep();

    const result = await workflow.run(
      { payload: urlPayload(), instanceId: "lpimg-test", timestamp: new Date() } as never,
      step as never,
    );

    expect(put).toHaveBeenCalledWith(
      R2_KEY,
      expect.any(Uint8Array),
      {
        httpMetadata: {
          contentType: "image/png",
          cacheControl: "public, max-age=31536000, immutable",
        },
        customMetadata: { source: "ai", uploadedAt: expect.any(String) },
      },
    );

    expect(sharedQueries.addLandingPageImage).toHaveBeenCalledWith(
      expect.anything(),
      UUID,
      expect.objectContaining({ r2Key: R2_KEY, src: `https://media.example.com/${R2_KEY}`, source: "ai" }),
    );

    expect(activity.logActivity).toHaveBeenCalledWith(
      expect.anything(),
      { id: "user-1", name: "Ada", role: "staff" },
      "landing_page.updated",
      { type: "landing_page", id: UUID, label: "Zinc page" },
      expect.objectContaining({ via: "mcp", action: "image_added", source: "ai", uploadJobId: "lpimg-test" }),
    );

    expect(result).toEqual({
      imageId: "img-row-1",
      r2Key: R2_KEY,
      src: `https://media.example.com/${R2_KEY}`,
      position: 1,
      width: 1,
      height: 1,
      altText: null,
      converted: false,
      storedContentType: "image/png",
    });

    expect(step.calls.map((c) => c.name)).toEqual([
      "fetch-transcode-store-image",
      "insert-image-record",
      "audit-image-added",
    ]);
    expect(step.calls[0].config).toEqual({
      retries: { limit: 3, delay: "5 seconds", backoff: "exponential" },
      timeout: "2 minutes",
    });
  });

  it("maps a permanently unavailable URL to a NonRetryableError with recovery advice", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    const { workflow } = makeWorkflow();
    const step = makeFakeStep();

    await expect(
      workflow.run({ payload: urlPayload(), instanceId: "lpimg-test" } as never, step as never),
    ).rejects.toMatchObject({
      name: "NonRetryableError",
      message: expect.stringContaining("not publicly fetchable"),
    });
    expect(sharedQueries.addLandingPageImage).not.toHaveBeenCalled();
  });

  it("maps a transient server failure to a retryable error (not NonRetryable)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 502 })));
    const { workflow } = makeWorkflow();
    const step = makeFakeStep();

    await expect(
      workflow.run({ payload: urlPayload(), instanceId: "lpimg-test" } as never, step as never),
    ).rejects.toMatchObject({
      name: expect.not.stringContaining("NonRetryableError"),
      message: expect.stringContaining("502"),
    });
  });

  it("rejects a content-type mismatch between the URL and the claim", async () => {
    const { workflow } = makeWorkflow();
    const step = makeFakeStep();

    await expect(
      workflow.run(
        { payload: urlPayload({ contentType: "image/jpeg" }), instanceId: "lpimg-test" } as never,
        step as never,
      ),
    ).rejects.toMatchObject({
      name: "NonRetryableError",
      message: expect.stringContaining("Content mismatch"),
    });
    expect(sharedQueries.addLandingPageImage).not.toHaveBeenCalled();
  });

  it("rejects an oversized image before buffering it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(null, { status: 200, headers: { "content-length": String(9 * 1024 * 1024) } }),
      ),
    );
    const { workflow } = makeWorkflow();
    const step = makeFakeStep();

    await expect(
      workflow.run({ payload: urlPayload(), instanceId: "lpimg-test" } as never, step as never),
    ).rejects.toMatchObject({
      name: "NonRetryableError",
      message: expect.stringContaining("8 MB cap"),
    });
  });

  it("refuses to insert when the landing page disappeared mid-flight", async () => {
    sharedQueries.getLandingPageById.mockResolvedValue(null);
    const { workflow } = makeWorkflow();
    const step = makeFakeStep();

    await expect(
      workflow.run({ payload: urlPayload(), instanceId: "lpimg-test" } as never, step as never),
    ).rejects.toMatchObject({
      name: "NonRetryableError",
      message: expect.stringContaining("no longer exists"),
    });
    expect(sharedQueries.addLandingPageImage).not.toHaveBeenCalled();
  });

  it("is idempotent on r2Key: a re-run insert step finds the existing row instead of duplicating", async () => {
    sharedQueries.getLandingPageImages.mockResolvedValue([STACK_ROW]);
    const { workflow, put } = makeWorkflow();
    const step = makeFakeStep();

    const result = await workflow.run(
      { payload: urlPayload(), instanceId: "lpimg-test" } as never,
      step as never,
    );

    expect(put).toHaveBeenCalled();
    expect(sharedQueries.addLandingPageImage).not.toHaveBeenCalled();
    expect(result.imageId).toBe("img-row-1");
  });
});

describe("CodLandingPageImageUploadWorkflow.run — bytes path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sharedQueries.getLandingPageById.mockResolvedValue(LANDING_PAGE);
    sharedQueries.getLandingPageImages.mockResolvedValue([]);
    sharedQueries.addLandingPageImage.mockResolvedValue([STACK_ROW]);
  });

  it("verifies the stored object, inserts the record, and audits", async () => {
    const { workflow, get, put } = makeWorkflow();
    const step = makeFakeStep();

    const result = await workflow.run(
      { payload: bytesPayload(), instanceId: "lpimg-test2" } as never,
      step as never,
    );

    expect(get).toHaveBeenCalledWith(R2_KEY);
    expect(put).not.toHaveBeenCalled();
    expect(sharedQueries.addLandingPageImage).toHaveBeenCalledWith(
      expect.anything(),
      UUID,
      expect.objectContaining({ source: "ai", width: 1, height: 1 }),
    );
    expect(activity.logActivity).toHaveBeenCalled();
    expect(result.imageId).toBe("img-row-1");
    expect(step.calls.map((c) => c.name)).toEqual([
      "transcode-stored-object",
      "insert-image-record",
      "audit-image-added",
    ]);
  });

  it("fails non-retryably when the tool's direct R2 write is missing", async () => {
    const { workflow, get } = makeWorkflow();
    get.mockResolvedValue(null);
    const step = makeFakeStep();

    await expect(
      workflow.run({ payload: bytesPayload(), instanceId: "lpimg-test2" } as never, step as never),
    ).rejects.toMatchObject({
      name: "NonRetryableError",
      message: expect.stringContaining("missing"),
    });
  });
});

describe("CodLandingPageImageUploadWorkflow.run — payload gate", () => {
  it("throws NonRetryableError before any step runs on a malformed payload", async () => {
    const { workflow } = makeWorkflow();
    const step = makeFakeStep();

    await expect(
      workflow.run(
        { payload: { kind: "url", landingPageId: "nope" }, instanceId: "lpimg-x" } as never,
        step as never,
      ),
    ).rejects.toBeInstanceOf(NonRetryableError);

    expect(step.calls).toHaveLength(0);
    expect(sharedQueries.addLandingPageImage).not.toHaveBeenCalled();
  });
});

describe("CodLandingPageImageUploadWorkflow.run — dimension fallbacks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(okFetch(REAL_1X1_PNG, { "content-type": "image/png", "content-length": "70" })),
    );
    sharedQueries.getLandingPageById.mockResolvedValue(LANDING_PAGE);
    sharedQueries.getLandingPageImages.mockResolvedValue([]);
    sharedQueries.addLandingPageImage.mockResolvedValue([STACK_ROW]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("server-measured dimensions win over client-declared ones", async () => {
    const { workflow } = makeWorkflow();
    const step = makeFakeStep();

    await workflow.run(
      { payload: urlPayload({ width: 999, height: 999 }), instanceId: "lpimg-t" } as never,
      step as never,
    );

    expect(sharedQueries.addLandingPageImage).toHaveBeenCalledWith(
      expect.anything(),
      UUID,
      expect.objectContaining({ width: 1, height: 1 }),
    );
  });

  it("client-declared dimensions are the fail-open fallback when header parsing fails", async () => {
    // PNG signature + garbage: sniffs as PNG (8-byte signature match) but the
    // IHDR chunk is invalid, so parseImageDimensions returns null.
    const corrupt = new Uint8Array(40);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).forEach((b: number, i: number) => {
      corrupt[i] = b;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(okFetch(corrupt, { "content-type": "image/png" })),
    );
    sharedQueries.addLandingPageImage.mockResolvedValue([
      { ...STACK_ROW, width: 1080, height: 1350 },
    ]);

    const { workflow } = makeWorkflow();
    const step = makeFakeStep();

    await workflow.run(
      { payload: urlPayload({ width: 1080, height: 1350 }), instanceId: "lpimg-t" } as never,
      step as never,
    );

    expect(sharedQueries.addLandingPageImage).toHaveBeenCalledWith(
      expect.anything(),
      UUID,
      expect.objectContaining({ width: 1080, height: 1350 }),
    );
  });
});

describe("CodLandingPageImageUploadWorkflow.run — fetch hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sharedQueries.getLandingPageById.mockResolvedValue(LANDING_PAGE);
    sharedQueries.getLandingPageImages.mockResolvedValue([]);
    sharedQueries.addLandingPageImage.mockResolvedValue([STACK_ROW]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("aborts a stream that exceeds the cap when content-length is absent", async () => {
    // 9 MB of bytes with a PNG signature — no content-length header, so the
    // capped reader must abort mid-stream before any sniff or R2 write.
    const big = new Uint8Array(9 * 1024 * 1024);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).forEach((b: number, i: number) => {
      big[i] = b;
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(big as unknown as BodyInit, { status: 200 })));

    const { workflow, put } = makeWorkflow();
    const step = makeFakeStep();

    await expect(
      workflow.run({ payload: urlPayload(), instanceId: "lpimg-t" } as never, step as never),
    ).rejects.toMatchObject({
      name: "NonRetryableError",
      message: expect.stringContaining("8 MB cap"),
    });
    expect(put).not.toHaveBeenCalled();
  });

  it("rejects a non-http(s) imageUrl at the payload gate", async () => {
    await expect(
      (async () => {
        const { workflow } = makeWorkflow();
        const step = makeFakeStep();
        await workflow.run(
          {
            payload: {
              ...urlPayload(),
              imageUrl: "file:///etc/passwd",
            },
            instanceId: "lpimg-t",
          } as never,
          step as never,
        );
      })(),
    ).rejects.toMatchObject({ name: "NonRetryableError" });
  });
});

/** Minimal valid VP8L WebP (width × height) — the transcode mock's output. */
function webpLosslessFixture(width: number, height: number): Uint8Array {
  const b = Buffer.alloc(30);
  b.write("RIFF", 0, "ascii");
  b.writeUInt32LE(18, 4);
  b.write("WEBP", 8, "ascii");
  b.write("VP8L", 12, "ascii");
  b.writeUInt32LE(5, 16);
  b.writeUInt8(0x2f, 20);
  b.writeUInt32LE((width - 1) | ((height - 1) << 14), 21);
  return new Uint8Array(b);
}

const WEBP_10x10 = webpLosslessFixture(10, 10);

/** Images-binding mock: input(stream).output(opts).response() → canned WebP. */
function makeImageTransform(
  webp: Uint8Array,
  opts: { fail?: "throw" | "http" | "empty" } = {},
) {
  const output = vi.fn(async () => ({
    // response() is synchronous on the real binding — returns Response directly.
    response: () => {
      if (opts.fail === "throw") throw new Error("images binding exploded");
      if (opts.fail === "http") return new Response("err", { status: 500 });
      if (opts.fail === "empty") return new Response(null, { status: 200 });
      return new Response(webp as unknown as BodyInit, { status: 200 });
    },
  }));
  const input = vi.fn(() => ({ output }));
  return { input, __output: output } as unknown as ImagesBinding & { __output: ReturnType<typeof vi.fn> };
}

describe("CodLandingPageImageUploadWorkflow.run — WebP transcode (Images binding)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(okFetch(REAL_1X1_PNG, { "content-type": "image/png", "content-length": "70" })),
    );
    sharedQueries.getLandingPageById.mockResolvedValue(LANDING_PAGE);
    sharedQueries.getLandingPageImages.mockResolvedValue([]);
    sharedQueries.addLandingPageImage.mockResolvedValue([STACK_ROW]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("url path: transcodes a PNG source to WebP and stores it under the webp key", async () => {
    const binding = makeImageTransform(WEBP_10x10);
    const { workflow, put } = makeWorkflow({ IMAGE_TRANSFORM: binding });
    const step = makeFakeStep();

    const result = await workflow.run(
      { payload: urlPayload(), instanceId: "lpimg-t" } as never,
      step as never,
    );

    expect(binding.input).toHaveBeenCalledTimes(1);
    expect((binding as unknown as { __output: ReturnType<typeof vi.fn> }).__output)
      .toHaveBeenCalledWith({ format: "image/webp", quality: 85 });
    expect(put).toHaveBeenCalledWith(
      R2_KEY,
      expect.any(Uint8Array),
      {
        httpMetadata: {
          contentType: "image/webp",
          cacheControl: "public, max-age=31536000, immutable",
        },
        customMetadata: { source: "ai", uploadedAt: expect.any(String) },
      },
    );
    expect(result.converted).toBe(true);
    expect(result.storedContentType).toBe("image/webp");
    // Dimensions measured from the transcoded WebP (10x10 fixture) flow into
    // the record insert (the result echoes the DB row, which the query mock
    // stubs with its own fixture values).
    expect(sharedQueries.addLandingPageImage).toHaveBeenCalledWith(
      expect.anything(),
      UUID,
      expect.objectContaining({ r2Key: R2_KEY, width: 10, height: 10 }),
    );
  });

  it("url path: a WebP source passes through without touching the binding (no billed transformation)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(okFetch(WEBP_10x10, { "content-type": "image/webp" })),
    );
    const WEBP_KEY = `landing/${KEY_HEX}.webp`;
    sharedQueries.addLandingPageImage.mockResolvedValue([
      { ...STACK_ROW, r2Key: WEBP_KEY, src: `https://media.example.com/${WEBP_KEY}` },
    ]);
    const binding = makeImageTransform(WEBP_10x10);
    const { workflow, put } = makeWorkflow({ IMAGE_TRANSFORM: binding });
    const step = makeFakeStep();

    const result = await workflow.run(
      {
        payload: urlPayload({
          contentType: "image/webp",
          r2Key: WEBP_KEY,
        }),
        instanceId: "lpimg-t",
      } as never,
      step as never,
    );

    expect(binding.input).not.toHaveBeenCalled();
    expect(put).toHaveBeenCalledWith(
      WEBP_KEY,
      expect.any(Uint8Array),
      expect.objectContaining({ httpMetadata: { contentType: "image/webp", cacheControl: expect.any(String) } }),
    );
    expect(result.converted).toBe(true);
    expect(result.storedContentType).toBe("image/webp");
  });

  it("bytes path: transcodes the stored original in place under the same key", async () => {
    const binding = makeImageTransform(WEBP_10x10);
    const { workflow, get, put } = makeWorkflow({ IMAGE_TRANSFORM: binding });
    const step = makeFakeStep();

    const result = await workflow.run(
      { payload: bytesPayload(), instanceId: "lpimg-t" } as never,
      step as never,
    );

    expect(get).toHaveBeenCalledWith(R2_KEY);
    expect(put).toHaveBeenCalledWith(
      R2_KEY,
      expect.any(Uint8Array),
      {
        httpMetadata: {
          contentType: "image/webp",
          cacheControl: "public, max-age=31536000, immutable",
        },
        customMetadata: { source: "ai", uploadedAt: expect.any(String) },
      },
    );
    expect(result.converted).toBe(true);
    expect(result.storedContentType).toBe("image/webp");
  });

  it("bytes path: an already-WebP object skips the binding (idempotent re-run after a successful transcode)", async () => {
    const binding = makeImageTransform(WEBP_10x10);
    // R2 get returns the WebP a prior run stored at the key.
    const put = vi.fn(async () => undefined);
    const get = vi.fn(async () => ({
      arrayBuffer: async () => WEBP_10x10.buffer.slice(0) as ArrayBuffer,
    }));
    const env = {
      IMAGES: { put, get },
      MEDIA_DOMAIN: "media.example.com",
      DB: {} as never,
      IMAGE_TRANSFORM: binding,
    };
    const wf = new (CodLandingPageImageUploadWorkflow as unknown as new (
      ctx: unknown,
      env: unknown,
    ) => InstanceType<typeof CodLandingPageImageUploadWorkflow>)({}, env);
    const step = makeFakeStep();
    const WEBP_KEY = `landing/${KEY_HEX}.webp`;
    sharedQueries.addLandingPageImage.mockResolvedValue([
      { ...STACK_ROW, r2Key: WEBP_KEY, src: `https://media.example.com/${WEBP_KEY}` },
    ]);

    const result = await wf.run(
      {
        payload: bytesPayload({ contentType: "image/webp", r2Key: WEBP_KEY }),
        instanceId: "lpimg-t",
      } as never,
      step as never,
    );

    expect(binding.input).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(result.converted).toBe(true);
    expect(result.storedContentType).toBe("image/webp");
  });

  it("binding failure falls back to the original format — the upload still succeeds", async () => {
    const binding = makeImageTransform(WEBP_10x10, { fail: "throw" });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { workflow, put } = makeWorkflow({ IMAGE_TRANSFORM: binding });
      const step = makeFakeStep();

      const result = await workflow.run(
        { payload: urlPayload(), instanceId: "lpimg-t" } as never,
        step as never,
      );

      expect(put).toHaveBeenCalledWith(
        R2_KEY,
        expect.any(Uint8Array),
        expect.objectContaining({
          httpMetadata: { contentType: "image/png", cacheControl: expect.any(String) },
        }),
      );
      expect(result.converted).toBe(false);
      expect(result.storedContentType).toBe("image/png");
      expect(result.imageId).toBe("img-row-1");
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("binding HTTP error falls back to the original format", async () => {
    const binding = makeImageTransform(WEBP_10x10, { fail: "http" });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { workflow } = makeWorkflow({ IMAGE_TRANSFORM: binding });
      const step = makeFakeStep();

      const result = await workflow.run(
        { payload: urlPayload(), instanceId: "lpimg-t" } as never,
        step as never,
      );

      expect(result.converted).toBe(false);
      expect(result.storedContentType).toBe("image/png");
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("binding empty-body response falls back to the original format", async () => {
    const binding = makeImageTransform(WEBP_10x10, { fail: "empty" });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { workflow } = makeWorkflow({ IMAGE_TRANSFORM: binding });
      const step = makeFakeStep();

      const result = await workflow.run(
        { payload: urlPayload(), instanceId: "lpimg-t" } as never,
        step as never,
      );

      expect(result.converted).toBe(false);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("audit row records the stored format and conversion outcome", async () => {
    const binding = makeImageTransform(WEBP_10x10);
    const { workflow } = makeWorkflow({ IMAGE_TRANSFORM: binding });
    const step = makeFakeStep();

    await workflow.run({ payload: urlPayload(), instanceId: "lpimg-t" } as never, step as never);

    expect(activity.logActivity).toHaveBeenCalledWith(
      expect.anything(),
      { id: "user-1", name: "Ada", role: "staff" },
      "landing_page.updated",
      { type: "landing_page", id: UUID, label: "Zinc page" },
      expect.objectContaining({ storedContentType: "image/webp", convertedToWebp: true }),
    );
  });
});
