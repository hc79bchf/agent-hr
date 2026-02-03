/**
 * LibraryPage component.
 * Central library for browsing and managing shared components.
 */

import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useLibrary, useDeleteLibraryComponent, libraryKeys } from '../hooks';
import { AddToAgentModal, CreateLibraryComponentModal, ConfirmModal } from '../components';
import type { LibraryComponent, LibraryListParams, LibraryComponentType } from '../types';

/**
 * Debounce delay for search input (ms).
 */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Default page size.
 */
const PAGE_SIZE = 12;

/**
 * Custom hook for debounced search.
 */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useMemo(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Get icon for component type.
 */
function getTypeIcon(type: LibraryComponentType): JSX.Element {
  switch (type) {
    case 'skill':
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case 'mcp_tool':
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case 'memory':
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
  }
}

/**
 * Get color classes for component type.
 */
function getTypeColor(type: LibraryComponentType): string {
  switch (type) {
    case 'skill':
      return 'bg-purple-100 text-purple-800';
    case 'mcp_tool':
      return 'bg-blue-100 text-blue-800';
    case 'memory':
      return 'bg-green-100 text-green-800';
  }
}

/**
 * Library component card.
 */
function LibraryCard({
  component,
  onClick,
}: {
  component: LibraryComponent;
  onClick: (component: LibraryComponent) => void;
}) {
  return (
    <div
      onClick={() => onClick(component)}
      className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer border border-gray-200"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`p-1.5 rounded ${getTypeColor(component.type)}`}>
              {getTypeIcon(component.type)}
            </span>
            <h3 className="text-lg font-medium text-gray-900 truncate">
              {component.name}
            </h3>
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {component.usage_count} uses
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
          {component.description || 'No description'}
        </p>

        {/* Tags */}
        {component.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {component.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
              >
                {tag}
              </span>
            ))}
            {component.tags.length > 3 && (
              <span className="text-xs text-gray-500">
                +{component.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Author */}
        <div className="text-xs text-gray-500">
          By {component.author?.name || 'Unknown'}
        </div>
      </div>
    </div>
  );
}

/**
 * Filter state.
 */
interface FilterState {
  search: string;
  type: LibraryComponentType | '';
}

/**
 * LibraryPage component.
 */
export function LibraryPage() {
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    type: '',
  });
  const [selectedComponent, setSelectedComponent] = useState<LibraryComponent | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddToAgentModalOpen, setIsAddToAgentModalOpen] = useState(false);
  const [componentToAdd, setComponentToAdd] = useState<LibraryComponent | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [componentToDelete, setComponentToDelete] = useState<LibraryComponent | null>(null);

  // Delete mutation
  const deleteMutation = useDeleteLibraryComponent();

  // Debounce search
  const debouncedSearch = useDebouncedValue(filters.search, SEARCH_DEBOUNCE_MS);

  // Build query params
  const queryParams: LibraryListParams = useMemo(() => {
    const params: LibraryListParams = {
      limit: PAGE_SIZE,
    };
    if (debouncedSearch) {
      params.search = debouncedSearch;
    }
    if (filters.type) {
      params.type = filters.type;
    }
    return params;
  }, [debouncedSearch, filters.type]);

  // Fetch library components
  const { data, isLoading, isError, error } = useLibrary({
    params: queryParams,
  });

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, search: e.target.value }));
  }, []);

  const handleTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters((prev) => ({
      ...prev,
      type: e.target.value as LibraryComponentType | '',
    }));
  }, []);

  const handleComponentClick = useCallback((component: LibraryComponent) => {
    setSelectedComponent(component);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedComponent(null);
  }, []);

  const handleCreateClick = useCallback(() => {
    setIsCreateModalOpen(true);
  }, []);

  const handleCreateModalClose = useCallback(() => {
    setIsCreateModalOpen(false);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: libraryKeys.lists() });
  }, [queryClient]);

  const handleAddToAgentClick = useCallback((component: LibraryComponent) => {
    setComponentToAdd(component);
    setIsAddToAgentModalOpen(true);
    setSelectedComponent(null); // Close detail modal
  }, []);

  const handleAddToAgentModalClose = useCallback(() => {
    setIsAddToAgentModalOpen(false);
    setComponentToAdd(null);
  }, []);

  const handleAddToAgentSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: libraryKeys.lists() });
  }, [queryClient]);

  const handleDeleteClick = useCallback((component: LibraryComponent) => {
    setComponentToDelete(component);
    setIsDeleteModalOpen(true);
    setSelectedComponent(null); // Close detail modal
  }, []);

  const handleDeleteModalClose = useCallback(() => {
    setIsDeleteModalOpen(false);
    setComponentToDelete(null);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!componentToDelete) return;
    try {
      await deleteMutation.mutateAsync(componentToDelete.id);
      setIsDeleteModalOpen(false);
      setComponentToDelete(null);
    } catch (error) {
      console.error('Failed to delete component:', error);
    }
  }, [componentToDelete, deleteMutation]);

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
                to="/library"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                Library
              </Link>
              <Link
                to="/component-registry"
                className="text-sm font-medium text-gray-600 hover:text-indigo-500"
              >
                Component Registry
              </Link>
              {user?.is_admin && (
                <>
                  <Link
                    to="/organizations"
                    className="text-sm font-medium text-gray-600 hover:text-indigo-500"
                  >
                    Organizations
                  </Link>
                  <Link
                    to="/users"
                    className="text-sm font-medium text-gray-600 hover:text-indigo-500"
                  >
                    Users
                  </Link>
                </>
              )}
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
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">Shared Components</h2>
          <p className="mt-1 text-sm text-gray-500">
            Browse and add shared skills, tools, and memory to your agents
          </p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <label htmlFor="search" className="sr-only">
              Search components
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                id="search"
                value={filters.search}
                onChange={handleSearchChange}
                placeholder="Search by name or description..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          {/* Type Filter */}
          <div className="w-full sm:w-48">
            <label htmlFor="type" className="sr-only">
              Filter by type
            </label>
            <select
              id="type"
              value={filters.type}
              onChange={handleTypeChange}
              className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="">All types</option>
              <option value="skill">Skills</option>
              <option value="mcp_tool">MCP Tools</option>
              <option value="memory">Memory</option>
            </select>
          </div>

          {/* Create Button */}
          <button
            onClick={handleCreateClick}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
            Create Component
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-gray-600">Loading components...</span>
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Error loading components
                </h3>
                <p className="mt-1 text-sm text-red-700">
                  {error?.message || 'An unexpected error occurred'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Component Grid */}
        {!isLoading && !isError && data && (
          <>
            {data.data.length === 0 ? (
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
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No components found
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {filters.search || filters.type
                    ? 'Try adjusting your filters'
                    : 'The library is empty. Create your first component to get started.'}
                </p>
                {!filters.search && !filters.type && (
                  <div className="mt-4">
                    <button
                      onClick={handleCreateClick}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
                      Create Component
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Results count */}
                <div className="mb-4 text-sm text-gray-500">
                  Showing {data.data.length} of {data.total} component
                  {data.total !== 1 ? 's' : ''}
                </div>

                {/* Card Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {data.data.map((component) => (
                    <LibraryCard
                      key={component.id}
                      component={component}
                      onClick={handleComponentClick}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Component Detail Modal */}
      {selectedComponent && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={handleCloseDetail}
            />

            {/* Modal */}
            <div className="relative inline-block bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`p-2 rounded-lg ${getTypeColor(selectedComponent.type)}`}
                    >
                      {getTypeIcon(selectedComponent.type)}
                    </span>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {selectedComponent.name}
                      </h3>
                      <p className="text-sm text-gray-500 capitalize">
                        {selectedComponent.type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCloseDetail}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Description */}
                {selectedComponent.description && (
                  <p className="text-sm text-gray-600 mb-4">
                    {selectedComponent.description}
                  </p>
                )}

                {/* Tags */}
                {selectedComponent.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {selectedComponent.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Content Preview */}
                {selectedComponent.content && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Content Preview
                    </h4>
                    <pre className="text-xs text-gray-600 bg-gray-50 p-3 rounded-md overflow-auto max-h-48">
                      {selectedComponent.content.slice(0, 500)}
                      {selectedComponent.content.length > 500 && '...'}
                    </pre>
                  </div>
                )}

                {/* Metadata */}
                <div className="text-xs text-gray-500 space-y-1">
                  <p>
                    <span className="font-medium">Author:</span>{' '}
                    {selectedComponent.author?.name || 'Unknown'}
                  </p>
                  <p>
                    <span className="font-medium">Used by:</span>{' '}
                    {selectedComponent.usage_count} agent
                    {selectedComponent.usage_count !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-3">
                <button
                  type="button"
                  onClick={() => handleAddToAgentClick(selectedComponent)}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto sm:text-sm"
                >
                  Add to Agent
                </button>
                {selectedComponent.author?.id === user?.id && (
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(selectedComponent)}
                    className="mt-3 sm:mt-0 w-full inline-flex justify-center rounded-md border border-red-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCloseDetail}
                  className="mt-3 sm:mt-0 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Component Modal */}
      <CreateLibraryComponentModal
        isOpen={isCreateModalOpen}
        onClose={handleCreateModalClose}
        onSuccess={handleCreateSuccess}
      />

      {/* Add to Agent Modal */}
      <AddToAgentModal
        isOpen={isAddToAgentModalOpen}
        onClose={handleAddToAgentModalClose}
        libraryComponent={componentToAdd}
        onSuccess={handleAddToAgentSuccess}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onCancel={handleDeleteModalClose}
        onConfirm={handleDeleteConfirm}
        title="Delete Component"
        message={`Are you sure you want to delete "${componentToDelete?.name}"? This will also remove it from all agents that reference it. This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
