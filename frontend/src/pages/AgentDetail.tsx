/**
 * AgentDetail page component.
 * Shows a single agent with all its information and navigation to skills, tools, and memory.
 */

import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import {
  useAgent,
  useUpdateAgent,
  useVersions,
  useComponents,
  useActiveDeployment,
  useDeployAgent,
  useStopDeployment,
  useMemorySuggestions,
  useFolders,
  agentKeys,
  versionKeys,
  deploymentKeys,
  folderKeys,
} from '../hooks';
import { downloadAgentExport, deleteAgent, deleteMemory, apiClient } from '../services';
import { Badge, ComponentList, FolderList, UploadModal, ConfirmModal, PublishToLibraryModal, ComponentEditor, DeploymentStatus, AgentChat, StatusDropdown, AddFromLibraryModal, CompareVersionsModal, StakeholdersSection } from '../components';
import { AddMemoryModal, MemorySection, WorkingMemoryPanel, MemorySuggestionsModal } from '../components/memory';
import { EditAgentModal } from '../components/agents';
import type { AgentVersion, Component, AgentStatus } from '../types';

/**
 * Type for registry component info in refs.
 */
interface RegistryComponentInfo {
  id: string;
  type: string;
  name: string;
  description?: string;
  tags?: string[];
}

/**
 * Type for agent registry reference.
 */
interface AgentRegistryRef {
  id: string;
  agent_id: string;
  registry_component_id: string;
  added_at: string;
  added_by?: string;
  registry_component?: RegistryComponentInfo;
}

interface AgentRegistryRefsResponse {
  data: AgentRegistryRef[];
  total: number;
}

/**
 * Tab options for the detail page.
 */
type TabType = 'skills' | 'tools' | 'memory' | 'agents';

/**
 * Tab configuration.
 */
interface TabConfig {
  id: TabType;
  label: string;
  description: string;
}

const TABS: TabConfig[] = [
  { id: 'skills', label: 'Skills', description: 'Knowledge and reasoning capabilities' },
  { id: 'tools', label: 'MCP Tools', description: 'External API integrations' },
  { id: 'memory', label: 'Memory', description: 'Agent memory and context' },
  { id: 'agents', label: 'Agents', description: 'Agent definitions and scripts' },
];

/**
 * Formats a date string to a readable format.
 * @param dateString - ISO date string.
 * @returns Formatted date string.
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats a date string to include time.
 * @param dateString - ISO date string.
 * @returns Formatted date/time string.
 */
function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * AgentDetail page component.
 * Displays detailed information about a single agent.
 */
