/**
 * Memory-related TypeScript types matching backend schemas.
 */

import type { AgentVersion } from './version';

/**
 * Memory type enum - cognitive memory model.
 */
export type MemoryType = 'working' | 'short_term' | 'long_term' | 'procedural';

/**
 * Memory suggestion status.
 */
export type SuggestionStatus = 'pending' | 'approved' | 'rejected';

/**
 * Labels and descriptions for memory types.
 */
export const MEMORY_TYPE_INFO: Record<MemoryType, { label: string; description: string }> = {
  working: {
    label: 'Working Memory',
    description: 'Current session context, auto-managed by the system',
  },
  short_term: {
    label: 'Short-Term Memory',
    description: 'Persists during session, cleared when session ends',
  },
  long_term: {
    label: 'Long-Term Memory',
    description: 'Permanent storage, persists across all sessions',
  },
  procedural: {
    label: 'Procedural Memory',
    description: 'How-to knowledge and procedures in markdown format',
  },
};

/**
 * Memory types that can be manually created by users.
 */
export const CREATABLE_MEMORY_TYPES: MemoryType[] = ['short_term', 'long_term', 'procedural'];

/**
 * Request body for creating a memory.
 */
export interface MemoryCreate {
  name: string;
  content: string;
  description?: string;
  memory_type?: MemoryType;
}

/**
 * Request body for updating a memory.
 */
export interface MemoryUpdate {
  name?: string;
  content?: string;
  description?: string;
  memory_type?: MemoryType;
}

/**
 * Memory response from API.
 */
export interface Memory {
  id: string;
  name: string;
  description: string | null;
  content: string | null;
  source_path: string | null;
  memory_type: MemoryType | null;
  created_at: string | null;
}

/**
 * Response from memory create/update endpoints.
 */
export interface MemoryResponse {
  memory: Memory;
  new_version: AgentVersion;
}

/**
 * Memory suggestion from agent during conversation.
 */
export interface MemorySuggestion {
  id: string;
  agent_id: string;
  deployment_id: string | null;
  suggested_name: string;
  suggested_content: string;
  suggested_type: MemoryType;
  source_message_id: string | null;
  status: SuggestionStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

/**
 * Request body for reviewing a memory suggestion.
 */
export interface MemorySuggestionReview {
  status: 'approved' | 'rejected';
}

/**
 * List response for memory suggestions.
 */
export interface MemorySuggestionListResponse {
  data: MemorySuggestion[];
  total: number;
}

/**
 * Working memory state for a deployment.
 */
export interface WorkingMemoryState {
  items: WorkingMemoryItem[];
  user_injected: WorkingMemoryItem[];
}

/**
 * Single item in working memory.
 */
export interface WorkingMemoryItem {
  id: string;
  content: string;
  source: 'system' | 'user' | 'conversation';
  created_at: string;
}

/**
 * Request to inject context into working memory.
 */
export interface WorkingMemoryInject {
  content: string;
}
