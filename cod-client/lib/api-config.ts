/**
 * API Configuration
 * 
 * Centralized configuration for calling the Cloudflare Workers API
 * from Next.js server actions and client components.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Get the base URL for the Cloudflare Workers API (async version for server-side)
 * 
 * Uses runtime environment from Cloudflare bindings instead of build-time process.env
 */
export async function getWorkerApiUrl(): Promise<string> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787';
  } catch {
    // Fallback for development or if context is not available
    return process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787';
  }
}

/**
 * Get the base URL synchronously (for client-side or build-time)
 * This is a fallback that uses process.env
 */
export function getWorkerApiUrlSync(): string {
  return process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787';
}

/**
 * API Configuration object (without API key - will be added per request)
 * Note: baseUrl should be fetched dynamically using getWorkerApiUrl() in server actions
 */
export const API_CONFIG = {
  baseUrl: getWorkerApiUrlSync(), // Fallback for build-time
  timeout: 10000, // 10 seconds
  retries: 3,
  headers: {
    'Content-Type': 'application/json',
  },
} as const;

/**
 * API Response types
 */
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface ApiError {
  error: string;
  required?: string;
  requiredAny?: string[];
  requiredAll?: string[];
  missing?: string[];
}