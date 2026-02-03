/**
 * Component-related TypeScript types matching backend schemas.
 */

import type { AgentVersion } from './version';

/**
 * Component type enum values.
 */
export type ComponentType = 'skill' | 'mcp_tool' | 'memory' | 'agent' | 'other';

/**
 * Memory type for memory components.
 */
export type MemoryComponentType = 'working' | 'short_term' | 'long_term' | 'procedural';

/**
 * Component data returned from API.
 */
export interface Component {
  id: string;
  type: ComponentType;
  name: string;
  description: string | null;
  content: string | null;
  source_path: string | null;
  /** Memory type (only for memory components) */
  memory_type?: MemoryComponentType | null;
  /** Folder this component belongs to */
  folder_id?: string | null;
}

/**
 * Component folder for grouping related components.
 */
export interface ComponentFolder {
  id: string;
  version_id: string;
  type: ComponentType;
  name: string;
  description: string | null;
  source_path: string | null;
  file_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Minimal component info for folder detail view.
 */
export interface ComponentInFolder {
  id: string;
  name: string;
  description: string | null;
  source_path: string | null;
  memory_type?: MemoryComponentType | null;
}

/**
 * Folder detail response with components.
 */
export interface ComponentFolderDetail extends ComponentFolder {
  components: ComponentInFolder[];
}

/**
 * Folders grouped by component type.
 */
export interface FoldersByType {
  skills: ComponentFolder[];
  mcp_tools: ComponentFolder[];
  memory: ComponentFolder[];
  agents: ComponentFolder[];
}

/**
 * Request body for updating a component.
 */
export interface ComponentUpdate {
  name?: string;
  description?: string | null;
  content?: string | null;
}

/**
 * Response from component edit endpoint.
 */
export interface ComponentEditResponse {
  component: Component;
  new_version: AgentVersion;
}
