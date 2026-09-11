/**
 * CORS Middleware Tests
 * Verifies origin validation in development and production environments.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { corsMiddleware } from "./cors";
import type { AppContext } from "@/types/app";

describe("CORS Middleware", () => {
  let app: Hono<AppContext>;

  describe("Development Environment", () => {
    beforeEach(() => {
      app = new Hono<AppContext>();
      app.use("*", async (c, next) => {
        c.env = {
          ENVIRONMENT: "development",
          ALLOWED_ORIGINS: "*",
        } as any;
        await next();
      });
      app.use("*", corsMiddleware);
      app.get("/test", (c) => c.json({ ok: true }));
    });

    it("should allow any origin in development", async () => {
      const res = await app.request("/test", {
        method: "GET",
        headers: {
          origin: "http://localhost:3000",
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
    });

    it("should allow different origin in development", async () => {
      const res = await app.request("/test", {
        method: "GET",
        headers: {
          origin: "http://localhost:5173",
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    });

    it("should handle OPTIONS preflight", async () => {
      const res = await app.request("/test", {
        method: "OPTIONS",
        headers: {
          origin: "http://localhost:3000",
        },
      });

      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
      expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
      expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    });
  });

  describe("Production Environment - Whitelist", () => {
    beforeEach(() => {
      app = new Hono<AppContext>();
      app.use("*", async (c, next) => {
        c.env = {
          ENVIRONMENT: "production",
          ALLOWED_ORIGINS: "https://app.example.com,https://store.example.com",
        } as any;
        await next();
      });
      app.use("*", corsMiddleware);
      app.get("/test", (c) => c.json({ ok: true }));
    });

    it("should allow whitelisted origin", async () => {
      const res = await app.request("/test", {
        method: "GET",
        headers: {
          origin: "https://app.example.com",
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com");
      expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    });

    it("should allow second whitelisted origin", async () => {
      const res = await app.request("/test", {
        method: "GET",
        headers: {
          origin: "https://store.example.com",
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://store.example.com");
      expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    });

    it("should reject non-whitelisted origin by returning first allowed origin", async () => {
      const res = await app.request("/test", {
        method: "GET",
        headers: {
          origin: "https://evil.com",
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com");
      // Browser will reject this response due to origin mismatch
    });

    it("should handle requests without origin header", async () => {
      const res = await app.request("/test", {
        method: "GET",
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com");
    });

    it("should handle OPTIONS preflight for whitelisted origin", async () => {
      const res = await app.request("/test", {
        method: "OPTIONS",
        headers: {
          origin: "https://app.example.com",
        },
      });

      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com");
    });
  });

  describe("Production Environment - No ALLOWED_ORIGINS", () => {
    beforeEach(() => {
      app = new Hono<AppContext>();
      app.use("*", async (c, next) => {
        c.env = {
          ENVIRONMENT: "production",
          // ALLOWED_ORIGINS undefined
        } as any;
        await next();
      });
      app.use("*", corsMiddleware);
      app.get("/test", (c) => c.json({ ok: true }));
    });

    it("should fall back to wildcard if no ALLOWED_ORIGINS set", async () => {
      const res = await app.request("/test", {
        method: "GET",
        headers: {
          origin: "https://app.example.com",
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com");
    });
  });

  describe("Raw Response handlers (streamed bodies)", () => {
    beforeEach(() => {
      app = new Hono<AppContext>();
      app.use("*", async (c, next) => {
        c.env = {
          ENVIRONMENT: "production",
          ALLOWED_ORIGINS: "https://app.example.com",
        } as any;
        await next();
      });
      app.use("*", corsMiddleware);
    });

    // Regression: handlers returning a raw `new Response(...)` (label PDF
    // proxy, R2 image streaming) bypass Hono's prepared-header application,
    // so headers set before next() never reached them and the browser
    // blocked the response with a CORS error despite the 200.
    it("adds CORS headers to a raw Response", async () => {
      app.get("/raw", () => new Response("raw-body", {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      }));

      const res = await app.request("/raw", {
        method: "GET",
        headers: { origin: "https://app.example.com" },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com");
      expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    });

    it("does not duplicate CORS headers on context-built responses", async () => {
      app.get("/json", (c) => c.json({ ok: true }));

      const res = await app.request("/json", {
        method: "GET",
        headers: { origin: "https://app.example.com" },
      });

      expect(res.status).toBe(200);
      expect([...res.headers.keys()].filter((k) => k === "access-control-allow-origin")).toHaveLength(1);
    });
  });
});
