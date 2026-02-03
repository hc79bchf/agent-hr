import { apiClient } from './api';

export type StakeholderRole = 'owner' | 'contributor' | 'viewer' | 'admin';

export interface Stakeholder {
  id: string;
  agent_id: string;
  user_id: string;
  role: StakeholderRole;
  granted_by: string;
  granted_at: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface AddStakeholderRequest {
  user_id: string;
  role: StakeholderRole;
}

export interface UpdateStakeholderRequest {
  role: StakeholderRole;
}

export const stakeholdersService = {
  async list(agentId: string): Promise<Stakeholder[]> {
    const response = await apiClient.get<Stakeholder[]>(`/api/agents/${agentId}/stakeholders`);
    return response.data;
  },

  async add(agentId: string, data: AddStakeholderRequest): Promise<Stakeholder> {
    const response = await apiClient.post<Stakeholder>(`/api/agents/${agentId}/stakeholders`, data);
    return response.data;
  },

  async update(agentId: string, userId: string, data: UpdateStakeholderRequest): Promise<Stakeholder> {
    const response = await apiClient.put<Stakeholder>(`/api/agents/${agentId}/stakeholders/${userId}`, data);
    return response.data;
  },

  async remove(agentId: string, userId: string): Promise<void> {
    await apiClient.delete(`/api/agents/${agentId}/stakeholders/${userId}`);
  },
};

export default stakeholdersService;
