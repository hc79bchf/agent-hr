/**
 * OwnershipManagementSection component.
 * Displays and manages owner and manager for a component.
 */

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { componentRegistryService } from '../../services/componentRegistry';
import { usersService } from '../../services/users';
import type { ComponentRegistryEntry, ComponentOwnershipUpdate, UserInfo } from '../../types';
import { Modal } from '../ui';

interface OwnershipManagementSectionProps {
  component: ComponentRegistryEntry;
  currentUserId: string;
  onComponentUpdate?: (updated: ComponentRegistryEntry) => void;
}

interface UserDisplayProps {
  label: string;
  user: UserInfo | null | undefined;
  onEdit?: () => void;
  canEdit: boolean;
}

function UserDisplay({ label, user, onEdit, canEdit }: UserDisplayProps) {
  return (
    <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        {user ? (
          <div className="mt-1">
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
        ) : (
          <p className="mt-1 text-sm text-gray-400 italic">Not assigned</p>
        )}
      </div>
      {canEdit && onEdit && (
        <button
          onClick={onEdit}
          className="text-sm text-indigo-600 hover:text-indigo-900"
        >
          {user ? 'Change' : 'Assign'}
        </button>
      )}
    </div>
  );
}

export function OwnershipManagementSection({
  component,
  currentUserId,
  onComponentUpdate,
}: OwnershipManagementSectionProps) {
  const queryClient = useQueryClient();
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState('');
  const [newManagerId, setNewManagerId] = useState('');

  const isOwner = component.owner_id === currentUserId;
  const isManager = component.manager_id === currentUserId;

  const [error, setError] = useState<string | null>(null);

  // Fetch users when modals are open
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersService.list(),
    enabled: isOwnerModalOpen || isManagerModalOpen,
  });

  // Update ownership mutation
  const updateOwnershipMutation = useMutation({
    mutationFn: (data: ComponentOwnershipUpdate) =>
      componentRegistryService.updateOwnership(component.id, data),
    onSuccess: (updatedComponent) => {
      // Invalidate ALL component-registry queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['component-registry'] });
      // Notify parent to update the selected component
      onComponentUpdate?.(updatedComponent);
      setIsOwnerModalOpen(false);
      setIsManagerModalOpen(false);
      setNewOwnerId('');
      setNewManagerId('');
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to update ownership. You may not have permission.');
    },
  });

  const handleTransferOwnership = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!newOwnerId.trim()) return;
      updateOwnershipMutation.mutate({ owner_id: newOwnerId.trim() });
    },
    [newOwnerId, updateOwnershipMutation]
  );

  const handleAssignManager = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      // Empty string means remove manager - use zero UUID to signal removal
      const managerId = newManagerId || '00000000-0000-0000-0000-000000000000';
      updateOwnershipMutation.mutate({ manager_id: managerId });
    },
    [newManagerId, updateOwnershipMutation]
  );

  const handleRemoveManager = useCallback(() => {
    if (window.confirm('Are you sure you want to remove the manager?')) {
      // Use empty UUID to signal removal
      updateOwnershipMutation.mutate({ manager_id: '00000000-0000-0000-0000-000000000000' });
    }
  }, [updateOwnershipMutation]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-gray-900">Ownership</h3>
        <p className="mt-1 text-sm text-gray-500">
          Manage who owns and manages this component
        </p>
      </div>

      {/* Owner and Manager Display */}
      <div className="space-y-3">
        <UserDisplay
          label="Owner"
          user={component.owner}
          onEdit={() => {
            setNewOwnerId('');
            setIsOwnerModalOpen(true);
          }}
          canEdit={isOwner}
        />

        <UserDisplay
          label="Manager"
          user={component.manager}
          onEdit={() => {
            setNewManagerId(component.manager?.id || '');
            setIsManagerModalOpen(true);
          }}
          canEdit={isOwner || isManager}
        />
      </div>

      {/* Remove Manager Button (if manager exists and user can edit) */}
      {component.manager && (isOwner || isManager) && (
        <div className="pt-2">
          <button
            onClick={handleRemoveManager}
            className="text-sm text-red-600 hover:text-red-900"
          >
            Remove Manager
          </button>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      <Modal
        isOpen={isOwnerModalOpen}
        onClose={() => setIsOwnerModalOpen(false)}
        title="Transfer Ownership"
      >
        <form onSubmit={handleTransferOwnership} className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
            <div className="flex">
              <svg className="h-5 w-5 text-yellow-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-yellow-800">Warning</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  Transferring ownership will give the new owner full control over this component.
                  You will no longer be able to manage it.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="new_owner_id" className="block text-sm font-medium text-gray-700">
              New Owner
            </label>
            {isLoadingUsers ? (
              <div className="mt-1 text-sm text-gray-500">Loading users...</div>
            ) : (
              <select
                id="new_owner_id"
                value={newOwnerId}
                onChange={(e) => setNewOwnerId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              >
                <option value="">Select a user...</option>
                {users
                  .filter((user) => user.id !== component.owner_id)
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
              </select>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Select the user who should become the new owner.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsOwnerModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateOwnershipMutation.isPending || !newOwnerId}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {updateOwnershipMutation.isPending ? 'Transferring...' : 'Transfer Ownership'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Manager Modal */}
      <Modal
        isOpen={isManagerModalOpen}
        onClose={() => setIsManagerModalOpen(false)}
        title={component.manager ? 'Change Manager' : 'Assign Manager'}
      >
        <form onSubmit={handleAssignManager} className="space-y-4">
          <div>
            <label htmlFor="new_manager_id" className="block text-sm font-medium text-gray-700">
              Manager
            </label>
            {isLoadingUsers ? (
              <div className="mt-1 text-sm text-gray-500">Loading users...</div>
            ) : (
              <select
                id="new_manager_id"
                value={newManagerId}
                onChange={(e) => setNewManagerId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">No manager (remove if assigned)</option>
                {users
                  .filter((user) => user.id !== component.owner_id)
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
              </select>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Select a user to manage this component, or select "No manager" to remove the current manager.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsManagerModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateOwnershipMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {updateOwnershipMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default OwnershipManagementSection;
