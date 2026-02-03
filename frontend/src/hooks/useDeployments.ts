/**
 * TanStack Query hooks for deployment operations.
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import {
  deployAgent,
  getActiveDeployment,
  listDeployments,
  getDeployment,
  stopDeployment,
  chatWithDeployment,
} from '../services';
import type { Deployment, DeployRequest, DeployResponse, DeploymentListResponse, ChatResponse } from '../types';

/**
 * Query key factory for deployment-related queries.
 */
export const deploymentKeys = {
  all: ['deployments'] as const,
  lists: () => [...deploymentKeys.all, 'list'] as const,
  list: (agentId: string, status?: string) => [...deploymentKeys.lists(), agentId, { status }] as const,
  details: () => [...deploymentKeys.all, 'detail'] as const,
  detail: (id: string) => [...deploymentKeys.details(), id] as const,
  active: (agentId: string) => [...deploymentKeys.all, 'active', agentId] as const,
};

/**
 * Hook options for useActiveDeployment.
 */
interface UseActiveDeploymentOptions {
  enabled?: boolean;
  refetchInterval?: number;
  queryOptions?: Omit<
    UseQueryOptions<Deployment | null, Error>,
    'queryKey' | 'queryFn' | 'enabled' | 'refetchInterval'
  >;
}

/**
 * Hook for fetching the active deployment for an agent.
 * @param agentId - The agent's UUID.
 * @param options - Query options.
 * @returns Query result with active deployment data.
 */
export function useActiveDeployment(agentId: string, options: UseActiveDeploymentOptions = {}) {
  const { enabled = true, refetchInterval, queryOptions } = options;

  return useQuery<Deployment | null, Error>({
    queryKey: deploymentKeys.active(agentId),
    queryFn: () => getActiveDeployment(agentId),
    enabled: enabled && Boolean(agentId),
    refetchInterval,
    ...queryOptions,
  });
}

/**
 * Hook options for useDeployments.
 */
interface UseDeploymentsOptions {
  status?: string;
  enabled?: boolean;
  queryOptions?: Omit<
    UseQueryOptions<DeploymentListResponse, Error>,
    'queryKey' | 'queryFn' | 'enabled'
  >;
}

/**
 * Hook for listing deployments for an agent.
 * @param agentId - The agent's UUID.
 * @param options - Query options.
 * @returns Query result with deployments list.
 */
export function useDeployments(agentId: string, options: UseDeploymentsOptions = {}) {
  const { status, enabled = true, queryOptions } = options;

  return useQuery<DeploymentListResponse, Error>({
    queryKey: deploymentKeys.list(agentId, status),
    queryFn: () => listDeployments(agentId, status),
    enabled: enabled && Boolean(agentId),
    ...queryOptions,
  });
}

/**
 * Hook options for useDeployment.
 */
interface UseDeploymentOptions {
  enabled?: boolean;
  refetchInterval?: number;
  queryOptions?: Omit<
    UseQueryOptions<Deployment, Error>,
    'queryKey' | 'queryFn' | 'enabled' | 'refetchInterval'
  >;
}

/**
 * Hook for fetching a single deployment.
 * @param deploymentId - The deployment's UUID.
 * @param options - Query options.
 * @returns Query result with deployment data.
 */
export function useDeployment(deploymentId: string, options: UseDeploymentOptions = {}) {
  const { enabled = true, refetchInterval, queryOptions } = options;

  return useQuery<Deployment, Error>({
    queryKey: deploymentKeys.detail(deploymentId),
    queryFn: () => getDeployment(deploymentId),
    enabled: enabled && Boolean(deploymentId),
    refetchInterval,
    ...queryOptions,
  });
}

/**
 * Hook for deploying an agent.
 * @returns Mutation for deploying an agent.
 */
export function useDeployAgent() {
  const queryClient = useQueryClient();

  return useMutation<DeployResponse, Error, { agentId: string; data?: DeployRequest }>({
    mutationFn: ({ agentId, data }) => deployAgent(agentId, data),
    onSuccess: (_, { agentId }) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: deploymentKeys.active(agentId) });
      queryClient.invalidateQueries({ queryKey: deploymentKeys.list(agentId) });
    },
  });
}

/**
 * Hook for stopping a deployment.
 * @returns Mutation for stopping a deployment.
 */
export function useStopDeployment() {
  const queryClient = useQueryClient();

  return useMutation<Deployment, Error, { deploymentId: string; agentId: string }>({
    mutationFn: ({ deploymentId }) => stopDeployment(deploymentId),
    onSuccess: (_, { agentId }) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: deploymentKeys.active(agentId) });
      queryClient.invalidateQueries({ queryKey: deploymentKeys.lists() });
    },
  });
}

/**
 * Hook for chatting with a deployed agent.
 * @returns Mutation for sending chat messages.
 */
export function useChatWithDeployment() {
  return useMutation<
    ChatResponse,
    Error,
    { deploymentId: string; message: string; conversationId?: string }
  >({
    mutationFn: ({ deploymentId, message, conversationId }) =>
      chatWithDeployment(deploymentId, message, conversationId),
  });
}
