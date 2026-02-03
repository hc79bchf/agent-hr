/**
 * OrganizationsPage component.
 * Page for managing organizations hierarchy.
 */

import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { organizationsService } from '../services/organizations';
import type { Organization, CreateOrganizationRequest } from '../services/organizations';
import { Modal } from '../components/ui';

/**
 * OrganizationsPage component.
 * Displays organizations in a hierarchical list with create/edit functionality.
 */
export function OrganizationsPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [formData, setFormData] = useState<CreateOrganizationRequest>({
    name: '',
    parent_id: undefined,
  });

  // Fetch organizations
  const { data: organizations, isLoading, isError, error } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizationsService.list(),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateOrganizationRequest) => organizationsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      handleCloseModal();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateOrganizationRequest }) =>
      organizationsService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      handleCloseModal();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => organizationsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });

  const handleOpenCreateModal = useCallback(() => {
    setFormData({ name: '', parent_id: undefined });
    setEditingOrg(null);
    setIsCreateModalOpen(true);
  }, []);

  const handleOpenEditModal = useCallback((org: Organization) => {
    setFormData({ name: org.name, parent_id: org.parent_id || undefined });
    setEditingOrg(org);
    setIsCreateModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsCreateModalOpen(false);
    setEditingOrg(null);
    setFormData({ name: '', parent_id: undefined });
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (editingOrg) {
        updateMutation.mutate({ id: editingOrg.id, data: formData });
      } else {
        createMutation.mutate(formData);
      }
    },
    [editingOrg, formData, createMutation, updateMutation]
  );

  const handleDelete = useCallback(
    (org: Organization) => {
      if (window.confirm(`Are you sure you want to delete "${org.name}"?`)) {
        deleteMutation.mutate(org.id);
      }
    },
    [deleteMutation]
  );

  // Build organization tree
  const buildTree = (orgs: Organization[] | undefined): Map<string | null, Organization[]> => {
    const tree = new Map<string | null, Organization[]>();
    if (!orgs) return tree;

    orgs.forEach((org) => {
      const parentId = org.parent_id;
      if (!tree.has(parentId)) {
        tree.set(parentId, []);
      }
      tree.get(parentId)!.push(org);
    });

    return tree;
  };

  const orgTree = buildTree(organizations);

  const renderOrgNode = (org: Organization, level: number = 0): React.ReactNode => {
    const children = orgTree.get(org.id) || [];

    return (
      <div key={org.id} className="border-l-2 border-gray-200 ml-4">
        <div
          className={`flex items-center justify-between p-4 hover:bg-gray-50 ${
            level === 0 ? 'border-l-0 ml-0' : ''
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-indigo-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">{org.name}</h3>
              <p className="text-xs text-gray-500">
                Created {new Date(org.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenEditModal(org)}
              className="text-sm text-indigo-600 hover:text-indigo-900"
            >
              Edit
            </button>
            <button
              onClick={() => handleDelete(org)}
              className="text-sm text-red-600 hover:text-red-900"
            >
              Delete
            </button>
          </div>
        </div>
        {children.length > 0 && (
          <div className="pl-4">{children.map((child) => renderOrgNode(child, level + 1))}</div>
        )}
      </div>
    );
  };

  const rootOrgs = orgTree.get(null) || [];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-3xl font-bold text-gray-900 hover:text-indigo-600 transition-colors">Agent-HR</Link>
            <nav className="flex items-center gap-6">
              <Link
                to="/agents"
                className="text-sm font-medium text-gray-600 hover:text-indigo-500"
              >
                Agents
              </Link>
              <Link
                to="/component-registry"
                className="text-sm font-medium text-gray-600 hover:text-indigo-500"
              >
                Components
              </Link>
              <Link
                to="/organizations"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                Organizations
              </Link>
              <Link
                to="/users"
                className="text-sm font-medium text-gray-600 hover:text-indigo-500"
              >
                Users
              </Link>
              <Link
                to="/api-docs"
                className="text-sm font-medium text-gray-600 hover:text-indigo-500"
              >
                API Docs
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Welcome, {user?.name}</span>
            <button
              onClick={logout}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Page Title */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Organizations</h2>
            <p className="mt-1 text-sm text-gray-500">
              Manage your organization hierarchy
            </p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg
              className="-ml-1 mr-2 h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
            Add Organization
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-gray-600">Loading organizations...</span>
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading organizations</h3>
                <p className="mt-1 text-sm text-red-700">
                  {(error as Error)?.message || 'An unexpected error occurred'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Organization Tree */}
        {!isLoading && !isError && organizations && (
          <div className="bg-white shadow rounded-lg">
            {rootOrgs.length === 0 ? (
              <div className="text-center py-12">
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
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No organizations</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Get started by creating your first organization
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {rootOrgs.map((org) => renderOrgNode(org))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCloseModal}
        title={editingOrg ? 'Edit Organization' : 'Create Organization'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="parent_id" className="block text-sm font-medium text-gray-700">
              Parent Organization
            </label>
            <select
              id="parent_id"
              value={formData.parent_id || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  parent_id: e.target.value || undefined,
                })
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">None (Top-level)</option>
              {organizations
                ?.filter((org) => org.id !== editingOrg?.id)
                .map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
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
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : editingOrg
                  ? 'Update'
                  : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default OrganizationsPage;
