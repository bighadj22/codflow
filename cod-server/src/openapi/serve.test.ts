/**
 * Tests for the merged OpenAPI spec endpoint.
 *
 * During the migration `/api/openapi.json` serves legacy hand-written
 * paths plus auto-generated paths for migrated endpoints. These tests
 * pin the merge invariants:
 *   - migrated endpoints are documented from their Zod schemas
 *   - un-migrated endpoints keep their legacy documentation
 *   - generated components fix the legacy dangling ErrorResponse $ref
 */

import { describe, it, expect } from "vitest";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { registerSpecEndpoint } from "./serve";
import wilayasRouter from "@/endpoints/wilayas/routes";
import activityLogsRouter from "@/endpoints/activity-logs/routes";
import deliveryCompaniesRouter from "@/endpoints/delivery-companies/routes";
import reviewsRouter from "@/endpoints/reviews/routes";
import customerGroupsRouter from "@/endpoints/customer-groups/routes";
import customerTagsRouter from "@/endpoints/customer-tags/routes";

function buildApp() {
  const app = new OpenAPIHono<AppContext>();
  registerSpecEndpoint(app);
  app.route("/api/wilayas", wilayasRouter);
  app.route("/api/activity-logs", activityLogsRouter);
  app.route("/api/delivery-companies", deliveryCompaniesRouter);
  app.route("/api/reviews", reviewsRouter);
  app.route("/api/customer-groups", customerGroupsRouter);
  app.route("/api/customer-tags", customerTagsRouter);
  return app;
}

