/**
 * Route-level tests for the store-pages OpenAPIHono router.
 *
 * Mocks ./queries entirely — this file proves routing, RBAC scope gating,
 * request/param validation, and error-envelope mapping. It never touches
 * cod-shared's sanitizeRichText (HTMLRewriter doesn't exist in this pool);
 * the write chokepoint's real behaviour is proven in
 * cod-shared/queries/store-pages.e2e.test.ts and this endpoint's own
 * store-pages.wrapper-e2e.test.ts.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { errorHandler } from "@/middleware/error";
import { openApiValidationHook } from "@/openapi/validation-hook";
import storePagesRouter from "./routes";
import * as queries from "./queries";
import { NotFoundError, ConflictError, BusinessLogicError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";

const mockDb = {} as any;
vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}));

// Explicit factories, not vi.mock("./queries") automocking: "./queries"
// re-exports `export * from cod-shared/queries/store-pages`, and a separate
// mock of that module would make automocking introspect the REAL "./queries"
// against the ALREADY-mocked cod-shared module — silently dropping every
// function "./queries" doesn't locally redeclare (listStorePages,
// seedStorePages, …). An explicit factory sidesteps that chain entirely.
vi.mock("./queries", () => ({
  listStorePages: vi.fn(),
  getStorePageOrThrow: vi.fn(),
  createCustomPage: vi.fn(),
  updateStorePageMeta: vi.fn(),
  deleteStorePage: vi.fn(),
  saveTranslation: vi.fn(),
  resetTranslationToTemplate: vi.fn(),
  seedStorePages: vi.fn(),
}));
vi.mock("../../../../cod-shared/queries/stores", () => ({
  getStore: vi.fn(async () => ({ id: "store_1", name: "متجر تجريبي" })),
}));
vi.mock("../../../../cod-shared/queries/store-pages", () => ({
  getLegalProfile: vi.fn(),
  upsertLegalProfile: vi.fn(),
}));

const admin = { id: "user_admin_001", name: "Admin User", role: "admin", scopes: [] };
const staffNoScope = { id: "user_staff_001", name: "Amira Khalil", role: "staff", scopes: [] };

const NOW = new Date().toISOString();

function pageSummary(overrides: Record<string, any> = {}) {
  return {
    id: "sp_1",
    kind: "refund",
    slug: "refund-policy",
    status: "published",
    showInFooter: true,
    position: 3,
    templateVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
    translations: [{ locale: "ar", title: "سياسة الإرجاع", source: "template", updatedAt: NOW }],
    ...overrides,
  };
}

function pageDetail(overrides: Record<string, any> = {}) {
  return { ...pageSummary(), bodies: { ar: { pageId: "sp_1", locale: "ar", title: "سياسة الإرجاع", bodyHtml: "<p>x</p>", bodyPlain: "x", metaTitle: null, metaDescription: null, source: "template", updatedAt: NOW } }, ...overrides };
}

let app: OpenAPIHono<AppContext>;

function mountAs(user: typeof admin | typeof staffNoScope) {
  app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
  app.use("*", async (c, next) => {
    c.env = { DB: mockDb } as any;
    c.set("user", user as any);
    await next();
  });
  app.onError(errorHandler);
  app.route("/api/store-pages", storePagesRouter);
}

beforeEach(() => {
  vi.clearAllMocks();
  mountAs(admin);
});

describe("GET /api/store-pages", () => {
  it("returns 200 with the list", async () => {
    vi.mocked(queries.listStorePages).mockResolvedValue([pageSummary()] as any);
    const res = await app.request("/api/store-pages");
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.count).toBe(1);
  });

  it("is scope-gated: 403 for staff without store_pages:read", async () => {
    mountAs(staffNoScope);
    const res = await app.request("/api/store-pages");
    expect(res.status).toBe(403);
    const body: any = await res.json();
    expect(body.required).toBe("store_pages:read");
  });
});

describe("GET /api/store-pages/legal-profile", () => {
  it("returns 200 with null when never set", async () => {
    const shared = await import("../../../../cod-shared/queries/store-pages");
    vi.mocked(shared.getLegalProfile).mockResolvedValue(undefined);
    const res = await app.request("/api/store-pages/legal-profile");
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data).toBeNull();
  });

  it("is not shadowed by the /{id} route (static-before-param routing)", async () => {
    const shared = await import("../../../../cod-shared/queries/store-pages");
    vi.mocked(shared.getLegalProfile).mockResolvedValue({ storeId: "store_1", contactEmail: "a@b.dz" } as any);
    vi.mocked(queries.getStorePageOrThrow).mockClear();
    const res = await app.request("/api/store-pages/legal-profile");
    expect(res.status).toBe(200);
    // If routing matched /{id} instead, this would have been called with id="legal-profile".
    expect(queries.getStorePageOrThrow).not.toHaveBeenCalled();
  });
});

describe("PUT /api/store-pages/legal-profile", () => {
  it("saves and returns 200", async () => {
    const shared = await import("../../../../cod-shared/queries/store-pages");
    vi.mocked(shared.upsertLegalProfile).mockResolvedValue({ storeId: "store_1", contactEmail: "a@b.dz" } as any);
    const res = await app.request("/api/store-pages/legal-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactEmail: "a@b.dz" }),
    });
    expect(res.status).toBe(200);
  });

  it("rejects a malformed email with 400", async () => {
    const res = await app.request("/api/store-pages/legal-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactEmail: "not-an-email" }),
    });
    expect(res.status).toBe(400);
  });

  it("is scope-gated: 403 for staff without store_pages:manage", async () => {
    mountAs(staffNoScope);
    const res = await app.request("/api/store-pages/legal-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/store-pages/seed-defaults", () => {
  it("returns which kinds were created", async () => {
    vi.mocked(queries.seedStorePages).mockResolvedValue({ created: ["terms", "privacy"] } as any);
    const res = await app.request("/api/store-pages/seed-defaults", { method: "POST" });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data.created).toEqual(["terms", "privacy"]);
  });
});

describe("GET /api/store-pages/{id}", () => {
  it("returns 200 with detail", async () => {
    vi.mocked(queries.getStorePageOrThrow).mockResolvedValue(pageDetail() as any);
    const res = await app.request("/api/store-pages/sp_1");
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data.id).toBe("sp_1");
  });

  it("maps NotFoundError to 404 with the entity in context", async () => {
    vi.mocked(queries.getStorePageOrThrow).mockRejectedValue(new NotFoundError("Store Page", "missing"));
    const res = await app.request("/api/store-pages/missing");
    expect(res.status).toBe(404);
    const body: any = await res.json();
    expect(body.context).toMatchObject({ entity: "Store Page", id: "missing" });
  });
});

describe("POST /api/store-pages (create custom page)", () => {
  const validBody = {
    slug: "faq",
    locale: "en",
    title: "FAQ",
    bodyHtml: "<p>Q and A</p>",
  };

  it("returns 201 on success", async () => {
    vi.mocked(queries.createCustomPage).mockResolvedValue(pageDetail({ kind: "custom", slug: "faq" }) as any);
    const res = await app.request("/api/store-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(201);
  });

  it("maps a slug conflict to 409 DUPLICATE_ENTITY", async () => {
    vi.mocked(queries.createCustomPage).mockRejectedValue(
      new ConflictError('Slug "faq" is already used by another page', ERROR_CODES.DUPLICATE_ENTITY, { slug: "faq" }),
    );
    const res = await app.request("/api/store-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(409);
    const body: any = await res.json();
    expect(body.code).toBe(ERROR_CODES.DUPLICATE_ENTITY);
  });

  it("rejects an uppercase slug with 400 before reaching queries", async () => {
    const res = await app.request("/api/store-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, slug: "FAQ" }),
    });
    expect(res.status).toBe(400);
    expect(queries.createCustomPage).not.toHaveBeenCalled();
  });

  it("rejects a 2-character slug (below PAGE_SLUG_MIN) with 400", async () => {
    const res = await app.request("/api/store-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, slug: "ab" }),
    });
    expect(res.status).toBe(400);
  });

  it("is scope-gated: 403 for staff without store_pages:manage", async () => {
    mountAs(staffNoScope);
    const res = await app.request("/api/store-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/store-pages/{id}", () => {
  it("returns 200 on success", async () => {
    vi.mocked(queries.updateStorePageMeta).mockResolvedValue(pageDetail({ status: "draft" }) as any);
    const res = await app.request("/api/store-pages/sp_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "draft" }),
    });
    expect(res.status).toBe(200);
  });

  it("maps NotFoundError to 404", async () => {
    vi.mocked(queries.updateStorePageMeta).mockRejectedValue(new NotFoundError("Store Page", "sp_x"));
    const res = await app.request("/api/store-pages/sp_x", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "draft" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/store-pages/{id}", () => {
  it("returns 200 on success", async () => {
    vi.mocked(queries.deleteStorePage).mockResolvedValue(undefined);
    const res = await app.request("/api/store-pages/sp_1", { method: "DELETE" });
    expect(res.status).toBe(200);
  });

  it("maps the legal-kind guard to 422 STORE_PAGE_CANNOT_DELETE_LEGAL", async () => {
    vi.mocked(queries.deleteStorePage).mockRejectedValue(
      new BusinessLogicError(
        '"terms" is a legal page and cannot be deleted — unpublish it instead',
        ERROR_CODES.STORE_PAGE_CANNOT_DELETE_LEGAL,
        { id: "sp_1", kind: "terms" },
      ),
    );
    const res = await app.request("/api/store-pages/sp_1", { method: "DELETE" });
    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.code).toBe(ERROR_CODES.STORE_PAGE_CANNOT_DELETE_LEGAL);
  });
});

describe("PUT /api/store-pages/{id}/translations/{locale}", () => {
  const body = { title: "Refund Policy", bodyHtml: "<p>Body</p>" };

  it("returns 200 on success", async () => {
    vi.mocked(queries.saveTranslation).mockResolvedValue({
      pageId: "sp_1", locale: "en", title: "Refund Policy", bodyHtml: "<p>Body</p>",
      bodyPlain: "Body", metaTitle: null, metaDescription: null, source: "merchant", updatedAt: NOW,
    } as any);
    const res = await app.request("/api/store-pages/sp_1/translations/en", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(200);
    const responseBody: any = await res.json();
    expect(responseBody.data.source).toBe("merchant");
  });

  it("rejects an unsupported locale at the route level with 400, before the handler runs", async () => {
    const res = await app.request("/api/store-pages/sp_1/translations/de", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(400);
    expect(queries.saveTranslation).not.toHaveBeenCalled();
  });

  it("rejects an empty body with 400", async () => {
    const res = await app.request("/api/store-pages/sp_1/translations/en", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "", bodyHtml: "" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/store-pages/{id}/translations/{locale}/reset", () => {
  it("returns 200 on success", async () => {
    vi.mocked(queries.resetTranslationToTemplate).mockResolvedValue({
      pageId: "sp_1", locale: "ar", title: "الشروط والأحكام", bodyHtml: "<p>x</p>",
      bodyPlain: "x", metaTitle: null, metaDescription: null, source: "template", updatedAt: NOW,
    } as any);
    const res = await app.request("/api/store-pages/sp_1/translations/ar/reset", { method: "POST" });
    expect(res.status).toBe(200);
  });

  it("maps the custom-page guard to 422 STORE_PAGE_NOT_LEGAL", async () => {
    vi.mocked(queries.resetTranslationToTemplate).mockRejectedValue(
      new BusinessLogicError(
        "A custom page has no template to reset to",
        ERROR_CODES.STORE_PAGE_NOT_LEGAL,
        { id: "sp_2" },
      ),
    );
    const res = await app.request("/api/store-pages/sp_2/translations/ar/reset", { method: "POST" });
    expect(res.status).toBe(422);
    const body: any = await res.json();
    expect(body.code).toBe(ERROR_CODES.STORE_PAGE_NOT_LEGAL);
  });
});
