/**
 * Users Routes
 * 
 * Defines all user management API endpoints with RBAC protection.
 */

import { Hono } from "hono";
import type { AppContext } from "@/types";
import * as handlers from "./handlers";
import { requireAdmin, requireScope } from "@/rbac/middleware";
import { SCOPES } from "../../../../cod-shared/rbac/scopes";

const users = new Hono<AppContext>();

// GET /users - List all users with filtering (admin only)
users.get("/", requireAdmin(), handlers.listUsers);

// GET /users/:id - Get single user with scope details (admin only)
users.get("/:id", requireAdmin(), handlers.getUser);

// POST /users - Create new user account (admin only)
users.post("/", requireAdmin(), handlers.createUser);

// PATCH /users/:id - Update user information (admin only)
users.patch("/:id", requireAdmin(), handlers.updateUser);

// PATCH /users/:id/role - Update user role (admin only)
users.patch("/:id/role", requireAdmin(), handlers.updateUserRole);

// POST /users/:id/scopes - Grant scope to user (admin only)
users.post("/:id/scopes", requireAdmin(), handlers.grantScope);

// DELETE /users/:id/scopes/:scope - Revoke scope from user (admin only)
users.delete("/:id/scopes/:scope", requireAdmin(), handlers.revokeScope);

// POST /users/:id/api-key/rotate - Rotate (regenerate) API key (admin only)
users.post("/:id/api-key/rotate", requireAdmin(), handlers.rotateApiKey);


export default users;