export function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('skills');
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Component | null>(null);
  const [showDeleteMemoryConfirm, setShowDeleteMemoryConfirm] = useState(false);
  const [memoryToDelete, setMemoryToDelete] = useState<Component | null>(null);
  const [isDeletingMemory, setIsDeletingMemory] = useState(false);
  const [showRemoveRegistryRefConfirm, setShowRemoveRegistryRefConfirm] = useState(false);
  const [registryRefToRemove, setRegistryRefToRemove] = useState<AgentRegistryRef | null>(null);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [componentToPublish, setComponentToPublish] = useState<Component | null>(null);
  const [isComponentEditorOpen, setIsComponentEditorOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showDeprecateConfirm, setShowDeprecateConfirm] = useState(false);
  const [isAddFromLibraryOpen, setIsAddFromLibraryOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [isSuggestionsModalOpen, setIsSuggestionsModalOpen] = useState(false);
  const [injectingProcedural, setInjectingProcedural] = useState(false);
  const [isEditAgentModalOpen, setIsEditAgentModalOpen] = useState(false);
  const [isEditDropdownOpen, setIsEditDropdownOpen] = useState(false);

  // Fetch agent data
  const {
    data: agent,
    isLoading: isLoadingAgent,
    isError: isAgentError,
    error: agentError,
  } = useAgent(id || '');

  // Fetch versions
  const {
    data: versionsData,
    isLoading: isLoadingVersions,
  } = useVersions(id || '', { enabled: Boolean(id) });

  // Determine current version ID for components
  const currentVersionIdForComponents = useMemo(() => {
    if (selectedVersionId) return selectedVersionId;
    if (agent?.current_version_id) return agent.current_version_id;
    return versionsData?.data?.[0]?.id || '';
  }, [selectedVersionId, agent?.current_version_id, versionsData]);

  // Fetch skills
  const {
    data: skills,
    isLoading: isLoadingSkills,
  } = useComponents({
    versionId: currentVersionIdForComponents,
    type: 'skill',
    queryOptions: {
      enabled: Boolean(currentVersionIdForComponents) && activeTab === 'skills',
    },
  });

  // Fetch tools
  const {
    data: tools,
    isLoading: isLoadingTools,
  } = useComponents({
    versionId: currentVersionIdForComponents,
    type: 'mcp_tool',
    queryOptions: {
      enabled: Boolean(currentVersionIdForComponents) && activeTab === 'tools',
    },
  });

  // Fetch memory
  const {
    data: memories,
    isLoading: isLoadingMemory,
  } = useComponents({
    versionId: currentVersionIdForComponents,
    type: 'memory',
    queryOptions: {
      enabled: Boolean(currentVersionIdForComponents) && activeTab === 'memory',
    },
  });

  // Fetch agents
  const {
    data: agentComponents,
    isLoading: isLoadingAgents,
  } = useComponents({
    versionId: currentVersionIdForComponents,
    type: 'agent',
    queryOptions: {
      enabled: Boolean(currentVersionIdForComponents) && activeTab === 'agents',
    },
  });

  // Fetch folders for current version
  const {
    data: foldersData,
    isLoading: isLoadingFolders,
  } = useFolders(id || '', currentVersionIdForComponents, {
    enabled: Boolean(id) && Boolean(currentVersionIdForComponents) &&
      (activeTab === 'skills' || activeTab === 'tools' || activeTab === 'agents'),
  });

  // Fetch registry refs (always enabled for bottom section)
  const {
    data: registryRefsData,
    isLoading: isLoadingRegistryRefs,
  } = useQuery({
    queryKey: ['agent-registry-refs', id],
    queryFn: async () => {
      const response = await apiClient.get<AgentRegistryRefsResponse>(
        `/api/agents/${id}/registry-refs`
      );
      return response.data;
    },
    enabled: Boolean(id),
  });

  // Fetch memory suggestions
  const { data: suggestionsData } = useMemorySuggestions(
    id || '',
    'pending',
    activeTab === 'memory'
  );
  const pendingSuggestionsCount = suggestionsData?.data?.length || 0;

  // Remove registry ref mutation
  const removeRegistryRefMutation = useMutation({
    mutationFn: async (refId: string) => {
      await apiClient.delete(`/api/agents/${id}/registry-refs/${refId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-registry-refs', id] });
    },
  });

  // Update agent mutation
  const updateAgentMutation = useUpdateAgent();

  // Deployment hooks
  const { data: activeDeployment, isLoading: isLoadingDeployment } = useActiveDeployment(id || '');
  const deployMutation = useDeployAgent();
  const stopMutation = useStopDeployment();

  // Get the versions list
  const versions = useMemo(() => versionsData?.data || [], [versionsData]);

  // Get currently selected version
  const currentVersion = useMemo(() => {
    if (selectedVersionId) {
      return versions.find((v) => v.id === selectedVersionId);
    }
    // Default to current version or latest
    if (agent?.current_version_id) {
      return versions.find((v) => v.id === agent.current_version_id);
    }
    return versions[0];
  }, [selectedVersionId, versions, agent?.current_version_id]);

  // Handle version selection
  const handleVersionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedVersionId(e.target.value);
  }, []);

  // Handle export
  const handleExport = useCallback(async () => {
    if (!agent) return;

    setIsExporting(true);
    try {
      await downloadAgentExport(agent.id, agent.name);
    } catch (error) {
      console.error('Export failed:', error);
      // TODO: Show error toast
    } finally {
      setIsExporting(false);
    }
  }, [agent]);

  // Handle compare versions
  const handleCompareVersions = useCallback(() => {
    setIsCompareModalOpen(true);
  }, []);

  // Handle edit details - open edit agent modal
  const handleEditDetails = useCallback(() => {
    setIsEditAgentModalOpen(true);
    setIsEditDropdownOpen(false);
  }, []);

  // Handle upload files - open upload modal
  const handleUploadFiles = useCallback(() => {
    setIsUploadModalOpen(true);
    setIsEditDropdownOpen(false);
  }, []);

  // Handle edit agent modal close
  const handleEditAgentModalClose = useCallback(() => {
    setIsEditAgentModalOpen(false);
  }, []);

  // Handle edit agent success
  const handleEditAgentSuccess = useCallback(() => {
    if (id) {
      queryClient.invalidateQueries({ queryKey: agentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: agentKeys.all });
    }
    setIsEditAgentModalOpen(false);
  }, [id, queryClient]);

  // Handle upload modal close
  const handleUploadModalClose = useCallback(() => {
    setIsUploadModalOpen(false);
  }, []);

  // Handle upload success - refresh agent and versions data
  const handleUploadSuccess = useCallback(() => {
    if (id) {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: agentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: versionKeys.all(id) });
      // Also invalidate folder queries for new version
      if (currentVersionIdForComponents) {
        queryClient.invalidateQueries({ queryKey: folderKeys.all(id, currentVersionIdForComponents) });
      }
    }
    setIsUploadModalOpen(false);
  }, [id, currentVersionIdForComponents, queryClient]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigate('/agents');
  }, [navigate]);

  // Handle delete agent
  const handleDelete = useCallback(async () => {
    if (!agent) return;

    setIsDeleting(true);
    try {
      await deleteAgent(agent.id);
      // Invalidate the agent list queries to trigger refresh on navigation
      await queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
      navigate('/agents');
    } catch (error) {
      console.error('Delete failed:', error);
      // TODO: Show error toast
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [agent, navigate, queryClient]);

  // Handle add memory
  const handleAddMemory = useCallback(() => {
    setInjectingProcedural(false);
    setEditingMemory(null);
    setIsMemoryModalOpen(true);
  }, []);

  // Handle inject procedural memory
  const handleInjectProcedural = useCallback(() => {
    setInjectingProcedural(true);
    setEditingMemory(null);
    setIsMemoryModalOpen(true);
  }, []);

  // Handle edit memory
  const handleEditMemory = useCallback((memory: Component) => {
    setEditingMemory(memory);
    setIsMemoryModalOpen(true);
  }, []);

  // Handle memory modal close
  const handleMemoryModalClose = useCallback(() => {
    setIsMemoryModalOpen(false);
    setEditingMemory(null);
    setInjectingProcedural(false);
  }, []);

  // Handle memory success - refresh data
  const handleMemorySuccess = useCallback(() => {
    if (id) {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: agentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: versionKeys.all(id) });
    }
    setIsMemoryModalOpen(false);
    setEditingMemory(null);
    setInjectingProcedural(false);
  }, [id, queryClient]);

  // Handle delete memory button click
  const handleDeleteMemoryClick = useCallback((memory: Component) => {
    setMemoryToDelete(memory);
    setShowDeleteMemoryConfirm(true);
  }, []);

  // Handle delete memory confirmation
  const handleDeleteMemory = useCallback(async () => {
    if (!id || !memoryToDelete) return;

    setIsDeletingMemory(true);
    try {
      await deleteMemory(id, memoryToDelete.id);
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: agentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: versionKeys.all(id) });
      setShowDeleteMemoryConfirm(false);
      setMemoryToDelete(null);
    } catch (error) {
      console.error('Delete memory failed:', error);
      // TODO: Show error toast
    } finally {
      setIsDeletingMemory(false);
    }
  }, [id, memoryToDelete, queryClient]);

  // Handle remove registry ref button click
  const handleRemoveRegistryRefClick = useCallback((ref: AgentRegistryRef) => {
    setRegistryRefToRemove(ref);
    setShowRemoveRegistryRefConfirm(true);
  }, []);

  // Handle publish to library
  const handlePublishClick = useCallback((component: Component) => {
    setComponentToPublish(component);
    setIsPublishModalOpen(true);
  }, []);

  // Handle publish modal close
  const handlePublishModalClose = useCallback(() => {
    setIsPublishModalOpen(false);
    setComponentToPublish(null);
  }, []);

  // Handle publish success
  const handlePublishSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['component-registry'] });
    setIsPublishModalOpen(false);
    setComponentToPublish(null);
  }, [queryClient]);

  // Handle edit component (skills/tools)
  const handleEditComponent = useCallback((component: Component) => {
    setEditingComponent(component);
    setIsComponentEditorOpen(true);
  }, []);

  // Handle component editor close
  const handleComponentEditorClose = useCallback(() => {
    setIsComponentEditorOpen(false);
    setEditingComponent(null);
  }, []);

  // Handle component version created (after edit)
  const handleComponentVersionCreated = useCallback(() => {
    if (id) {
      queryClient.invalidateQueries({ queryKey: agentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: versionKeys.all(id) });
    }
    setIsComponentEditorOpen(false);
    setEditingComponent(null);
  }, [id, queryClient]);

  // Handle remove registry ref confirmation
  const handleRemoveRegistryRef = useCallback(() => {
    if (!id || !registryRefToRemove) return;

    removeRegistryRefMutation.mutate(registryRefToRemove.id, {
      onSuccess: () => {
        setShowRemoveRegistryRefConfirm(false);
        setRegistryRefToRemove(null);
      },
      onError: (error) => {
        console.error('Remove registry ref failed:', error);
        // TODO: Show error toast
      },
    });
  }, [id, registryRefToRemove, removeRegistryRefMutation]);

  // Handle deploy agent
  const handleDeploy = useCallback(() => {
    if (!id || !currentVersionIdForComponents) return;

    deployMutation.mutate(
      { agentId: id, data: { version_id: currentVersionIdForComponents } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: deploymentKeys.active(id) });
        },
        onError: (error) => {
          console.error('Deploy failed:', error);
          // TODO: Show error toast
        },
      }
    );
  }, [id, currentVersionIdForComponents, deployMutation, queryClient]);

  // Handle stop deployment
  const handleStopDeployment = useCallback(() => {
    if (!activeDeployment?.id || !id) return;

    stopMutation.mutate(
      { deploymentId: activeDeployment.id, agentId: id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: deploymentKeys.active(id) });
          setIsChatOpen(false);
        },
        onError: (error) => {
          console.error('Stop deployment failed:', error);
          // TODO: Show error toast
        },
      }
    );
  }, [activeDeployment?.id, id, stopMutation, queryClient]);

  // Handle chat toggle
  const handleChatClick = useCallback(() => {
    setIsChatOpen(true);
  }, []);

  // Handle chat close
  const handleChatClose = useCallback(() => {
    setIsChatOpen(false);
  }, []);

  // Handle status change
  const handleStatusChange = useCallback((newStatus: AgentStatus) => {
    if (!agent) return;
    updateAgentMutation.mutate(
      { id: agent.id, data: { status: newStatus } },
      {
        onError: (error) => {
          console.error('Failed to update status:', error);
          // TODO: Show error toast
        },
      }
    );
  }, [agent, updateAgentMutation]);

  // Handle deprecate click (opens confirmation)
  const handleDeprecateClick = useCallback(() => {
    setShowDeprecateConfirm(true);
  }, []);

  // Handle deprecate confirmation
  const handleDeprecateConfirm = useCallback(() => {
    if (!agent) return;
    updateAgentMutation.mutate(
      { id: agent.id, data: { status: 'deprecated' } },
      {
        onSuccess: () => {
          setShowDeprecateConfirm(false);
        },
        onError: (error) => {
          console.error('Failed to deprecate:', error);
          setShowDeprecateConfirm(false);
        },
      }
    );
  }, [agent, updateAgentMutation]);

  // Handle add from registry success
  const handleAddFromRegistrySuccess = useCallback(() => {
    if (id) {
      queryClient.invalidateQueries({ queryKey: ['agent-registry-refs', id] });
    }
  }, [id, queryClient]);

  // Loading state
  if (isLoadingAgent) {
    return (
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="animate-pulse h-8 bg-gray-200 rounded w-48"></div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (isAgentError || !agent) {
    return (
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <Link to="/" className="text-3xl font-bold text-gray-900 hover:text-indigo-600 transition-colors">Agent-HR</Link>
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
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-red-400"
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
                <h3 className="text-lg font-medium text-red-800">Agent not found</h3>
                <p className="mt-2 text-sm text-red-700">
                  {agentError?.message || 'The requested agent could not be found.'}
                </p>
                <button
                  onClick={handleBack}
                  className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Back to Agents
                </button>
              </div>
            </div>
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
          <Link
            to="/agents"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 flex items-center gap-1"
          >
            <svg
              className="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Back to Agents
          </Link>
        </nav>

        {/* Agent Header Card */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="p-6">
            {/* Top Row: Name, Status, Edit */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-900">{agent.name}</h2>
                <StatusDropdown
                  status={agent.status}
                  onChange={handleStatusChange}
                  disabled={updateAgentMutation.isPending}
                  requireConfirmForDeprecate
                  onDeprecateClick={handleDeprecateClick}
                />
              </div>
              {/* Edit Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsEditDropdownOpen(!isEditDropdownOpen)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <svg
                    className="-ml-0.5 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Edit
                  <svg
                    className="ml-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {isEditDropdownOpen && (
                  <>
                    {/* Backdrop to close dropdown */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsEditDropdownOpen(false)}
                    />
                    <div className="absolute right-0 z-20 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                      <div className="py-1">
                        <button
                          onClick={handleEditDetails}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                        >
                          <svg
                            className="mr-3 h-4 w-4 text-gray-500"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                            <path
                              fillRule="evenodd"
                              d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Edit Details
                        </button>
                        <button
                          onClick={handleUploadFiles}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                        >
                          <svg
                            className="mr-3 h-4 w-4 text-gray-500"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Upload Files
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Description */}
            {agent.description && (
              <p className="text-gray-600 mb-4">{agent.description}</p>
            )}

            {/* Author and Metadata */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-4">
              {agent.author && (
                <div className="flex items-center gap-1">
                  <svg
                    className="h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>by {agent.author.name}</span>
                </div>
              )}
              {agent.department && (
                <div className="flex items-center gap-1">
                  <svg
                    className="h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{agent.department}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <svg
                  className="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Created {formatDate(agent.created_at)}</span>
              </div>
              <div className="flex items-center gap-1">
                <svg
                  className="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Updated {formatDate(agent.updated_at)}</span>
              </div>
            </div>

            {/* Tags */}
            {agent.tags && agent.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {agent.tags.map((tag) => (
                  <Badge key={tag} variant="info">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Usage Notes */}
            {agent.usage_notes && (
              <div className="mt-4 p-3 bg-gray-50 rounded-md">
                <h4 className="text-sm font-medium text-gray-700 mb-1">Usage Notes</h4>
                <p className="text-sm text-gray-600">{agent.usage_notes}</p>
              </div>
            )}
          </div>

          {/* Version Selector and Actions */}
          <div className="border-t border-gray-200 px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Version Selector */}
              <div className="flex items-center gap-3">
                <label htmlFor="version-select" className="text-sm font-medium text-gray-700">
                  Version:
                </label>
                <select
                  id="version-select"
                  value={selectedVersionId || currentVersion?.id || ''}
                  onChange={handleVersionChange}
                  disabled={isLoadingVersions || versions.length === 0}
                  className="block w-48 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  {isLoadingVersions ? (
                    <option>Loading...</option>
                  ) : versions.length === 0 ? (
                    <option>No versions</option>
                  ) : (
                    versions.map((version: AgentVersion) => (
                      <option key={version.id} value={version.id}>
                        v{version.version_number} ({version.change_type})
                        {version.id === agent.current_version_id ? ' - Current' : ''}
                      </option>
                    ))
                  )}
                </select>
                {currentVersion && (
                  <span className="text-xs text-gray-500">
                    {formatDateTime(currentVersion.created_at)}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                {/* Deployment Status */}
                <DeploymentStatus
                  deployment={activeDeployment || null}
                  isLoading={isLoadingDeployment}
                  isDeploying={deployMutation.isPending}
                  isStopping={stopMutation.isPending}
                  onDeploy={handleDeploy}
                  onStop={handleStopDeployment}
                  onChat={handleChatClick}
                />

                <div className="border-l border-gray-300 h-8"></div>

                <button
                  onClick={handleCompareVersions}
                  disabled={versions.length < 2}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg
                    className="-ml-0.5 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 011.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 011.414-1.414L15 13.586V12a1 1 0 011-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Compare Versions
                </button>
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? (
                    <>
                      <svg
                        className="animate-spin -ml-0.5 mr-2 h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg
                        className="-ml-0.5 mr-2 h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Export
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <svg
                    className="-ml-0.5 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white shadow rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex" aria-label="Tabs">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-1/4 py-4 px-1 text-center border-b-2 font-medium text-sm
                    ${
                      activeTab === tab.id
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'skills' && (
              <div>
                {/* Header with link to full page */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-500">
                    Knowledge and reasoning capabilities for this agent.
                  </p>
                  <Link
                    to={`/agents/${id}/skills`}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    View Full Page
                  </Link>
                </div>
                {(foldersData?.skills?.length || 0) > 0 ? (
                  <FolderList
                    folders={foldersData?.skills || []}
                    agentId={id || ''}
                    versionId={currentVersionIdForComponents}
                    isLoading={isLoadingFolders}
                    emptyMessage="No skill folders have been added to this agent yet."
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
                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                      </svg>
                    }
                  />
                ) : (
                  <ComponentList
                    components={skills || []}
                    isLoading={isLoadingSkills}
                    onEdit={handleEditComponent}
                    onPublish={handlePublishClick}
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
                )}
              </div>
            )}

            {activeTab === 'tools' && (
              <div>
                {/* Header with link to full page */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-500">
                    External API integrations and system connections (read-only).
                  </p>
                  <Link
                    to={`/agents/${id}/tools`}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    View Full Page
                  </Link>
                </div>
                {(foldersData?.mcp_tools?.length || 0) > 0 ? (
                  <FolderList
                    folders={foldersData?.mcp_tools || []}
                    agentId={id || ''}
                    versionId={currentVersionIdForComponents}
                    isLoading={isLoadingFolders}
                    emptyMessage="No MCP tool folders have been configured for this agent."
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
                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                      </svg>
                    }
                  />
                ) : (
                  <ComponentList
                    components={tools || []}
                    isLoading={isLoadingTools}
                    isReadOnly={true}
                    onEdit={handleEditComponent}
                    onPublish={handlePublishClick}
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
                )}
              </div>
            )}

            {activeTab === 'memory' && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Agent memory organized by type: working, short-term, long-term, and procedural.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleAddMemory}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <svg
                        className="-ml-0.5 mr-1.5 h-4 w-4"
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
                      Add Memory
                    </button>
                    <Link
                      to={`/agents/${id}/memory`}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      View Full Page
                    </Link>
                  </div>
                </div>

                {isLoadingMemory ? (
                  <div className="text-center py-8">
                    <div className="animate-spin inline-block h-8 w-8 border-4 border-gray-200 border-t-indigo-600 rounded-full"></div>
                    <p className="mt-2 text-sm text-gray-500">Loading memory...</p>
                  </div>
                ) : (
                  <>
                    {/* Working Memory Panel */}
                    <WorkingMemoryPanel deploymentId={activeDeployment?.id || null} />

                    {/* Short-Term Memory */}
                    <MemorySection
                      type="short_term"
                      memories={(memories || []).filter(
                        (m) => m.memory_type === 'short_term'
                      )}
                      onEdit={handleEditMemory}
                      onDelete={handleDeleteMemoryClick}
                    />

                    {/* Long-Term Memory */}
                    <MemorySection
                      type="long_term"
                      memories={(memories || []).filter(
                        (m) => m.memory_type === 'long_term' || !m.memory_type
                      )}
                      pendingCount={pendingSuggestionsCount}
                      onEdit={handleEditMemory}
                      onDelete={handleDeleteMemoryClick}
                      onViewPending={() => setIsSuggestionsModalOpen(true)}
                    />

                    {/* Procedural Memory */}
                    <MemorySection
                      type="procedural"
                      memories={(memories || []).filter(
                        (m) => m.memory_type === 'procedural'
                      )}
                      onEdit={handleEditMemory}
                      onDelete={handleDeleteMemoryClick}
                      onInject={handleInjectProcedural}
                    />
                  </>
                )}
              </div>
            )}

            {activeTab === 'agents' && (
              <div>
                {/* Header with link to full page */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-500">
                    Agent definitions and scripts.
                  </p>
                  <Link
                    to={`/agents/${id}/agents`}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    View Full Page
                  </Link>
                </div>
                {(foldersData?.agents?.length || 0) > 0 ? (
                  <FolderList
                    folders={foldersData?.agents || []}
                    agentId={id || ''}
                    versionId={currentVersionIdForComponents}
                    isLoading={isLoadingFolders}
                    emptyMessage="No agent definition folders have been added yet."
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
                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                      </svg>
                    }
                  />
                ) : (
                  <ComponentList
                    components={agentComponents || []}
                    isLoading={isLoadingAgents}
                    emptyMessage="No agent definitions have been added yet."
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
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    }
                  />
                )}
              </div>
            )}

          </div>
        </div>

        {/* Component Registry Section - Bottom of Page */}
        <div className="bg-white shadow rounded-lg mt-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Component Registry</h3>
                <p className="text-sm text-gray-500">
                  Shared components from the component registry.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsAddFromLibraryOpen(true)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <svg className="-ml-0.5 mr-1.5 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Add from Registry
                </button>
                <Link
                  to="/component-registry"
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Browse Registry
                </Link>
              </div>
            </div>
          </div>
          <div className="p-6">
            {isLoadingRegistryRefs ? (
              <div className="text-center py-8">
                <div className="animate-spin inline-block h-8 w-8 border-4 border-gray-200 border-t-indigo-600 rounded-full"></div>
                <p className="mt-2 text-sm text-gray-500">Loading registry components...</p>
              </div>
            ) : !registryRefsData?.data?.length ? (
              <div className="text-center py-8">
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
                    d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No registry components</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Add shared components from the registry to use across agents.
                </p>
                <Link
                  to="/component-registry"
                  className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Browse Registry
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {registryRefsData.data.map((ref) => (
                  <div
                    key={ref.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {ref.registry_component?.name || 'Unknown Component'}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">
                          Type: {ref.registry_component?.type || 'unknown'}
                        </p>
                        {ref.registry_component?.description && (
                          <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                            {ref.registry_component.description}
                          </p>
                        )}
                        {ref.registry_component?.tags && ref.registry_component.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {ref.registry_component.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveRegistryRefClick(ref)}
                        className="ml-2 p-1 text-gray-400 hover:text-red-500 rounded"
                        title="Remove from agent"
                      >
                        <svg
                          className="h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                    <div className="mt-3 text-xs text-gray-400">
                      Added {new Date(ref.added_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stakeholders Section - Bottom of Page */}
        {id && (
          <div className="bg-white shadow rounded-lg mt-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Stakeholders</h3>
              <p className="text-sm text-gray-500">
                Access control and permissions for this agent.
              </p>
            </div>
            <div className="p-6">
              <StakeholdersSection agentId={id} />
            </div>
          </div>
        )}
      </main>

      {/* Upload Modal for editing (adding new version) */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={handleUploadModalClose}
        onSuccess={handleUploadSuccess}
        agentId={id}
        agentName={agent?.name}
      />

      {/* Edit Agent Details Modal */}
      {agent && (
        <EditAgentModal
          isOpen={isEditAgentModalOpen}
          onClose={handleEditAgentModalClose}
          agent={agent}
          onSuccess={handleEditAgentSuccess}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Agent"
        message={`Are you sure you want to delete "${agent?.name}"? This action cannot be undone.`}
        confirmLabel="Delete Agent"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        isLoading={isDeleting}
      />

      {/* Deprecation Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeprecateConfirm}
        title="Deprecate Agent"
        message={`Are you sure you want to deprecate "${agent?.name}"? Deprecated agents remain visible but indicate they should no longer be used.`}
        confirmLabel="Deprecate"
        confirmVariant="danger"
        onConfirm={handleDeprecateConfirm}
        onCancel={() => setShowDeprecateConfirm(false)}
        isLoading={updateAgentMutation.isPending}
      />

      {/* Add/Edit Memory Modal */}
      {id && (
        <AddMemoryModal
          isOpen={isMemoryModalOpen}
          onClose={handleMemoryModalClose}
          agentId={id}
          existingMemory={editingMemory}
          defaultMemoryType={injectingProcedural ? 'procedural' : 'long_term'}
          onSuccess={handleMemorySuccess}
        />
      )}

      {/* Delete Memory Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteMemoryConfirm}
        title="Delete Memory"
        message={`Are you sure you want to delete "${memoryToDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete Memory"
        confirmVariant="danger"
        onConfirm={handleDeleteMemory}
        onCancel={() => {
          setShowDeleteMemoryConfirm(false);
          setMemoryToDelete(null);
        }}
        isLoading={isDeletingMemory}
      />

      {/* Remove Registry Ref Confirmation Modal */}
      <ConfirmModal
        isOpen={showRemoveRegistryRefConfirm}
        title="Remove Registry Component"
        message={`Are you sure you want to remove "${registryRefToRemove?.registry_component?.name || 'this component'}" from this agent?`}
        confirmLabel="Remove"
        confirmVariant="danger"
        onConfirm={handleRemoveRegistryRef}
        onCancel={() => {
          setShowRemoveRegistryRefConfirm(false);
          setRegistryRefToRemove(null);
        }}
        isLoading={removeRegistryRefMutation.isPending}
      />

      {/* Publish to Library Modal */}
      <PublishToLibraryModal
        isOpen={isPublishModalOpen}
        onClose={handlePublishModalClose}
        component={componentToPublish}
        versionId={currentVersionIdForComponents}
        onSuccess={handlePublishSuccess}
      />

      {/* Component Editor (for skills and tools) */}
      <ComponentEditor
        isOpen={isComponentEditorOpen}
        onClose={handleComponentEditorClose}
        component={editingComponent}
        versionId={currentVersionIdForComponents}
        onVersionCreated={handleComponentVersionCreated}
      />

      {/* Agent Chat Panel */}
      {id && activeDeployment && (
        <AgentChat
          isOpen={isChatOpen}
          onClose={handleChatClose}
          deploymentId={activeDeployment.id}
          agentName={agent.name}
        />
      )}

      {/* Add from Registry Modal */}
      {id && (
        <AddFromLibraryModal
          isOpen={isAddFromLibraryOpen}
          onClose={() => setIsAddFromLibraryOpen(false)}
          agentId={id}
          onSuccess={handleAddFromRegistrySuccess}
        />
      )}

      {/* Compare Versions Modal */}
      {id && (
        <CompareVersionsModal
          isOpen={isCompareModalOpen}
          onClose={() => setIsCompareModalOpen(false)}
          agentId={id}
          versions={versions}
        />
      )}

      {/* Memory Suggestions Modal */}
      {id && (
        <MemorySuggestionsModal
          isOpen={isSuggestionsModalOpen}
          onClose={() => setIsSuggestionsModalOpen(false)}
          agentId={id}
          onApprove={handleMemorySuccess}
        />
      )}
    </div>
  );
}
