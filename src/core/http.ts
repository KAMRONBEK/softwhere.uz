import { logger } from './logger';

/** Generic response envelope returned by the API client. */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/** Normalized application error. */
export interface AppError {
  message: string;
  code?: string;
  status?: number;
}

interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

/**
 * Generic, domain-agnostic HTTP client. Feature-specific calls live in their
 * own module (e.g. modules/estimator/api, modules/blog/api) and build on this —
 * keeping `core` free of any dependency on `shared`/`modules`.
 */
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

// Singleton instance.
export const apiClient = new ApiClient();

// Error handling utility.
export const handleApiError = (error: ApiResponse): AppError => {
  return {
    message: error.error || 'An unexpected error occurred',
    code: 'API_ERROR',
  };
};

// Response validation utility.
export const validateApiResponse = <T>(response: ApiResponse<T>): T => {
  if (!response.success) {
    throw handleApiError(response);
  }

  return response.data as T;
};
