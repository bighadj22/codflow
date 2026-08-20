"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { getDb } from "@/db";
import { getUserApiKey, requirePermission } from "@/lib/auth";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import { getAllTags, getTagWithCustomers } from "@/../cod-shared/queries/customer-tags";
import { mapError } from "@/lib/errors/mapper";
import { getLocale } from "@/lib/locale";
import type { CustomerTag, CustomerTagWithCustomers } from "@/types";

interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  success: boolean;
}

interface CreateTagData {
  name: string;
  color?: string;
}

interface UpdateTagData {
  name?: string;
  color?: string;
}

export async function getCustomerTags(): Promise<CustomerTag[]> {
  await requirePermission(SCOPES.CUSTOMER_TAGS_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  return getAllTags(db);
}

export async function getCustomerTag(id: string): Promise<CustomerTagWithCustomers | null> {
  await requirePermission(SCOPES.CUSTOMER_TAGS_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  return getTagWithCustomers(db, id);
}

export async function createCustomerTag(data: CreateTagData): Promise<CustomerTag> {
  await requirePermission(SCOPES.CUSTOMER_TAGS_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    const response = await apiClient.post<ApiResponse<CustomerTag>>(
      "/api/customer-tags",
      apiKey,
      data,
    );

    if (!response.data) throw new Error("No data returned from API");

    revalidatePath("/customer-tags");
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Customer Tags Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

export async function updateCustomerTag(id: string, data: UpdateTagData): Promise<CustomerTag> {
  await requirePermission(SCOPES.CUSTOMER_TAGS_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    const response = await apiClient.patch<ApiResponse<CustomerTag>>(
      `/api/customer-tags/${id}`,
      apiKey,
      data,
    );

    if (!response.data) throw new Error("No data returned from API");

    revalidatePath("/customer-tags");
    revalidatePath(`/customer-tags/${id}`);
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Customer Tags Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        tagId: id,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

export async function deleteCustomerTag(id: string): Promise<void> {
  await requirePermission(SCOPES.CUSTOMER_TAGS_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    await apiClient.delete<ApiResponse>(`/api/customer-tags/${id}`, apiKey);
    revalidatePath("/customer-tags");
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Customer Tags Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        tagId: id,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

export async function assignCustomerTag(tagId: string, customerId: string): Promise<void> {
  await requirePermission(SCOPES.CUSTOMER_TAGS_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    await apiClient.post<ApiResponse>(
      `/api/customer-tags/${tagId}/assignments`,
      apiKey,
      { customerId },
    );
    revalidatePath(`/customer-tags/${tagId}`);
    revalidatePath("/customer-tags");
    revalidatePath(`/customers/${customerId}`);
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Customer Tags Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        tagId,
        customerId,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

export async function unassignCustomerTag(tagId: string, customerId: string): Promise<void> {
  await requirePermission(SCOPES.CUSTOMER_TAGS_MANAGE);

  const apiKey = await getUserApiKey();
  if (!apiKey) redirect("/setup-api-key");

  try {
    await apiClient.delete<ApiResponse>(
      `/api/customer-tags/${tagId}/assignments/${customerId}`,
      apiKey,
    );
    revalidatePath(`/customer-tags/${tagId}`);
    revalidatePath("/customer-tags");
    revalidatePath(`/customers/${customerId}`);
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Customer Tags Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        tagId,
        customerId,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}
