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
import productGroupsRouter from "@/endpoints/product-groups/routes";
import customersRouter from "@/endpoints/customers/routes";
import shippingProfilesRouter from "@/endpoints/shipping-profiles/routes";
import driversRouter from "@/endpoints/drivers/routes";
import usersRouter from "@/endpoints/users/routes";
import storesRouter from "@/endpoints/stores/routes";
import productsRouter from "@/endpoints/products/routes";
import { stockRouter, productStockRouter } from "@/endpoints/stock/routes";
import offersRouter from "@/endpoints/offers/routes";
import driverPaymentsRouter from "@/endpoints/driver-payments/routes";
import { uploadRouter } from "@/endpoints/images/routes";

function buildApp() {
  const app = new OpenAPIHono<AppContext>();
  registerSpecEndpoint(app);
  app.route("/api/wilayas", wilayasRouter);
  app.route("/api/activity-logs", activityLogsRouter);
  app.route("/api/delivery-companies", deliveryCompaniesRouter);
  app.route("/api/reviews", reviewsRouter);
  app.route("/api/customer-groups", customerGroupsRouter);
  app.route("/api/customer-tags", customerTagsRouter);
  app.route("/api/product-groups", productGroupsRouter);
  app.route("/api/customers", customersRouter);
  app.route("/api/shipping-profiles", shippingProfilesRouter);
  app.route("/api/drivers", driversRouter);
  app.route("/api/users", usersRouter);
  app.route("/api/stores", storesRouter);
  app.route("/api/products", productsRouter);
  app.route("/api/stock", stockRouter);
  app.route("/api/products", productStockRouter);
  app.route("/api/offers", offersRouter);
  app.route("/api/driver-payments", driverPaymentsRouter);
  app.route("/api/images", uploadRouter);
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

  it("documents the migrated product-groups endpoints from Zod schemas", async () => {
    const app = buildApp();
    const res = await app.request("/api/openapi.json", {}, { WORKER_URL: "https://x" } as any);
    const spec: any = await res.json();

    const list = spec.paths["/api/product-groups"]?.get;
    expect(list).toBeDefined();
    expect(list.summary).toBe("List product groups");
    expect(list.tags).toEqual(["Product Groups"]);
    expect(list.operationId).toBe("listProductGroups");
    expect(list.security).toEqual([{ ApiKeyAuth: [] }]);

    const create = spec.paths["/api/product-groups"]?.post;
    expect(create).toBeDefined();
    expect(create.summary).toBe("Create product group");
    expect(create.operationId).toBe("createProductGroup");

    const get = spec.paths["/api/product-groups/{id}"]?.get;
    expect(get).toBeDefined();
    expect(get.summary).toBe("Get product group");
    expect(get.operationId).toBe("getProductGroup");

    const update = spec.paths["/api/product-groups/{id}"]?.patch;
    expect(update).toBeDefined();
    expect(update.summary).toBe("Update product group");
    expect(update.operationId).toBe("updateProductGroup");

    const del = spec.paths["/api/product-groups/{id}"]?.delete;
    expect(del).toBeDefined();
    expect(del.summary).toBe("Delete product group");
    expect(del.operationId).toBe("deleteProductGroup");

    expect(spec.components.schemas.ProductCategory).toBeDefined();
    expect(spec.components.schemas.ProductCategory.properties.productsCount).toBeDefined();
  });

  it("documents the migrated customers endpoints from Zod schemas", async () => {
    const app = buildApp();
    const res = await app.request("/api/openapi.json", {}, { WORKER_URL: "https://x" } as any);
    const spec: any = await res.json();

    const list = spec.paths["/api/customers"]?.get;
    expect(list).toBeDefined();
    expect(list.summary).toBe("List customers");
    expect(list.tags).toEqual(["Customers"]);
    expect(list.operationId).toBe("listCustomers");
    expect(list.security).toEqual([{ ApiKeyAuth: [] }]);
    const paramNames = list.parameters.map((p: any) => p.name);
    for (const name of ["wilayaId", "search", "groupId", "tagId", "limit", "offset"]) {
      expect(paramNames).toContain(name);
    }

    const create = spec.paths["/api/customers"]?.post;
    expect(create).toBeDefined();
    expect(create.summary).toBe("Create customer");
    expect(create.operationId).toBe("createCustomer");

    const get = spec.paths["/api/customers/{id}"]?.get;
    expect(get).toBeDefined();
    expect(get.summary).toBe("Get customer");
    expect(get.operationId).toBe("getCustomer");

    const update = spec.paths["/api/customers/{id}"]?.patch;
    expect(update).toBeDefined();
    expect(update.summary).toBe("Update customer");
    expect(update.operationId).toBe("updateCustomer");

    const del = spec.paths["/api/customers/{id}"]?.delete;
    expect(del).toBeDefined();
    expect(del.summary).toBe("Delete customer");
    expect(del.operationId).toBe("deleteCustomer");

    const orders = spec.paths["/api/customers/{id}/orders"]?.get;
    expect(orders).toBeDefined();
    expect(orders.operationId).toBe("getCustomerOrders");

    const groups = spec.paths["/api/customers/{id}/groups"]?.get;
    expect(groups).toBeDefined();
    expect(groups.operationId).toBe("getCustomerGroups");

    const tags = spec.paths["/api/customers/{id}/tags"]?.get;
    expect(tags).toBeDefined();
    expect(tags.operationId).toBe("getCustomerTags");

    expect(spec.components.schemas.Customer).toBeDefined();
    expect(spec.components.schemas.Customer.properties.recentOrders).toBeDefined();
    expect(spec.components.schemas.CustomerOrderSummary).toBeDefined();
    expect(spec.components.schemas.CustomerGroupMembership).toBeDefined();
    expect(spec.components.schemas.CustomerTagMembership).toBeDefined();
  });

  it("documents the migrated shipping-profiles endpoints from Zod schemas", async () => {
    const app = buildApp();
    const res = await app.request("/api/openapi.json", {}, { WORKER_URL: "https://x" } as any);
    const spec: any = await res.json();

    const list = spec.paths["/api/shipping-profiles"]?.get;
    expect(list).toBeDefined();
    expect(list.summary).toBe("List shipping profiles");
    expect(list.tags).toEqual(["Shipping Profiles"]);
    expect(list.operationId).toBe("listShippingProfiles");
    expect(list.security).toEqual([{ ApiKeyAuth: [] }]);

    const create = spec.paths["/api/shipping-profiles"]?.post;
    expect(create).toBeDefined();
    expect(create.summary).toBe("Create shipping profile");
    expect(create.operationId).toBe("createShippingProfile");

    const defaultRules = spec.paths["/api/shipping-profiles/default/rules"]?.get;
    expect(defaultRules).toBeDefined();
    expect(defaultRules.operationId).toBe("getDefaultRules");

    const get = spec.paths["/api/shipping-profiles/{id}"]?.get;
    expect(get).toBeDefined();
    expect(get.summary).toBe("Get shipping profile");
    expect(get.operationId).toBe("getShippingProfile");

    const update = spec.paths["/api/shipping-profiles/{id}"]?.patch;
    expect(update).toBeDefined();
    expect(update.summary).toBe("Update shipping profile");
    expect(update.operationId).toBe("updateShippingProfile");

    const del = spec.paths["/api/shipping-profiles/{id}"]?.delete;
    expect(del).toBeDefined();
    expect(del.summary).toBe("Delete shipping profile");
    expect(del.operationId).toBe("deleteShippingProfile");

    const setRules = spec.paths["/api/shipping-profiles/{id}/rules"]?.put;
    expect(setRules).toBeDefined();
    expect(setRules.summary).toBe("Replace wilaya rules");
    expect(setRules.operationId).toBe("setProfileRules");

    const communes = spec.paths["/api/shipping-profiles/{id}/rules/{wilayaId}/communes"]?.get;
    expect(communes).toBeDefined();
    expect(communes.summary).toBe("List commune overrides");
    expect(communes.operationId).toBe("listCommuneOverrides");

    const setOverride =
      spec.paths["/api/shipping-profiles/{id}/rules/{wilayaId}/communes/{communeId}"]?.put;
    expect(setOverride).toBeDefined();
    expect(setOverride.summary).toBe("Set or update commune override");
    expect(setOverride.operationId).toBe("setCommuneOverride");

    const delOverride =
      spec.paths["/api/shipping-profiles/{id}/rules/{wilayaId}/communes/{communeId}"]?.delete;
    expect(delOverride).toBeDefined();
    expect(delOverride.summary).toBe("Remove commune override");
    expect(delOverride.operationId).toBe("deleteCommuneOverride");

    expect(spec.components.schemas.ShippingProfile).toBeDefined();
    expect(spec.components.schemas.ShippingProfile.properties.ruleCount).toBeDefined();
    expect(spec.components.schemas.ShippingProfileWithRules).toBeDefined();
    expect(spec.components.schemas.ShippingRule).toBeDefined();
    expect(spec.components.schemas.CommuneOverride).toBeDefined();
  });

  it("documents the migrated drivers endpoints from Zod schemas", async () => {
    const app = buildApp();
    const res = await app.request("/api/openapi.json", {}, { WORKER_URL: "https://x" } as any);
    const spec: any = await res.json();

    const list = spec.paths["/api/drivers"]?.get;
    expect(list).toBeDefined();
    expect(list.summary).toBe("List drivers");
    expect(list.tags).toEqual(["Drivers"]);
    expect(list.operationId).toBe("listDrivers");
    expect(list.security).toEqual([{ ApiKeyAuth: [] }]);
    const paramNames = list.parameters.map((p: any) => p.name);
    for (const name of ["wilayaId", "status", "vehicleType", "search", "limit", "offset"]) {
      expect(paramNames).toContain(name);
    }

    const create = spec.paths["/api/drivers"]?.post;
    expect(create).toBeDefined();
    expect(create.summary).toBe("Create driver");
    expect(create.operationId).toBe("createDriver");

    const get = spec.paths["/api/drivers/{id}"]?.get;
    expect(get).toBeDefined();
    expect(get.summary).toBe("Get driver");
    expect(get.operationId).toBe("getDriver");

    const update = spec.paths["/api/drivers/{id}"]?.patch;
    expect(update).toBeDefined();
    expect(update.summary).toBe("Update driver");
    expect(update.operationId).toBe("updateDriver");

    const del = spec.paths["/api/drivers/{id}"]?.delete;
    expect(del).toBeDefined();
    expect(del.summary).toBe("Delete driver");
    expect(del.operationId).toBe("deleteDriver");

    const status = spec.paths["/api/drivers/{id}/status"]?.patch;
    expect(status).toBeDefined();
    expect(status.summary).toBe("Update driver status");
    expect(status.operationId).toBe("updateDriverStatus");

    const comps = spec.paths["/api/drivers/{id}/compensations"]?.get;
    expect(comps).toBeDefined();
    expect(comps.summary).toBe("List driver compensations");
    expect(comps.operationId).toBe("listDriverCompensations");

    const setComp = spec.paths["/api/drivers/{id}/compensations/{wilayaId}"]?.put;
    expect(setComp).toBeDefined();
    expect(setComp.summary).toBe("Upsert driver compensation for one wilaya");
    expect(setComp.operationId).toBe("setDriverCompensation");

    const delComp = spec.paths["/api/drivers/{id}/compensations/{wilayaId}"]?.delete;
    expect(delComp).toBeDefined();
    expect(delComp.summary).toBe("Remove driver compensation for one wilaya");
    expect(delComp.operationId).toBe("deleteDriverCompensation");

    expect(spec.components.schemas.Driver).toBeDefined();
    expect(spec.components.schemas.Driver.properties.compensationWilayaCount).toBeDefined();
    expect(spec.components.schemas.DriverCompensationRow).toBeDefined();
  });

  it("documents the migrated users endpoints from Zod schemas", async () => {
    const app = buildApp();
    const res = await app.request("/api/openapi.json", {}, { WORKER_URL: "https://x" } as any);
    const spec: any = await res.json();

    const list = spec.paths["/api/users"]?.get;
    expect(list).toBeDefined();
    expect(list.summary).toBe("List users");
    expect(list.tags).toEqual(["Users"]);
    expect(list.operationId).toBe("listUsers");
    expect(list.security).toEqual([{ ApiKeyAuth: [] }]);
    const paramNames = list.parameters.map((p: any) => p.name);
    for (const name of ["role", "status", "search", "limit", "offset"]) {
      expect(paramNames).toContain(name);
    }

    const create = spec.paths["/api/users"]?.post;
    expect(create).toBeDefined();
    expect(create.summary).toBe("Create user");
    expect(create.operationId).toBe("createUser");

    const get = spec.paths["/api/users/{id}"]?.get;
    expect(get).toBeDefined();
    expect(get.summary).toBe("Get user");
    expect(get.operationId).toBe("getUser");

    const update = spec.paths["/api/users/{id}"]?.patch;
    expect(update).toBeDefined();
    expect(update.summary).toBe("Update user");
    expect(update.operationId).toBe("updateUser");

    const role = spec.paths["/api/users/{id}/role"]?.patch;
    expect(role).toBeDefined();
    expect(role.summary).toBe("Update user role");
    expect(role.operationId).toBe("updateUserRole");

    const grantScope = spec.paths["/api/users/{id}/scopes"]?.post;
    expect(grantScope).toBeDefined();
    expect(grantScope.summary).toBe("Grant scope to user");
    expect(grantScope.operationId).toBe("grantScope");

    const revokeScope = spec.paths["/api/users/{id}/scopes/{scope}"]?.delete;
    expect(revokeScope).toBeDefined();
    expect(revokeScope.summary).toBe("Revoke scope from user");
    expect(revokeScope.operationId).toBe("revokeScope");

    const rotate = spec.paths["/api/users/{id}/api-key/rotate"]?.post;
    expect(rotate).toBeDefined();
    expect(rotate.summary).toBe("Rotate API key");
    expect(rotate.operationId).toBe("rotateApiKey");

    expect(spec.components.schemas.User).toBeDefined();
    expect(spec.components.schemas.User.properties.scopes).toBeDefined();
  });

  it("documents the migrated stores endpoints from Zod schemas", async () => {
    const app = buildApp();
    const res = await app.request("/api/openapi.json", {}, { WORKER_URL: "https://x" } as any);
    const spec: any = await res.json();

    const getMe = spec.paths["/api/stores/me"]?.get;
    expect(getMe).toBeDefined();
    expect(getMe.summary).toBe("Get store configuration");
    expect(getMe.tags).toEqual(["Store Settings"]);
    expect(getMe.operationId).toBe("getMyStore");
    expect(getMe.security).toEqual([{ ApiKeyAuth: [] }]);

    const updateMe = spec.paths["/api/stores/me"]?.patch;
    expect(updateMe).toBeDefined();
    expect(updateMe.summary).toBe("Update store configuration");
    expect(updateMe.operationId).toBe("updateMyStore");

    const getPixel = spec.paths["/api/stores/pixel-config"]?.get;
    expect(getPixel).toBeDefined();
    expect(getPixel.summary).toBe("Get pixel configuration");
    expect(getPixel.operationId).toBe("getPixelConfig");

    const savePixel = spec.paths["/api/stores/pixel-config"]?.post;
    expect(savePixel).toBeDefined();
    expect(savePixel.summary).toBe("Save pixel configuration");
    expect(savePixel.operationId).toBe("savePixelConfig");

    expect(spec.components.schemas.Store).toBeDefined();
    expect(spec.components.schemas.Store.properties.storeApiKey).toBeDefined();
    expect(spec.components.schemas.StorePixelConfig).toBeDefined();
  });

  it("documents the migrated products endpoints from Zod schemas", async () => {
    const app = buildApp();
    const res = await app.request("/api/openapi.json", {}, { WORKER_URL: "https://x" } as any);
    const spec: any = await res.json();

    const list = spec.paths["/api/products"]?.get;
    expect(list).toBeDefined();
    expect(list.summary).toBe("List products");
    expect(list.tags).toEqual(["Products"]);
    expect(list.operationId).toBe("listProducts");
    expect(list.security).toEqual([{ ApiKeyAuth: [] }]);

    const create = spec.paths["/api/products"]?.post;
    expect(create).toBeDefined();
    expect(create.operationId).toBe("createProduct");

    const get = spec.paths["/api/products/{id}"]?.get;
    expect(get).toBeDefined();
    expect(get.operationId).toBe("getProduct");
    expect(spec.paths["/api/products/{id}"]?.patch?.operationId).toBe("updateProduct");
    expect(spec.paths["/api/products/{id}"]?.delete?.operationId).toBe("deleteProduct");
    expect(spec.paths["/api/products/{id}/status"]?.patch?.operationId).toBe("updateProductStatus");

    expect(spec.paths["/api/products/{id}/images"]?.get?.operationId).toBe("listProductImages");
    expect(spec.paths["/api/products/{id}/images"]?.post?.operationId).toBe("saveProductImage");
    expect(spec.paths["/api/products/{id}/images/reorder"]?.patch?.operationId).toBe("reorderProductImages");
    expect(spec.paths["/api/products/{id}/images/{imageId}"]?.delete?.operationId).toBe("deleteProductImage");

    expect(spec.paths["/api/products/{productId}/variants"]?.get?.operationId).toBe("listVariants");
    expect(spec.paths["/api/products/{productId}/variants"]?.post?.operationId).toBe("createVariant");
    expect(spec.paths["/api/products/{productId}/variants/{variantId}"]?.get?.operationId).toBe("getVariant");
    expect(spec.paths["/api/products/{productId}/variants/{variantId}"]?.patch?.operationId).toBe("updateVariant");
    expect(spec.paths["/api/products/{productId}/variants/{variantId}"]?.delete?.operationId).toBe("deleteVariant");

    expect(spec.components.schemas.Product).toBeDefined();
    expect(spec.components.schemas.ProductImage).toBeDefined();
    expect(spec.components.schemas.ProductVariant).toBeDefined();
  });

  it("documents the migrated stock endpoints from Zod schemas", async () => {
    const app = buildApp();
    const res = await app.request("/api/openapi.json", {}, { WORKER_URL: "https://x" } as any);
    const spec: any = await res.json();

    const overview = spec.paths["/api/stock/overview"]?.get;
    expect(overview).toBeDefined();
    expect(overview.summary).toBe("Stock overview");
    expect(overview.tags).toEqual(["Stock"]);
    expect(overview.operationId).toBe("getStockOverview");
    expect(overview.security).toEqual([{ ApiKeyAuth: [] }]);

    const alerts = spec.paths["/api/stock/alerts"]?.get;
    expect(alerts).toBeDefined();
    expect(alerts.operationId).toBe("getStockAlerts");

    expect(spec.paths["/api/products/{id}/stock/adjust"]?.post?.operationId).toBe("adjustProductStock");
    expect(spec.paths["/api/products/{id}/stock/history"]?.get?.operationId).toBe("getProductStockHistory");
    expect(spec.paths["/api/products/{id}/stock/threshold"]?.patch?.operationId).toBe("updateProductThreshold");
    expect(spec.paths["/api/products/{productId}/variants/{variantId}/stock/adjust"]?.post?.operationId).toBe("adjustVariantStock");
    expect(spec.paths["/api/products/{productId}/variants/{variantId}/stock/threshold"]?.patch?.operationId).toBe("updateVariantThreshold");

    expect(spec.components.schemas.StockMovement).toBeDefined();
    expect(spec.components.schemas.StockAlertItem).toBeDefined();
    expect(spec.components.schemas.StockOverview).toBeDefined();
  });

  it("documents the migrated offers endpoints from Zod schemas", async () => {
    const app = buildApp();
    const res = await app.request("/api/openapi.json", {}, { WORKER_URL: "https://x" } as any);
    const spec: any = await res.json();

    const list = spec.paths["/api/offers"]?.get;
    expect(list).toBeDefined();
    expect(list.summary).toBe("List offers");
    expect(list.tags).toEqual(["Offers"]);
    expect(list.operationId).toBe("listOffers");
    expect(list.security).toEqual([{ ApiKeyAuth: [] }]);

    expect(spec.paths["/api/offers"]?.post?.operationId).toBe("createOffer");
    expect(spec.paths["/api/offers/{id}"]?.get?.operationId).toBe("getOffer");
    expect(spec.paths["/api/offers/{id}"]?.patch?.operationId).toBe("updateOffer");
    expect(spec.paths["/api/offers/{id}"]?.delete?.operationId).toBe("deleteOffer");

    const offer = spec.components.schemas.Offer;
    expect(offer).toBeDefined();
    expect(offer.properties.triggerProduct).toBeDefined();
    expect(offer.properties.rewardVariant).toBeDefined();
  });

  it("documents the migrated driver-payments endpoints from Zod schemas", async () => {
    const app = buildApp();
    const res = await app.request("/api/openapi.json", {}, { WORKER_URL: "https://x" } as any);
    const spec: any = await res.json();

    const create = spec.paths["/api/driver-payments"]?.post;
    expect(create).toBeDefined();
    expect(create.summary).toBe("Create driver payment");
    expect(create.tags).toEqual(["Driver Payments"]);
    expect(create.operationId).toBe("createDriverPayment");
    expect(create.security).toEqual([{ ApiKeyAuth: [] }]);

    expect(spec.paths["/api/driver-payments/{driverId}"]?.get?.operationId).toBe("listDriverPayments");
    expect(spec.paths["/api/driver-payments/{driverId}/pending"]?.get?.operationId).toBe("listPendingSettlementOrders");

    const payment = spec.components.schemas.DriverPayment;
    expect(payment).toBeDefined();
    expect(payment.properties.amount).toBeDefined();
    expect(payment.properties.orderCount).toBeDefined();

    expect(create.requestBody.content["application/json"].schema.required)
      .toEqual(expect.arrayContaining(["driverId", "type", "orderIds"]));
  });

  it("documents the migrated images upload/presign endpoints from Zod schemas", async () => {
    const app = buildApp();
    const res = await app.request("/api/openapi.json", {}, { WORKER_URL: "https://x" } as any);
    const spec: any = await res.json();

    const upload = spec.paths["/api/images/upload"]?.post;
    expect(upload).toBeDefined();
    expect(upload.summary).toBe("Upload image");
    expect(upload.tags).toEqual(["Images"]);
    expect(upload.operationId).toBe("uploadImage");
    expect(upload.security).toEqual([{ ApiKeyAuth: [] }]);
    expect(
      upload.requestBody.content["multipart/form-data"].schema.properties.file
    ).toBeDefined();

    const presign = spec.paths["/api/images/presign"]?.post;
    expect(presign).toBeDefined();
    expect(presign.operationId).toBe("presignUpload");

    expect(spec.components.schemas.UploadedImage).toBeDefined();
    expect(spec.components.schemas.PresignedUpload).toBeDefined();
  });

  it("still documents un-migrated endpoints from the legacy spec", async () => {
    const app = buildApp();
    const res = await app.request("/api/openapi.json", {}, { WORKER_URL: "https://x" } as any);
    const spec: any = await res.json();

    expect(spec.paths["/api/orders"]).toBeDefined();
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
