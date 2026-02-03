/**
 * TanStack Query hook for fetching agent versions.
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { listVersions, compareVersions } from '../services';
import type { VersionListResponse, VersionListParams, VersionCompareResponse } from '../types';
import { agentKeys } from './useAgents';

/**
 * Query key factory for versions.
 */
export const versionKeys = {
  all: (agentId: string) => [...agentKeys.detail(agentId), 'versions'] as const,
  list: (agentId: string, params: VersionListParams) =>
    [...versionKeys.all(agentId), params] as const,
};

/**
 * Hook options for useVersions.
 */
interface UseVersionsOptions {
  params?: VersionListParams;
  enabled?: boolean;
  queryOptions?: Omit<
    UseQueryOptions<VersionListResponse, Error>,
    'queryKey' | 'queryFn' | 'enabled'
  >;
}

/**
 * Hook for fetching versions of an agent.
 * @param agentId - The agent's UUID.
 * @param options - Query parameters and options.
 * @returns Query result with versions data.
 */
export function useVersions(agentId: string, options: UseVersionsOptions = {}) {
  const { params = {}, enabled = true, queryOptions } = options;

  return useQuery<VersionListResponse, Error>({
    queryKey: versionKeys.list(agentId, params),
    queryFn: () => listVersions(agentId, params),
    enabled: enabled && Boolean(agentId),
    ...queryOptions,
  });
}

/**
 * Hook options for useVersionCompare.
 */
interface UseVersionCompareOptions {
  enabled?: boolean;
  queryOptions?: Omit<
    UseQueryOptions<VersionCompareResponse, Error>,
    'queryKey' | 'queryFn' | 'enabled'
  >;
}

/**
 * Hook for comparing two versions.
 * @param agentId - The agent's UUID.
 * @param versionAId - First version UUID.
 * @param versionBId - Second version UUID.
 * @param options - Query options.
 * @returns Query result with comparison data.
 */
export function useVersionCompare(
  agentId: string,
  versionAId: string,
  versionBId: string,
  options: UseVersionCompareOptions = {}
) {
  const { enabled = true, queryOptions } = options;

  return useQuery<VersionCompareResponse, Error>({
    queryKey: [...versionKeys.all(agentId), 'compare', versionAId, versionBId],
    queryFn: () => compareVersions(agentId, versionAId, versionBId),
    enabled: enabled && Boolean(agentId) && Boolean(versionAId) && Boolean(versionBId),
    ...queryOptions,
  });
}
