/**
 * User Schemas
 *
 * Team members and authentication.
 */

import { z } from "@hono/zod-openapi";

export const UserSchema = z
  .object({
    id: z.string().openapi({ example: "a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8" }),
    name: z.string().openapi({ example: "Ahmed Benali" }),
    email: z.string().email().openapi({ example: "staff@example.com" }),
    emailVerified: z.boolean().openapi({ example: true }),
    image: z.string().nullable().openapi({ description: "Avatar image URL", example: null }),
    role: z.enum(["admin", "staff"]).openapi({ example: "staff" }),
    status: z.enum(["active", "inactive"]).openapi({ example: "active" }),
    language: z.string().openapi({
      description: 'UI language preference for emails: "ar" | "en"',
      example: "en",
    }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    scopes: z.array(z.string()).openapi({
      description:
        'Permission scopes for this user. Always `["*"]` for admins. The `apiKey` field is never included in these responses — use POST /{id}/api-key/rotate for a one-time key reveal.',
      example: ["orders:read", "customers:read"],
    }),
  })
  .openapi("User", {
    description: "Team member record with permission scopes",
  });
