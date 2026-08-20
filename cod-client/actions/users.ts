"use server";

/**
 * Server Actions for Users API
 * 
 * These actions securely call the Cloudflare Workers API using the user's stored API key.
 * All actions include proper error handling and type safety.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { getDb } from "@/db";
import { getUserApiKey, requirePermission, requireAdmin } from "@/lib/auth";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { getAllUsers, getUserById } from "@/../cod-shared/queries/users";
import { mapError } from "@/lib/errors/mapper";
import { getLocale } from "@/lib/locale";

/**
 * API Response types
 */
interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  scopes?: string[];
}

interface CreateUserData {
  name: string;
  email: string;
  role: string;
  scopes?: string[];
}

interface UpdateUserData {
  name?: string;
  email?: string;
  status?: string;
}

interface UserFilters {
  role?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Get all users (admin only)
 */
export async function getUsers(filters?: UserFilters): Promise<User[]> {
  await requireAdmin();
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const rows = await getAllUsers(db, {
    role: filters?.role as "admin" | "staff" | undefined,
    status: filters?.status as "active" | "inactive" | undefined,
    search: filters?.search,
    limit: filters?.limit,
    offset: filters?.offset,
  });
  return rows as unknown as User[];
}

/**
 * Get single user by ID (admin only)
 */
export async function getUser(id: string): Promise<User | null> {
  await requireAdmin();
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const row = await getUserById(db, id);
  return (row as unknown as User | null) ?? null;
}

/**
 * Create new user.
 * Returns the created user, the raw API key, and temporary password (returned once — show them to the admin immediately).
 */
export async function createUser(userData: CreateUserData): Promise<{ user: User; apiKey: string; tempPassword: string }> {
  await requireAdmin();

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    const response = await apiClient.post<ApiResponse<User> & { apiKey: string; tempPassword: string }>(
      "/api/users",
      apiKey,
      userData,
    );

    if (!response.data || !response.apiKey || !response.tempPassword) {
      throw new Error("Invalid response from server");
    }

    revalidatePath("/team");
    return { user: response.data, apiKey: response.apiKey, tempPassword: response.tempPassword };
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Users Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

/**
 * Update user information (admin only)
 */
export async function updateUser(id: string, updates: UpdateUserData): Promise<User> {
  await requireAdmin();
  
  const apiKey = await getUserApiKey();
  if (!apiKey) {
    redirect("/setup-api-key");
  }

  try {
    const response = await apiClient.patch<ApiResponse<User>>(`/api/users/${id}`, apiKey, updates);
    
    if (!response.data) {
      throw new Error("No user data returned from API");
    }

    // Revalidate settings page
    revalidatePath("/team");
    
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Users Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        userId: id,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

/**
 * Update user role (admin only)
 */
export async function updateUserRole(id: string, role: string): Promise<User> {
  await requireAdmin();
  
  const apiKey = await getUserApiKey();
  if (!apiKey) {
    redirect("/setup-api-key");
  }

  try {
    const response = await apiClient.patch<ApiResponse<User>>(`/api/users/${id}/role`, apiKey, { role });
    
    if (!response.data) {
      throw new Error("No user data returned from API");
    }

    // Revalidate settings page
    revalidatePath("/team");
    
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Users Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        userId: id,
        role,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

/**
 * Grant scope to user (admin only)
 */
export async function grantScope(userId: string, scope: string): Promise<void> {
  await requireAdmin();
  
  const apiKey = await getUserApiKey();
  if (!apiKey) {
    redirect("/setup-api-key");
  }

  try {
    await apiClient.post<ApiResponse>(`/api/users/${userId}/scopes`, apiKey, { scope });

    // Revalidate settings page
    revalidatePath("/team");
    
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Users Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        userId,
        scope,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

/**
 * Revoke scope from user (admin only)
 */
export async function revokeScope(userId: string, scope: string): Promise<void> {
  await requireAdmin();
  
  const apiKey = await getUserApiKey();
  if (!apiKey) {
    redirect("/setup-api-key");
  }

  try {
    await apiClient.delete<ApiResponse>(`/api/users/${userId}/scopes/${scope}`, apiKey);

    // Revalidate settings page
    revalidatePath("/team");
    
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Users Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        userId,
        scope,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

/**
 * Rotate (regenerate) API key for a user. Admin only.
 * Returns the new raw key — shown once, cannot be retrieved again.
 */
export async function rotateApiKey(userId: string): Promise<{ apiKey: string }> {
  await requireAdmin();

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    const response = await apiClient.post<ApiResponse<{ apiKey: string }>>(
      `/api/users/${userId}/api-key/rotate`,
      apiKey,
    );

    if (!response.data) throw new Error("No API key returned from server");

    revalidatePath("/team");
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Users Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        userId,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

