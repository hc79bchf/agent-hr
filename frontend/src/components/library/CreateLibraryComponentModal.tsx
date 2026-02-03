/**
 * CreateLibraryComponentModal component for creating new library components.
 * Supports both manual creation and file/folder upload.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { DropZone, FileWithPath } from '../upload/DropZone';
import { useCreateLibraryComponent, useCreateLibraryComponentsBatch } from '../../hooks';
import type { LibraryComponentType, LibraryComponentCreate } from '../../types';

/**
 * Props for CreateLibraryComponentModal.
 */
interface CreateLibraryComponentModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback when component is created */
  onSuccess?: () => void;
}

/**
 * Detected component from uploaded file.
 */
interface DetectedComponent {
  name: string;
  type: LibraryComponentType;
  description: string;
  content: string;
  sourcePath: string;
  selected: boolean;
}

/**
 * Infer component type from file path.
 */
function inferComponentType(filePath: string): LibraryComponentType {
  const lowerPath = filePath.toLowerCase();

  // Check for skill patterns
  if (
    lowerPath.includes('/skills/') ||
    lowerPath.includes('.claude/commands/') ||
    lowerPath.includes('/commands/')
  ) {
    return 'skill';
  }

  // Check for tool patterns
  if (
    lowerPath.includes('/tools/') ||
    lowerPath.includes('.claude/tools/') ||
    lowerPath.includes('mcp') ||
    lowerPath.includes('tool')
  ) {
    return 'mcp_tool';
  }

  // Check for memory patterns
  if (
    lowerPath.includes('/memory/') ||
    lowerPath.includes('/memories/') ||
    lowerPath.includes('memory') ||
    lowerPath.includes('context') ||
    lowerPath.includes('knowledge')
  ) {
    return 'memory';
  }

  // Default based on file extension
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (ext === 'json') {
    return 'mcp_tool';
  }

  return 'skill';
}

/**
 * Get component name from file path.
 */
function getComponentName(filePath: string): string {
  const parts = filePath.split('/');
  const filename = parts[parts.length - 1];
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');

  // Convert to readable name
  return nameWithoutExt
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Extract description from content (first paragraph or first line).
 */
function extractDescription(content: string, type: LibraryComponentType): string {
  if (type === 'mcp_tool') {
    try {
      const json = JSON.parse(content);
      return json.description || json.name || '';
    } catch {
      return '';
    }
  }

  // For markdown/text, use first non-empty line or paragraph
  const lines = content.split('\n').filter((l) => l.trim());
  if (lines.length === 0) return '';

  // Skip headers and get first content line
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('#') && !trimmed.startsWith('---')) {
      return trimmed.slice(0, 200);
    }
  }

  return lines[0]?.slice(0, 200) || '';
}

/**
 * Parse uploaded files to detect components.
 */
async function parseFiles(files: FileWithPath[]): Promise<DetectedComponent[]> {
  const relevantExtensions = ['.json', '.yaml', '.yml', '.md', '.txt', '.py', '.ts', '.js'];

  const relevantFiles = files.filter((file) => {
    const name = file.name.toLowerCase();
    // Skip hidden files and common non-component files
    if (name.startsWith('.') || name === '__init__.py' || name === 'readme.md') {
      return false;
    }
    return relevantExtensions.some((ext) => name.endsWith(ext));
  });

  const components: DetectedComponent[] = [];

  for (const file of relevantFiles) {
    try {
      const content = await file.text();
      const path = file.webkitRelativePath || file.name;
      const type = inferComponentType(path);

      components.push({
        name: getComponentName(path),
        type,
        description: extractDescription(content, type),
        content,
        sourcePath: path,
        selected: true,
      });
    } catch {
      // Skip files that can't be read
    }
  }

  return components;
}

/**
 * CreateLibraryComponentModal component.
 */
