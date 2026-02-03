/**
 * Service for managing ComponentRegistry entries with access control.
 */

import { apiClient } from './api';
import type {
  ComponentRegistryEntry,
  ComponentRegistryCreate,
  ComponentRegistryUpdate,
  ComponentOwnershipUpdate,
  ComponentRegistryListResponse,
  ComponentRegistryListParams,
  ComponentSnapshot,
  ComponentSnapshotCreate,
  ComponentSnapshotListResponse,
} from '../types';

/**
 * Service for ComponentRegistry CRUD operations.
 */
export const componentRegistryService = {
  /**
   * List components in the registry with optional filtering.
   */
  async list(params?: ComponentRegistryListParams): Promise<ComponentRegistryListResponse> {
    const response = await apiClient.get<ComponentRegistryListResponse>(
      '/api/component-registry',
      { params }
    );
    return response.data;
  },

  /**
   * Get a specific component by ID.
   */
  async get(componentId: string): Promise<ComponentRegistryEntry> {
    const response = await apiClient.get<ComponentRegistryEntry>(
      `/api/component-registry/${componentId}`
    );
    return response.data;
  },

  /**
   * Create a new component in the registry.
   */
  async create(data: ComponentRegistryCreate): Promise<ComponentRegistryEntry> {
    const response = await apiClient.post<ComponentRegistryEntry>(
      '/api/component-registry',
      data
    );
    return response.data;
  },

  /**
   * Update a component (name, manager, visibility, metadata).
   */
  async update(componentId: string, data: ComponentRegistryUpdate): Promise<ComponentRegistryEntry> {
    const response = await apiClient.patch<ComponentRegistryEntry>(
      `/api/component-registry/${componentId}`,
      data
    );
    return response.data;
  },

  /**
   * Update component ownership (owner and/or manager).
   */
  async updateOwnership(componentId: string, data: ComponentOwnershipUpdate): Promise<ComponentRegistryEntry> {
    const response = await apiClient.patch<ComponentRegistryEntry>(
      `/api/component-registry/${componentId}/ownership`,
      data
    );
    return response.data;
  },

  /**
   * Delete a component (soft delete).
   */
  async delete(componentId: string): Promise<void> {
    await apiClient.delete(`/api/component-registry/${componentId}`);
  },

  /**
   * List snapshots for a component.
   */
  async listSnapshots(componentId: string): Promise<ComponentSnapshotListResponse> {
    const response = await apiClient.get<ComponentSnapshotListResponse>(
      `/api/component-registry/${componentId}/snapshots`
    );
    return response.data;
  },

  /**
   * Get a specific snapshot.
   */
  async getSnapshot(componentId: string, snapshotId: string): Promise<ComponentSnapshot> {
    const response = await apiClient.get<ComponentSnapshot>(
      `/api/component-registry/${componentId}/snapshots/${snapshotId}`
    );
    return response.data;
  },

  /**
   * Create a snapshot of the current component state.
   */
  async createSnapshot(componentId: string, data: ComponentSnapshotCreate): Promise<ComponentSnapshot> {
    const response = await apiClient.post<ComponentSnapshot>(
      `/api/component-registry/${componentId}/snapshots`,
      data
    );
    return response.data;
  },

  /**
   * Restore a component to a snapshot state.
   */
  async restoreSnapshot(componentId: string, snapshotId: string): Promise<ComponentRegistryEntry> {
    const response = await apiClient.post<ComponentRegistryEntry>(
      `/api/component-registry/${componentId}/snapshots/${snapshotId}/restore`
    );
    return response.data;
  },

  /**
   * Delete a snapshot.
   */
  async deleteSnapshot(componentId: string, snapshotId: string): Promise<void> {
    await apiClient.delete(`/api/component-registry/${componentId}/snapshots/${snapshotId}`);
  },
};

export default componentRegistryService;
