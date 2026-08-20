"use server";

/**
 * Server Actions for Customers API
 * 
 * These actions securely call the Cloudflare Workers API using the user's stored API key.
 * All actions include proper error handling and type safety.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { getDb } from "@/db";
import { getUserApiKey, requirePermission } from "@/lib/auth";
import { SCOPES } from "@/../cod-shared/rbac/scopes";
import {
  getAllCustomers,
  getCustomerById,
  getOrdersByCustomerId,
  getCustomerGroupMemberships as getCustomerGroupMembershipsQuery,
  getCustomerTagMemberships as getCustomerTagMembershipsQuery,
} from "@/../cod-shared/queries/customers";
import { mapError } from "@/lib/errors/mapper";
import { getLocale } from "@/lib/locale";
import type { Order, CustomerGroupSummary, CustomerTagSummary } from "@/types";

/**
 * API Response types
 */
interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  success: boolean;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  phone2?: string;
  wilayaId?: number;
  communeId?: string;
  wilaya: string;
  commune?: string;
  address?: string;
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
  lastOrderAt?: string;
}

interface CreateCustomerData {
  name: string;
  phone: string;
  phone2?: string | null;
  wilayaId: number;
  communeId?: string;
  address?: string;
}

interface UpdateCustomerData {
  name?: string;
  phone?: string;
  phone2?: string | null;
  wilayaId?: number;
  communeId?: string | null;
  address?: string | null;
}

interface CustomerFilters {
  wilayaId?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Get all customers
 */
export async function getCustomers(filters?: CustomerFilters): Promise<Customer[]> {
  await requirePermission(SCOPES.CUSTOMERS_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const rows = await getAllCustomers(db, filters);
  return rows as unknown as Customer[];
}

/**
 * Get single customer by ID
 */
export async function getCustomer(id: string): Promise<Customer | null> {
  await requirePermission(SCOPES.CUSTOMERS_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const row = await getCustomerById(db, id);
  return (row as unknown as Customer | null) ?? null;
}

/**
 * Create new customer
 */
export async function createCustomer(customerData: CreateCustomerData): Promise<Customer> {
  await requirePermission(SCOPES.CUSTOMERS_CREATE);
  
  const apiKey = await getUserApiKey();
  if (!apiKey) {
    redirect("/setup-api-key");
  }

  try {
    const response = await apiClient.post<ApiResponse<Customer>>("/api/customers", apiKey, customerData);
    
    if (!response.data) {
      throw new Error("No customer data returned from API");
    }

    // Revalidate customers page and dashboard
    revalidatePath("/customers");
    revalidatePath("/dashboard");
    
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Customers Action Error]", {
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
 * Update customer information
 */
export async function updateCustomer(id: string, updates: UpdateCustomerData): Promise<Customer> {
  await requirePermission(SCOPES.CUSTOMERS_UPDATE);
  
  const apiKey = await getUserApiKey();
  if (!apiKey) {
    redirect("/setup-api-key");
  }

  try {
    const response = await apiClient.patch<ApiResponse<Customer>>(`/api/customers/${id}`, apiKey, updates);
    
    if (!response.data) {
      throw new Error("No customer data returned from API");
    }

    // Revalidate customers page and customer profile
    revalidatePath("/customers");
    revalidatePath(`/customers/${id}`);
    revalidatePath("/dashboard");
    
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Customers Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        customerId: id,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}

/**
 * Get orders for a specific customer
 */
export async function getCustomerOrders(customerId: string): Promise<Order[]> {
  await requirePermission(SCOPES.CUSTOMERS_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const rows = await getOrdersByCustomerId(db, customerId);
  return rows as unknown as Order[];
}

/**
 * Get groups a customer belongs to
 */
export async function getCustomerGroupMemberships(customerId: string): Promise<CustomerGroupSummary[]> {
  await requirePermission(SCOPES.CUSTOMER_GROUPS_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const rows = await getCustomerGroupMembershipsQuery(db, customerId);
  return rows as unknown as CustomerGroupSummary[];
}

/**
 * Get tags assigned to a customer
 */
export async function getCustomerTagMemberships(customerId: string): Promise<CustomerTagSummary[]> {
  await requirePermission(SCOPES.CUSTOMER_TAGS_READ);
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const rows = await getCustomerTagMembershipsQuery(db, customerId);
  return rows as unknown as CustomerTagSummary[];
}

/**
 * Delete customer
 */
export async function deleteCustomer(id: string): Promise<void> {
  await requirePermission(SCOPES.CUSTOMERS_DELETE);
  
  const apiKey = await getUserApiKey();
  if (!apiKey) {
    redirect("/setup-api-key");
  }

  try {
    await apiClient.delete<ApiResponse>(`/api/customers/${id}`, apiKey);

    // Revalidate customers page and dashboard
    revalidatePath("/customers");
    revalidatePath("/dashboard");
    
  } catch (error) {
    if (error instanceof ApiClientError && error.code) {
      const locale = await getLocale();
      const userMessage = mapError(error.code, locale, error.context);
      
      console.error("[Customers Action Error]", {
        code: error.code,
        category: error.category,
        context: error.context,
        customerId: id,
      });
      
      throw new Error(userMessage);
    }
    throw error;
  }
}