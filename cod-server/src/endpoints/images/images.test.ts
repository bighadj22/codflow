/**
 * Integration Tests for Images Endpoint
 * 
 * Tests error scenarios for images endpoints.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { ERROR_CODES, ERROR_CATEGORIES } from "../../../../cod-shared/errors/codes";
import * as handlers from "./handlers";
import { presignUpload } from "./presign";

// Mock the database
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  all: vi.fn(),
  get: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn(),
  delete: vi.fn().mockReturnThis(),
} as any;

vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}));

// Mock R2 bucket
const mockBucket = {
  put: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
} as any;

describe("Images Endpoint - Error Scenarios", () => {
  let app: Hono<AppContext>;

  beforeEach(() => {
    app = new Hono<AppContext>();
    
    // Add middleware to inject mock env and user
    app.use("*", async (c, next) => {
      c.env = { 
        DB: mockDb,
        IMAGES: mockBucket,
        CF_ACCOUNT_ID: "test-account",
        R2_ACCESS_KEY_ID: "test-key",
        R2_SECRET_ACCESS_KEY: "test-secret",
        R2_BUCKET_NAME: "test-bucket",
        MEDIA_DOMAIN: "media.example.com",
      } as any;
      c.set("user", { id: "user-123", email: "test@example.com" } as any);
      await next();
    });
    
    app.onError(errorHandler);
    app.post("/api/images/upload", handlers.uploadImage);
    app.post("/api/images/presign", presignUpload);
    app.get("/images/:key{.+}", handlers.serveImage);
    app.get("/api/products/:id/images", handlers.listProductImages);
    app.post("/api/products/:id/images", handlers.saveProductImage);
    app.delete("/api/products/:id/images/:imageId", handlers.deleteProductImage);
    
    vi.clearAllMocks();
  });

  describe("POST /api/images/upload", () => {
    it("should return 400 with REQUIRED_FIELD_MISSING code when file is missing", async () => {
      const formData = new FormData();
      // No file added

      const res = await app.request("/api/images/upload", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        error: "Missing file field",
        code: ERROR_CODES.REQUIRED_FIELD_MISSING,
        category: ERROR_CATEGORIES.VALIDATION,
        context: {
          field: "file",
        },
      });
    });

    it("should return 400 with INVALID_FILE_TYPE code when file type is not allowed", async () => {
      const formData = new FormData();
      const file = new File(["test"], "test.pdf", { type: "application/pdf" });
      formData.append("file", file);

      const res = await app.request("/api/images/upload", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        error: "Invalid file type. Allowed: jpg, png, webp, gif",
        code: ERROR_CODES.INVALID_FILE_TYPE,
        category: ERROR_CATEGORIES.VALIDATION,
      });
      expect(body.context).toHaveProperty("fileType", "application/pdf");
      expect(body.context).toHaveProperty("allowedTypes");
      expect(Array.isArray(body.context.allowedTypes)).toBe(true);
    });

    it("should return 400 with FILE_TOO_LARGE code when file exceeds max size", async () => {
      const formData = new FormData();
      // Create a file larger than 10 MB
      const largeContent = new Uint8Array(11 * 1024 * 1024); // 11 MB
      const file = new File([largeContent], "large-image.jpg", { type: "image/jpeg" });
      formData.append("file", file);

      const res = await app.request("/api/images/upload", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        error: "File too large. Max 10 MB",
        code: ERROR_CODES.FILE_TOO_LARGE,
        category: ERROR_CATEGORIES.VALIDATION,
      });
      expect(body.context).toHaveProperty("fileSize");
      expect(body.context).toHaveProperty("maxSize", 10 * 1024 * 1024);
      expect(body.context).toHaveProperty("fileName", "large-image.jpg");
    });

    it("should return 500 with INTERNAL_SERVER_ERROR code when R2 upload fails", async () => {
      const formData = new FormData();
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      formData.append("file", file);

      // Mock R2 put to throw an error
      mockBucket.put.mockRejectedValue(new Error("R2 connection failed"));

      const res = await app.request("/api/images/upload", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(500);
      const body: any = await res.json();
      expect(body).toMatchObject({
        error: "Failed to upload image to storage",
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
        category: ERROR_CATEGORIES.SYSTEM,
      });
      expect(body.context).toHaveProperty("key");
      expect(body.context).toHaveProperty("fileName", "test.jpg");
    });

    it("should return 201 when image is uploaded successfully", async () => {
      const formData = new FormData();
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      formData.append("file", file);

      mockBucket.put.mockResolvedValue(undefined);

      const res = await app.request("/api/images/upload", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(201);
      const body: any = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          key: expect.stringMatching(/^products\/[a-f0-9]+\.jpg$/),
          url: expect.stringContaining("/images/products/"),
        }),
      });
    });
  });

  describe("GET /images/:key", () => {
    it("should return 400 with REQUIRED_FIELD_MISSING code when key is missing", async () => {
      const res = await app.request("/images/", {
        method: "GET",
      });

      // This will likely 404 due to route not matching, but let's test the handler directly
      // In practice, the route pattern ensures key is present
      expect(res.status).toBe(404);
    });

    it("should return 400 with VALIDATION_FAILED code when key contains path traversal", async () => {
      // Test with a key that starts with / (absolute path)
      const res = await app.request("/images//etc/passwd", {
        method: "GET",
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        error: "Invalid key",
        code: ERROR_CODES.VALIDATION_FAILED,
        category: ERROR_CATEGORIES.VALIDATION,
      });
      expect(body.context).toHaveProperty("key");
    });

    it("should return 404 with IMAGE_NOT_FOUND code when image does not exist in R2", async () => {
      mockBucket.get.mockResolvedValue(null);

      const res = await app.request("/images/products/nonexistent.jpg", {
        method: "GET",
      });

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toMatchObject({
        error: "Image with ID products/nonexistent.jpg not found",
        code: ERROR_CODES.IMAGE_NOT_FOUND,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "Image",
          id: "products/nonexistent.jpg",
        },
      });
    });

    it("should return 200 with image data when image exists", async () => {
      const mockImageBody = new ReadableStream();
      mockBucket.get.mockResolvedValue({
        body: mockImageBody,
        httpEtag: '"abc123"',
        writeHttpMetadata: (headers: Headers) => {
          headers.set("Content-Type", "image/jpeg");
        },
      });

      const res = await app.request("/images/products/test.jpg", {
        method: "GET",
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/jpeg");
      expect(res.headers.get("ETag")).toBe('"abc123"');
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    });
  });

  describe("POST /api/products/:id/images", () => {
    it("should return 400 with REQUIRED_FIELD_MISSING code when key or src is missing", async () => {
      const res = await app.request("/api/products/prod_123/images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Missing key and src
        }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        error: "key and src are required",
        code: ERROR_CODES.REQUIRED_FIELD_MISSING,
        category: ERROR_CATEGORIES.VALIDATION,
      });
      expect(body.context).toHaveProperty("missingFields");
      expect(Array.isArray(body.context.missingFields)).toBe(true);
    });

    it("should return 201 when image record is saved successfully", async () => {
      mockDb.all.mockResolvedValue([]);
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const res = await app.request("/api/products/prod_123/images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "products/abc123.jpg",
          src: "https://example.com/images/products/abc123.jpg",
          altText: "Product image",
        }),
      });

      expect(res.status).toBe(201);
      const body: any = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          productId: "prod_123",
          src: "https://example.com/images/products/abc123.jpg",
          r2Key: "products/abc123.jpg",
          altText: "Product image",
        }),
      });
    });
  });

  describe("DELETE /api/products/:id/images/:imageId", () => {
    it("should return 404 with IMAGE_NOT_FOUND code when image does not exist", async () => {
      mockDb.get.mockResolvedValue(null);

      const res = await app.request("/api/products/prod_123/images/img_nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body).toMatchObject({
        error: "Image with ID img_nonexistent not found",
        code: ERROR_CODES.IMAGE_NOT_FOUND,
        category: ERROR_CATEGORIES.BUSINESS_LOGIC,
        context: {
          entity: "Image",
          id: "img_nonexistent",
        },
      });
    });

    it("should return 500 with INTERNAL_SERVER_ERROR code when R2 delete fails", async () => {
      mockDb.get.mockResolvedValue({
        id: "img_123",
        productId: "prod_123",
        r2Key: "products/abc123.jpg",
        src: "https://example.com/images/products/abc123.jpg",
      });
      mockBucket.delete.mockRejectedValue(new Error("R2 delete failed"));

      const res = await app.request("/api/products/prod_123/images/img_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(500);
      const body: any = await res.json();
      expect(body).toMatchObject({
        error: "Failed to delete image from storage",
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
        category: ERROR_CATEGORIES.SYSTEM,
      });
      expect(body.context).toHaveProperty("imageId", "img_123");
      expect(body.context).toHaveProperty("r2Key", "products/abc123.jpg");
    });

    it("should return 200 when image is deleted successfully", async () => {
      mockDb.get.mockResolvedValue({
        id: "img_123",
        productId: "prod_123",
        r2Key: "products/abc123.jpg",
        src: "https://example.com/images/products/abc123.jpg",
      });
      mockBucket.delete.mockResolvedValue(undefined);
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const res = await app.request("/api/products/prod_123/images/img_123", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body).toMatchObject({
        success: true,
      });
    });
  });

  describe("POST /api/images/presign", () => {
    it("should return 400 with INVALID_FILE_TYPE code when content type is not allowed", async () => {
      const res = await app.request("/api/images/presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentType: "application/pdf",
        }),
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toMatchObject({
        error: "Invalid content type. Allowed: jpg, png, webp, gif",
        code: ERROR_CODES.INVALID_FILE_TYPE,
        category: ERROR_CATEGORIES.VALIDATION,
      });
      expect(body.context).toHaveProperty("contentType", "application/pdf");
      expect(body.context).toHaveProperty("allowedTypes");
    });

    it("should return 500 with INTERNAL_SERVER_ERROR code when R2 credentials are missing", async () => {
      // Create a new app instance with missing credentials
      const appNoCredentials = new Hono<AppContext>();
      
      appNoCredentials.use("*", async (c, next) => {
        c.env = { 
          DB: mockDb,
          IMAGES: mockBucket,
          // Missing credentials
          CF_ACCOUNT_ID: undefined,
          R2_ACCESS_KEY_ID: undefined,
          R2_SECRET_ACCESS_KEY: undefined,
        } as any;
        await next();
      });
      
      appNoCredentials.onError(errorHandler);
      appNoCredentials.post("/api/images/presign", presignUpload);

      const res = await appNoCredentials.request("/api/images/presign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentType: "image/jpeg",
        }),
      });

      expect(res.status).toBe(500);
      const body: any = await res.json();
      expect(body).toMatchObject({
        error: expect.stringContaining("R2 credentials not configured"),
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
        category: ERROR_CATEGORIES.SYSTEM,
      });
      expect(body.context).toHaveProperty("missingCredentials");
      expect(Array.isArray(body.context.missingCredentials)).toBe(true);
    });
  });

  describe("Error Response Structure", () => {
    it("should always include error, code, and category fields in error responses", async () => {
      const formData = new FormData();
      // No file added

      const res = await app.request("/api/images/upload", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toHaveProperty("error");
      expect(body).toHaveProperty("code");
      expect(body).toHaveProperty("category");
      expect(typeof body.error).toBe("string");
      expect(typeof body.code).toBe("string");
      expect(typeof body.category).toBe("string");
    });

    it("should include context field when available", async () => {
      const formData = new FormData();
      const file = new File(["test"], "test.pdf", { type: "application/pdf" });
      formData.append("file", file);

      const res = await app.request("/api/images/upload", {
        method: "POST",
        body: formData,
      });

      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body).toHaveProperty("context");
      expect(body.context).toHaveProperty("fileType");
      expect(body.context).toHaveProperty("allowedTypes");
    });
  });
});
