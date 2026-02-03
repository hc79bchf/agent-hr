/**
 * Users service for admin user management.
 * Provides API calls for listing and updating users.
 */

import { get, patch } from './api';
import type { User } from '../types';

/**
 * User update request payload.
 */
export interface UserUpdate {
  organization_id?: string | null;
}

/**
 * Users service with API methods.
 */
export const usersService = {
  /**
   * List all users for admin management.
   * @returns Promise resolving to array of users.
   */
  list: (): Promise<User[]> => get<User[]>('/api/users'),

  /**
   * Get a specific user by ID.
   * @param id - User ID.
   * @returns Promise resolving to the user.
   */
  get: (id: string): Promise<User> => get<User>(`/api/users/${id}`),

  /**
   * Update a user's organization assignment.
   * @param id - User ID.
   * @param data - Fields to update.
   * @returns Promise resolving to the updated user.
   */
  update: (id: string, data: UserUpdate): Promise<User> =>
    patch<User>(`/api/users/${id}`, data),
};