describe("GET /api/openapi.json (merged spec)", () => {
  it("returns 200 with a JSON document", async () => {
    const app = buildApp();
    const res = await app.request("/api/openapi.json", {}, { WORKER_URL: "https://api.example.com" } as any);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const spec: any = await res.json();
    expect(spec.openapi).toBe("3.1.0");
  });

  it("uses WORKER_URL as the server URL", async () => {
    const app = buildApp();
    const res = await app.request("/api/openapi.json", {}, { WORKER_URL: "https://api.example.com" } as any);

    const spec: any = await res.json();
    expect(spec.servers[0].url).toBe("https://api.example.com");
  });

  it("documents the migrated wilayas endpoints from Zod schemas", async () => {
    const app = buildApp();
    const res = await app.request("/api/openapi.json", {}, { WORKER_URL: "https://x" } as any);
    const spec: any = await res.json();

    const list = spec.paths["/api/wilayas"]?.get;
    expect(list).toBeDefined();
    expect(list.tags).toEqual(["Wilayas"]);
    expect(list.operationId).toBe("listWilayas");
    expect(list.parameters).toHaveLength(1);
    expect(list.parameters[0].name).toBe("search");
    expect(list.parameters[0].in).toBe("query");
    expect(list.parameters[0].required).toBe(false);
    expect(list.security).toEqual([{ ApiKeyAuth: [] }]);

    const communes = spec.paths["/api/wilayas/{id}/communes"]?.get;
    expect(communes).toBeDefined();
    expect(communes.operationId).toBe("listCommunes");
    expect(communes.parameters).toHaveLength(1);
    expect(communes.parameters[0].name).toBe("id");
    expect(communes.parameters[0].in).toBe("path");
    expect(communes.parameters[0].required).toBe(true);
    expect(communes.parameters[0].schema.type).toBe("integer");
    expect(communes.parameters[0].schema.minimum).toBe(1);
    expect(communes.parameters[0].schema.maximum).toBe(58);
  });

  it("documents the migrated activity-logs endpoints from Zod schemas", async () => {
    const app = buildApp();
    const res = await app.request("/api/openapi.json", {}, { WORKER_URL: "https://x" } as any);
    const spec: any = await res.json();

    const listLogs = spec.paths["/api/activity-logs"]?.get;
    expect(listLogs).toBeDefined();
    expect(listLogs.tags).toEqual(["Activity Logs"]);
    expect(listLogs.operationId).toBe("listActivityLogs");
    expect(listLogs.summary).toBe("List activity logs");
    expect(listLogs.security).toEqual([{ ApiKeyAuth: [] }]);

    const userLogs = spec.paths["/api/activity-logs/users/{userId}"]?.get;
    expect(userLogs).toBeDefined();
    expect(userLogs.operationId).toBe("getUserActivityLogs");
    expect(userLogs.summary).toBe("Get user activity logs");
  });

  it("documents the migrated delivery-companies endpoints from Zod schemas", async () => {
    const app = buildApp();
    const res = await app.request("/api/openapi.json", {}, { WORKER_URL: "https://x" } as any);
    const spec: any = await res.json();

    // List endpoint
    const list = spec.paths["/api/delivery-companies"]?.get;
    expect(list).toBeDefined();
    expect(list.summary).toBe("List delivery companies");
    expect(list.parameters).toBeDefined();
    expect(list.parameters.find((p: any) => p.name === "active")).toBeDefined();
    expect(list.security).toEqual([{ ApiKeyAuth: [] }]);

    // Get by ID endpoint
    const get = spec.paths["/api/delivery-companies/{id}"]?.get;
    expect(get).toBeDefined();
    expect(get.summary).toBe("Get delivery company");
    expect(get.parameters[0].name).toBe("id");
    expect(get.parameters[0].in).toBe("path");

    // Stop desks endpoint
    const stopDesks = spec.paths["/api/delivery-companies/{id}/stop-desks"]?.get;
    expect(stopDesks).toBeDefined();
    expect(stopDesks.summary).toBe("Get company stop desks");

    // Webhook endpoints
    const registerWebhook = spec.paths["/api/delivery-companies/{id}/webhook/register"]?.post;
    expect(registerWebhook).toBeDefined();
    expect(registerWebhook.summary).toBe("Register ZR Express webhook");

    // Schemas
    expect(spec.components.schemas.DeliveryCompany).toBeDefined();
    expect(spec.components.schemas.DeliveryCompany.properties.name).toBeDefined();
    expect(spec.components.schemas.DeliveryCompany.properties.isConnected).toBeDefined();
    expect(spec.components.schemas.StopDesk).toBeDefined();
    expect(spec.components.schemas.StopDesk.properties.code).toBeDefined();
  });

  it("documents the migrated reviews endpoints from Zod schemas", async () => {
    const app = buildApp();
    const res = await app.request("/api/openapi.json", {}, { WORKER_URL: "https://x" } as any);
    const spec: any = await res.json();

    const list = spec.paths["/api/reviews"]?.get;
    expect(list).toBeDefined();
    expect(list.summary).toBe("List reviews");
    expect(list.tags).toEqual(["Reviews"]);
    expect(list.operationId).toBe("listReviews");
    expect(list.security).toEqual([{ ApiKeyAuth: [] }]);

    const update = spec.paths["/api/reviews/{id}"]?.patch;
    expect(update).toBeDefined();
    expect(update.summary).toBe("Update review status");
    expect(update.operationId).toBe("updateReview");

    const del = spec.paths["/api/reviews/{id}"]?.delete;
    expect(del).toBeDefined();
    expect(del.summary).toBe("Delete review");
    expect(del.operationId).toBe("deleteReview");

    expect(spec.components.schemas.Review).toBeDefined();
    expect(spec.components.schemas.Review.properties.customerName).toBeDefined();
    expect(spec.components.schemas.Review.properties.rating).toBeDefined();
  });

  it("documents the migrated customer-groups endpoints from Zod schemas", async () => {
    const app = buildApp();
    const res = await app.request("/api/openapi.json", {}, { WORKER_URL: "https://x" } as any);
    const spec: any = await res.json();

    const list = spec.paths["/api/customer-groups"]?.get;
    expect(list).toBeDefined();
    expect(list.summary).toBe("List customer groups");
    expect(list.tags).toEqual(["Customer Groups"]);
    expect(list.operationId).toBe("listCustomerGroups");
    expect(list.security).toEqual([{ ApiKeyAuth: [] }]);

    const create = spec.paths["/api/customer-groups"]?.post;
    expect(create).toBeDefined();
    expect(create.summary).toBe("Create customer group");
    expect(create.operationId).toBe("createCustomerGroup");

    const get = spec.paths["/api/customer-groups/{id}"]?.get;
    expect(get).toBeDefined();
    expect(get.summary).toBe("Get customer group");
    expect(get.operationId).toBe("getCustomerGroup");

    const update = spec.paths["/api/customer-groups/{id}"]?.patch;
    expect(update).toBeDefined();
    expect(update.summary).toBe("Update customer group");
    expect(update.operationId).toBe("updateCustomerGroup");

    const del = spec.paths["/api/customer-groups/{id}"]?.delete;
    expect(del).toBeDefined();
    expect(del.summary).toBe("Delete customer group");
    expect(del.operationId).toBe("deleteCustomerGroup");

    const addMem = spec.paths["/api/customer-groups/{id}/members"]?.post;
    expect(addMem).toBeDefined();
    expect(addMem.summary).toBe("Add member to group");
    expect(addMem.operationId).toBe("addMember");

    const remMem = spec.paths["/api/customer-groups/{id}/members/{customerId}"]?.delete;
    expect(remMem).toBeDefined();
    expect(remMem.summary).toBe("Remove member from group");
    expect(remMem.operationId).toBe("removeMember");

    expect(spec.components.schemas.CustomerGroup).toBeDefined();
    expect(spec.components.schemas.CustomerGroup.properties.name).toBeDefined();
    expect(spec.components.schemas.CustomerGroupMember).toBeDefined();
  });

  it("documents the migrated customer-tags endpoints from Zod schemas", async () => {
    const app = buildApp();
    const res = await app.request("/api/openapi.json", {}, { WORKER_URL: "https://x" } as any);
    const spec: any = await res.json();

    const list = spec.paths["/api/customer-tags"]?.get;
    expect(list).toBeDefined();
    expect(list.summary).toBe("List customer tags");
    expect(list.tags).toEqual(["Customer Tags"]);
    expect(list.operationId).toBe("listCustomerTags");
    expect(list.security).toEqual([{ ApiKeyAuth: [] }]);

    const create = spec.paths["/api/customer-tags"]?.post;
    expect(create).toBeDefined();
    expect(create.summary).toBe("Create customer tag");
    expect(create.operationId).toBe("createCustomerTag");

    const get = spec.paths["/api/customer-tags/{id}"]?.get;
    expect(get).toBeDefined();
    expect(get.summary).toBe("Get customer tag");
    expect(get.operationId).toBe("getCustomerTag");

    const update = spec.paths["/api/customer-tags/{id}"]?.patch;
    expect(update).toBeDefined();
    expect(update.summary).toBe("Update customer tag");
    expect(update.operationId).toBe("updateCustomerTag");

    const del = spec.paths["/api/customer-tags/{id}"]?.delete;
    expect(del).toBeDefined();
    expect(del.summary).toBe("Delete customer tag");
    expect(del.operationId).toBe("deleteCustomerTag");

    const assign = spec.paths["/api/customer-tags/{id}/assignments"]?.post;
    expect(assign).toBeDefined();
    expect(assign.summary).toBe("Assign tag to customer");
    expect(assign.operationId).toBe("assignTag");

    const unassign = spec.paths["/api/customer-tags/{id}/assignments/{customerId}"]?.delete;
    expect(unassign).toBeDefined();
    expect(unassign.summary).toBe("Unassign tag from customer");
    expect(unassign.operationId).toBe("unassignTag");

    expect(spec.components.schemas.CustomerTag).toBeDefined();
    expect(spec.components.schemas.CustomerTag.properties.name).toBeDefined();
    expect(spec.components.schemas.CustomerTagCustomer).toBeDefined();
  });

  it("still documents un-migrated endpoints from the legacy spec", async () => {
    const app = buildApp();
    const res = await app.request("/api/openapi.json", {}, { WORKER_URL: "https://x" } as any);
    const spec: any = await res.json();

    expect(spec.paths["/api/orders"]).toBeDefined();
    expect(spec.paths["/api/customers"]).toBeDefined();
    expect(spec.paths["/store/products"]).toBeDefined();
  });

  it("merges generated components and resolves the legacy ErrorResponse ref", async () => {
    const app = buildApp();
    const res = await app.request("/api/openapi.json", {}, { WORKER_URL: "https://x" } as any);
    const spec: any = await res.json();

    expect(spec.components.schemas.ErrorResponse).toBeDefined();
    expect(spec.components.schemas.ErrorResponse.properties.error.type).toBe("string");
    expect(spec.components.schemas.Wilaya).toBeDefined();
    expect(spec.components.schemas.Wilaya.properties.nameAr.type).toBe("string");
    expect(spec.components.schemas.Commune).toBeDefined();

    // Legacy path items reference #/components/schemas/ErrorResponse, which
    // never existed in the hand-written generator — the generated component
    // now makes those refs resolvable.
    expect(spec.components.securitySchemes.ApiKeyAuth).toMatchObject({
      type: "apiKey",
      in: "header",
      name: "X-API-Key",
    });
    expect(spec.components.securitySchemes.StoreAuth).toMatchObject({
      type: "apiKey",
      in: "header",
      name: "X-Store-API-Key",
    });
  });
});

describe("GET /api/docs (Swagger UI)", () => {
  it("serves an HTML page pointing at the spec", async () => {
    const app = buildApp();
    const res = await app.request("/api/docs");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("swagger-ui-bundle.js");
    expect(html).toContain('url: "/api/openapi.json"');
  });
});
