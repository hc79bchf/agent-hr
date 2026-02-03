import { apiClient } from './api';

export interface Organization {
  id: string;
  name: string;
  parent_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateOrganizationRequest {
  name: string;
  parent_id?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateOrganizationRequest {
  name?: string;
  parent_id?: string;
  metadata?: Record<string, unknown>;
}

export const organizationsService = {
  async list(): Promise<Organization[]> {
    const response = await apiClient.get<Organization[]>('/api/organizations');
    return response.data;
  },

  async get(id: string): Promise<Organization> {
    const response = await apiClient.get<Organization>(`/organizations/${id}`);
    return response.data;
  },

  async create(data: CreateOrganizationRequest): Promise<Organization> {
    const response = await apiClient.post<Organization>('/api/organizations', data);
    return response.data;
  },

  async update(id: string, data: UpdateOrganizationRequest): Promise<Organization> {
    const response = await apiClient.put<Organization>(`/organizations/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/organizations/${id}`);
  },
};

export default organizationsService;
