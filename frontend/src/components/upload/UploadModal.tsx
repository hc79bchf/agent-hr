/**
 * UploadModal component for registering new agents via file upload.
 * Combines metadata form, file upload, and component preview.
 */

import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import JSZip from 'jszip';
import { Modal } from '../ui/Modal';
import { DropZone, FileWithPath } from './DropZone';
import { ComponentPreview, DetectedComponent } from './ComponentPreview';
import { agentService, versionService } from '../../services';
import { agentKeys } from '../../hooks';
import type { AgentCreate, ComponentType } from '../../types';

/**
 * UploadModal props.
 */
interface UploadModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback when upload succeeds */
  onSuccess?: (agentId: string) => void;
  /** Optional agent ID for edit mode (upload new version to existing agent) */
  agentId?: string;
  /** Optional agent name for edit mode (used for zip file naming) */
  agentName?: string;
}

/**
 * Form data for agent metadata.
 */
interface AgentMetadata {
  name: string;
  description: string;
  tags: string;
  department: string;
  usageNotes: string;
}

/**
 * Initial form state.
 */
const initialMetadata: AgentMetadata = {
  name: '',
  description: '',
  tags: '',
  department: '',
  usageNotes: '',
};

/**
 * Infer component type from file path/name.
 * Uses folder structure for accurate categorization (mirrors backend parser.py):
 * - .claude/commands/ or /skills/ → skill
 * - .claude/agents/ or *agent*.py → agent
 * - .claude/tools/ or /tools/ or mcp patterns → mcp_tool
 * - /memory/ or /memories/ folder .md/.txt files → memory
 * - Other .md and .txt files → memory
 * - Other files (utility code, etc.) → other
 */
function inferComponentType(filePath: string): ComponentType {
  const lowerPath = filePath.toLowerCase();
  const fileName = filePath.split('/').pop() || '';
  const fileNameLower = fileName.toLowerCase();
  const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '';

  // Skip files in examples/ folders - categorize as other
  if (lowerPath.includes('/examples/') || lowerPath.startsWith('examples/')) {
    return 'other';
  }

  // Skip __init__.py files - they're module markers, not components
  if (fileNameLower === '__init__.py') {
    return 'other';
  }

  // Check for memory folder patterns FIRST (before skill check)
  // ALL files in /memory/ or /memories/ folders are memory
  if (
    lowerPath.includes('/memory/') ||
    lowerPath.includes('/memories/') ||
    lowerPath.startsWith('memory/') ||
    lowerPath.startsWith('memories/')
  ) {
    return 'memory';
  }

  // Check for skill patterns (Claude commands folder OR skills folder)
  if (
    lowerPath.includes('.claude/commands/') ||
    lowerPath.includes('/commands/') ||
    lowerPath.startsWith('commands/') ||
    lowerPath.includes('/skills/') ||
    lowerPath.startsWith('skills/')
  ) {
    return 'skill';
  }

  // Check for agent patterns - only *agent*.py files, not all files in agents/
  if (lowerPath.includes('.claude/agents/') && ext === '.md') {
    return 'agent';
  }

  // Files in /agents/ folder - only *agent*.py are agents
  if (
    (lowerPath.includes('/agents/') || lowerPath.startsWith('agents/')) &&
    ext === '.py'
  ) {
    // Only parse *agent*.py files as agents
    if (fileNameLower.includes('agent')) {
      return 'agent';
    }
    // Other .py files in agents/ folder are utility code
    return 'other';
  }

  // Check for tool patterns (MCP tools)
  if (
    lowerPath.includes('.claude/tools/') ||
    lowerPath.includes('/tools/') ||
    lowerPath.startsWith('tools/') ||
    lowerPath.includes('mcp.json') ||
    lowerPath.includes('mcp_config.json')
  ) {
    return 'mcp_tool';
  }

  // Check for memory patterns - .md and .txt files (not in specific folders)
  if (ext === '.md' || ext === '.txt') {
    // Skip blocklisted files
    const blocklist = ['license.txt', 'readme.txt', 'requirements.txt', 'changelog.txt'];
    if (blocklist.includes(fileNameLower)) {
      return 'other';
    }
    return 'memory';
  }

  // *agent*.py files anywhere → agents
  if (ext === '.py' && fileNameLower.includes('agent')) {
    return 'agent';
  }

  // Python files NOT in recognized folders (skills/, commands/, tools/, agents/)
  // are utility/library code, not skills
  if (ext === '.py') {
    return 'other';
  }

  // Default to other for unrecognized files
  return 'other';
}

