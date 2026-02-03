/**
 * Types for ComponentRegistry - components with access control.
 */

/**
 * Component type enum.
 */
export type RegistryComponentType = 'skill' | 'tool' | 'memory';

/**
 * Component visibility enum.
 */
export type ComponentVisibility = 'private' | 'organization' | 'public';

/**
 * Basic user info embedded in responses.
 */
export interface UserInfo {
  id: string;
  name: string;
  email: string;
}

/**
 * Component registry entry.
 */
export interface ComponentRegistryEntry {
  id: string;
  type: RegistryComponentType;
  name: string;
  description?: string;
  content?: string;
  tags?: string[];
  owner_id: string;
  organization_id?: string;
  manager_id?: string;
  visibility: ComponentVisibility;
  component_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  owner?: UserInfo;
  manager?: UserInfo;
}

/**
 * Request to create a component in the registry.
 */
export interface ComponentRegistryCreate {
  type: RegistryComponentType;
  name: string;
  description?: string;
  content?: string;
  tags?: string[];
  organization_id?: string;
  manager_id?: string;
  visibility?: ComponentVisibility;
  component_metadata?: Record<string, unknown>;
}

/**
 * Request to update a component in the registry.
 */
export interface ComponentRegistryUpdate {
  name?: string;
  description?: string;
  content?: string;
  tags?: string[];
  manager_id?: string;
  visibility?: ComponentVisibility;
  component_metadata?: Record<string, unknown>;
}

/**
 * Request to update component ownership.
 */
export interface ComponentOwnershipUpdate {
  owner_id?: string;
  manager_id?: string;
}

/**
 * Paginated list response for component registry.
 */
export interface ComponentRegistryListResponse {
  data: ComponentRegistryEntry[];
  total: number;
}

/**
 * Query parameters for listing components.
 */
export interface ComponentRegistryListParams {
  type?: RegistryComponentType;
  visibility?: ComponentVisibility;
  owner_id?: string;
  organization_id?: string;
  search?: string;
  tag?: string;
  skip?: number;
  limit?: number;
}

/**
 * Component snapshot for version history.
 */
export interface ComponentSnapshot {
  id: string;
  component_id: string;
  version_label: string;
  name: string;
  description?: string;
  content?: string;
  tags?: string[];
  component_metadata: Record<string, unknown>;
  created_by: string;
  created_at: string;
  creator?: UserInfo;
}

/**
 * Request to create a snapshot.
 */
export interface ComponentSnapshotCreate {
  version_label: string;
}

/**
 * List response for snapshots.
 */
export interface ComponentSnapshotListResponse {
  data: ComponentSnapshot[];
  total: number;
}
