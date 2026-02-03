/**
 * TanStack Query hooks for fetching component folders.
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { listFoldersByType, getFolderDetail, getUngroupedComponents } from '../services';
import type { FoldersByType, ComponentFolderDetail } from '../types';
import { agentKeys } from './useAgents';

/**
 * Query key factory for folders.
 */
export const folderKeys = {
  all: (agentId: string, versionId: string) =>
    [...agentKeys.detail(agentId), 'versions', versionId, 'folders'] as const,
  byType: (agentId: string, versionId: string) =>
    [...folderKeys.all(agentId, versionId), 'byType'] as const,
  detail: (agentId: string, versionId: string, folderId: string) =>
    [...folderKeys.all(agentId, versionId), folderId] as const,
  ungrouped: (agentId: string, versionId: string) =>
    [...folderKeys.all(agentId, versionId), 'ungrouped'] as const,
};

/**
 * Hook options for useFolders.
 */
interface UseFoldersOptions {
  enabled?: boolean;
  queryOptions?: Omit<
    UseQueryOptions<FoldersByType, Error>,
    'queryKey' | 'queryFn' | 'enabled'
  >;
}

/**
 * Hook for fetching folders grouped by type.
 * @param agentId - The agent's UUID.
 * @param versionId - The version's UUID.
 * @param options - Query options.
 * @returns Query result with folders data.
 */
export function useFolders(
  agentId: string,
  versionId: string,
  options: UseFoldersOptions = {}
) {
  const { enabled = true, queryOptions } = options;

  return useQuery<FoldersByType, Error>({
    queryKey: folderKeys.byType(agentId, versionId),
    queryFn: () => listFoldersByType(agentId, versionId),
    enabled: enabled && Boolean(agentId) && Boolean(versionId),
    ...queryOptions,
  });
}

/**
 * Hook options for useFolderDetail.
 */
interface UseFolderDetailOptions {
  enabled?: boolean;
  queryOptions?: Omit<
    UseQueryOptions<ComponentFolderDetail, Error>,
    'queryKey' | 'queryFn' | 'enabled'
  >;
}

/**
 * Hook for fetching folder detail with components.
 * @param agentId - The agent's UUID.
 * @param versionId - The version's UUID.
 * @param folderId - The folder's UUID.
 * @param options - Query options.
 * @returns Query result with folder detail data.
 */
export function useFolderDetail(
  agentId: string,
  versionId: string,
  folderId: string,
  options: UseFolderDetailOptions = {}
) {
  const { enabled = true, queryOptions } = options;

  return useQuery<ComponentFolderDetail, Error>({
    queryKey: folderKeys.detail(agentId, versionId, folderId),
    queryFn: () => getFolderDetail(agentId, versionId, folderId),
    enabled: enabled && Boolean(agentId) && Boolean(versionId) && Boolean(folderId),
    ...queryOptions,
  });
}

/**
 * Hook options for useUngroupedComponents.
 */
interface UseUngroupedComponentsOptions {
  enabled?: boolean;
  queryOptions?: Omit<
    UseQueryOptions<FoldersByType, Error>,
    'queryKey' | 'queryFn' | 'enabled'
  >;
}

/**
 * Hook for fetching ungrouped components.
 * @param agentId - The agent's UUID.
 * @param versionId - The version's UUID.
 * @param options - Query options.
 * @returns Query result with ungrouped components as synthetic folders.
 */
export function useUngroupedComponents(
  agentId: string,
  versionId: string,
  options: UseUngroupedComponentsOptions = {}
) {
  const { enabled = true, queryOptions } = options;

  return useQuery<FoldersByType, Error>({
    queryKey: folderKeys.ungrouped(agentId, versionId),
    queryFn: () => getUngroupedComponents(agentId, versionId),
    enabled: enabled && Boolean(agentId) && Boolean(versionId),
    ...queryOptions,
  });
}
