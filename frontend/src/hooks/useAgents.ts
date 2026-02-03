/**
 * TanStack Query hook for fetching and managing agents.
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { listAgents } from '../services';
import type { Agent, AgentListParams, AgentListResponse } from '../types';

/**
 * Query key factory for agents.
 */
export const agentKeys = {
  all: ['agents'] as const,
  lists: () => [...agentKeys.all, 'list'] as const,
  list: (params: AgentListParams) => [...agentKeys.lists(), params] as const,
  details: () => [...agentKeys.all, 'detail'] as const,
  detail: (id: string) => [...agentKeys.details(), id] as const,
};

/**
 * Hook options for useAgents.
 */
interface UseAgentsOptions {
  params?: AgentListParams;
  queryOptions?: Omit<
    UseQueryOptions<AgentListResponse, Error>,
    'queryKey' | 'queryFn'
  >;
}

/**
 * Default refetch interval for agent list (5 seconds).
 * This ensures running status updates are reflected without page refresh.
 */
const DEFAULT_REFETCH_INTERVAL = 5000;

/**
 * Hook for fetching a paginated list of agents.
 * @param options - Query parameters and options.
 * @returns Query result with agents data.
 */
export function useAgents(options: UseAgentsOptions = {}) {
  const { params = {}, queryOptions } = options;

  return useQuery<AgentListResponse, Error>({
    queryKey: agentKeys.list(params),
    queryFn: () => listAgents(params),
    refetchInterval: DEFAULT_REFETCH_INTERVAL,
    ...queryOptions,
  });
}

/**
 * Re-export for convenience.
 */
export type { Agent, AgentListParams, AgentListResponse };
