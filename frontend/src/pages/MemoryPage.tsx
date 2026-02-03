/**
 * MemoryPage component for managing agent memory.
 * Displays memory items with add, edit, and bulk import functionality.
 */

import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAgent, useVersions } from '../hooks';
import { useComponents } from '../hooks/useComponents';
import { ComponentList } from '../components/components';
import { ComponentEditor } from '../components/editor';
import { SearchInput, Modal } from '../components/ui';
import type { Component, ComponentEditResponse } from '../types';

/**
 * MemoryPage component.
 * Shows memory items for an agent version with add, edit, and bulk import capabilities.
 */
export function MemoryPage() {
  const { id: agentId } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [newMemoryName, setNewMemoryName] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);

  // Fetch agent data
  const { data: agent, isLoading: isLoadingAgent } = useAgent(agentId || '');

  // Fetch versions to get current version ID
  const { data: versionsData, isLoading: isLoadingVersions } = useVersions(agentId || '', {
    enabled: Boolean(agentId),
  });

  // Determine current version ID
  const currentVersionId =
    agent?.current_version_id || versionsData?.data?.[0]?.id || '';

  // Fetch memory items for current version
  const {
    data: memories,
    isLoading: isLoadingMemories,
    error: memoriesError,
  } = useComponents({
    versionId: currentVersionId,
    type: 'memory',
    queryOptions: {
      enabled: Boolean(currentVersionId),
    },
  });

  // Handle memory click (for editing)
  const handleMemoryClick = useCallback((component: Component) => {
    setSelectedComponent(component);
    setIsEditorOpen(true);
  }, []);

  // Handle editor close
  const handleEditorClose = useCallback(() => {
    setIsEditorOpen(false);
    setSelectedComponent(null);
  }, []);

  // Handle version created (after save)
  const handleVersionCreated = useCallback((response: ComponentEditResponse) => {
    // Navigate to the new version or refresh the current view
    console.log('New version created:', response.new_version.id);
    // The component query will be invalidated automatically
  }, []);

  // Handle component delete
  const handleComponentDelete = useCallback((componentId: string) => {
    console.log('Component deleted:', componentId);
    // The component will be removed from the list after query invalidation
  }, []);

  // Handle add memory
  const handleAddMemory = useCallback(() => {
    setNewMemoryName('');
    setNewMemoryContent('');
    setIsAddModalOpen(true);
  }, []);

  // Handle save new memory
  const handleSaveNewMemory = useCallback(() => {
    // TODO: Implement save via API
    console.log('Save new memory:', { name: newMemoryName, content: newMemoryContent });
    setIsAddModalOpen(false);
    setNewMemoryName('');
    setNewMemoryContent('');
  }, [newMemoryName, newMemoryContent]);

  // Handle bulk import
  const handleBulkImport = useCallback(() => {
    setIsBulkImportModalOpen(true);
  }, []);

  // Handle file upload for bulk import
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // TODO: Process uploaded files
      console.log('Files uploaded:', files);
      setIsBulkImportModalOpen(false);
    }
  }, []);

  // Handle export selected
  const handleExportSelected = useCallback(() => {
    // TODO: Implement export with selected IDs
    console.log('Export selected:', selectedIds);
  }, [selectedIds]);

  // Loading state
  const isLoading = isLoadingAgent || isLoadingVersions || isLoadingMemories;

  // Error state
  if (memoriesError) {
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
              Error loading memory: {memoriesError.message}
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
            <span className="text-gray-600">Memory</span>
          </div>
        </nav>

        {/* Page Header */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Memory</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Agent memory, context, and learned information for {agent?.name || 'this agent'}.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBulkImport}
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
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                  Feed New Memory
                </button>
                <button
                  onClick={handleAddMemory}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add Memory
                </button>
              </div>
            </div>

            {/* Search and Actions Bar */}
            <div className="flex items-center gap-4">
              <div className="flex-1 max-w-md">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search memory..."
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

        {/* Memory List */}
        <div className="bg-white shadow rounded-lg p-6">
          <ComponentList
            components={memories || []}
            onComponentClick={handleMemoryClick}
            isLoading={isLoading}
            isSelectable={true}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            searchQuery={searchQuery}
            emptyMessage="No memory items have been added to this agent yet."
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
                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                />
              </svg>
            }
          />
        </div>
      </main>

      {/* Add Memory Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Memory"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="memory-name" className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              type="text"
              id="memory-name"
              value={newMemoryName}
              onChange={(e) => setNewMemoryName(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Enter memory name"
            />
          </div>
          <div>
            <label htmlFor="memory-content" className="block text-sm font-medium text-gray-700">
              Content
            </label>
            <textarea
              id="memory-content"
              rows={8}
              value={newMemoryContent}
              onChange={(e) => setNewMemoryContent(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono"
              placeholder="Enter memory content (text, JSON, or other data)"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveNewMemory}
              disabled={!newMemoryName.trim() || !newMemoryContent.trim()}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Memory
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal
        isOpen={isBulkImportModalOpen}
        onClose={() => setIsBulkImportModalOpen(false)}
        title="Feed New Memory"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Upload files to bulk import memory items. Supported formats: .txt, .md, .json
          </p>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
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
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <div className="mt-4">
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-indigo-600 hover:text-indigo-500 font-medium">
                  Click to upload
                </span>
                <span className="text-gray-500"> or drag and drop</span>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  accept=".txt,.md,.json"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
              </label>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Maximum 10 files, up to 1MB each
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsBulkImportModalOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Component Editor Panel */}
      <ComponentEditor
        isOpen={isEditorOpen}
        onClose={handleEditorClose}
        component={selectedComponent}
        versionId={currentVersionId}
        onVersionCreated={handleVersionCreated}
        onDelete={handleComponentDelete}
      />
    </div>
  );
}
