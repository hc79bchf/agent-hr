/**
 * Base API client with authentication handling.
 * Uses axios for HTTP requests with automatic token injection.
 */

import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { getToken, removeToken } from '../lib/token';
import type { ApiError } from '../types';

/**
 * API client configuration.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Custom error class for API errors.
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: string
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/**
 * Create and configure the axios instance.
 */
function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor: add auth token
  client.interceptors.request.use(
    (config) => {
      const token = getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor: handle errors
  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError<ApiError>) => {
      if (error.response) {
        const { status, data } = error.response;

        // Handle 401 Unauthorized - token expired or invalid
        if (status === 401) {
          removeToken();
          // Optionally redirect to login page
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
        }

        // Extract error message from response
        let errorMessage = error.message;
        let errorDetail: string | undefined;

        if (data?.detail) {
          // Handle FastAPI validation errors (422) which return an array
          if (Array.isArray(data.detail)) {
            // Format validation errors: "field: message"
            errorMessage = data.detail
              .map((err: { loc?: string[]; msg?: string }) => {
                const field = err.loc?.slice(-1)[0] || 'field';
                return `${field}: ${err.msg || 'validation error'}`;
              })
              .join('; ');
            errorDetail = errorMessage;
          } else if (typeof data.detail === 'string') {
            errorMessage = data.detail;
            errorDetail = data.detail;
          } else {
            // Handle object detail
            errorMessage = String(data.detail);
            errorDetail = errorMessage;
          }
        }

        throw new ApiClientError(errorMessage, status, errorDetail);
      }

      // Network error or other issue
      throw new ApiClientError(
        error.message || 'Network error',
        0,
        'Unable to connect to the server'
      );
    }
  );

  return client;
}

/**
 * The configured axios instance for API calls.
 */
export const apiClient = createApiClient();

/**
 * Generic GET request.
 */
export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await apiClient.get<T>(url, config);
  return response.data;
}

/**
 * Generic POST request.
 */
export async function post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await apiClient.post<T>(url, data, config);
  return response.data;
}

/**
 * Generic PATCH request.
 */
export async function patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const response = await apiClient.patch<T>(url, data, config);
  return response.data;
}

/**
 * Generic DELETE request.
 */
export async function del<T = void>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await apiClient.delete<T>(url, config);
  return response.data;
}

/**
 * POST request with FormData (for file uploads).
 */
export async function postFormData<T>(url: string, formData: FormData): Promise<T> {
  const response = await apiClient.post<T>(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

/**
 * Build query string from params object.
 */
export function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}