export function CreateLibraryComponentModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateLibraryComponentModalProps) {
  // Mode: 'manual' for form input, 'upload' for file upload
  const [mode, setMode] = useState<'manual' | 'upload'>('manual');

  // Manual mode state
  const [type, setType] = useState<LibraryComponentType>('skill');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  // Upload mode state
  const [files, setFiles] = useState<FileWithPath[]>([]);
  const [detectedComponents, setDetectedComponents] = useState<DetectedComponent[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadStep, setUploadStep] = useState<'upload' | 'preview'>('upload');

  // Shared state
  const [error, setError] = useState<string | null>(null);

  // Mutations
  const createMutation = useCreateLibraryComponent();
  const createBatchMutation = useCreateLibraryComponentsBatch();

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setMode('manual');
      setType('skill');
      setName('');
      setDescription('');
      setContent('');
      setTagsInput('');
      setFiles([]);
      setDetectedComponents([]);
      setUploadStep('upload');
      setError(null);
    }
  }, [isOpen]);

  // Handle close
  const handleClose = useCallback(() => {
    if (!createMutation.isPending && !createBatchMutation.isPending) {
      onClose();
    }
  }, [createMutation.isPending, createBatchMutation.isPending, onClose]);

  // Handle files selected
  const handleFilesSelected = useCallback(async (selectedFiles: FileWithPath[]) => {
    setFiles(selectedFiles);

    if (selectedFiles.length > 0) {
      setIsParsing(true);
      setError(null);

      try {
        const detected = await parseFiles(selectedFiles);
        setDetectedComponents(detected);

        if (detected.length > 0) {
          setUploadStep('preview');
        } else {
          setError('No valid components found in the uploaded files.');
        }
      } catch {
        setError('Failed to parse uploaded files.');
      } finally {
        setIsParsing(false);
      }
    }
  }, []);

  // Toggle component selection
  const toggleComponentSelection = useCallback((index: number) => {
    setDetectedComponents((prev) =>
      prev.map((c, i) => (i === index ? { ...c, selected: !c.selected } : c))
    );
  }, []);

  // Update component type
  const updateComponentType = useCallback((index: number, newType: LibraryComponentType) => {
    setDetectedComponents((prev) =>
      prev.map((c, i) => (i === index ? { ...c, type: newType } : c))
    );
  }, []);

  // Count selected components
  const selectedCount = useMemo(
    () => detectedComponents.filter((c) => c.selected).length,
    [detectedComponents]
  );

  // Handle manual submit
  const handleManualSubmit = useCallback(() => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setError(null);

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    createMutation.mutate(
      {
        type,
        name: name.trim(),
        description: description.trim() || undefined,
        content: content.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
      },
      {
        onSuccess: () => {
          handleClose();
          onSuccess?.();
        },
        onError: (err: Error) => {
          setError(err.message || 'Failed to create component');
        },
      }
    );
  }, [type, name, description, content, tagsInput, createMutation, handleClose, onSuccess]);

  // Handle upload submit
  const handleUploadSubmit = useCallback(() => {
    const selectedComponents = detectedComponents.filter((c) => c.selected);

    if (selectedComponents.length === 0) {
      setError('Please select at least one component');
      return;
    }

    setError(null);

    const componentsToCreate: LibraryComponentCreate[] = selectedComponents.map((c) => ({
      type: c.type,
      name: c.name,
      description: c.description || undefined,
      content: c.content,
    }));

    createBatchMutation.mutate(
      { components: componentsToCreate },
      {
        onSuccess: (result) => {
          if (result.total_failed > 0) {
            setError(
              `Created ${result.total_created} component(s), but ${result.total_failed} failed.`
            );
          } else {
            handleClose();
            onSuccess?.();
          }
        },
        onError: (err: Error) => {
          setError(err.message || 'Failed to create components');
        },
      }
    );
  }, [detectedComponents, createBatchMutation, handleClose, onSuccess]);

  const isSubmitting = createMutation.isPending || createBatchMutation.isPending;

  // Footer buttons
  const footer = (
    <div className="flex items-center justify-between">
      <div>
        {mode === 'upload' && uploadStep === 'preview' && (
          <button
            type="button"
            onClick={() => setUploadStep('upload')}
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
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        {mode === 'manual' && (
          <button
            type="button"
            onClick={handleManualSubmit}
            disabled={isSubmitting || !name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create Component'}
          </button>
        )}
        {mode === 'upload' && uploadStep === 'upload' && (
          <button
            type="button"
            onClick={() => handleFilesSelected(files)}
            disabled={files.length === 0 || isParsing}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isParsing ? 'Analyzing...' : 'Analyze Files'}
          </button>
        )}
        {mode === 'upload' && uploadStep === 'preview' && (
          <button
            type="button"
            onClick={handleUploadSubmit}
            disabled={isSubmitting || selectedCount === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting
              ? 'Creating...'
              : `Create ${selectedCount} Component${selectedCount !== 1 ? 's' : ''}`}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Library Component"
      size="lg"
      footer={footer}
      closeOnEscape={!isSubmitting}
      closeOnBackdropClick={!isSubmitting}
    >
      <div className="space-y-4">
        {/* Mode Toggle */}
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              mode === 'manual'
                ? 'text-indigo-600 border-indigo-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            Create Manually
          </button>
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              mode === 'upload'
                ? 'text-indigo-600 border-indigo-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            Upload Files
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Manual Mode */}
        {mode === 'manual' && (
          <>
            {/* Type field */}
            <div>
              <label htmlFor="component-type" className="block text-sm font-medium text-gray-700">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                id="component-type"
                value={type}
                onChange={(e) => setType(e.target.value as LibraryComponentType)}
                disabled={isSubmitting}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md disabled:bg-gray-100"
              >
                <option value="skill">Skill</option>
                <option value="mcp_tool">MCP Tool</option>
                <option value="memory">Memory</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {type === 'skill' && 'Knowledge and reasoning capabilities'}
                {type === 'mcp_tool' && 'External API integrations and tools'}
                {type === 'memory' && 'Persistent memory and context'}
              </p>
            </div>

            {/* Name field */}
            <div>
              <label htmlFor="component-name" className="block text-sm font-medium text-gray-700">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="component-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Customer Service Knowledge Base"
                disabled={isSubmitting}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
              />
            </div>

            {/* Description field */}
            <div>
              <label
                htmlFor="component-description"
                className="block text-sm font-medium text-gray-700"
              >
                Description
              </label>
              <textarea
                id="component-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Brief description of what this component does..."
                disabled={isSubmitting}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
              />
            </div>

            {/* Content field */}
            <div>
              <label
                htmlFor="component-content"
                className="block text-sm font-medium text-gray-700"
              >
                Content
              </label>
              <p className="text-xs text-gray-500 mb-1">
                {type === 'skill' &&
                  'Enter the skill definition or knowledge content. Supports Markdown.'}
                {type === 'mcp_tool' && 'Enter the tool configuration or API specification.'}
                {type === 'memory' && 'Enter the memory content or context. Supports Markdown.'}
              </p>
              <textarea
                id="component-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                placeholder="Enter component content here..."
                disabled={isSubmitting}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono disabled:bg-gray-100"
              />
            </div>

            {/* Tags field */}
            <div>
              <label htmlFor="component-tags" className="block text-sm font-medium text-gray-700">
                Tags
              </label>
              <input
                type="text"
                id="component-tags"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g., customer-service, knowledge-base, faq (comma-separated)"
                disabled={isSubmitting}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
              />
              <p className="mt-1 text-xs text-gray-500">Separate tags with commas</p>
            </div>
          </>
        )}

        {/* Upload Mode - Step 1: Upload */}
        {mode === 'upload' && uploadStep === 'upload' && (
          <>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Upload Skills, Tools, or Memory
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Upload files or a folder containing component definitions. The system will
                automatically detect the component type based on file paths and content.
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
                {files.length} file{files.length !== 1 ? 's' : ''} selected. Click &quot;Analyze
                Files&quot; to continue.
              </p>
            )}
          </>
        )}

        {/* Upload Mode - Step 2: Preview */}
        {mode === 'upload' && uploadStep === 'preview' && (
          <>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Detected Components</h3>
              <p className="text-xs text-gray-500 mb-4">
                Review the components detected from your files. You can adjust the type or uncheck
                components you don&apos;t want to add.
              </p>
            </div>

            <div className="max-h-80 overflow-y-auto border rounded-md divide-y">
              {detectedComponents.map((component, index) => (
                <div
                  key={component.sourcePath}
                  className={`p-3 ${component.selected ? 'bg-white' : 'bg-gray-50'}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${component.name}`}
                      checked={component.selected}
                      onChange={() => toggleComponentSelection(index)}
                      className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 truncate">{component.name}</span>
                        <select
                          value={component.type}
                          onChange={(e) =>
                            updateComponentType(index, e.target.value as LibraryComponentType)
                          }
                          className="text-xs border border-gray-300 rounded px-2 py-0.5"
                        >
                          <option value="skill">Skill</option>
                          <option value="mcp_tool">MCP Tool</option>
                          <option value="memory">Memory</option>
                        </select>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{component.sourcePath}</p>
                      {component.description && (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                          {component.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Selected:</span>
                <span className="font-medium text-gray-900">
                  {selectedCount} of {detectedComponents.length} components
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
