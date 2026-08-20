/**
 * API Client Tests
 * 
 * Unit tests for the enhanced API client with structured error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, ApiClientError } from './api-client';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock API_CONFIG to disable retries in tests
vi.mock('./api-config', () => ({
  API_CONFIG: {
    baseUrl: 'http://localhost:8787',
    timeout: 10000,
    retries: 0, // Disable retries for faster tests
    headers: {
      'Content-Type': 'application/json',
    },
  },
  ApiResponse: {},
  ApiError: {},
  getWorkerApiUrl: () => Promise.resolve('http://localhost:8787'),
}));

describe('ApiClientError', () => {
  it('should create error with all properties', () => {
    const error = new ApiClientError(
      'Test error',
      400,
      'VALIDATION_FAILED',
      'VALIDATION',
      { field: 'name' }
    );
    
    expect(error.message).toBe('Test error');
    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.category).toBe('VALIDATION');
    expect(error.context).toEqual({ field: 'name' });
    expect(error.name).toBe('ApiClientError');
  });
  
  it('should check if error matches specific code using is()', () => {
    const error = new ApiClientError(
      'Customer not found',
      404,
      'CUSTOMER_NOT_FOUND',
      'BUSINESS_LOGIC'
    );
    
    expect(error.is('CUSTOMER_NOT_FOUND')).toBe(true);
    expect(error.is('ORDER_NOT_FOUND')).toBe(false);
  });
  
  it('should check if error is in specific category using isCategory()', () => {
    const error = new ApiClientError(
      'Validation failed',
      400,
      'VALIDATION_FAILED',
      'VALIDATION'
    );
    
    expect(error.isCategory('VALIDATION')).toBe(true);
    expect(error.isCategory('BUSINESS_LOGIC')).toBe(false);
  });
  
  it('should handle undefined code in is() method', () => {
    const error = new ApiClientError('Network error', 500);
    
    expect(error.is('SOME_CODE')).toBe(false);
  });
  
  it('should handle undefined category in isCategory() method', () => {
    const error = new ApiClientError('Network error', 500);
    
    expect(error.isCategory('SYSTEM')).toBe(false);
  });
});

describe('API Client - Error Response Parsing', () => {
  const apiKey = 'test-api-key';
  
  beforeEach(() => {
    mockFetch.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it('should parse structured error response with code, category, and context', async () => {
    const errorResponse = {
      error: 'Customer not found',
      code: 'CUSTOMER_NOT_FOUND',
      category: 'BUSINESS_LOGIC',
      context: { customerId: '123' },
    };
    
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => errorResponse,
    });
    
    try {
      await apiClient.get('/api/customers/123', apiKey);
      // Should not reach here
      expect.fail('Expected error to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiClientError);
      const apiError = error as ApiClientError;
      expect(apiError.message).toBe('Customer not found');
      expect(apiError.status).toBe(404);
      expect(apiError.code).toBe('CUSTOMER_NOT_FOUND');
      expect(apiError.category).toBe('BUSINESS_LOGIC');
      expect(apiError.context).toEqual({ customerId: '123' });
    }
  });
  
  it('should parse validation error with field details in context', async () => {
    const errorResponse = {
      error: 'Validation failed',
      code: 'VALIDATION_FAILED',
      category: 'VALIDATION',
      context: {
        fields: [
          { path: 'name', message: 'Name is required', code: 'invalid_type' },
          { path: 'phone', message: 'Phone must be at least 10 characters', code: 'too_small' },
        ],
      },
    };
    
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => errorResponse,
    });
    
    try {
      await apiClient.post('/api/customers', apiKey, { name: '', phone: '123' });
    } catch (error) {
      const apiError = error as ApiClientError;
      expect(apiError.code).toBe('VALIDATION_FAILED');
      expect(apiError.category).toBe('VALIDATION');
      expect(apiError.context?.fields).toHaveLength(2);
      expect(apiError.context?.fields[0].path).toBe('name');
    }
  });
  
  it('should preserve HTTP status code in ApiClientError', async () => {
    const errorResponse = {
      error: 'Permission denied',
      code: 'PERMISSION_DENIED',
      category: 'AUTHENTICATION',
    };
    
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => errorResponse,
    });
    
    try {
      await apiClient.delete('/api/customers/123', apiKey);
    } catch (error) {
      const apiError = error as ApiClientError;
      expect(apiError.status).toBe(403);
      expect(apiError.code).toBe('PERMISSION_DENIED');
    }
  });
  
  it('should handle error response without code or category', async () => {
    const errorResponse = {
      error: 'Something went wrong',
    };
    
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => errorResponse,
    });
    
    try {
      await apiClient.get('/api/customers', apiKey);
    } catch (error) {
      const apiError = error as ApiClientError;
      expect(apiError.message).toBe('Something went wrong');
      expect(apiError.status).toBe(500);
      expect(apiError.code).toBeUndefined();
      expect(apiError.category).toBeUndefined();
    }
  });
  
  it('should handle error response with only error message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: 'Internal server error' }),
    });
    
    try {
      await apiClient.get('/api/orders', apiKey);
    } catch (error) {
      const apiError = error as ApiClientError;
      expect(apiError.message).toBe('Internal server error');
      expect(apiError.status).toBe(500);
    }
  });
  
  it('should use HTTP status as fallback message when error field is missing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({}),
    });
    
    try {
      await apiClient.get('/api/products/999', apiKey);
    } catch (error) {
      const apiError = error as ApiClientError;
      expect(apiError.message).toBe('HTTP 404');
      expect(apiError.status).toBe(404);
    }
  });
});

describe('API Client - Network Error Handling', () => {
  const apiKey = 'test-api-key';
  
  beforeEach(() => {
    mockFetch.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it('should handle network errors without code or category', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network request failed'));
    
    try {
      await apiClient.get('/api/customers', apiKey);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Network request failed');
      // Network errors are not ApiClientError instances
      expect(error).not.toBeInstanceOf(ApiClientError);
    }
  });
  
  it('should handle timeout errors', async () => {
    mockFetch.mockRejectedValueOnce(new DOMException('The operation was aborted', 'AbortError'));
    
    try {
      await apiClient.get('/api/orders', apiKey);
    } catch (error) {
      expect(error).toBeInstanceOf(DOMException);
      expect((error as DOMException).name).toBe('AbortError');
    }
  });
  
  it('should handle invalid content type', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
    });
    
    try {
      await apiClient.get('/api/customers', apiKey);
    } catch (error) {
      const apiError = error as ApiClientError;
      expect(apiError.message).toContain('Invalid response format');
      expect(apiError.status).toBe(200);
    }
  });
});

describe('API Client - Console Logging', () => {
  const apiKey = 'test-api-key';
  let consoleErrorSpy: any;
  
  beforeEach(() => {
    mockFetch.mockClear();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it('should log detailed error information to console', async () => {
    const errorResponse = {
      error: 'Order not found',
      code: 'ORDER_NOT_FOUND',
      category: 'BUSINESS_LOGIC',
      context: { orderId: '456' },
    };
    
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => errorResponse,
    });
    
    try {
      await apiClient.get('/api/orders/456', apiKey);
    } catch (error) {
      // Error should be logged
    }
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[API Client Error]',
      expect.objectContaining({
        endpoint: '/api/orders/456',
        status: 404,
        code: 'ORDER_NOT_FOUND',
        category: 'BUSINESS_LOGIC',
        context: { orderId: '456' },
        message: 'Order not found',
      })
    );
  });
  
  it('should log network errors to console', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));
    
    try {
      await apiClient.get('/api/products', apiKey);
    } catch (error) {
      // Error should be logged
    }
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[API Client Error]',
      expect.objectContaining({
        endpoint: '/api/products',
        error: 'Failed to fetch',
      })
    );
  });
  
  it('should log all error properties including context', async () => {
    const errorResponse = {
      error: 'Insufficient stock',
      code: 'INSUFFICIENT_STOCK',
      category: 'BUSINESS_LOGIC',
      context: {
        productName: 'Widget',
        available: 5,
        required: 10,
      },
    };
    
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => errorResponse,
    });
    
    try {
      await apiClient.post('/api/orders', apiKey, { products: [{ id: '1', quantity: 10 }] });
    } catch (error) {
      // Error should be logged
    }
    
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[API Client Error]',
      expect.objectContaining({
        endpoint: '/api/orders',
        status: 422,
        code: 'INSUFFICIENT_STOCK',
        category: 'BUSINESS_LOGIC',
        context: {
          productName: 'Widget',
          available: 5,
          required: 10,
        },
      })
    );
  });
});

describe('API Client - Successful Requests', () => {
  const apiKey = 'test-api-key';
  
  beforeEach(() => {
    mockFetch.mockClear();
  });
  
  it('should return data on successful GET request', async () => {
    const mockData = { id: '1', name: 'Test Customer' };
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockData,
    });
    
    const result = await apiClient.get('/api/customers/1', apiKey);
    expect(result).toEqual(mockData);
  });
  
  it('should return data on successful POST request', async () => {
    const mockData = { id: '2', name: 'New Customer' };
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockData,
    });
    
    const result = await apiClient.post('/api/customers', apiKey, { name: 'New Customer' });
    expect(result).toEqual(mockData);
  });
});

describe('API Client - Retry Logic', () => {
  const apiKey = 'test-api-key';
  
  beforeEach(() => {
    mockFetch.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it('should not retry on 4xx client errors', async () => {
    const errorResponse = {
      error: 'Validation failed',
      code: 'VALIDATION_FAILED',
      category: 'VALIDATION',
    };
    
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => errorResponse,
    });
    
    try {
      await apiClient.post('/api/customers', apiKey, {});
    } catch (error) {
      // Should fail immediately
    }
    
    // Should only be called once (no retries for 4xx)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
