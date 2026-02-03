/**
 * Auth service for authentication operations.
 */

import { get, post } from './api';
import { setToken, removeToken } from '../lib/token';
import type { User, RegisterRequest, LoginRequest, TokenResponse } from '../types';

/**
 * Register a new user.
 * @param data - Registration data (email, name, password).
 * @returns The created user.
 */
export async function register(data: RegisterRequest): Promise<User> {
  const user = await post<User>('/api/auth/register', data);
  return user;
}

/**
 * Login with email and password.
 * Automatically stores the access token on success.
 * @param data - Login credentials (email, password).
 * @returns The token response.
 */
export async function login(data: LoginRequest): Promise<TokenResponse> {
  const response = await post<TokenResponse>('/api/auth/login', data);
  setToken(response.access_token);
  return response;
}

/**
 * Logout the current user.
 * Removes the stored access token.
 */
export function logout(): void {
  removeToken();
}

/**
 * Get the current authenticated user.
 * @returns The current user data.
 */
export async function getCurrentUser(): Promise<User> {
  return get<User>('/api/auth/me');
}

/**
 * Auth service object for convenient access.
 */
export const authService = {
  register,
  login,
  logout,
  getCurrentUser,
};
