/**
 * AgentList page component.
 * Main page for browsing and filtering agents in a card grid layout.
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useAgents, agentKeys } from '../hooks';
import { AgentCard, AgentFilters } from '../components/agents';
import { UploadModal } from '../components/upload';
import { stopAllDeployments } from '../services/deployments';
import type { AgentFilterState } from '../components/agents';
import type { Agent, AgentListParams } from '../types';

/**
 * Debounce delay for search input (ms).
 */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Default page size for agent list.
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
 * AgentList page component.
 * Displays agents in a card grid with filtering and search.
 */
export function AgentList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const [filters, setFilters] = useState<AgentFilterState>({
    search: '',
    status: '',
  });
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isShuttingDown, setIsShuttingDown] = useState(false);

  // Debounce search to avoid excessive API calls
  const debouncedSearch = useDebouncedValue(filters.search, SEARCH_DEBOUNCE_MS);

  // Build query params
  const queryParams: AgentListParams = useMemo(() => {
    const params: AgentListParams = {
      limit: PAGE_SIZE,
    };
    if (debouncedSearch) {
      params.search = debouncedSearch;
    }
    if (filters.status) {
      params.status = filters.status;
    }
    return params;
  }, [debouncedSearch, filters.status]);

  // Fetch agents
  const { data, isLoading, isError, error } = useAgents({
    params: queryParams,
  });

  const handleFilterChange = useCallback((newFilters: AgentFilterState) => {
    setFilters(newFilters);
  }, []);

  const handleAgentClick = useCallback((agent: Agent) => {
    navigate(`/agents/${agent.id}`);
  }, [navigate]);

  const handleUploadClick = useCallback(() => {
    setIsUploadModalOpen(true);
  }, []);

  const handleUploadModalClose = useCallback(() => {
    setIsUploadModalOpen(false);
  }, []);

  const handleUploadSuccess = useCallback(
    (agentId: string) => {
      // Navigate to the newly created agent
      navigate(`/agents/${agentId}`);
    },
    [navigate]
  );

  const handleShutdownAll = useCallback(async () => {
    if (!confirm('Are you sure you want to shutdown all running agents? This will stop all deployed agents.')) {
      return;
    }

    setIsShuttingDown(true);
    try {
      const result = await stopAllDeployments();
      // Refresh agent list to update running status
      queryClient.invalidateQueries({ queryKey: agentKeys.all });

      if (result.failed_count > 0) {
        alert(`Stopped ${result.stopped_count} agent(s), but ${result.failed_count} failed to stop.`);
      } else if (result.stopped_count > 0) {
        alert(`Successfully stopped ${result.stopped_count} agent(s).`);
      } else {
        alert('No running agents to stop.');
      }
    } catch (error) {
      alert('Failed to shutdown agents. Please try again.');
      console.error('Shutdown error:', error);
    } finally {
      setIsShuttingDown(false);
    }
  }, [queryClient]);

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
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                Agents
              </Link>
              <Link
                to="/component-registry"
                className="text-sm font-medium text-gray-600 hover:text-indigo-500"
              >
                Components
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
            <span className="text-sm text-gray-600">
              Welcome, {user?.name}
            </span>
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
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Agents</h2>
            <p className="mt-1 text-sm text-gray-500">
              Browse and manage your AI agents
            </p>
          </div>
          {user?.is_admin && (
            <button
              onClick={handleShutdownAll}
              disabled={isShuttingDown}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isShuttingDown ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Stopping...
                </>
              ) : (
                <>
                  <svg className="-ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                  </svg>
                  Shutdown All Agents
                </>
              )}
            </button>
          )}
        </div>

        {/* Filters */}
        <AgentFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onUploadClick={handleUploadClick}
        />

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-gray-600">Loading agents...</span>
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
                  Error loading agents
                </h3>
                <p className="mt-1 text-sm text-red-700">
                  {error?.message || 'An unexpected error occurred'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Agent Grid */}
        {!isLoading && !isError && data && (
          <>
            {data.data.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No agents found
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {filters.search || filters.status
                    ? 'Try adjusting your filters'
                    : 'Get started by uploading your first agent'}
                </p>
                {!filters.search && !filters.status && (
                  <div className="mt-6">
                    <button
                      onClick={handleUploadClick}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <svg
                        className="-ml-1 mr-2 h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Upload New Agent
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Results count */}
                <div className="mb-4 text-sm text-gray-500">
                  Showing {data.data.length} of {data.total} agent{data.total !== 1 ? 's' : ''}
                </div>

                {/* Card Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {data.data.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      onClick={handleAgentClick}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={handleUploadModalClose}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}
