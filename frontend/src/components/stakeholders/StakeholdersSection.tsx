/**
 * StakeholdersSection component.
 * Displays and manages stakeholders for an agent.
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stakeholdersService } from '../../services/stakeholders';
import { usersService } from '../../services/users';
import type { Stakeholder, StakeholderRole, AddStakeholderRequest } from '../../services/stakeholders';
import type { User } from '../../types';
import { Modal } from '../ui';

interface StakeholdersSectionProps {
  agentId: string;
}

const ROLE_LABELS: Record<StakeholderRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  contributor: 'Contributor',
  viewer: 'Viewer',
};

const ROLE_COLORS: Record<StakeholderRole, string> = {
  owner: 'bg-purple-100 text-purple-800',
  admin: 'bg-red-100 text-red-800',
  contributor: 'bg-blue-100 text-blue-800',
  viewer: 'bg-gray-100 text-gray-800',
};

export function StakeholdersSection({ agentId }: StakeholdersSectionProps) {
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState<AddStakeholderRequest>({
    user_id: '',
    role: 'viewer',
  });

  // Fetch stakeholders
  const {
    data: stakeholders,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['stakeholders', agentId],
    queryFn: () => stakeholdersService.list(agentId),
  });

  // Fetch users for dropdown
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersService.list(),
  });

  // Add stakeholder mutation
  const addMutation = useMutation({
    mutationFn: (data: AddStakeholderRequest) => stakeholdersService.add(agentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stakeholders', agentId] });
      handleCloseModal();
    },
  });

  // Remove stakeholder mutation
  const removeMutation = useMutation({
    mutationFn: (userId: string) => stakeholdersService.remove(agentId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stakeholders', agentId] });
    },
  });

  // Update stakeholder mutation
  const updateMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: StakeholderRole }) =>
      stakeholdersService.update(agentId, userId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stakeholders', agentId] });
    },
  });

  const handleOpenModal = useCallback(() => {
    setFormData({ user_id: '', role: 'viewer' });
    setIsAddModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsAddModalOpen(false);
    setFormData({ user_id: '', role: 'viewer' });
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      addMutation.mutate(formData);
    },
    [formData, addMutation]
  );

  const handleRemove = useCallback(
    (stakeholder: Stakeholder) => {
      if (window.confirm(`Remove ${stakeholder.user?.name || stakeholder.user_id} from this agent?`)) {
        removeMutation.mutate(stakeholder.user_id);
      }
    },
    [removeMutation]
  );

  const handleRoleChange = useCallback(
    (stakeholder: Stakeholder, newRole: StakeholderRole) => {
      updateMutation.mutate({ userId: stakeholder.user_id, role: newRole });
    },
    [updateMutation]
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-3 text-gray-600">Loading stakeholders...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <h3 className="text-sm font-medium text-red-800">Error loading stakeholders</h3>
        <p className="mt-1 text-sm text-red-700">
          {(error as Error)?.message || 'An unexpected error occurred'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Stakeholders</h3>
          <p className="mt-1 text-sm text-gray-500">
            Manage who has access to this agent
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <svg
            className="-ml-1 mr-2 h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
          </svg>
          Add Stakeholder
        </button>
      </div>

      {/* Stakeholders List */}
      {stakeholders && stakeholders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No stakeholders</h3>
          <p className="mt-1 text-sm text-gray-500">Add stakeholders to manage access to this agent</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {stakeholders?.map((stakeholder) => (
              <li key={stakeholder.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center min-w-0">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-lg font-medium text-gray-600">
                          {(stakeholder.user?.name || stakeholder.user_id).charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4 truncate">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {stakeholder.user?.name || stakeholder.user_id}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {stakeholder.user?.email || `Added ${new Date(stakeholder.granted_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <select
                      value={stakeholder.role}
                      onChange={(e) => handleRoleChange(stakeholder, e.target.value as StakeholderRole)}
                      className={`text-xs font-medium rounded-full px-3 py-1 ${ROLE_COLORS[stakeholder.role]} border-0 focus:ring-2 focus:ring-indigo-500`}
                    >
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRemove(stakeholder)}
                      className="text-sm text-red-600 hover:text-red-900"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Add Stakeholder Modal */}
      <Modal isOpen={isAddModalOpen} onClose={handleCloseModal} title="Add Stakeholder">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="user_id" className="block text-sm font-medium text-gray-700">
              User
            </label>
            <select
              id="user_id"
              value={formData.user_id}
              onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            >
              <option value="">Select a user...</option>
              {users
                ?.filter((user: User) => !stakeholders?.some((s) => s.user_id === user.id))
                .map((user: User) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700">
              Role
            </label>
            <select
              id="role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as StakeholderRole })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addMutation.isPending || !formData.user_id}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {addMutation.isPending ? 'Adding...' : 'Add Stakeholder'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default StakeholdersSection;
