/**
 * Export service for downloading agent configurations.
 */

import { apiClient } from './api';

/**
 * Export request options.
 */
export interface ExportOptions {
  /** Component IDs to exclude from export. */
  excludedComponentIds?: string[];
}

/**
 * Export an agent's configuration as a zip file.
 * @param agentId - The agent's UUID.
 * @param options - Export options including excluded component IDs.
 * @returns A Blob containing the zip file.
 */
export async function exportAgent(agentId: string, options: ExportOptions = {}): Promise<Blob> {
  const response = await apiClient.post(
    `/api/agents/${agentId}/export`,
    { excluded_component_ids: options.excludedComponentIds || [] },
    { responseType: 'blob' }
  );
  return response.data as Blob;
}

/**
 * Export and download an agent's configuration.
 * Triggers a browser download of the zip file.
 * @param agentId - The agent's UUID.
 * @param agentName - The agent's name (used for filename).
 * @param options - Export options including excluded component IDs.
 */
export async function downloadAgentExport(
  agentId: string,
  agentName: string,
  options: ExportOptions = {}
): Promise<void> {
  const blob = await exportAgent(agentId, options);

  // Create download link
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  // Sanitize agent name for filename
  const safeName = agentName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  link.download = `${safeName}_export.zip`;

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Export service object for convenient access.
 */
export const exportService = {
  export: exportAgent,
  download: downloadAgentExport,
};
