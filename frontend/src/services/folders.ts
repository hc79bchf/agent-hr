/**
 * Folder service for component folder operations.
 */

import { get } from './api';
import type { ComponentFolder, ComponentFolderDetail, FoldersByType } from '../types';

/**
 * List folders for a version grouped by type.
 * @param agentId - The agent's UUID.
 * @param versionId - The version's UUID.
 * @returns Folders grouped by type.
 */
export async function listFoldersByType(
  agentId: string,
  versionId: string
): Promise<FoldersByType> {
  return get<FoldersByType>(`/api/agents/${agentId}/versions/${versionId}/folders`);
}

/**
 * List folders for a version with optional filtering.
 * @param agentId - The agent's UUID.
 * @param versionId - The version's UUID.
 * @param type - Optional component type filter.
 * @returns List of folders.
 */
export async function listFolders(
  agentId: string,
  versionId: string,
  type?: string
): Promise<{ data: ComponentFolder[]; total: number }> {
  const params = new URLSearchParams();
  if (type) params.append('type', type);
  const queryString = params.toString() ? `?${params.toString()}` : '';
  return get<{ data: ComponentFolder[]; total: number }>(
    `/api/agents/${agentId}/versions/${versionId}/folders/list${queryString}`
  );
}

/**
 * Get folder details with its components.
 * @param agentId - The agent's UUID.
 * @param versionId - The version's UUID.
 * @param folderId - The folder's UUID.
 * @returns Folder detail with components.
 */
export async function getFolderDetail(
  agentId: string,
  versionId: string,
  folderId: string
): Promise<ComponentFolderDetail> {
  return get<ComponentFolderDetail>(
    `/api/agents/${agentId}/versions/${versionId}/folders/${folderId}`
  );
}

/**
 * Get ungrouped components for a version.
 * @param agentId - The agent's UUID.
 * @param versionId - The version's UUID.
 * @returns Ungrouped components as synthetic folders by type.
 */
export async function getUngroupedComponents(
  agentId: string,
  versionId: string
): Promise<FoldersByType> {
  return get<FoldersByType>(`/api/agents/${agentId}/versions/${versionId}/ungrouped`);
}

/**
 * Folder service object for convenient access.
 */
export const folderService = {
  listByType: listFoldersByType,
  list: listFolders,
  getDetail: getFolderDetail,
  getUngrouped: getUngroupedComponents,
};
