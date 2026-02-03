/**
 * UsersPage component.
 * Admin page for managing users and assigning them to organizations.
 */

import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { usersService, organizationsService } from '../services';
import { SearchInput } from '../components/ui';

/**
 * UsersPage component.
 * Displays users in a table with organization assignment dropdowns.
 */
export function UsersPage() {
  const { user: currentUser, logout } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch users
  const { data: users, isLoading: usersLoading, isError: usersError } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => usersService.list(),
  });

  // Fetch organizations
  const { data: organizations, isLoading: orgsLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizationsService.list(),
  });

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: ({ userId, organizationId }: { userId: string; organizationId: string | null }) =>
      usersService.update(userId, { organization_id: organizationId }),
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setSuccessMessage(`Updated organization for ${updatedUser.name}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    },
  });

  const handleOrgChange = useCallback(
    (userId: string, organizationId: string | null) => {
      updateMutation.mutate({ userId, organizationId });
    },
    [updateMutation]
  );

  // Filter users by search term
  const filteredUsers = users?.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isLoading = usersLoading || orgsLoading;

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
                className="text-sm font-medium text-gray-600 hover:text-indigo-500"
              >
                Organizations
              </Link>
              <Link
                to="/users"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
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
            <span className="text-sm text-gray-600">Welcome, {currentUser?.name}</span>
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
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">User Management</h2>
          <p className="mt-1 text-sm text-gray-500">
            Assign users to organizations for data isolation
          </p>
        </div>

        {/* Success Toast */}
        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="flex">
              <svg
                className="h-5 w-5 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <p className="ml-3 text-sm font-medium text-green-800">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by name or email..."
          />
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-gray-600">Loading users...</span>
          </div>
        )}

        {/* Error State */}
        {usersError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading users</h3>
                <p className="mt-1 text-sm text-red-700">
                  Please try again later.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Users Table */}
        {!isLoading && !usersError && filteredUsers && (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      {searchTerm ? 'No users match your search.' : 'No users found.'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span className="text-indigo-600 font-medium text-sm">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={user.organization_id || ''}
                          onChange={(e) =>
                            handleOrgChange(user.id, e.target.value || null)
                          }
                          disabled={updateMutation.isPending}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:opacity-50"
                        >
                          <option value="">Unassigned</option>
                          {organizations?.map((org) => (
                            <option key={org.id} value={org.id}>
                              {org.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary */}
        {!isLoading && filteredUsers && (
          <div className="mt-4 text-sm text-gray-500">
            Showing {filteredUsers.length} of {users?.length || 0} users
          </div>
        )}
      </main>
    </div>
  );
}

export default UsersPage;
