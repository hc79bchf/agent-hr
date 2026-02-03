/**
 * Re-export all services from a single entry point.
 */

// Base API client
export { apiClient, ApiClientError, get, post, patch, del, postFormData, buildQueryString } from './api';

// Auth service
export { authService, register, login, logout, getCurrentUser } from './auth';

// Agent service
export { agentService, listAgents, createAgent, getAgent, updateAgent, deleteAgent } from './agents';

// Version service
export { versionService, listVersions, getVersion, uploadVersion, rollbackToVersion, compareVersions } from './versions';

// Component service
export { componentService, listComponents, getComponent, editComponent } from './components';

// Export service
export { exportService, exportAgent, downloadAgentExport } from './export';
export type { ExportOptions } from './export';

// Memory service
export { memoryService, createMemory, updateMemory, deleteMemory } from './memory';
export type { MemoryCreate, MemoryUpdate, MemoryCreateResponse, MemoryUpdateResponse, MemoryDeleteResponse } from './memory';

// Library service
export {
  libraryService,
  listLibraryComponents,
  createLibraryComponent,
  createLibraryComponentsBatch,
  getLibraryComponent,
  updateLibraryComponent,
  deleteLibraryComponent,
  listAgentLibraryRefs,
  addLibraryRefToAgent,
  removeLibraryRefFromAgent,
  publishToLibrary,
} from './library';

// Deployment service
export {
  deploymentService,
  deployAgent,
  getActiveDeployment,
  listDeployments,
  getDeployment,
  stopDeployment,
  chatWithDeployment,
  getWebSocketUrl,
} from './deployments';

// Folder service
export {
  folderService,
  listFoldersByType,
  listFolders,
  getFolderDetail,
  getUngroupedComponents,
} from './folders';

// Organizations service
export { organizationsService } from './organizations';
export type { Organization, CreateOrganizationRequest, UpdateOrganizationRequest } from './organizations';

// Stakeholders service
export { stakeholdersService } from './stakeholders';
export type { Stakeholder, StakeholderRole, AddStakeholderRequest, UpdateStakeholderRequest } from './stakeholders';

// Users service
export { usersService } from './users';
export type { UserUpdate } from './users';

// Grants and access requests service
export { grantsService, accessRequestsService } from './grants';

// Component registry service
export { componentRegistryService } from './componentRegistry';
