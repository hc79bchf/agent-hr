/**
 * Component service for managing version components.
 */

import { get, patch } from './api';
import type { Component, ComponentUpdate, ComponentEditResponse } from '../types';

/**
 * List all components in a version.
 * @param versionId - The version's UUID.
 * @returns Array of components.
 */
export async function listComponents(versionId: string): Promise<Component[]> {
  return get<Component[]>(`/api/versions/${versionId}/components`);
}

/**
 * Get a specific component.
 * @param versionId - The version's UUID.
 * @param componentId - The component's UUID.
 * @returns The component data.
 */
export async function getComponent(versionId: string, componentId: string): Promise<Component> {
  return get<Component>(`/api/versions/${versionId}/components/${componentId}`);
}

/**
 * Edit a component.
 * This creates a new version with the edited component.
 * @param versionId - The version's UUID.
 * @param componentId - The component's UUID.
 * @param data - The fields to update.
 * @returns The edited component and the new version.
 */
export async function editComponent(
  versionId: string,
  componentId: string,
  data: ComponentUpdate
): Promise<ComponentEditResponse> {
  return patch<ComponentEditResponse>(
    `/api/versions/${versionId}/components/${componentId}`,
    data
  );
}

/**
 * Component service object for convenient access.
 */
export const componentService = {
  list: listComponents,
  get: getComponent,
  edit: editComponent,
};
