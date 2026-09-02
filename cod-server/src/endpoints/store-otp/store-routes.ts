/**
 * Storefront OTP — public send/verify routes
 *
 * Mounted at /store (second-router precedent: abandoned-orders). Auth is the
 * global X-Store-API-Key middleware already applied to /store/*.
 *
 * POST /store/otp/send    { phone } → send a WhatsApp code
 * POST /store/otp/verify  { phone, requestId, code } → verify + mint token
 *
 * Fail-open contract (PLAN.md §5): quota exhaustion (402) or provider
 * outage (5xx/network) at SEND time returns { status: "unavailable",
 * bypassToken } — checkout proceeds unverified. Wrong codes, expiry, and
 * rate limits get NO bypass: that is the flow working correctly.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { defineRoute } from "@/lib/route-builder";
import * as handlers from "./handlers";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

const sendRoute = defineRoute({
  method: "post",
  path: "/otp/send",
  auth: "store",
  tags: ["Storefront"],
  summary: "Send a WhatsApp OTP to the customer's phone",
  description:
    "Sends a 6-digit code over WhatsApp via dzverify. Requires the store's OTP verification to be enabled. " +
    "When dzverify cannot serve the send (balance exhausted, provider down), returns status 'unavailable' with a " +
    "server-signed bypassToken — checkout proceeds unverified (fail-open; orders are never blocked by quota). " +
    "Rate limits return 429 with the wait window.",
  operationId: "sendStoreOtp",
  body: z.object({
    phone: z.string().min(6).max(20).openapi({ example: "0551234567", description: "Algerian mobile; normalized server-side to E.164" }),
  }),
  responses: {
    200: {
      description: "OTP sent (or unavailable with a bypass token)",
      content: jsonContent(
        z.object({
          success: z.boolean(),
          data: z.union([
            z.object({
              status: z.literal("sent"),
              requestId: z.string(),
              expiresAt: z.number().openapi({ description: "Unix milliseconds" }),
              maxAttempts: z.number(),
            }),
            z.object({
              status: z.literal("unavailable"),
              reason: z.string(),
              bypassToken: z.string(),
            }),
          ]),
        })
      ),
    },
    400: { description: "Phone cannot be normalized to E.164 (INVALID_PHONE_FORMAT)" },
    422: { description: "OTP verification not enabled for this store (OTP_NOT_ENABLED)" },
    429: { description: "Rate limited — retry after context.windowSeconds (OTP_RATE_LIMITED)" },
    502: { description: "dzverify rejected the request for a non-fail-open reason" },
  },
  handler: handlers.sendOtp,
});

const verifyRoute = defineRoute({
  method: "post",
  path: "/otp/verify",
  auth: "store",
  tags: ["Storefront"],
  summary: "Verify the WhatsApp OTP code",
  description:
    "Verifies the code the customer typed. On success returns a signed otpToken (15-min TTL, bound to the phone) " +
    "that the storefront submits with the order. Wrong-but-retryable codes return 422 with attemptsRemaining. " +
    "Terminal states (expired, attempts exhausted, already verified) return 409 — send a new OTP.",
  operationId: "verifyStoreOtp",
  body: z.object({
    phone: z.string().min(6).max(20),
    requestId: z.string().min(1).max(64),
    code: z.string().regex(/^\d{6}$/),
  }),
  responses: {
    200: {
      description: "Verified — otpToken returned",
      content: jsonContent(
        z.object({
          success: z.boolean(),
          data: z.object({
            status: z.literal("verified"),
            otpToken: z.string(),
          }),
        })
      ),
    },
    400: { description: "Phone cannot be normalized to E.164 (INVALID_PHONE_FORMAT)" },
    422: { description: "Wrong code, retryable — context.attemptsRemaining" },
    409: { description: "Terminal: expired / failed / already verified — send a new OTP" },
    404: { description: "Unknown requestId" },
    502: { description: "dzverify transport failure" },
  },
  handler: handlers.verifyOtp,
});

const router = new OpenAPIHono<AppContext>();

router.openapi(sendRoute.route, sendRoute.handler);
router.openapi(verifyRoute.route, verifyRoute.handler);

export default router;
