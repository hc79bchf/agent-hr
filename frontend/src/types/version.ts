/**
 * Version-related TypeScript types matching backend schemas.
 */

import type { Component } from './component';

/**
 * Change type enum values.
 */
export type ChangeType = 'upload' | 'edit' | 'rollback';

/**
 * Agent version data returned from API.
 */
export interface AgentVersion {
  id: string;
  agent_id: string;
  version_number: number;
  change_type: ChangeType;
  change_summary: string | null;
  created_by: string;
  created_at: string;
  components: Component[];
}

/**
 * Paginated list response for versions.
 */
export interface VersionListResponse {
  data: AgentVersion[];
  total: number;
}

/**
 * Query parameters for listing versions.
 */
export interface VersionListParams {
  skip?: number;
  limit?: number;
}

/**
 * Change type for component diffs in version comparison.
 */
export type DiffChangeType = 'added' | 'removed' | 'modified';

/**
 * Represents a diff for a single component between two versions.
 */
export interface ComponentDiff {
  name: string;
  type: string;
  change_type: DiffChangeType;
  content_a: string | null;
  content_b: string | null;
}

/**
 * Summary info for a version in comparison.
 */
export interface VersionSummary {
  id: string;
  version_number: number;
  change_type: string;
  created_at: string;
}

/**
 * Summary of changes for a component category.
 */
export interface DiffSummary {
  added: number;
  removed: number;
  modified: number;
}

/**
 * Response from version comparison endpoint.
 */
export interface VersionCompareResponse {
  version_a: VersionSummary;
  version_b: VersionSummary;
  skills: ComponentDiff[];
  mcp_tools: ComponentDiff[];
  memory: ComponentDiff[];
  agents: ComponentDiff[];
  summary: Record<string, DiffSummary>;
}
