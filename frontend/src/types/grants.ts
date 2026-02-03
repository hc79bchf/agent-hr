/**
 * Component access control TypeScript types matching backend schemas.
 */

/**
 * Access level enum for component grants.
 * - viewer: Can view component details (default)
 * - executor: Can execute/use the component
 * - contributor: Can modify the component
 */
export type ComponentAccessLevel = 'viewer' | 'executor' | 'contributor';

/**
 * Request status enum for access requests.
 */
export type RequestStatus = 'pending' | 'approved' | 'denied';

/**
 * Component grant data returned from API.
 */
export interface ComponentGrant {
  id: string;
  component_id: string;
  agent_id: string;
  access_level: ComponentAccessLevel;
  granted_by: string;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  is_active: boolean;
}

/**
 * Request body for creating a component grant.
 */
export interface ComponentGrantCreate {
  component_id: string;
  agent_id: string;
  access_level?: ComponentAccessLevel;
  expires_at?: string | null;
}

/**
 * Request body for updating a component grant.
 */
export interface ComponentGrantUpdate {
  access_level?: ComponentAccessLevel;
  expires_at?: string | null;
}

/**
 * Paginated list response for component grants.
 */
export interface ComponentGrantListResponse {
  data: ComponentGrant[];
  total: number;
}

/**
 * Component access request data returned from API.
 */
export interface ComponentAccessRequest {
  id: string;
  component_id: string;
  agent_id: string;
  agent_name: string | null;
  requested_level: ComponentAccessLevel;
  requested_by: string;
  requester_name: string | null;
  requested_at: string;
  status: RequestStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  denial_reason: string | null;
  is_pending: boolean;
}

/**
 * Request body for creating an access request.
 */
export interface ComponentAccessRequestCreate {
  component_id: string;
  agent_id: string;
  requested_level: ComponentAccessLevel;
}

/**
 * Request body for resolving (approve/deny) an access request.
 */
export interface ComponentAccessRequestResolve {
  approve: boolean;
  denial_reason?: string | null;
}

/**
 * Paginated list response for access requests.
 */
export interface ComponentAccessRequestListResponse {
  data: ComponentAccessRequest[];
  total: number;
}

/**
 * Query parameters for listing access requests.
 */
export interface AccessRequestListParams {
  pending_only?: boolean;
  status?: 'pending' | 'approved' | 'denied';
  skip?: number;
  limit?: number;
}
