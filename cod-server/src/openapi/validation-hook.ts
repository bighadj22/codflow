/**
 * Default validation hook for OpenAPIHono routes.
 *
 * Without this hook, @hono/zod-openapi fails validation with
 * `c.json(result, 400)` — a raw ZodError dump that does not match the
 * platform error envelope. This hook produces the exact same body as the
 * global errorHandler's ZodError branch, so route-level (framework)
 * validation and handler-level (thrown ZodError) validation are
 * indistinguishable to API consumers.
 *
 * Pass it as `defaultHook` when constructing the root OpenAPIHono app;
 * sub-routers resolve it through their parent automatically.
 */

import type { Context } from "hono";
import type { ZodError } from "zod";
import type { AppContext } from "@/types";
import { ERROR_CODES, ERROR_CATEGORIES } from "../../../cod-shared/errors/codes";

type ValidationResult =
  | { success: true; data: unknown }
  | { success: false; error: ZodError };

export function openApiValidationHook(
  result: ValidationResult,
  c: Context<AppContext>
) {
  if (result.success) return;
  return c.json(
    {
      error: "Validation failed",
      code: ERROR_CODES.VALIDATION_FAILED,
      category: ERROR_CATEGORIES.VALIDATION,
      context: {
        fields: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
          code: issue.code,
        })),
      },
    },
    400
  );
}
