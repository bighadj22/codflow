/**
 * API Client
 * 
 * Type-safe HTTP client for calling the Cloudflare Workers API
 * with proper error handling, retries, and RBAC integration.
 */

import { API_CONFIG, ApiResponse, ApiError, getWorkerApiUrl } from './api-config';

/**
 * HTTP Methods
 */
type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/**
 * Request options
 */
interface RequestOptions {
  method?: HttpMethod;
  body?: any;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

/**
 * API Client Error
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public category?: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
  
  /**
   * Check if error matches a specific error code
   */
  is(errorCode: string): boolean {
    return this.code === errorCode;
  }
  
  /**
   * Check if error is in a specific category
   */
  isCategory(category: string): boolean {
    return this.category === category;
  }
}

/**
 * Make HTTP request to Workers API
 */
async function makeRequest<T>(
  endpoint: string,
  apiKey: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    headers = {},
    timeout = API_CONFIG.timeout,
    retries = API_CONFIG.retries,
  } = options;

  // Get the runtime worker URL from Cloudflare bindings
  const baseUrl = await getWorkerApiUrl();
  const url = `${baseUrl}${endpoint}`;
  
  const requestHeaders = {
    ...API_CONFIG.headers,
    'X-API-Key': apiKey, // Use the user's API key from database
    ...headers,
  };

  const requestOptions: RequestInit = {
    method,
    headers: requestHeaders,
    signal: AbortSignal.timeout(timeout),
  };

  if (body && method !== 'GET') {
    requestOptions.body = JSON.stringify(body);
  }

  let lastError: Error;

  // Retry logic
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, requestOptions);
      
      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new ApiClientError(
          `Invalid response format: ${contentType}`,
          response.status
        );
      }

      const data: any = await response.json();

      // Handle HTTP errors
      if (!response.ok) {
        // Parse structured error response from backend
        const errorData = data as { error?: string; code?: string; category?: string; context?: Record<string, any> };
        
        throw new ApiClientError(
          errorData.error || `HTTP ${response.status}`,
          response.status,
          errorData.code,
          errorData.category,
          errorData.context
        );
      }

      return data as T;
    } catch (error) {
      lastError = error as Error;
      
      // Log detailed error for debugging
      if (error instanceof ApiClientError) {
        console.error('[API Client Error]', {
          endpoint,
          status: error.status,
          code: error.code,
          category: error.category,
          context: error.context,
          message: error.message,
        });
      } else {
        // Network errors or other unexpected errors
        console.error('[API Client Error]', {
          endpoint,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      
      // Don't retry on client errors (4xx) or the last attempt
      if (error instanceof ApiClientError && 
          error.status && 
          error.status >= 400 && 
          error.status < 500) {
        throw error;
      }
      
      if (attempt === retries) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  throw lastError!;
}

/**
 * API Client
 */
export const apiClient = {
  /**
   * GET request
   */
  get: <T>(endpoint: string, apiKey: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    makeRequest<T>(endpoint, apiKey, { ...options, method: 'GET' }),

  /**
   * POST request
   */
  post: <T>(endpoint: string, apiKey: string, body?: any, options?: Omit<RequestOptions, 'method'>) =>
    makeRequest<T>(endpoint, apiKey, { ...options, method: 'POST', body }),

  /**
   * PATCH request
   */
  patch: <T>(endpoint: string, apiKey: string, body?: any, options?: Omit<RequestOptions, 'method'>) =>
    makeRequest<T>(endpoint, apiKey, { ...options, method: 'PATCH', body }),

  /**
   * PUT request
   */
  put: <T>(endpoint: string, apiKey: string, body?: any, options?: Omit<RequestOptions, 'method'>) =>
    makeRequest<T>(endpoint, apiKey, { ...options, method: 'PUT', body }),

  /**
   * DELETE request
   */
  delete: <T>(endpoint: string, apiKey: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    makeRequest<T>(endpoint, apiKey, { ...options, method: 'DELETE' }),
};