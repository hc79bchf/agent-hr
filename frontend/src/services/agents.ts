/**
 * Agent service for CRUD operations on agents.
 */

import { get, post, patch, del, buildQueryString } from './api';
import type { Agent, AgentCreate, AgentUpdate, AgentListResponse, AgentListParams } from '../types';

/**
 * List agents with optional filtering and pagination.
 * @param params - Query parameters for filtering/pagination.
 * @returns Paginated list of agents.
 */
export async function listAgents(params: AgentListParams = {}): Promise<AgentListResponse> {
  const queryString = buildQueryString({
    status: params.status,
    search: params.search,
    skip: params.skip,
    limit: params.limit,
  });
  return get<AgentListResponse>(`/api/agents${queryString}`);
}

/**
 * Create a new agent.
 * @param data - Agent creation data.
 * @returns The created agent.
 */
export async function createAgent(data: AgentCreate): Promise<Agent> {
  return post<Agent>('/api/agents', data);
}

/**
 * Get an agent by ID.
 * @param id - The agent's UUID.
 * @returns The agent data.
 */
export async function getAgent(id: string): Promise<Agent> {
  return get<Agent>(`/api/agents/${id}`);
}

/**
 * Update an agent.
 * @param id - The agent's UUID.
 * @param data - The fields to update.
 * @returns The updated agent.
 */
export async function updateAgent(id: string, data: AgentUpdate): Promise<Agent> {
  return patch<Agent>(`/api/agents/${id}`, data);
}

/**
 * Delete an agent (soft delete).
 * @param id - The agent's UUID.
 */
export async function deleteAgent(id: string): Promise<void> {
  await del(`/api/agents/${id}`);
}

/**
 * Agent service object for convenient access.
 */
export const agentService = {
  list: listAgents,
  create: createAgent,
  get: getAgent,
  update: updateAgent,
  delete: deleteAgent,
};
