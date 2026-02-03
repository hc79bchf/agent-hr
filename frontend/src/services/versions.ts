/**
 * Version service for agent version operations.
 */

import { get, post, postFormData, buildQueryString } from './api';
import type { AgentVersion, VersionListResponse, VersionListParams, VersionCompareResponse } from '../types';

/**
 * List versions for an agent.
 * @param agentId - The agent's UUID.
 * @param params - Query parameters for pagination.
 * @returns Paginated list of versions.
 */
export async function listVersions(
  agentId: string,
  params: VersionListParams = {}
): Promise<VersionListResponse> {
  const queryString = buildQueryString({
    skip: params.skip,
    limit: params.limit,
  });
  return get<VersionListResponse>(`/api/agents/${agentId}/versions${queryString}`);
}

/**
 * Get a specific version.
 * @param agentId - The agent's UUID.
 * @param versionId - The version's UUID.
 * @returns The version data with components.
 */
export async function getVersion(agentId: string, versionId: string): Promise<AgentVersion> {
  return get<AgentVersion>(`/api/agents/${agentId}/versions/${versionId}`);
}

/**
 * Upload a configuration file to create a new version.
 * @param agentId - The agent's UUID.
 * @param file - The file to upload (zip or single file).
 * @returns The created version.
 */
export async function uploadVersion(agentId: string, file: File): Promise<AgentVersion> {
  const formData = new FormData();
  formData.append('file', file);
  return postFormData<AgentVersion>(`/api/agents/${agentId}/upload`, formData);
}

/**
 * Rollback to a previous version.
 * Creates a new version that copies the configuration from the specified source version.
 * @param agentId - The agent's UUID.
 * @param versionId - The version ID to rollback to.
 * @returns The newly created rollback version.
 */
export async function rollbackToVersion(agentId: string, versionId: string): Promise<AgentVersion> {
  return post<AgentVersion>(`/api/agents/${agentId}/rollback/${versionId}`);
}

/**
 * Compare two versions of an agent.
 * @param agentId - Agent UUID.
 * @param versionAId - First version UUID.
 * @param versionBId - Second version UUID.
 * @returns Comparison result with diffs.
 */
export async function compareVersions(
  agentId: string,
  versionAId: string,
  versionBId: string
): Promise<VersionCompareResponse> {
  return get<VersionCompareResponse>(
    `/api/agents/${agentId}/versions/compare?version_a=${versionAId}&version_b=${versionBId}`
  );
}

/**
 * Version service object for convenient access.
 */
export const versionService = {
  list: listVersions,
  get: getVersion,
  upload: uploadVersion,
  rollback: rollbackToVersion,
  compare: compareVersions,
};
