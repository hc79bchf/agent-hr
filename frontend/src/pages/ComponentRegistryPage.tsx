/**
 * ComponentRegistryPage component.
 * Unified component management with access control (owner, manager, grants, access requests).
 * Combines component registry and library functionality.
 */

import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { componentRegistryService } from '../services/componentRegistry';
import {
  ComponentGrantsSection,
  AccessRequestsPanel,
  OwnershipManagementSection,
  RequestAccessModal,
} from '../components';
import {
  ComponentEditModal,
  CompareSnapshotsModal,
} from '../components/component-registry';
import type {
  ComponentRegistryEntry,
  ComponentRegistryCreate,
  ComponentRegistryListParams,
  RegistryComponentType,
  ComponentVisibility,
  ComponentSnapshot,
} from '../types';

/**
 * Page size for pagination.
 */
const PAGE_SIZE = 12;

/**
 * Debounce delay for search input (ms).
 */
const SEARCH_DEBOUNCE_MS = 300;

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
function getTypeIcon(type: RegistryComponentType): JSX.Element {
  switch (type) {
    case 'skill':
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case 'tool':
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
function getTypeColor(type: RegistryComponentType): string {
  switch (type) {
    case 'skill':
      return 'bg-purple-100 text-purple-800';
    case 'tool':
      return 'bg-blue-100 text-blue-800';
    case 'memory':
      return 'bg-green-100 text-green-800';
  }
}

/**
 * Get color classes for visibility.
 */
function getVisibilityColor(visibility: ComponentVisibility): string {
  switch (visibility) {
    case 'private':
      return 'bg-gray-100 text-gray-800';
    case 'organization':
      return 'bg-yellow-100 text-yellow-800';
    case 'public':
      return 'bg-green-100 text-green-800';
  }
}

/**
 * Component card.
 */
function ComponentCard({
  component,
  onClick,
}: {
  component: ComponentRegistryEntry;
  onClick: (component: ComponentRegistryEntry) => void;
}) {
  return (
    <div
      onClick={() => onClick(component)}
      className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer border border-gray-200"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`p-1.5 rounded flex-shrink-0 ${getTypeColor(component.type)}`}>
              {getTypeIcon(component.type)}
            </span>
            <h3 className="text-lg font-medium text-gray-900 truncate">
              {component.name}
            </h3>
          </div>
          <span className={`text-xs font-medium px-2 py-1 rounded flex-shrink-0 ${getVisibilityColor(component.visibility)}`}>
            {component.visibility}
          </span>
        </div>

        {/* Description */}
        {component.description && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-2">
            {component.description}
          </p>
        )}

        {/* Tags */}
        {component.tags && component.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
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

        {/* Owner Info */}
        <div className="text-xs text-gray-500">
          <span className="font-medium">Owner:</span>{' '}
          {component.owner?.name || 'Unknown'}
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
  type: RegistryComponentType | '';
  visibility: ComponentVisibility | '';
  showOwned: boolean;
}

/**
 * Metadata key-value pair for component creation.
 */
interface MetadataField {
  key: string;
  value: string;
}

/**
 * Uploaded file info.
 */
interface UploadedFile {
  name: string;
  path: string;
  content: string;
}

/**
 * Create component form data.
 */
interface CreateFormData {
  type: RegistryComponentType;
  name: string;
  description: string;
  tags: string;
  visibility: ComponentVisibility;
  metadataFields: MetadataField[];
  uploadedFiles: UploadedFile[];
}

export function ComponentRegistryPage() {
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    type: '',
    visibility: '',
    showOwned: false,
  });
  const [selectedComponent, setSelectedComponent] = useState<ComponentRegistryEntry | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'grants' | 'requests'>('details');
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState<CreateFormData>({
    type: 'skill',
    name: '',
    description: '',
    tags: '',
    visibility: 'private',
    metadataFields: [{ key: '', value: '' }],
    uploadedFiles: [],
  });
  const [isRequestAccessModalOpen, setIsRequestAccessModalOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search
  const debouncedSearch = useDebouncedValue(filters.search, SEARCH_DEBOUNCE_MS);

  // Build query params
  const queryParams: ComponentRegistryListParams = useMemo(() => {
    const params: ComponentRegistryListParams = {
      limit: PAGE_SIZE,
      skip: (currentPage - 1) * PAGE_SIZE,
    };
    if (debouncedSearch) {
      params.search = debouncedSearch;
    }
    if (filters.type) {
      params.type = filters.type;
    }
    if (filters.visibility) {
      params.visibility = filters.visibility;
    }
    if (filters.showOwned && user) {
      params.owner_id = user.id;
    }
    return params;
  }, [debouncedSearch, filters, user, currentPage]);

  // Fetch components
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['component-registry', queryParams],
    queryFn: () => componentRegistryService.list(queryParams),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: ComponentRegistryCreate) => componentRegistryService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-registry'] });
      setIsCreateModalOpen(false);
      setCreateError(null);
      setCreateFormData({
        type: 'skill',
        name: '',
        description: '',
        tags: '',
        visibility: 'private',
        metadataFields: [{ key: '', value: '' }],
        uploadedFiles: [],
      });
    },
    onError: (err: Error) => {
      console.error('Create component error:', err);
      setCreateError(err.message || 'Failed to create component. Please try again.');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (componentId: string) => componentRegistryService.delete(componentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-registry'] });
      setSelectedComponent(null);
    },
  });

  // Fetch snapshots for selected component (owner only)
  const isOwner = selectedComponent?.owner_id === user?.id;
  const { data: snapshotsData, isLoading: isLoadingSnapshots } = useQuery({
    queryKey: ['component-snapshots', selectedComponent?.id],
    queryFn: () => componentRegistryService.listSnapshots(selectedComponent!.id),
    enabled: Boolean(selectedComponent?.id) && isOwner,
  });

  // Restore snapshot mutation
  const restoreSnapshotMutation = useMutation({
    mutationFn: ({ componentId, snapshotId }: { componentId: string; snapshotId: string }) =>
      componentRegistryService.restoreSnapshot(componentId, snapshotId),
    onSuccess: (updatedComponent) => {
      queryClient.invalidateQueries({ queryKey: ['component-registry'] });
      setSelectedComponent(updatedComponent);
      setSelectedSnapshotId(null);
    },
  });

  // Get current snapshot (if selected)
  const selectedSnapshot = useMemo(() => {
    if (!selectedSnapshotId || !snapshotsData?.data) return null;
    return snapshotsData.data.find((s: ComponentSnapshot) => s.id === selectedSnapshotId) || null;
  }, [selectedSnapshotId, snapshotsData]);

  // Format date for version selector
  const formatVersionDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, search: e.target.value }));
    setCurrentPage(1);
  }, []);

  const handleTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters((prev) => ({
      ...prev,
      type: e.target.value as RegistryComponentType | '',
    }));
    setCurrentPage(1);
  }, []);

  const handleVisibilityChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters((prev) => ({
      ...prev,
      visibility: e.target.value as ComponentVisibility | '',
    }));
    setCurrentPage(1);
  }, []);

  const handleOwnedToggle = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      showOwned: !prev.showOwned,
    }));
    setCurrentPage(1);
  }, []);

  const handleComponentClick = useCallback((component: ComponentRegistryEntry) => {
    setSelectedComponent(component);
    setActiveTab('details');
    setSelectedSnapshotId(null); // Reset to current version
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedComponent(null);
    setSelectedSnapshotId(null);
  }, []);

  const handleVersionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedSnapshotId(value === 'current' ? null : value);
  }, []);

  const handleRestoreSnapshot = useCallback(() => {
    if (!selectedComponent || !selectedSnapshotId) return;
    if (confirm('Are you sure you want to restore this snapshot? This will overwrite the current content.')) {
      restoreSnapshotMutation.mutate({ componentId: selectedComponent.id, snapshotId: selectedSnapshotId });
    }
  }, [selectedComponent, selectedSnapshotId, restoreSnapshotMutation]);

  const handleCreateSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setCreateError(null); // Clear previous errors

      // Transform form data to API format
      const tags = createFormData.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const metadata: Record<string, unknown> = {};
      createFormData.metadataFields.forEach((field) => {
        if (field.key.trim()) {
          metadata[field.key.trim()] = field.value;
        }
      });

      // Add uploaded files to metadata
      if (createFormData.uploadedFiles.length > 0) {
        metadata['_files'] = createFormData.uploadedFiles.map((f) => ({
          name: f.name,
          path: f.path,
        }));
      }

      const apiData: ComponentRegistryCreate = {
        type: createFormData.type,
        name: createFormData.name,
        visibility: createFormData.visibility,
      };

      if (createFormData.description.trim()) {
        apiData.description = createFormData.description.trim();
      }
      if (tags.length > 0) {
        apiData.tags = tags;
      }
      if (Object.keys(metadata).length > 0) {
        apiData.component_metadata = metadata;
      }
      // Combine all file contents for the content field
      if (createFormData.uploadedFiles.length > 0) {
        const combinedContent = createFormData.uploadedFiles
          .map((f) => `--- ${f.path || f.name} ---\n${f.content}`)
          .join('\n\n');
        apiData.content = combinedContent;
      }

      console.log('Creating component with data:', { ...apiData, content: apiData.content?.slice(0, 100) + '...' });
      createMutation.mutate(apiData);
    },
    [createFormData, createMutation]
  );

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // List of allowed text file extensions
    const allowedExtensions = ['.txt', '.json', '.yaml', '.yml', '.md', '.py', '.js', '.ts', '.tsx', '.jsx', '.css', '.html', '.xml', '.csv', '.sh', '.sql', '.env', '.gitignore', '.dockerfile'];

    const fileArray = Array.from(files).filter((file) => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      return allowedExtensions.includes(ext) || file.name.toLowerCase() === 'dockerfile';
    });

    if (fileArray.length === 0) {
      setCreateError('No supported text files found. Only text-based files are allowed.');
      return;
    }

    const readPromises = fileArray.map((file) => {
      return new Promise<UploadedFile | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          // Check for NUL characters (binary content)
          if (content && content.includes('\0')) {
            console.warn(`Skipping binary file: ${file.name}`);
            resolve(null);
            return;
          }
          resolve({
            name: file.name,
            path: (file as unknown as { webkitRelativePath?: string }).webkitRelativePath || file.name,
            content: content || '',
          });
        };
        reader.onerror = () => {
          console.warn(`Failed to read file: ${file.name}`);
          resolve(null);
        };
        reader.readAsText(file);
      });
    });

    Promise.all(readPromises).then((results) => {
      const uploadedFiles = results.filter((f): f is UploadedFile => f !== null);
      if (uploadedFiles.length === 0) {
        setCreateError('No valid text files could be read. Binary files are not supported.');
        return;
      }
      setCreateFormData((prev) => ({
        ...prev,
        uploadedFiles: [...prev.uploadedFiles, ...uploadedFiles],
      }));
      setCreateError(null);
    });

    // Reset input so the same file can be selected again
    e.target.value = '';
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setCreateFormData((prev) => ({
      ...prev,
      uploadedFiles: prev.uploadedFiles.filter((_, i) => i !== index),
    }));
  }, []);

  const handleClearAllFiles = useCallback(() => {
    setCreateFormData((prev) => ({
      ...prev,
      uploadedFiles: [],
    }));
  }, []);

  const handleAddMetadataField = useCallback(() => {
    setCreateFormData((prev) => ({
      ...prev,
      metadataFields: [...prev.metadataFields, { key: '', value: '' }],
    }));
  }, []);

  const handleRemoveMetadataField = useCallback((index: number) => {
    setCreateFormData((prev) => ({
      ...prev,
      metadataFields: prev.metadataFields.filter((_, i) => i !== index),
    }));
  }, []);

  const handleMetadataFieldChange = useCallback(
    (index: number, field: 'key' | 'value', value: string) => {
      setCreateFormData((prev) => ({
        ...prev,
        metadataFields: prev.metadataFields.map((item, i) =>
          i === index ? { ...item, [field]: value } : item
        ),
      }));
    },
    []
  );

  const handleDelete = useCallback(() => {
    if (selectedComponent && window.confirm(`Are you sure you want to delete "${selectedComponent.name}"?`)) {
      deleteMutation.mutate(selectedComponent.id);
    }
  }, [selectedComponent, deleteMutation]);

  const handleOpenRequestAccess = useCallback(() => {
    setIsRequestAccessModalOpen(true);
  }, []);

  const handleCloseRequestAccess = useCallback(() => {
    setIsRequestAccessModalOpen(false);
  }, []);

  // isOwner is defined earlier for snapshot query
  const isManager = selectedComponent?.manager_id === user?.id;
  const canManage = isOwner || isManager;

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
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
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
        {/* Page Title */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">Component Registry</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage component ownership, access grants, and permissions
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
          <div className="w-full sm:w-40">
            <select
              value={filters.type}
              onChange={handleTypeChange}
              className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="">All types</option>
              <option value="skill">Skill</option>
              <option value="tool">Tool</option>
              <option value="memory">Memory</option>
            </select>
          </div>

          {/* Visibility Filter */}
          <div className="w-full sm:w-40">
            <select
              value={filters.visibility}
              onChange={handleVisibilityChange}
              className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="">All visibility</option>
              <option value="private">Private</option>
              <option value="organization">Organization</option>
              <option value="public">Public</option>
            </select>
          </div>

          {/* Show Owned Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.showOwned}
              onChange={handleOwnedToggle}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">My components only</span>
          </label>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Create Button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
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
            <h3 className="text-sm font-medium text-red-800">Error loading components</h3>
            <p className="mt-1 text-sm text-red-700">
              {(error as Error)?.message || 'An unexpected error occurred'}
            </p>
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
                <h3 className="mt-2 text-sm font-medium text-gray-900">No components found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Create a component to get started with access control.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-500">
                  Showing {data.data.length} of {data.total} component{data.total !== 1 ? 's' : ''}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {data.data.map((component) => (
                    <ComponentCard
                      key={component.id}
                      component={component}
                      onClick={handleComponentClick}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {data.total > PAGE_SIZE && (
                  <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
                    <div className="text-sm text-gray-500">
                      Page {currentPage} of {Math.ceil(data.total / PAGE_SIZE)}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Previous
                      </button>
                      {Array.from({ length: Math.ceil(data.total / PAGE_SIZE) }, (_, i) => i + 1)
                        .filter((page) => {
                          const total = Math.ceil(data.total / PAGE_SIZE);
                          return page === 1 || page === total || Math.abs(page - currentPage) <= 1;
                        })
                        .reduce<(number | string)[]>((acc, page, idx, arr) => {
                          if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                            acc.push('...');
                          }
                          acc.push(page);
                          return acc;
                        }, [])
                        .map((item, idx) =>
                          typeof item === 'string' ? (
                            <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                          ) : (
                            <button
                              key={item}
                              onClick={() => setCurrentPage(item)}
                              className={`inline-flex items-center px-3 py-2 border text-sm font-medium rounded-md ${
                                currentPage === item
                                  ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                              }`}
                            >
                              {item}
                            </button>
                          )
                        )}
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(Math.ceil(data.total / PAGE_SIZE), p + 1))}
                        disabled={currentPage >= Math.ceil(data.total / PAGE_SIZE)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                        <svg className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
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
            <div className="relative inline-block bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-3xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`p-2 rounded-lg ${getTypeColor(selectedComponent.type)}`}>
                      {getTypeIcon(selectedComponent.type)}
                    </span>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {selectedSnapshot ? selectedSnapshot.name : selectedComponent.name}
                      </h3>
                      <p className="text-sm text-gray-500 capitalize">
                        {selectedComponent.type}
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

                {/* Version Selector (Owner Only) */}
                {isOwner && (
                  <div className="flex flex-wrap items-center gap-3 mb-4 pb-4 border-b border-gray-200">
                    <label htmlFor="version-select" className="text-sm font-medium text-gray-700">
                      Version:
                    </label>
                    <select
                      id="version-select"
                      value={selectedSnapshotId || 'current'}
                      onChange={handleVersionChange}
                      disabled={isLoadingSnapshots}
                      className="block w-48 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                      <option value="current">Current</option>
                      {snapshotsData?.data?.map((snapshot: ComponentSnapshot) => (
                        <option key={snapshot.id} value={snapshot.id}>
                          {snapshot.version_label}
                        </option>
                      ))}
                    </select>
                    {selectedSnapshot && (
                      <span className="text-xs text-gray-500">
                        {formatVersionDate(selectedSnapshot.created_at)}
                      </span>
                    )}
                    {selectedSnapshot ? (
                      <button
                        onClick={handleRestoreSnapshot}
                        disabled={restoreSnapshotMutation.isPending}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {restoreSnapshotMutation.isPending ? 'Restoring...' : 'Restore This Version'}
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsCompareModalOpen(true)}
                        disabled={!snapshotsData?.data || snapshotsData.data.length === 0}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        title={!snapshotsData?.data || snapshotsData.data.length === 0 ? 'No snapshots to compare' : 'Compare versions'}
                      >
                        <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Compare Versions
                      </button>
                    )}
                  </div>
                )}

                {/* Viewing snapshot banner */}
                {selectedSnapshot && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="flex items-center gap-2">
                      <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm text-yellow-800">
                        Viewing snapshot: <strong>{selectedSnapshot.version_label}</strong>
                        {selectedSnapshot.creator && ` (created by ${selectedSnapshot.creator.name})`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Tabs */}
                <div className="border-b border-gray-200 mb-4">
                  <nav className="-mb-px flex space-x-8">
                    <button
                      onClick={() => setActiveTab('details')}
                      className={`py-2 px-1 border-b-2 text-sm font-medium ${
                        activeTab === 'details'
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Details & Ownership
                    </button>
                    <button
                      onClick={() => setActiveTab('grants')}
                      className={`py-2 px-1 border-b-2 text-sm font-medium ${
                        activeTab === 'grants'
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Access Grants
                    </button>
                    {canManage && (
                      <button
                        onClick={() => setActiveTab('requests')}
                        className={`py-2 px-1 border-b-2 text-sm font-medium ${
                          activeTab === 'requests'
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Access Requests
                      </button>
                    )}
                  </nav>
                </div>

                {/* Tab Content */}
                <div className="min-h-[300px]">
                  {activeTab === 'details' && (
                    <div className="space-y-6">
                      {/* Description */}
                      {(selectedSnapshot?.description || selectedComponent.description) && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
                          <p className="text-sm text-gray-600">
                            {selectedSnapshot ? selectedSnapshot.description : selectedComponent.description}
                          </p>
                        </div>
                      )}

                      {/* Tags */}
                      {((selectedSnapshot?.tags && selectedSnapshot.tags.length > 0) ||
                        (selectedComponent.tags && selectedComponent.tags.length > 0)) && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Tags</h4>
                          <div className="flex flex-wrap gap-1">
                            {(selectedSnapshot?.tags || selectedComponent.tags || []).map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Content Preview */}
                      {(selectedSnapshot?.content || selectedComponent.content) && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Content Preview</h4>
                          <pre className="text-xs text-gray-600 bg-gray-50 p-3 rounded-md overflow-auto max-h-48">
                            {(() => {
                              const content = selectedSnapshot ? selectedSnapshot.content : selectedComponent.content;
                              return content ? (content.slice(0, 500) + (content.length > 500 ? '...' : '')) : '';
                            })()}
                          </pre>
                        </div>
                      )}

                      {/* Visibility (only show for current version) */}
                      {!selectedSnapshot && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Visibility</h4>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getVisibilityColor(selectedComponent.visibility)}`}>
                            {selectedComponent.visibility}
                          </span>
                        </div>
                      )}

                      {/* Ownership Section (only show for current version) */}
                      {!selectedSnapshot && (
                        <OwnershipManagementSection
                          component={selectedComponent}
                          currentUserId={user?.id || ''}
                          onComponentUpdate={setSelectedComponent}
                        />
                      )}
                    </div>
                  )}

                  {activeTab === 'grants' && (
                    <ComponentGrantsSection componentId={selectedComponent.id} />
                  )}

                  {activeTab === 'requests' && canManage && (
                    <AccessRequestsPanel componentId={selectedComponent.id} />
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-3">
                {isOwner && !selectedSnapshot && (
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(true)}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 sm:w-auto sm:text-sm"
                  >
                    Edit
                  </button>
                )}
                {isOwner && !selectedSnapshot && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    className="w-full inline-flex justify-center rounded-md border border-red-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-red-700 hover:bg-red-50 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                  </button>
                )}
                {!canManage && (
                  <button
                    type="button"
                    onClick={handleOpenRequestAccess}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 sm:w-auto sm:text-sm"
                  >
                    Request Access
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCloseDetail}
                  className="mt-3 sm:mt-0 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Component Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setIsCreateModalOpen(false)}
            />
            <div className="relative inline-block bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-2xl sm:w-full max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleCreateSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Create Component</h3>
                  <div className="space-y-4">
                    {/* Name */}
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="name"
                        value={createFormData.name}
                        onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="Enter component name"
                        required
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                        Description
                      </label>
                      <textarea
                        id="description"
                        value={createFormData.description}
                        onChange={(e) => setCreateFormData({ ...createFormData, description: e.target.value })}
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="Describe what this component does..."
                      />
                    </div>

                    {/* Type and Visibility Row */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                          Type
                        </label>
                        <select
                          id="type"
                          value={createFormData.type}
                          onChange={(e) => setCreateFormData({ ...createFormData, type: e.target.value as RegistryComponentType })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                          <option value="skill">Skill</option>
                          <option value="tool">Tool</option>
                          <option value="memory">Memory</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="visibility" className="block text-sm font-medium text-gray-700">
                          Visibility
                        </label>
                        <select
                          id="visibility"
                          value={createFormData.visibility}
                          onChange={(e) => setCreateFormData({ ...createFormData, visibility: e.target.value as ComponentVisibility })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                          <option value="private">Private</option>
                          <option value="organization">Organization</option>
                          <option value="public">Public</option>
                        </select>
                      </div>
                    </div>

                    {/* Tags */}
                    <div>
                      <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
                        Tags
                      </label>
                      <input
                        type="text"
                        id="tags"
                        value={createFormData.tags}
                        onChange={(e) => setCreateFormData({ ...createFormData, tags: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="Enter tags separated by commas (e.g., ai, automation, nlp)"
                      />
                      <p className="mt-1 text-xs text-gray-500">Separate multiple tags with commas</p>
                    </div>

                    {/* File Upload */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Upload Files
                        </label>
                        {createFormData.uploadedFiles.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearAllFiles}
                            className="text-sm text-red-600 hover:text-red-500"
                          >
                            Clear All
                          </button>
                        )}
                      </div>

                      {/* Upload Buttons */}
                      <div className="flex gap-2 mb-3">
                        <label className="flex-1 cursor-pointer">
                          <div className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                            <svg className="h-5 w-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Upload Files
                          </div>
                          <input
                            type="file"
                            className="sr-only"
                            onChange={handleFileUpload}
                            accept=".txt,.json,.yaml,.yml,.md,.py,.js,.ts,.tsx,.jsx,.css,.html,.xml,.csv"
                            multiple
                          />
                        </label>
                        <label className="flex-1 cursor-pointer">
                          <div className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                            <svg className="h-5 w-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                            Upload Folder
                          </div>
                          <input
                            type="file"
                            className="sr-only"
                            onChange={handleFileUpload}
                            /* @ts-ignore: webkitdirectory is non-standard but widely supported */
                            webkitdirectory=""
                            directory=""
                            multiple
                          />
                        </label>
                      </div>

                      {/* File List */}
                      {createFormData.uploadedFiles.length > 0 ? (
                        <div className="border border-gray-200 rounded-md max-h-40 overflow-y-auto">
                          <ul className="divide-y divide-gray-200">
                            {createFormData.uploadedFiles.map((file, index) => (
                              <li key={index} className="px-3 py-2 flex items-center justify-between hover:bg-gray-50">
                                <div className="flex items-center min-w-0">
                                  <svg className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <span className="text-sm text-gray-700 truncate" title={file.path}>
                                    {file.path || file.name}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFile(index)}
                                  className="ml-2 text-red-500 hover:text-red-700 flex-shrink-0"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="border-2 border-gray-300 border-dashed rounded-md px-6 py-8">
                          <div className="text-center">
                            <svg
                              className="mx-auto h-12 w-12 text-gray-400"
                              stroke="currentColor"
                              fill="none"
                              viewBox="0 0 48 48"
                            >
                              <path
                                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            <p className="mt-2 text-sm text-gray-500">
                              No files uploaded yet
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Supports TXT, JSON, YAML, MD, PY, JS, TS, TSX, JSX, CSS, HTML, XML, CSV
                            </p>
                          </div>
                        </div>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        {createFormData.uploadedFiles.length} file{createFormData.uploadedFiles.length !== 1 ? 's' : ''} selected
                      </p>
                    </div>

                    {/* Metadata */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Metadata
                        </label>
                        <button
                          type="button"
                          onClick={handleAddMetadataField}
                          className="text-sm text-indigo-600 hover:text-indigo-500"
                        >
                          + Add Field
                        </button>
                      </div>
                      <div className="space-y-2">
                        {createFormData.metadataFields.map((field, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={field.key}
                              onChange={(e) => handleMetadataFieldChange(index, 'key', e.target.value)}
                              placeholder="Key"
                              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            />
                            <input
                              type="text"
                              value={field.value}
                              onChange={(e) => handleMetadataFieldChange(index, 'value', e.target.value)}
                              placeholder="Value"
                              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            />
                            {createFormData.metadataFields.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMetadataField(index)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">Add custom key-value pairs for component metadata</p>
                    </div>

                    {/* Error Display */}
                    {createError && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-3">
                        <div className="flex">
                          <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="ml-2 text-sm text-red-700">{createError}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-3">
                  <button
                    type="submit"
                    disabled={createMutation.isPending || !createFormData.name.trim()}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="mt-3 sm:mt-0 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Request Access Modal */}
      {selectedComponent && (
        <RequestAccessModal
          isOpen={isRequestAccessModalOpen}
          onClose={handleCloseRequestAccess}
          componentId={selectedComponent.id}
          componentName={selectedComponent.name}
        />
      )}

      {/* Edit Modal */}
      {selectedComponent && (
        <ComponentEditModal
          component={selectedComponent}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={(updated) => {
            setSelectedComponent(updated);
            setIsEditModalOpen(false);
          }}
        />
      )}

      {/* Compare Snapshots Modal */}
      {selectedComponent && snapshotsData?.data && (
        <CompareSnapshotsModal
          isOpen={isCompareModalOpen}
          onClose={() => setIsCompareModalOpen(false)}
          component={selectedComponent}
          snapshots={snapshotsData.data}
        />
      )}
    </div>
  );
}

export default ComponentRegistryPage;
