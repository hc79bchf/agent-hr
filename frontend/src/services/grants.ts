import { apiClient } from './api';
import type {
  ComponentGrant,
  ComponentGrantCreate,
  ComponentGrantUpdate,
  ComponentGrantListResponse,
  ComponentAccessRequest,
  ComponentAccessRequestCreate,
  ComponentAccessRequestResolve,
  ComponentAccessRequestListResponse,
  AccessRequestListParams,
} from '../types';

/**
 * Service for managing component grants (who can access what).
 */
export const grantsService = {
  /**
   * List all grants for a component.
   */
  async listByComponent(componentId: string): Promise<ComponentGrantListResponse> {
    const response = await apiClient.get<ComponentGrantListResponse>(
      `/api/components/${componentId}/grants`
    );
    return response.data;
  },

  /**
   * Get a specific grant for an agent on a component.
   */
  async get(componentId: string, agentId: string): Promise<ComponentGrant> {
    const response = await apiClient.get<ComponentGrant>(
      `/api/components/${componentId}/grants/${agentId}`
    );
    return response.data;
  },

  /**
   * Create a new grant (grant access to an agent).
   */
  async create(componentId: string, data: Omit<ComponentGrantCreate, 'component_id'>): Promise<ComponentGrant> {
    const response = await apiClient.post<ComponentGrant>(
      `/api/components/${componentId}/grants`,
      { ...data, component_id: componentId }
    );
    return response.data;
  },

  /**
   * Update an existing grant (change access level).
   */
  async update(componentId: string, agentId: string, data: ComponentGrantUpdate): Promise<ComponentGrant> {
    const response = await apiClient.patch<ComponentGrant>(
      `/api/components/${componentId}/grants/${agentId}`,
      data
    );
    return response.data;
  },

  /**
   * Revoke a grant (remove access).
   */
  async revoke(componentId: string, agentId: string): Promise<void> {
    await apiClient.delete(`/api/components/${componentId}/grants/${agentId}`);
  },
};

/**
 * Service for managing access requests.
 */
export const accessRequestsService = {
  /**
   * Create an access request for an agent to a component.
   */
  async create(agentId: string, data: Omit<ComponentAccessRequestCreate, 'agent_id'>): Promise<ComponentAccessRequest> {
    const response = await apiClient.post<ComponentAccessRequest>(
      `/api/agents/${agentId}/access-requests`,
      { ...data, agent_id: agentId }
    );
    return response.data;
  },

  /**
   * List access requests for an agent.
   */
  async listByAgent(agentId: string, params?: AccessRequestListParams): Promise<ComponentAccessRequestListResponse> {
    const response = await apiClient.get<ComponentAccessRequestListResponse>(
      `/api/agents/${agentId}/access-requests`,
      { params }
    );
    return response.data;
  },

  /**
   * List access requests for a component.
   */
  async listByComponent(componentId: string, params?: AccessRequestListParams): Promise<ComponentAccessRequestListResponse> {
    const response = await apiClient.get<ComponentAccessRequestListResponse>(
      `/api/components/${componentId}/access-requests`,
      { params }
    );
    return response.data;
  },

  /**
   * Get a specific access request.
   */
  async get(requestId: string): Promise<ComponentAccessRequest> {
    const response = await apiClient.get<ComponentAccessRequest>(
      `/api/access-requests/${requestId}`
    );
    return response.data;
  },

  /**
   * Resolve (approve or deny) an access request.
   */
  async resolve(requestId: string, data: ComponentAccessRequestResolve): Promise<ComponentAccessRequest> {
    const response = await apiClient.post<ComponentAccessRequest>(
      `/api/access-requests/${requestId}/resolve`,
      data
    );
    return response.data;
  },

  /**
   * Approve an access request (convenience method).
   */
  async approve(requestId: string): Promise<ComponentAccessRequest> {
    return this.resolve(requestId, { approve: true });
  },

  /**
   * Deny an access request (convenience method).
   */
  async deny(requestId: string, denialReason: string): Promise<ComponentAccessRequest> {
    return this.resolve(requestId, { approve: false, denial_reason: denialReason });
  },
};

export default { grantsService, accessRequestsService };
