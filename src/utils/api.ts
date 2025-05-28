import { logger } from './logger';
import { ApiResponse, AppError } from '@/types';

interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

class ApiClient {
  private baseURL: string;
  private defaultTimeout: number = 10000; // 10 seconds

  constructor(baseURL: string = '') {
    this.baseURL = baseURL;
  }

  private async request<T = any>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = this.defaultTimeout,
    } = config;

    const url = `${this.baseURL}${endpoint}`;
    const startTime = Date.now();

    // Log the request
    logger.apiRequest(method, endpoint);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers,
      };

      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      // Log the response
      logger.apiResponse(method, endpoint, response.status);
      logger.performance(`API ${method} ${endpoint}`, duration);

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      return {
        success: true,
        data,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.performance(`API ${method} ${endpoint} (failed)`, duration);

      if (error instanceof Error) {
        logger.error(
          `API request failed: ${method} ${endpoint}`,
          error.message
        );

        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: false,
        error: 'Unknown error occurred',
      };
    }
  }

  async get<T = any>(
    endpoint: string,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET', headers });
  }

  async post<T = any>(
    endpoint: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'POST', body, headers });
  }

  async put<T = any>(
    endpoint: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PUT', body, headers });
  }

  async delete<T = any>(
    endpoint: string,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE', headers });
  }

  async patch<T = any>(
    endpoint: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PATCH', body, headers });
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Convenience functions for common API operations
export const api = {
  // Blog API
  blog: {
    getPosts: (params?: Record<string, any>) => {
      const queryString = params
        ? `?${new URLSearchParams(params).toString()}`
        : '';

      return apiClient.get(`/api/blog/posts${queryString}`);
    },
    getPost: (slug: string, locale: string) =>
      apiClient.get(`/api/blog/posts/${slug}?locale=${locale}`),
    generatePosts: (data: any) => apiClient.post('/api/blog/generate', data),
  },

  // Admin API
  admin: {
    getPosts: () => apiClient.get('/api/admin/posts'),
    getPost: (id: string) => apiClient.get(`/api/admin/posts/${id}`),
    updatePost: (id: string, data: any) =>
      apiClient.put(`/api/admin/posts/${id}`, data),
    deletePost: (id: string) => apiClient.delete(`/api/admin/posts/${id}`),
    publishPost: (id: string) =>
      apiClient.patch(`/api/admin/posts/${id}`, { status: 'published' }),
    unpublishPost: (id: string) =>
      apiClient.patch(`/api/admin/posts/${id}`, { status: 'draft' }),
  },

  // Contact API
  contact: {
    send: (data: any) => apiClient.post('/api/contact', data),
  },
};

// Error handling utility
export const handleApiError = (error: ApiResponse): AppError => {
  return {
    message: error.error || 'An unexpected error occurred',
    code: 'API_ERROR',
  };
};

// Response validation utility
export const validateApiResponse = <T>(response: ApiResponse<T>): T => {
  if (!response.success) {
    throw handleApiError(response);
  }

  return response.data as T;
};
