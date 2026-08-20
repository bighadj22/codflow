"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { getDb } from "@/db";
import { getUserApiKey, requirePermission } from "@/lib/auth";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { getAllGroups, getGroupWithMembers } from "@/../cod-shared/queries/customer-groups";
import { mapError } from "@/lib/errors/mapper";
import { getLocale } from "@/lib/locale";
import type { CustomerGroup, CustomerGroupWithMembers } from "@/types";

interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  success: boolean;
}

interface CreateGroupData {
  name: string;
  description?: string;
  color?: string;
}

interface UpdateGroupData {
  name?: string;
  description?: string | null;
  color?: string;
}

export async function getCustomerGroups(): Promise<CustomerGroup[]> {
  await requirePermission(SCOPES.CUSTOMER_GROUPS_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  return getAllGroups(db);
}

export async function getCustomerGroup(id: string): Promise<CustomerGroupWithMembers | null> {
  await requirePermission(SCOPES.CUSTOMER_GROUPS_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  return getGroupWithMembers(db, id);
}

export async function createCustomerGroup(data: CreateGroupData): Promise<CustomerGroup> {
  await requirePermission(SCOPES.CUSTOMER_GROUPS_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    const response = await apiClient.post<ApiResponse<CustomerGroup>>(
      "/api/customer-groups",
      apiKey,
      data,
    );

    if (!response.data) throw new Error("No data returned from API");

    revalidatePath("/customer-groups");
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Customer Groups Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

export async function updateCustomerGroup(id: string, data: UpdateGroupData): Promise<CustomerGroup> {
  await requirePermission(SCOPES.CUSTOMER_GROUPS_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    const response = await apiClient.patch<ApiResponse<CustomerGroup>>(
      `/api/customer-groups/${id}`,
      apiKey,
      data,
    );

    if (!response.data) throw new Error("No data returned from API");

    revalidatePath("/customer-groups");
    revalidatePath(`/customer-groups/${id}`);
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Customer Groups Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        groupId: id,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

export async function deleteCustomerGroup(id: string): Promise<void> {
  await requirePermission(SCOPES.CUSTOMER_GROUPS_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    await apiClient.delete<ApiResponse>(`/api/customer-groups/${id}`, apiKey);
    revalidatePath("/customer-groups");
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Customer Groups Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        groupId: id,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

export async function addCustomerToGroup(groupId: string, customerId: string): Promise<void> {
  await requirePermission(SCOPES.CUSTOMER_GROUPS_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    await apiClient.post<ApiResponse>(
      `/api/customer-groups/${groupId}/members`,
      apiKey,
      { customerId },
    );
    revalidatePath(`/customer-groups/${groupId}`);
    revalidatePath("/customer-groups");
    revalidatePath(`/customers/${customerId}`);
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Customer Groups Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        groupId,
        customerId,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

export async function removeCustomerFromGroup(groupId: string, customerId: string): Promise<void> {
  await requirePermission(SCOPES.CUSTOMER_GROUPS_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    await apiClient.delete<ApiResponse>(
      `/api/customer-groups/${groupId}/members/${customerId}`,
      apiKey,
    );
    revalidatePath(`/customer-groups/${groupId}`);
    revalidatePath("/customer-groups");
    revalidatePath(`/customers/${customerId}`);
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Customer Groups Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        groupId,
        customerId,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}
