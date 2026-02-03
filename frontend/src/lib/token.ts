/**
 * Token storage utilities for authentication.
 * Uses localStorage for persistence across sessions.
 */

const TOKEN_KEY = 'agent_hr_access_token';
const LAST_ACTIVITY_KEY = 'agent_hr_last_activity';

/**
 * Inactivity timeout in milliseconds (30 minutes).
 */
export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Get the stored access token.
 * @returns The access token or null if not found.
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Decode a JWT token payload without verification.
 * @param token - The JWT token to decode.
 * @returns The decoded payload or null if invalid.
 */
export function decodeToken(token: string): { exp?: number; sub?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

/**
 * Check if a token is expired.
 * @param token - The JWT token to check.
 * @returns True if the token is expired or invalid.
 */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  const payload = decodeToken(token);
  if (!payload?.exp) return true;
  // Add 10 second buffer to avoid edge cases
  return Date.now() >= (payload.exp * 1000) - 10000;
}

/**
 * Get token expiration time in milliseconds.
 * @param token - The JWT token.
 * @returns Expiration timestamp in ms, or 0 if invalid.
 */
export function getTokenExpirationMs(token: string | null): number {
  if (!token) return 0;
  const payload = decodeToken(token);
  if (!payload?.exp) return 0;
  return payload.exp * 1000;
}

/**
 * Store the access token.
 * @param token - The access token to store.
 */
export function setToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Remove the stored access token.
 */
export function removeToken(): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Check if a token is stored.
 * @returns True if a token exists.
 */
export function hasToken(): boolean {
  return getToken() !== null;
}

/**
 * Update the last activity timestamp.
 */
export function updateLastActivity(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
}

/**
 * Get the last activity timestamp.
 * @returns The timestamp in ms, or 0 if not set.
 */
export function getLastActivity(): number {
  if (typeof window === 'undefined') return 0;
  const value = localStorage.getItem(LAST_ACTIVITY_KEY);
  return value ? parseInt(value, 10) : 0;
}

/**
 * Clear the last activity timestamp.
 */
export function clearLastActivity(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LAST_ACTIVITY_KEY);
}

/**
 * Check if user has been inactive for too long.
 * @returns True if inactive beyond the timeout.
 */
export function isInactive(): boolean {
  const lastActivity = getLastActivity();
  if (!lastActivity) return false;
  return Date.now() - lastActivity > INACTIVITY_TIMEOUT_MS;
}
