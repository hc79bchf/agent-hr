/**
 * SkillsPage component for managing agent skills.
 * Displays a list of skills with upload, edit, and export functionality.
 */

import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAgent, useVersions } from '../hooks';
import { useComponents } from '../hooks/useComponents';
import { ComponentList } from '../components/components';
import { ComponentEditor } from '../components/editor';
import { SearchInput } from '../components/ui';
import type { Component, ComponentEditResponse } from '../types';

/**
 * SkillsPage component.
 * Shows skills for an agent version with upload and export capabilities.
 */
export function SkillsPage() {
  const { id: agentId } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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

  // Fetch skills for current version
  const {
    data: skills,
    isLoading: isLoadingSkills,
    error: skillsError,
  } = useComponents({
    versionId: currentVersionId,
    type: 'skill',
    queryOptions: {
      enabled: Boolean(currentVersionId),
    },
  });

  // Handle skill click (for editing)
  const handleSkillClick = useCallback((component: Component) => {
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

  // Handle upload skill
  const handleUploadSkill = useCallback(() => {
    // TODO: Open upload modal
    console.log('Upload skill clicked');
  }, []);

  // Handle export selected
  const handleExportSelected = useCallback(() => {
    // TODO: Implement export with selected IDs
    console.log('Export selected:', selectedIds);
  }, [selectedIds]);

  // Loading state
  const isLoading = isLoadingAgent || isLoadingVersions || isLoadingSkills;

  // Error state
  if (skillsError) {
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
              Error loading skills: {skillsError.message}
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
            <span className="text-gray-600">Skills</span>
          </div>
        </nav>

        {/* Page Header */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Skills</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Knowledge and reasoning capabilities for {agent?.name || 'this agent'}.
                </p>
              </div>
              <button
                onClick={handleUploadSkill}
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
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                Upload Skill
              </button>
            </div>

            {/* Search and Actions Bar */}
            <div className="flex items-center gap-4">
              <div className="flex-1 max-w-md">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search skills..."
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

        {/* Skills List */}
        <div className="bg-white shadow rounded-lg p-6">
          <ComponentList
            components={skills || []}
            onComponentClick={handleSkillClick}
            isLoading={isLoading}
            isSelectable={true}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            searchQuery={searchQuery}
            emptyMessage="No skills have been added to this agent yet."
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
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            }
          />
        </div>
      </main>

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
