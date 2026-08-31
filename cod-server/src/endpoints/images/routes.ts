/**
 * Images Routes
 *
 * Two routers, two different worlds (both mounted in src/index.ts):
 *   - uploadRouter → /api/images/*   (auth + `products:manage` scope)
 *       POST /upload  — multipart upload straight to R2
 *       POST /presign — presigned URL for direct client-side PUT
 *
 *   - serveRouter   → /images/:key{.+}  (public, no auth)
 *       Serves R2 objects. Deliberately kept on plain Hono: the route needs
 *       Hono's regex param (`:key{.+}`) so keys with slashes match, which
 *       cannot be expressed in a @hono/zod-openapi createRoute path. Its
 *       documentation is preserved as a legacy path entry in openapi.ts.
 *
 * Built with defineRoute() — the standard route-builder pattern.
 * MIME-type and size checks stay in the handlers to preserve their
 * specific error codes.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import { Hono } from "hono";
import type { AppContext } from "@/types";
import { defineRoute } from "@/lib/route-builder";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";
import * as h from "./handlers";
import { presignUpload } from "./presign";
import {
  UploadedImageSchema,
  PresignedUploadSchema,
  SuccessResponseSchema,
} from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

// ─── Routes ───────────────────────────────────────────────────────────────────

const uploadImageRoute = defineRoute({
  method: "post",
  path: "/upload",
  auth: { scope: SCOPES.PRODUCTS_MANAGE },
  tags: ["Images"],
  summary: "Upload image",
  description:
    "Upload an image file (jpg, png, webp, gif) to R2 storage. Max 10 MB. Content type must be multipart/form-data with a single `file` field.",
  operationId: "uploadImage",
  bodyContent: {
    "multipart/form-data": {
      schema: z.object({
        file: z.instanceof(File).openapi({ type: "string", format: "binary" }),
      }),
    },
  },
  responses: {
    201: {
      description: "Image uploaded successfully",
      content: jsonContent(SuccessResponseSchema(UploadedImageSchema)),
    },
    400: {
      description:
        "Validation error - missing file, invalid type, or file too large (VALIDATION_FAILED / REQUIRED_FIELD_MISSING / INVALID_FILE_TYPE / FILE_TOO_LARGE)",
    },
    500: { description: "System error - R2 storage failure (INTERNAL_SERVER_ERROR)" },
  },
  handler: h.uploadImage,
});

const presignRoute = defineRoute({
  method: "post",
  path: "/presign",
  auth: { scope: SCOPES.PRODUCTS_MANAGE },
  tags: ["Images"],
  summary: "Get presigned upload URL",
  description:
    "Get a presigned URL for direct client-side upload to R2. The client PUTs the file to `presignedUrl`, then calls POST /api/products/{id}/images with the returned `key`. Allowed content types: image/jpeg, image/png, image/webp, image/gif.",
  operationId: "presignUpload",
  body: z.object({
    contentType: z.string().min(1).openapi({
      description:
        "MIME type — one of: image/jpeg, image/png, image/webp, image/gif (validated server-side; invalid values return INVALID_FILE_TYPE)",
      example: "image/jpeg",
    }),
  }),
  responses: {
    200: {
      description: "Presigned URL generated",
      content: jsonContent(SuccessResponseSchema(PresignedUploadSchema)),
    },
    400: { description: "Invalid or unsupported content type (INVALID_FILE_TYPE)" },
    500: {
      description:
        "R2 credentials not configured on server or presigned URL generation failed (INTERNAL_SERVER_ERROR)",
    },
  },
  handler: presignUpload,
});

// ─── Routers ──────────────────────────────────────────────────────────────────

// Upload route — requires auth (goes through /api/* middleware)
export const uploadRouter = new OpenAPIHono<AppContext>();
uploadRouter.openapi(uploadImageRoute.route, uploadImageRoute.handler);
uploadRouter.openapi(presignRoute.route, presignRoute.handler);

// Serve route — no auth, mounted outside /api/*
// Plain Hono on purpose: `:key{.+}` regex param is required so that object
// keys containing slashes (e.g. "products/abc.jpg") keep matching. See the
// module docblock above.
const serveRouter = new Hono<AppContext>();
serveRouter.get("/:key{.+}", h.serveImage);

export { serveRouter };
