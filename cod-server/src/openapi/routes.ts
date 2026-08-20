import { Hono } from "hono";
import type { Context } from "hono";
import type { AppContext } from "@/types";
import { generateOpenAPISpec } from "./generator";
import {
  customerPaths,
  orderPaths,
  productPaths,
  driverPaths,
  userPaths,
  wilayaPaths,
  imagePaths,
  activityLogPaths,
  customerGroupPaths,
  customerTagPaths,
  productGroupPaths,
  shippingProfilePaths,
  driverPaymentPaths,
  deliveryCompanyPaths,
  storePaths,
  storeMgmtPaths,
  reviewPaths,
  stockPaths,
  webhookPaths,
  offerPaths,
  variantPaths,
} from "./paths";

const openapi = new Hono<AppContext>();

openapi.get("/openapi.json", (c: Context<AppContext>) => {
  const baseUrl = c.env.WORKER_URL ||
    c.req.header("X-Worker-URL") ||
    `https://${c.req.header("host")}`;

  const spec = generateOpenAPISpec(baseUrl);
  spec.paths = {
    ...orderPaths,
    ...customerPaths,
    ...productPaths,
    ...variantPaths,
    ...stockPaths,
    ...offerPaths,
    ...reviewPaths,
    ...deliveryCompanyPaths,
    ...shippingProfilePaths,
    ...driverPaths,
    ...driverPaymentPaths,
    ...customerGroupPaths,
    ...customerTagPaths,
    ...productGroupPaths,
    ...userPaths,
    ...storePaths,
    ...storeMgmtPaths,
    ...wilayaPaths,
    ...imagePaths,
    ...activityLogPaths,
    ...webhookPaths,
  };

  return c.json(spec);
});

export default openapi;