/**
 * Get component name from file path.
 */
function getComponentName(filePath: string): string {
  // Extract filename without extension
  const parts = filePath.split('/');
  const filename = parts[parts.length - 1];
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');

  // Convert to readable name (handle snake_case, kebab-case, camelCase)
  return nameWithoutExt
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Parse files to detect components (client-side simulation).
 * In production, this would be an API call to the backend.
 */
async function parseFiles(files: FileWithPath[]): Promise<DetectedComponent[]> {
  // Filter to relevant file types
  const relevantExtensions = ['.json', '.yaml', '.yml', '.md', '.txt', '.py', '.ts', '.js'];

  const relevantFiles = files.filter((file) => {
    const name = file.name.toLowerCase();
    return relevantExtensions.some((ext) => name.endsWith(ext));
  });

  // Create detected components from files
  return relevantFiles.map((file) => {
    const path = file.webkitRelativePath || file.name;
    return {
      name: getComponentName(path),
      type: inferComponentType(path),
      sourcePath: path,
      size: file.size,
      selected: true, // Select all by default
    };
  });
}

/**
 * UploadModal component.
 */
export function UploadModal({ isOpen, onClose, onSuccess, agentId, agentName }: UploadModalProps) {
  const queryClient = useQueryClient();

  // Determine if we're in edit mode (uploading to existing agent)
  const isEditMode = Boolean(agentId);

  // Form state
  const [metadata, setMetadata] = useState<AgentMetadata>(initialMetadata);
  const [files, setFiles] = useState<FileWithPath[]>([]);
  const [components, setComponents] = useState<DetectedComponent[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  // In edit mode, skip metadata step and go straight to upload
  const [step, setStep] = useState<'metadata' | 'upload' | 'preview'>(isEditMode ? 'upload' : 'metadata');

  // Validation
  const isMetadataValid = useMemo(() => {
    return metadata.name.trim().length >= 2;
  }, [metadata.name]);

  const hasSelectedComponents = useMemo(() => {
    return components.some((c) => c.selected);
  }, [components]);

  // Create agent mutation
  const createAgentMutation = useMutation({
    mutationFn: async (data: AgentCreate) => {
      return agentService.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.all });
    },
  });

  // Upload version mutation
  const uploadVersionMutation = useMutation({
    mutationFn: async ({ agentId, file }: { agentId: string; file: File }) => {
      return versionService.upload(agentId, file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.all });
    },
  });

  // Handle metadata input changes
  const handleMetadataChange = useCallback(
    (field: keyof AgentMetadata) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setMetadata((prev) => ({ ...prev, [field]: event.target.value }));
    },
    []
  );

  // Handle files selected
  const handleFilesSelected = useCallback(async (selectedFiles: FileWithPath[]) => {
    setFiles(selectedFiles);

    if (selectedFiles.length > 0) {
      setIsParsing(true);
      setParseError(null);

      try {
        const detected = await parseFiles(selectedFiles);
        setComponents(detected);
        setStep('preview');
      } catch (error) {
        setParseError(error instanceof Error ? error.message : 'Failed to parse files');
        setComponents([]);
      } finally {
        setIsParsing(false);
      }
    } else {
      setComponents([]);
      setStep('upload');
    }
  }, []);

  // Handle component selection changes
  const handleComponentsChange = useCallback((updated: DetectedComponent[]) => {
    setComponents(updated);
  }, []);

  // Create a zip file from selected files
  const createZipFile = useCallback(async (): Promise<File> => {
    // Get selected component paths
    const selectedPaths = new Set(
      components.filter((c) => c.selected).map((c) => c.sourcePath)
    );

    // Filter files to selected components
    const selectedFiles = files.filter((file) => {
      const path = file.webkitRelativePath || file.name;
      return selectedPaths.has(path);
    });

    // For single file, return as-is
    if (selectedFiles.length === 1) {
      return selectedFiles[0];
    }

    // Create a proper zip file using JSZip
    const zip = new JSZip();

    for (const file of selectedFiles) {
      const path = file.webkitRelativePath || file.name;
      const content = await file.arrayBuffer();
      zip.file(path, content);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // Use agentName in edit mode, otherwise use metadata.name
    const zipFileName = (agentName || metadata.name).replace(/\s+/g, '_');
    return new File([zipBlob], `${zipFileName}_upload.zip`, {
      type: 'application/zip',
    });
  }, [components, files, metadata.name, agentName]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    // In edit mode, we only need selected components (no metadata validation)
    if (!isEditMode && !isMetadataValid) return;
    if (!hasSelectedComponents) return;

    try {
      let targetAgentId: string;

      if (isEditMode && agentId) {
        // Edit mode: upload new version to existing agent
        targetAgentId = agentId;
      } else {
        // Create mode: create new agent first
        // Parse tags from comma-separated string
        const tags = metadata.tags
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0);

        // Create agent
        const agent = await createAgentMutation.mutateAsync({
          name: metadata.name.trim(),
          description: metadata.description.trim() || null,
          tags,
          department: metadata.department.trim() || null,
          usage_notes: metadata.usageNotes.trim() || null,
        });
        targetAgentId = agent.id;
      }

      // Create file for upload
      const uploadFile = await createZipFile();

      // Upload files
      await uploadVersionMutation.mutateAsync({
        agentId: targetAgentId,
        file: uploadFile,
      });

      // Reset and close
      setMetadata(initialMetadata);
      setFiles([]);
      setComponents([]);
      setStep(isEditMode ? 'upload' : 'metadata');
      onClose();
      onSuccess?.(targetAgentId);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  }, [
    isEditMode,
    agentId,
    isMetadataValid,
    hasSelectedComponents,
    metadata,
    createAgentMutation,
    createZipFile,
    uploadVersionMutation,
    onClose,
    onSuccess,
  ]);

  // Handle modal close
  const handleClose = useCallback(() => {
    // Reset state when closing
    setMetadata(initialMetadata);
    setFiles([]);
    setComponents([]);
    setStep(isEditMode ? 'upload' : 'metadata');
    setParseError(null);
    onClose();
  }, [onClose, isEditMode]);

  // Navigation
  const goToMetadata = useCallback(() => setStep('metadata'), []);
  const goToUpload = useCallback(() => setStep('upload'), []);

  // Loading state
  const isSubmitting = createAgentMutation.isPending || uploadVersionMutation.isPending;
  const error = createAgentMutation.error || uploadVersionMutation.error;

  // Footer content
  const footer = (
    <div className="flex items-center justify-between">
      <div>
        {/* Show back button if not on first step (metadata for create, upload for edit) */}
        {(isEditMode ? step === 'preview' : step !== 'metadata') && (
          <button
            type="button"
            onClick={step === 'upload' ? goToMetadata : goToUpload}
            className="text-sm text-gray-600 hover:text-gray-900"
            disabled={isSubmitting}
          >
            Back
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        {step === 'metadata' && (
          <button
            type="button"
            onClick={goToUpload}
            disabled={!isMetadataValid}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next: Upload Files
          </button>
        )}
        {step === 'upload' && (
          <button
            type="button"
            onClick={() => files.length > 0 && handleFilesSelected(files)}
            disabled={files.length === 0 || isParsing}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isParsing ? 'Analyzing...' : 'Analyze Files'}
          </button>
        )}
        {step === 'preview' && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!hasSelectedComponents || isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting
              ? isEditMode ? 'Uploading...' : 'Creating Agent...'
              : isEditMode ? 'Upload New Version' : 'Create Agent'}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditMode ? 'Upload New Version' : 'Upload New Agent'}
      size="lg"
      footer={footer}
      closeOnEscape={!isSubmitting}
      closeOnBackdropClick={!isSubmitting}
    >
      {/* Progress indicator */}
      <div className="mb-6">
        <div className="flex items-center">
          {(isEditMode ? ['upload', 'preview'] : ['metadata', 'upload', 'preview']).map((s, i, arr) => (
            <div key={s} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  step === s
                    ? 'bg-indigo-600 text-white'
                    : arr.indexOf(step) > i
                    ? 'bg-indigo-200 text-indigo-700'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {i + 1}
              </div>
              {i < arr.length - 1 && (
                <div
                  className={`w-16 h-1 mx-2 ${
                    arr.indexOf(step) > i
                      ? 'bg-indigo-200'
                      : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex mt-2">
          {isEditMode ? (
            <>
              <span className="text-xs text-gray-500 w-8 text-center">Files</span>
              <span className="text-xs text-gray-500 w-16 mx-2"></span>
              <span className="text-xs text-gray-500 w-8 text-center">Review</span>
            </>
          ) : (
            <>
              <span className="text-xs text-gray-500 w-8 text-center">Info</span>
              <span className="text-xs text-gray-500 w-16 mx-2"></span>
              <span className="text-xs text-gray-500 w-8 text-center">Files</span>
              <span className="text-xs text-gray-500 w-16 mx-2"></span>
              <span className="text-xs text-gray-500 w-8 text-center">Review</span>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">
            {error instanceof Error ? error.message : 'An error occurred'}
          </p>
        </div>
      )}

      {/* Step 1: Metadata Form */}
      {step === 'metadata' && (
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Agent Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={metadata.name}
              onChange={handleMetadataChange('name')}
              placeholder="e.g., Customer Support Agent"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
            {metadata.name.length > 0 && metadata.name.length < 2 && (
              <p className="mt-1 text-xs text-red-500">Name must be at least 2 characters</p>
            )}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              value={metadata.description}
              onChange={handleMetadataChange('description')}
              rows={3}
              placeholder="Describe what this agent does..."
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
              Tags
            </label>
            <input
              type="text"
              id="tags"
              value={metadata.tags}
              onChange={handleMetadataChange('tags')}
              placeholder="e.g., support, chat, automation (comma-separated)"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">Separate tags with commas</p>
          </div>

          <div>
            <label htmlFor="department" className="block text-sm font-medium text-gray-700">
              Department
            </label>
            <input
              type="text"
              id="department"
              value={metadata.department}
              onChange={handleMetadataChange('department')}
              placeholder="e.g., Engineering, Sales, HR"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="usageNotes" className="block text-sm font-medium text-gray-700">
              Usage Notes
            </label>
            <textarea
              id="usageNotes"
              value={metadata.usageNotes}
              onChange={handleMetadataChange('usageNotes')}
              rows={2}
              placeholder="Any special instructions or notes for using this agent..."
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
        </div>
      )}

      {/* Step 2: File Upload */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Upload Agent Configuration
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Upload files or a folder containing your agent configuration. Supported formats include
              JSON, YAML, Markdown, and source code files.
            </p>
          </div>

          <DropZone
            onFilesSelected={setFiles}
            selectedFiles={files}
            accept=".json,.yaml,.yml,.md,.txt,.py,.ts,.js"
            allowFolders
            multiple
          />

          {files.length > 0 && (
            <p className="text-sm text-gray-600">
              {files.length} file{files.length !== 1 ? 's' : ''} selected. Click &quot;Analyze Files&quot;
              to continue.
            </p>
          )}
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Detected Components
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Review the components detected from your files. Uncheck any you don&apos;t want to include.
            </p>
          </div>

          <ComponentPreview
            components={components}
            onSelectionChange={handleComponentsChange}
            isLoading={isParsing}
            error={parseError}
          />

          {/* Summary */}
          {components.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Summary</h4>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-gray-500">Agent Name:</dt>
                <dd className="text-gray-900 font-medium">{metadata.name}</dd>
                {metadata.department && (
                  <>
                    <dt className="text-gray-500">Department:</dt>
                    <dd className="text-gray-900">{metadata.department}</dd>
                  </>
                )}
                <dt className="text-gray-500">Components:</dt>
                <dd className="text-gray-900">
                  {components.filter((c) => c.selected).length} selected
                </dd>
              </dl>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
