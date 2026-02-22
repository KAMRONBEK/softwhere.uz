import { API_CONFIG } from '@/constants';
import { ApiResponse, AppError, BlogPost } from '@/types';
import { EstimateResult, EstimatorInput } from '@/types/estimator';
import { logger } from './logger';

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

  private async request<T = any>(endpoint: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    const { method = 'GET', headers = {}, body, timeout = this.defaultTimeout } = config;

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
        logger.error(`API request failed: ${method} ${endpoint}`, error.message);

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

  async get<T = any>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET', headers });
  }

  async post<T = any>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'POST', body, headers });
  }

  async put<T = any>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PUT', body, headers });
  }

  async delete<T = any>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE', headers });
  }

  async patch<T = any>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PATCH', body, headers });
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Convenience functions for common API operations
export const api = {
  // Blog API
  blog: {
    getPosts: async (params?: { locale?: string; generationGroupId?: string; limit?: number }) => {
      const searchParams = new URLSearchParams();

      if (params?.locale) searchParams.set('locale', params.locale);
      if (params?.generationGroupId) searchParams.set('generationGroupId', params.generationGroupId);
      if (params?.limit) searchParams.set('limit', params.limit.toString());

      const url = `${API_CONFIG.BLOG_POSTS_ENDPOINT}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

      return apiClient.get<{ posts: BlogPost[] }>(url);
    },

    getPost: async (slug: string, locale: string) => {
      return apiClient.get<{ post: BlogPost }>(`/api/blog/posts/${slug}?locale=${locale}`);
    },

    getRelatedPost: async (generationGroupId: string, locale: string) => {
      return apiClient.get<{ post: { slug: string; locale: string } }>(
        `/api/blog/posts/related?generationGroupId=${generationGroupId}&locale=${locale}`
      );
    },

    generatePosts: async (data: { category: string; customTopic?: string; locales: string[] }) => {
      return apiClient.post<{ message: string; generationGroupId: string }>(API_CONFIG.BLOG_GENERATION_ENDPOINT, data);
    },
  },

  // Admin API
  admin: {
    getPosts: () => apiClient.get('/api/admin/posts'),
    getPost: (id: string) => apiClient.get(`/api/admin/posts/${id}`),
    updatePost: (id: string, data: any) => apiClient.put(`/api/admin/posts/${id}`, data),
    deletePost: (id: string) => apiClient.delete(`/api/admin/posts/${id}`),
    publishPost: (id: string) => apiClient.patch(`/api/admin/posts/${id}`, { status: 'published' }),
    unpublishPost: (id: string) => apiClient.patch(`/api/admin/posts/${id}`, { status: 'draft' }),
  },

  // Contact API
  contact: {
    send: (data: any) => apiClient.post('/api/contact', data),
  },

  // Currency API
  currency: {
    getRates: async (): Promise<ApiResponse<{ base: string; rates: Record<string, number> }>> => {
      try {
        const res = await fetch('/api/currency/rates');
        const data = await res.json();

        if (!res.ok) return { success: false, error: data.error ?? 'Failed to fetch rates' };

        return { success: true, data: { base: data.base ?? 'USD', rates: data.rates ?? {} } };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  },

  // Estimator API
  estimator: {
    getEstimate: async (input: EstimatorInput): Promise<ApiResponse<EstimateResult & { source: 'ai' | 'formula'; reasoning?: string }>> => {
      try {
        const raw = await apiClient.post('/api/estimate', input);

        // The Next.js route already returns { success, data }.
        // apiClient.post wraps that again inside its own { success, data }.
        // We need to unwrap one level so the UI gets the plain estimate object.
        if (raw.success && raw.data && 'data' in (raw.data as any)) {
          const inner = (raw.data as any).data;

          return { success: true, data: inner } as ApiResponse<EstimateResult & { source: 'ai' | 'formula'; reasoning?: string }>;
        }

        // Otherwise return as-is (handles network errors etc.)
        return raw as ApiResponse<EstimateResult & { source: 'ai' | 'formula'; reasoning?: string }>;
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    saveQuote: async (
      input: EstimatorInput & { email?: string; name?: string; phone?: string }
    ): Promise<ApiResponse<{ quoteId: string }>> => {
      return apiClient.post('/api/estimate/save', input);
    },
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
