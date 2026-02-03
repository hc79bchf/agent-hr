/**
 * TanStack Query hook for fetching and managing version components.
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { listComponents, getComponent } from '../services';
import type { Component, ComponentType } from '../types';

/**
 * Query key factory for components.
 */
export const componentKeys = {
  all: ['components'] as const,
  lists: () => [...componentKeys.all, 'list'] as const,
  list: (versionId: string) => [...componentKeys.lists(), versionId] as const,
  listByType: (versionId: string, type: ComponentType) =>
    [...componentKeys.list(versionId), { type }] as const,
  details: () => [...componentKeys.all, 'detail'] as const,
  detail: (versionId: string, componentId: string) =>
    [...componentKeys.details(), versionId, componentId] as const,
};

/**
 * Hook options for useComponents.
 */
interface UseComponentsOptions {
  versionId: string;
  type?: ComponentType;
  queryOptions?: Omit<
    UseQueryOptions<Component[], Error>,
    'queryKey' | 'queryFn'
  >;
}

/**
 * Hook for fetching components by version.
 * @param options - Query parameters and options.
 * @returns Query result with components data.
 */
export function useComponents(options: UseComponentsOptions) {
  const { versionId, type, queryOptions } = options;

  return useQuery<Component[], Error>({
    queryKey: type
      ? componentKeys.listByType(versionId, type)
      : componentKeys.list(versionId),
    queryFn: async () => {
      const components = await listComponents(versionId);
      // Filter by type if specified
      if (type) {
        return components.filter((c) => c.type === type);
      }
      return components;
    },
    enabled: Boolean(versionId),
    ...queryOptions,
  });
}

/**
 * Hook options for useComponent.
 */
interface UseComponentOptions {
  versionId: string;
  componentId: string;
  queryOptions?: Omit<
    UseQueryOptions<Component, Error>,
    'queryKey' | 'queryFn'
  >;
}

/**
 * Hook for fetching a single component.
 * @param options - Query parameters and options.
 * @returns Query result with component data.
 */
export function useComponent(options: UseComponentOptions) {
  const { versionId, componentId, queryOptions } = options;

  return useQuery<Component, Error>({
    queryKey: componentKeys.detail(versionId, componentId),
    queryFn: () => getComponent(versionId, componentId),
    enabled: Boolean(versionId) && Boolean(componentId),
    ...queryOptions,
  });
}

/**
 * Re-export for convenience.
 */
export type { Component, ComponentType };
