/**
 * EditAgentModal component for editing agent metadata.
 * Allows updating name, description, tags, department, usage notes, organization, and manager.
 */

import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Modal } from '../ui/Modal';
import { agentService, organizationsService, usersService } from '../../services';
import { agentKeys } from '../../hooks';
import type { Agent, AgentUpdate, User } from '../../types';
import type { Organization } from '../../services/organizations';

/** Empty string constant for null manager selection */
const NO_MANAGER = '';

/**
 * Props for EditAgentModal.
 */
interface EditAgentModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** The agent to edit */
  agent: Agent;
  /** Callback when agent is updated */
  onSuccess?: () => void;
}

/**
 * EditAgentModal component.
 */
export function EditAgentModal({
  isOpen,
  onClose,
  agent,
  onSuccess,
}: EditAgentModalProps) {
  const queryClient = useQueryClient();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [department, setDepartment] = useState('');
  const [usageNotes, setUsageNotes] = useState('');
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [managerId, setManagerId] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fetch organizations
  const { data: organizations } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizationsService.list(),
  });

  // Fetch users for manager dropdown
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersService.list(),
  });

  // Reset form when modal opens or agent changes
  useEffect(() => {
    if (isOpen && agent) {
      setName(agent.name);
      setDescription(agent.description || '');
      setTags(agent.tags?.join(', ') || '');
      setDepartment(agent.department || '');
      setUsageNotes(agent.usage_notes || '');
      setOrganizationId(agent.organization_id || null);
      setManagerId(agent.manager_id || '');
      setError(null);
    }
  }, [isOpen, agent]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: AgentUpdate) => agentService.update(agent.id, data),
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: agentKeys.detail(agent.id) });
      queryClient.invalidateQueries({ queryKey: agentKeys.all });
      handleClose();
      onSuccess?.();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to update agent');
    },
  });

  const isSubmitting = updateMutation.isPending;

  // Handle close
  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      setError(null);
      onClose();
    }
  }, [isSubmitting, onClose]);

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setError(null);

    // Parse tags from comma-separated string
    const parsedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    updateMutation.mutate({
      name: name.trim(),
      description: description.trim() || null,
      tags: parsedTags,
      department: department.trim() || null,
      usage_notes: usageNotes.trim() || null,
      organization_id: organizationId || null,
      manager_id: managerId.trim() || null,
    });
  }, [name, description, tags, department, usageNotes, organizationId, managerId, updateMutation]);

  // Check if form has changes
  const hasChanges =
    name !== agent.name ||
    description !== (agent.description || '') ||
    tags !== (agent.tags?.join(', ') || '') ||
    department !== (agent.department || '') ||
    usageNotes !== (agent.usage_notes || '') ||
    organizationId !== (agent.organization_id || null) ||
    managerId !== (agent.manager_id || '');

  // Footer buttons
  const footer = (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={handleClose}
        disabled={isSubmitting}
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || !name.trim() || !hasChanges}
        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Edit Agent Details"
      size="lg"
      footer={footer}
      closeOnEscape={!isSubmitting}
      closeOnBackdropClick={!isSubmitting}
    >
      <div className="space-y-4">
        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Name field */}
        <div>
          <label htmlFor="agent-name" className="block text-sm font-medium text-gray-700">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="agent-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., HR Assistant, Sales Bot"
            disabled={isSubmitting}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
          />
        </div>

        {/* Description field */}
        <div>
          <label htmlFor="agent-description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="agent-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Brief description of what this agent does..."
            disabled={isSubmitting}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
          />
        </div>

        {/* Tags field */}
        <div>
          <label htmlFor="agent-tags" className="block text-sm font-medium text-gray-700">
            Tags
          </label>
          <input
            type="text"
            id="agent-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g., hr, onboarding, internal"
            disabled={isSubmitting}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
          />
          <p className="mt-1 text-xs text-gray-500">
            Comma-separated list of tags for categorization and search.
          </p>
        </div>

        {/* Department field */}
        <div>
          <label htmlFor="agent-department" className="block text-sm font-medium text-gray-700">
            Department
          </label>
          <input
            type="text"
            id="agent-department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="e.g., Human Resources, Engineering"
            disabled={isSubmitting}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
          />
        </div>

        {/* Organization field */}
        <div>
          <label htmlFor="agent-organization" className="block text-sm font-medium text-gray-700">
            Organization
          </label>
          <select
            id="agent-organization"
            value={organizationId || ''}
            onChange={(e) => setOrganizationId(e.target.value || null)}
            disabled={isSubmitting}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
          >
            <option value="">No organization</option>
            {organizations?.map((org: Organization) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Assign this agent to an organization.
          </p>
        </div>

        {/* Manager field */}
        <div>
          <label htmlFor="agent-manager" className="block text-sm font-medium text-gray-700">
            Manager
          </label>
          <select
            id="agent-manager"
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
            disabled={isSubmitting}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
          >
            <option value={NO_MANAGER}>No manager</option>
            {users?.map((user: User) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.email})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Select the user who manages this agent.
          </p>
        </div>

        {/* Usage Notes field */}
        <div>
          <label htmlFor="agent-usage-notes" className="block text-sm font-medium text-gray-700">
            Usage Notes
          </label>
          <textarea
            id="agent-usage-notes"
            value={usageNotes}
            onChange={(e) => setUsageNotes(e.target.value)}
            rows={3}
            placeholder="Any special instructions or notes for using this agent..."
            disabled={isSubmitting}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
          />
        </div>
      </div>
    </Modal>
  );
}
