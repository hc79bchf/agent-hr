/**
 * ToolsPage component for viewing MCP tools.
 * Displays a read-only list of MCP tools with export selection functionality.
 */

import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAgent, useVersions } from '../hooks';
import { useComponents } from '../hooks/useComponents';
import { ComponentList } from '../components/components';
import { SearchInput } from '../components/ui';

/**
 * ToolsPage component.
 * Shows MCP tools for an agent version in a read-only view with export capabilities.
 */
export function ToolsPage() {
  const { id: agentId } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch agent data
  const { data: agent, isLoading: isLoadingAgent } = useAgent(agentId || '');

  // Fetch versions to get current version ID
  const { data: versionsData, isLoading: isLoadingVersions } = useVersions(agentId || '', {
    enabled: Boolean(agentId),
  });

  // Determine current version ID
  const currentVersionId =
    agent?.current_version_id || versionsData?.data?.[0]?.id || '';

  // Fetch MCP tools for current version
  const {
    data: tools,
    isLoading: isLoadingTools,
    error: toolsError,
  } = useComponents({
    versionId: currentVersionId,
    type: 'mcp_tool',
    queryOptions: {
      enabled: Boolean(currentVersionId),
    },
  });

  // Handle export selected
  const handleExportSelected = useCallback(() => {
    // TODO: Implement export with selected IDs
    console.log('Export selected:', selectedIds);
  }, [selectedIds]);

  // Loading state
  const isLoading = isLoadingAgent || isLoadingVersions || isLoadingTools;

  // Error state
  if (toolsError) {
    return (
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Agent-HR</h1>
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
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-md p-6">
            <p className="text-sm text-red-700">
              Error loading tools: {toolsError.message}
            </p>
            <Link
              to={`/agents/${agentId}`}
              className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Back to Agent
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Agent-HR</h1>
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
        {/* Breadcrumb */}
        <nav className="mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Link
              to="/agents"
              className="text-indigo-600 hover:text-indigo-500"
            >
              Agents
            </Link>
            <span className="text-gray-400">/</span>
            <Link
              to={`/agents/${agentId}`}
              className="text-indigo-600 hover:text-indigo-500"
            >
              {agent?.name || 'Agent'}
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600">MCP Tools</span>
          </div>
        </nav>

        {/* Page Header */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">MCP Tools</h2>
                <p className="mt-1 text-sm text-gray-500">
                  External API integrations and system connections for {agent?.name || 'this agent'}.
                  <span className="ml-1 text-gray-400">
                    (Read-only - parsed from MCP configuration)
                  </span>
                </p>
              </div>
            </div>

            {/* Search and Actions Bar */}
            <div className="flex items-center gap-4">
              <div className="flex-1 max-w-md">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search tools..."
                />
              </div>
              {selectedIds.size > 0 && (
                <button
                  onClick={handleExportSelected}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <svg
                    className="-ml-0.5 mr-2 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Export Selected ({selectedIds.size})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                MCP tools are automatically detected from the agent's configuration file.
                To add or modify tools, update the MCP configuration and re-import the agent.
              </p>
            </div>
          </div>
        </div>

        {/* Tools List */}
        <div className="bg-white shadow rounded-lg p-6">
          <ComponentList
            components={tools || []}
            isLoading={isLoading}
            isSelectable={true}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            isReadOnly={true}
            searchQuery={searchQuery}
            emptyMessage="No MCP tools have been configured for this agent."
            emptyIcon={
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
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            }
          />
        </div>
      </main>
    </div>
  );
}
