/**
 * Library service for managing shared components across agents.
 */

import { get, post, patch, del, buildQueryString } from './api';
import type {
  LibraryComponent,
  LibraryComponentCreate,
  LibraryComponentUpdate,
  LibraryComponentListResponse,
  LibraryListParams,
  LibraryComponentBatchCreate,
  LibraryComponentBatchResponse,
  AgentLibraryRef,
  AgentLibraryRefsResponse,
  AgentLibraryRefCreate,
  PublishToLibraryRequest,
  PublishToLibraryResponse,
} from '../types';

// =============================================================================
// Library CRUD
// =============================================================================

/**
 * List library components with optional filtering.
 * @param params - Query parameters for filtering/pagination.
 * @returns Paginated list of library components.
 */
export async function listLibraryComponents(
  params: LibraryListParams = {}
): Promise<LibraryComponentListResponse> {
  const queryString = buildQueryString({
    type: params.type,
    search: params.search,
    tag: params.tag,
    author_id: params.author_id,
    skip: params.skip,
    limit: params.limit,
  });
  return get<LibraryComponentListResponse>(`/api/library${queryString}`);
}

/**
 * Create a new library component.
 * @param data - Component data.
 * @returns The created component.
 */
export async function createLibraryComponent(
  data: LibraryComponentCreate
): Promise<LibraryComponent> {
  return post<LibraryComponent>('/api/library', data);
}

/**
 * Create multiple library components at once.
 * @param data - Batch of component data.
 * @returns Batch creation result with created and failed components.
 */
export async function createLibraryComponentsBatch(
  data: LibraryComponentBatchCreate
): Promise<LibraryComponentBatchResponse> {
  return post<LibraryComponentBatchResponse>('/api/library/batch', data);
}

/**
 * Get a library component by ID.
 * @param id - The component's UUID.
 * @returns The component data.
 */
export async function getLibraryComponent(id: string): Promise<LibraryComponent> {
  return get<LibraryComponent>(`/api/library/${id}`);
}

/**
 * Update a library component.
 * @param id - The component's UUID.
 * @param data - The fields to update.
 * @returns The updated component.
 */
export async function updateLibraryComponent(
  id: string,
  data: LibraryComponentUpdate
): Promise<LibraryComponent> {
  return patch<LibraryComponent>(`/api/library/${id}`, data);
}

/**
 * Delete a library component.
 * @param id - The component's UUID.
 */
export async function deleteLibraryComponent(id: string): Promise<void> {
  await del(`/api/library/${id}`);
}

// =============================================================================
// Agent Library References
// =============================================================================

/**
 * List library components referenced by an agent.
 * @param agentId - The agent's UUID.
 * @returns List of library references.
 */
export async function listAgentLibraryRefs(
  agentId: string
): Promise<AgentLibraryRefsResponse> {
  return get<AgentLibraryRefsResponse>(`/api/agents/${agentId}/library-refs`);
}

/**
 * Add a library component reference to an agent.
 * @param agentId - The agent's UUID.
 * @param data - The library component ID to add.
 * @returns The created reference.
 */
export async function addLibraryRefToAgent(
  agentId: string,
  data: AgentLibraryRefCreate
): Promise<AgentLibraryRef> {
  return post<AgentLibraryRef>(`/api/agents/${agentId}/library-refs`, data);
}

/**
 * Remove a library component reference from an agent.
 * @param agentId - The agent's UUID.
 * @param refId - The reference's UUID.
 */
export async function removeLibraryRefFromAgent(
  agentId: string,
  refId: string
): Promise<void> {
  await del(`/api/agents/${agentId}/library-refs/${refId}`);
}

// =============================================================================
// Publish to Library
// =============================================================================

/**
 * Publish an agent's component to the library.
 * @param versionId - The version's UUID.
 * @param componentId - The component's UUID.
 * @param data - Optional overrides for name, description, tags.
 * @returns The created library component.
 */
export async function publishToLibrary(
  versionId: string,
  componentId: string,
  data: PublishToLibraryRequest = {}
): Promise<PublishToLibraryResponse> {
  return post<PublishToLibraryResponse>(
    `/api/versions/${versionId}/components/${componentId}/publish`,
    data
  );
}

// =============================================================================
// Service Object
// =============================================================================

/**
 * Library service object for convenient access.
 */
export const libraryService = {
  // Library CRUD
  list: listLibraryComponents,
  create: createLibraryComponent,
  createBatch: createLibraryComponentsBatch,
  get: getLibraryComponent,
  update: updateLibraryComponent,
  delete: deleteLibraryComponent,

  // Agent references
  listAgentRefs: listAgentLibraryRefs,
  addToAgent: addLibraryRefToAgent,
  removeFromAgent: removeLibraryRefFromAgent,

  // Publish
  publish: publishToLibrary,
};
