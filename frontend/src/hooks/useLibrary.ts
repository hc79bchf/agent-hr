/**
 * TanStack Query hooks for the component library.
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import {
  listLibraryComponents,
  getLibraryComponent,
  createLibraryComponent,
  createLibraryComponentsBatch,
  updateLibraryComponent,
  deleteLibraryComponent,
  listAgentLibraryRefs,
  addLibraryRefToAgent,
  removeLibraryRefFromAgent,
  publishToLibrary,
} from '../services';
import type {
  LibraryComponent,
  LibraryComponentCreate,
  LibraryComponentUpdate,
  LibraryComponentListResponse,
  LibraryListParams,
  LibraryComponentBatchCreate,
  LibraryComponentBatchResponse,
  AgentLibraryRefsResponse,
  AgentLibraryRefCreate,
  PublishToLibraryRequest,
} from '../types';

/**
 * Query key factory for library.
 */
export const libraryKeys = {
  all: ['library'] as const,
  lists: () => [...libraryKeys.all, 'list'] as const,
  list: (params: LibraryListParams) => [...libraryKeys.lists(), params] as const,
  details: () => [...libraryKeys.all, 'detail'] as const,
  detail: (id: string) => [...libraryKeys.details(), id] as const,
  agentRefs: (agentId: string) => [...libraryKeys.all, 'agentRefs', agentId] as const,
};

/**
 * Hook options for useLibrary.
 */
interface UseLibraryOptions {
  params?: LibraryListParams;
  queryOptions?: Omit<
    UseQueryOptions<LibraryComponentListResponse, Error>,
    'queryKey' | 'queryFn'
  >;
}

/**
 * Hook for fetching a paginated list of library components.
 */
export function useLibrary(options: UseLibraryOptions = {}) {
  const { params = {}, queryOptions } = options;

  return useQuery<LibraryComponentListResponse, Error>({
    queryKey: libraryKeys.list(params),
    queryFn: () => listLibraryComponents(params),
    ...queryOptions,
  });
}

/**
 * Hook for fetching a single library component.
 */
export function useLibraryComponent(id: string, enabled = true) {
  return useQuery<LibraryComponent, Error>({
    queryKey: libraryKeys.detail(id),
    queryFn: () => getLibraryComponent(id),
    enabled: enabled && !!id,
  });
}

/**
 * Hook for fetching library references for an agent.
 */
export function useAgentLibraryRefs(agentId: string, enabled = true) {
  return useQuery<AgentLibraryRefsResponse, Error>({
    queryKey: libraryKeys.agentRefs(agentId),
    queryFn: () => listAgentLibraryRefs(agentId),
    enabled: enabled && !!agentId,
  });
}

/**
 * Hook for creating a library component.
 */
export function useCreateLibraryComponent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LibraryComponentCreate) => createLibraryComponent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.lists() });
    },
  });
}

/**
 * Hook for creating multiple library components at once.
 */
export function useCreateLibraryComponentsBatch() {
  const queryClient = useQueryClient();

  return useMutation<LibraryComponentBatchResponse, Error, LibraryComponentBatchCreate>({
    mutationFn: (data: LibraryComponentBatchCreate) => createLibraryComponentsBatch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.lists() });
    },
  });
}

/**
 * Hook for updating a library component.
 */
export function useUpdateLibraryComponent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: LibraryComponentUpdate }) =>
      updateLibraryComponent(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.lists() });
    },
  });
}

/**
 * Hook for deleting a library component.
 */
export function useDeleteLibraryComponent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteLibraryComponent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.lists() });
    },
  });
}

/**
 * Hook for adding a library component to an agent.
 */
export function useAddLibraryRefToAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agentId,
      data,
    }: {
      agentId: string;
      data: AgentLibraryRefCreate;
    }) => addLibraryRefToAgent(agentId, data),
    onSuccess: (_, { agentId }) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.agentRefs(agentId) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.lists() });
    },
  });
}

/**
 * Hook for removing a library component from an agent.
 */
export function useRemoveLibraryRefFromAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agentId, refId }: { agentId: string; refId: string }) =>
      removeLibraryRefFromAgent(agentId, refId),
    onSuccess: (_, { agentId }) => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.agentRefs(agentId) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.lists() });
    },
  });
}

/**
 * Hook for publishing a component to the library.
 */
export function usePublishToLibrary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      versionId,
      componentId,
      data,
    }: {
      versionId: string;
      componentId: string;
      data?: PublishToLibraryRequest;
    }) => publishToLibrary(versionId, componentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryKeys.lists() });
    },
  });
}
