/**
 * Memory service for managing agent knowledge base entries.
 */

import { get, post, del } from './api';
import { apiClient } from './api';
import type { Component } from '../types';
import type { AgentVersion } from '../types/version';
import type {
  MemoryType,
  MemorySuggestion,
  MemorySuggestionListResponse,
  WorkingMemoryState,
} from '../types/memory';

/**
 * Request body for creating a memory entry.
 */
export interface MemoryCreate {
  name: string;
  content: string;
  description?: string | null;
  memory_type?: MemoryType;
}

/**
 * Request body for updating a memory entry.
 */
export interface MemoryUpdate {
  name?: string;
  content?: string;
  description?: string | null;
  memory_type?: MemoryType;
}

/**
 * Response from memory create endpoint.
 */
export interface MemoryCreateResponse {
  memory: Component;
  new_version: AgentVersion;
}

/**
 * Response from memory update endpoint.
 */
export interface MemoryUpdateResponse {
  memory: Component;
  new_version: AgentVersion;
}

/**
 * Response from memory delete endpoint.
 */
export interface MemoryDeleteResponse {
  deleted: boolean;
  new_version: AgentVersion;
}

/**
 * Create a new memory entry for an agent.
 * Creates a new agent version with the memory added.
 * @param agentId - The agent's UUID.
 * @param data - The memory data.
 * @returns The created memory and new version.
 */
export async function createMemory(
  agentId: string,
  data: MemoryCreate
): Promise<MemoryCreateResponse> {
  return post<MemoryCreateResponse>(`/api/agents/${agentId}/memories`, data);
}

/**
 * Update an existing memory entry.
 * Creates a new agent version with the memory updated.
 * @param agentId - The agent's UUID.
 * @param memoryId - The memory component's UUID.
 * @param data - The fields to update.
 * @returns The updated memory and new version.
 */
export async function updateMemory(
  agentId: string,
  memoryId: string,
  data: MemoryUpdate
): Promise<MemoryUpdateResponse> {
  const response = await apiClient.put<MemoryUpdateResponse>(
    `/api/agents/${agentId}/memories/${memoryId}`,
    data
  );
  return response.data;
}

/**
 * Delete a memory entry from an agent.
 * Creates a new agent version without the memory.
 * @param agentId - The agent's UUID.
 * @param memoryId - The memory component's UUID.
 * @returns Confirmation and new version.
 */
export async function deleteMemory(
  agentId: string,
  memoryId: string
): Promise<MemoryDeleteResponse> {
  return del<MemoryDeleteResponse>(`/api/agents/${agentId}/memories/${memoryId}`);
}

// =============================================================================
// Memory Suggestions
// =============================================================================

/**
 * Get pending memory suggestions for an agent.
 * @param agentId - The agent's UUID.
 * @param status - Optional status filter (default: pending).
 * @returns List of memory suggestions.
 */
export async function getMemorySuggestions(
  agentId: string,
  status: 'pending' | 'approved' | 'rejected' = 'pending'
): Promise<MemorySuggestionListResponse> {
  return get<MemorySuggestionListResponse>(
    `/api/agents/${agentId}/memory-suggestions?status=${status}`
  );
}

/**
 * Approve a memory suggestion, creating a new memory.
 * @param agentId - The agent's UUID.
 * @param suggestionId - The suggestion's UUID.
 * @returns The approved suggestion.
 */
export async function approveMemorySuggestion(
  agentId: string,
  suggestionId: string
): Promise<MemorySuggestion> {
  return post<MemorySuggestion>(
    `/api/agents/${agentId}/memory-suggestions/${suggestionId}/approve`,
    {}
  );
}

/**
 * Reject a memory suggestion.
 * @param agentId - The agent's UUID.
 * @param suggestionId - The suggestion's UUID.
 * @returns The rejected suggestion.
 */
export async function rejectMemorySuggestion(
  agentId: string,
  suggestionId: string
): Promise<MemorySuggestion> {
  return post<MemorySuggestion>(
    `/api/agents/${agentId}/memory-suggestions/${suggestionId}/reject`,
    {}
  );
}

// =============================================================================
// Working Memory (Deployment-scoped)
// =============================================================================

/**
 * Get working memory state for a deployment.
 * @param deploymentId - The deployment's UUID.
 * @returns Working memory state.
 */
export async function getWorkingMemory(
  deploymentId: string
): Promise<WorkingMemoryState> {
  return get<WorkingMemoryState>(`/api/deployments/${deploymentId}/working-memory`);
}

/**
 * Inject user context into working memory.
 * @param deploymentId - The deployment's UUID.
 * @param content - The content to inject.
 * @returns Updated working memory state.
 */
export async function injectWorkingMemory(
  deploymentId: string,
  content: string
): Promise<WorkingMemoryState> {
  return post<WorkingMemoryState>(
    `/api/deployments/${deploymentId}/working-memory`,
    { content }
  );
}

/**
 * Clear working memory for a deployment.
 * @param deploymentId - The deployment's UUID.
 * @returns Empty working memory state.
 */
export async function clearWorkingMemory(
  deploymentId: string
): Promise<WorkingMemoryState> {
  return del<WorkingMemoryState>(`/api/deployments/${deploymentId}/working-memory`);
}

/**
 * Memory service object for convenient access.
 */
export const memoryService = {
  create: createMemory,
  update: updateMemory,
  delete: deleteMemory,
  // Suggestions
  getSuggestions: getMemorySuggestions,
  approveSuggestion: approveMemorySuggestion,
  rejectSuggestion: rejectMemorySuggestion,
  // Working memory
  getWorkingMemory,
  injectWorkingMemory,
  clearWorkingMemory,
};
