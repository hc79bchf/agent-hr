/**
 * Auth-related TypeScript types matching backend schemas.
 */

/**
 * User data returned from API.
 */
export interface User {
  id: string;
  email: string;
  name: string;
  organization_id?: string | null;
  is_admin: boolean;
  created_at: string;
}

/**
 * Request body for user registration.
 */
export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
}

/**
 * Request body for user login.
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Token response from login endpoint.
 */
export interface TokenResponse {
  access_token: string;
  token_type: string;
}
