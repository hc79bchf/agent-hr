/**
 * React Query hooks for memory management.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { memoryService } from '../services';
import { agentKeys } from './useAgents';
import type {
  MemorySuggestionListResponse,
  WorkingMemoryState,
} from '../types';

/**
 * Query keys for memory-related queries.
 */
export const memoryKeys = {
  all: ['memory'] as const,
  suggestions: (agentId: string) => [...memoryKeys.all, 'suggestions', agentId] as const,
  suggestionsByStatus: (agentId: string, status: string) =>
    [...memoryKeys.suggestions(agentId), status] as const,
  workingMemory: (deploymentId: string) =>
    [...memoryKeys.all, 'working', deploymentId] as const,
};

/**
 * Hook to fetch memory suggestions for an agent.
 * @param agentId - The agent's UUID.
 * @param status - Status filter (default: pending).
 * @param enabled - Whether to enable the query.
 */
export function useMemorySuggestions(
  agentId: string,
  status: 'pending' | 'approved' | 'rejected' = 'pending',
  enabled = true
) {
  return useQuery<MemorySuggestionListResponse, Error>({
    queryKey: memoryKeys.suggestionsByStatus(agentId, status),
    queryFn: () => memoryService.getSuggestions(agentId, status),
    enabled: enabled && !!agentId,
  });
}

/**
 * Hook to approve a memory suggestion.
 */
export function useApproveMemorySuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agentId, suggestionId }: { agentId: string; suggestionId: string }) =>
      memoryService.approveSuggestion(agentId, suggestionId),
    onSuccess: (_, { agentId }) => {
      // Invalidate suggestions and agent data (new memory created)
      queryClient.invalidateQueries({ queryKey: memoryKeys.suggestions(agentId) });
      queryClient.invalidateQueries({ queryKey: agentKeys.all });
    },
  });
}

/**
 * Hook to reject a memory suggestion.
 */
export function useRejectMemorySuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agentId, suggestionId }: { agentId: string; suggestionId: string }) =>
      memoryService.rejectSuggestion(agentId, suggestionId),
    onSuccess: (_, { agentId }) => {
      queryClient.invalidateQueries({ queryKey: memoryKeys.suggestions(agentId) });
    },
  });
}

/**
 * Hook to fetch working memory for a deployment.
 * @param deploymentId - The deployment's UUID.
 * @param enabled - Whether to enable the query.
 */
export function useWorkingMemory(deploymentId: string, enabled = true) {
  return useQuery<WorkingMemoryState, Error>({
    queryKey: memoryKeys.workingMemory(deploymentId),
    queryFn: () => memoryService.getWorkingMemory(deploymentId),
    enabled: enabled && !!deploymentId,
    // Working memory changes frequently, poll every 10s when enabled
    refetchInterval: enabled ? 10000 : false,
  });
}

/**
 * Hook to inject context into working memory.
 */
export function useInjectWorkingMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ deploymentId, content }: { deploymentId: string; content: string }) =>
      memoryService.injectWorkingMemory(deploymentId, content),
    onSuccess: (_, { deploymentId }) => {
      queryClient.invalidateQueries({ queryKey: memoryKeys.workingMemory(deploymentId) });
    },
  });
}

/**
 * Hook to clear working memory.
 */
export function useClearWorkingMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deploymentId: string) => memoryService.clearWorkingMemory(deploymentId),
    onSuccess: (_, deploymentId) => {
      queryClient.invalidateQueries({ queryKey: memoryKeys.workingMemory(deploymentId) });
    },
  });
}
