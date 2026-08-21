/**
 * Tests for the OpenAPIHono default validation hook.
 *
 * Framework-level validation failures must be indistinguishable from
 * handler-level ZodError throws: same envelope, same 400 status.
 */

import { describe, it, expect } from "vitest";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppContext } from "@/types";
import { openApiValidationHook } from "./validation-hook";
import { ERROR_CODES, ERROR_CATEGORIES } from "../../../cod-shared/errors/codes";

function buildApp() {
  const app = new OpenAPIHono<AppContext>({ defaultHook: openApiValidationHook });
  const route = createRoute({
    method: "get",
    path: "/echo",
    request: {
      query: z.object({
        flag: z.enum(["a", "b"]),
      }),
    },
    responses: {
      200: {
        description: "ok",
        content: { "application/json": { schema: z.object({ flag: z.string() }) } },
      },
    },
  });
  app.openapi(route, (c) => {
    const { flag } = c.req.valid("query");
    return c.json({ flag }, 200);
  });
  return app;
}

describe("openApiValidationHook", () => {
  it("formats validation failures in the platform error envelope", async () => {
    const app = buildApp();

    const res = await app.request("/echo?flag=c");

    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body).toMatchObject({
      error: "Validation failed",
      code: ERROR_CODES.VALIDATION_FAILED,
      category: ERROR_CATEGORIES.VALIDATION,
    });
    expect(body.context.fields[0]).toMatchObject({
      path: "flag",
      code: "invalid_value",
    });
    expect(typeof body.context.fields[0].message).toBe("string");
  });

  it("does not interfere with valid requests", async () => {
    const app = buildApp();

    const res = await app.request("/echo?flag=a");

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body).toEqual({ flag: "a" });
  });
});
