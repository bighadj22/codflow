/**
 * Route-level integration tests for the Images routers.
 * Upload/presign run through the OpenAPIHono router; serve stays plain Hono.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import { Hono } from "hono";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import { uploadRouter, serveRouter } from "./routes";

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    constructor(_config?: unknown) {}
  },
  PutObjectCommand: vi.fn(),
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async () => "https://signed.example.com/upload"),
}));

function makeFile(name: string, type: string, size = 10) {
  return new File([new Uint8Array(size)], name, { type });
}

describe("Images routes", () => {
  let app: OpenAPIHono<AppContext>;
  let mockBucket: { put: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };
  let testEnv: Record<string, unknown>;

  beforeEach(() => {
    app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
    mockBucket = {
      put: vi.fn(async () => undefined),
      get: vi.fn(async () => null),
    };
    testEnv = {
      DB: {},
      IMAGES: mockBucket,
      CF_ACCOUNT_ID: "acct",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_BUCKET_NAME: "bucket",
      MEDIA_DOMAIN: "cdn.example.com",
    };
    app.use("*", async (c, next) => {
      c.env = testEnv as any;
      c.set("user", {
        id: "admin_user_001",
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
        status: "active",
        apiKey: "cod_admin_key",
      } as any);
      await next();
    });
    app.onError(errorHandler);
    app.route("/api/images", uploadRouter);
    app.route("/images", serveRouter as unknown as Hono<AppContext>);
    vi.clearAllMocks();
  });

  describe("POST /api/images/upload", () => {
    it("uploads a valid image and returns key + url with 201", async () => {
      const form = new FormData();
      form.append("file", makeFile("product.jpg", "image/jpeg"));

      const res = await app.request("/api/images/upload", {
        method: "POST",
        body: form,
      });

      expect(res.status).toBe(201);
      const body: any = await res.json();
      expect(body.data.key).toMatch(/^products\/[a-f0-9]+\.jpg$/);
      expect(body.data.url).toContain("/images/products/");
      expect(mockBucket.put).toHaveBeenCalledTimes(1);
    });

    it("returns 400 INVALID_FILE_TYPE for a disallowed file type", async () => {
      const form = new FormData();
      form.append("file", makeFile("doc.pdf", "application/pdf"));

      const res = await app.request("/api/images/upload", {
        method: "POST",
        body: form,
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe(ERROR_CODES.INVALID_FILE_TYPE);
    });

    it("returns 400 FILE_TOO_LARGE above 10 MB", async () => {
      const form = new FormData();
      form.append(
        "file",
        makeFile("big.png", "image/png", 11 * 1024 * 1024)
      );

      const res = await app.request("/api/images/upload", {
        method: "POST",
        body: form,
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe(ERROR_CODES.FILE_TOO_LARGE);
    });
  });

  describe("POST /api/images/presign", () => {
    it("returns presigned URL data with 200", async () => {
      const res = await app.request("/api/images/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: "image/webp" }),
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data.presignedUrl).toContain("https://signed");
      expect(body.data.key).toMatch(/^products\/[a-f0-9]+\.webp$/);
      expect(body.data.publicUrl).toBe(`https://cdn.example.com/${body.data.key}`);
    });

    it("returns 400 INVALID_FILE_TYPE for unsupported content types", async () => {
      const res = await app.request("/api/images/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: "application/pdf" }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.code).toBe(ERROR_CODES.INVALID_FILE_TYPE);
    });

    it("returns 500 when R2 credentials are not configured", async () => {
      delete testEnv.CF_ACCOUNT_ID;

      const res = await app.request("/api/images/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: "image/jpeg" }),
      });

      expect(res.status).toBe(500);
      const body: any = await res.json();
      expect(body.context.missingCredentials).toContain("CF_ACCOUNT_ID");
    });
  });

  describe("GET /images/{key} (public serving)", () => {
    function r2Object(body: string) {
      return {
        body: new Response(body).body,
        httpEtag: '"etag-1"',
        writeHttpMetadata: (headers: Headers) => headers.set("Content-Type", "image/jpeg"),
      };
    }

    it("serves an object with immutable cache headers", async () => {
      mockBucket.get.mockResolvedValue(r2Object("binary"));

      const res = await app.request("/images/products/abc.jpg");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/jpeg");
      expect(res.headers.get("Cache-Control")).toContain("immutable");
      expect(mockBucket.get).toHaveBeenCalledWith("products/abc.jpg");
    });

    it("rejects path traversal keys with 400", async () => {
      const res = await app.request("/images/%2e%2e%2fsecret.txt");

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.category).toBe("VALIDATION");
    });

    it("returns 404 when the object does not exist", async () => {
      mockBucket.get.mockResolvedValue(null);

      const res = await app.request("/images/products/missing.jpg");

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body.code).toBe("IMAGE_NOT_FOUND");
    });
  });
});
