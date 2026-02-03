/**
 * Agent-related TypeScript types matching backend schemas.
 */

/**
 * Agent status enum values.
 */
export type AgentStatus = 'draft' | 'active' | 'deprecated';

/**
 * Author information nested in agent response.
 */
export interface AuthorInfo {
  id: string;
  name: string;
  email: string;
}

/**
 * Organization information nested in agent response.
 */
export interface OrganizationInfo {
  id: string;
  name: string;
}

/**
 * Manager information nested in agent response.
 */
export interface ManagerInfo {
  id: string;
  name: string;
  email: string;
}

/**
 * Agent data returned from API.
 */
export interface Agent {
  id: string;
  name: string;
  description: string | null;
  author_id: string;
  author: AuthorInfo | null;
  current_version_id: string | null;
  status: AgentStatus;
  tags: string[];
  department: string | null;
  usage_notes: string | null;
  organization_id: string | null;
  organization: OrganizationInfo | null;
  manager_id: string | null;
  manager: ManagerInfo | null;
  version_count: number;
  is_running: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Request body for creating a new agent.
 */
export interface AgentCreate {
  name: string;
  description?: string | null;
  tags?: string[];
  department?: string | null;
  usage_notes?: string | null;
}

/**
 * Request body for updating an agent.
 */
export interface AgentUpdate {
  name?: string;
  description?: string | null;
  status?: AgentStatus;
  tags?: string[];
  department?: string | null;
  usage_notes?: string | null;
  organization_id?: string | null;
  manager_id?: string | null;
}

/**
 * Paginated list response for agents.
 */
export interface AgentListResponse {
  data: Agent[];
  total: number;
}

/**
 * Query parameters for listing agents.
 */
export interface AgentListParams {
  status?: AgentStatus;
  search?: string;
  skip?: number;
  limit?: number;
}
