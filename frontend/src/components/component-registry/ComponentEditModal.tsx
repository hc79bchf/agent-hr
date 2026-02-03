/**
 * ComponentEditModal component.
 * Modal for editing component details with optional snapshot creation and file upload.
 */

import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { componentRegistryService } from '../../services/componentRegistry';
import type {
  ComponentRegistryEntry,
  ComponentRegistryUpdate,
  ComponentVisibility,
} from '../../types';

interface MetadataField {
  key: string;
  value: string;
}

interface UploadedFile {
  name: string;
  path: string;
  content: string;
}

interface ComponentEditModalProps {
  component: ComponentRegistryEntry;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: ComponentRegistryEntry) => void;
}

export function ComponentEditModal({
  component,
  isOpen,
  onClose,
  onSuccess,
}: ComponentEditModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: component.name,
    description: component.description || '',
    content: component.content || '',
    tags: component.tags?.join(', ') || '',
    visibility: component.visibility,
    metadataFields: Object.entries(component.component_metadata || {}).map(([key, value]) => ({
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
    })) as MetadataField[],
  });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [createSnapshot, setCreateSnapshot] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset form when component changes
  useEffect(() => {
    setFormData({
      name: component.name,
      description: component.description || '',
      content: component.content || '',
      tags: component.tags?.join(', ') || '',
      visibility: component.visibility,
      metadataFields: Object.entries(component.component_metadata || {}).map(([key, value]) => ({
        key,
        value: typeof value === 'string' ? value : JSON.stringify(value),
      })) as MetadataField[],
    });
    setUploadedFiles([]);
    setCreateSnapshot(false);
    setSnapshotLabel('');
    setError(null);
  }, [component]);

  // Create snapshot mutation
  const snapshotMutation = useMutation({
    mutationFn: (label: string) =>
      componentRegistryService.createSnapshot(component.id, { version_label: label }),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: ComponentRegistryUpdate) =>
      componentRegistryService.update(component.id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['component-registry'] });
      onSuccess(updated);
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to update component');
    },
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const readPromises = fileArray.map((file) => {
      return new Promise<UploadedFile>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({
            name: file.name,
            path: (file as unknown as { webkitRelativePath?: string }).webkitRelativePath || file.name,
            content: event.target?.result as string,
          });
        };
        reader.readAsText(file);
      });
    });

    Promise.all(readPromises).then((newFiles) => {
      setUploadedFiles((prev) => {
        const updated = [...prev, ...newFiles];
        // Auto-enable snapshot creation when files are uploaded (first upload only)
        if (prev.length === 0 && updated.length > 0) {
          setCreateSnapshot(true);
          const now = new Date();
          const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          setSnapshotLabel(`Before upload - ${dateStr} ${timeStr}`);
        }
        return updated;
      });
    });

    // Reset input so the same file can be selected again
    e.target.value = '';
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearAllFiles = useCallback(() => {
    setUploadedFiles([]);
    // Reset auto-snapshot when clearing files
    setCreateSnapshot(false);
    setSnapshotLabel('');
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      try {
        // Create snapshot first if requested
        if (createSnapshot && snapshotLabel.trim()) {
          await snapshotMutation.mutateAsync(snapshotLabel.trim());
        }

        // Build update data
        const tags = formData.tags
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0);

        const metadata: Record<string, unknown> = {};
        formData.metadataFields.forEach((field) => {
          if (field.key.trim()) {
            try {
              metadata[field.key.trim()] = JSON.parse(field.value);
            } catch {
              metadata[field.key.trim()] = field.value;
            }
          }
        });

        // If files were uploaded, add file info to metadata and combine content
        if (uploadedFiles.length > 0) {
          metadata['_files'] = uploadedFiles.map((f) => ({
            name: f.name,
            path: f.path,
          }));
        }

        // Determine content: if files uploaded, use combined file content; otherwise use textarea content
        let finalContent = formData.content;
        if (uploadedFiles.length > 0) {
          finalContent = uploadedFiles
            .map((f) => `--- ${f.path || f.name} ---\n${f.content}`)
            .join('\n\n');
        }

        const updateData: ComponentRegistryUpdate = {
          name: formData.name,
          description: formData.description || undefined,
          content: finalContent || undefined,
          tags: tags.length > 0 ? tags : undefined,
          visibility: formData.visibility,
          component_metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        };

        await updateMutation.mutateAsync(updateData);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        }
      }
    },
    [formData, uploadedFiles, createSnapshot, snapshotLabel, snapshotMutation, updateMutation]
  );

  const handleAddMetadataField = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      metadataFields: [...prev.metadataFields, { key: '', value: '' }],
    }));
  }, []);

  const handleRemoveMetadataField = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      metadataFields: prev.metadataFields.filter((_, i) => i !== index),
    }));
  }, []);

  const handleMetadataFieldChange = useCallback(
    (index: number, field: 'key' | 'value', value: string) => {
      setFormData((prev) => ({
        ...prev,
        metadataFields: prev.metadataFields.map((item, i) =>
          i === index ? { ...item, [field]: value } : item
        ),
      }));
    },
    []
  );

  if (!isOpen) return null;

  const isPending = updateMutation.isPending || snapshotMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />
        <div className="relative inline-block bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-2xl sm:w-full max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Edit Component</h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    id="edit-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>

                {/* File Upload Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Upload New Version
                    </label>
                    {uploadedFiles.length > 0 && (
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
                  {uploadedFiles.length > 0 ? (
                    <div className="border border-gray-200 rounded-md max-h-32 overflow-y-auto">
                      <ul className="divide-y divide-gray-200">
                        {uploadedFiles.map((file, index) => (
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
                    <div className="border-2 border-gray-300 border-dashed rounded-md px-4 py-4">
                      <div className="text-center">
                        <svg
                          className="mx-auto h-8 w-8 text-gray-400"
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
                        <p className="mt-1 text-sm text-gray-500">
                          Upload files to replace current content
                        </p>
                      </div>
                    </div>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    {uploadedFiles.length > 0
                      ? `${uploadedFiles.length} file${uploadedFiles.length !== 1 ? 's' : ''} will replace current content. A snapshot will be created automatically.`
                      : 'Or edit content directly below'}
                  </p>
                </div>

                {/* Content (only show if no files uploaded) */}
                {uploadedFiles.length === 0 && (
                  <div>
                    <label htmlFor="edit-content" className="block text-sm font-medium text-gray-700">
                      Content
                    </label>
                    <textarea
                      id="edit-content"
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      rows={8}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono text-xs"
                      placeholder="Component content (code, configuration, etc.)"
                    />
                  </div>
                )}

                {/* Visibility */}
                <div>
                  <label htmlFor="edit-visibility" className="block text-sm font-medium text-gray-700">
                    Visibility
                  </label>
                  <select
                    id="edit-visibility"
                    value={formData.visibility}
                    onChange={(e) => setFormData({ ...formData, visibility: e.target.value as ComponentVisibility })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="private">Private</option>
                    <option value="organization">Organization</option>
                    <option value="public">Public</option>
                  </select>
                </div>

                {/* Tags */}
                <div>
                  <label htmlFor="edit-tags" className="block text-sm font-medium text-gray-700">
                    Tags
                  </label>
                  <input
                    type="text"
                    id="edit-tags"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="Enter tags separated by commas"
                  />
                </div>

                {/* Metadata */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Metadata</label>
                    <button
                      type="button"
                      onClick={handleAddMetadataField}
                      className="text-sm text-indigo-600 hover:text-indigo-500"
                    >
                      + Add Field
                    </button>
                  </div>
                  <div className="space-y-2">
                    {formData.metadataFields.length === 0 ? (
                      <p className="text-sm text-gray-500">No metadata fields</p>
                    ) : (
                      formData.metadataFields.map((field, index) => (
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
                          <button
                            type="button"
                            onClick={() => handleRemoveMetadataField(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Snapshot Option */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createSnapshot}
                        onChange={(e) => setCreateSnapshot(e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">Create snapshot before saving</span>
                    </label>
                    {uploadedFiles.length > 0 && createSnapshot && (
                      <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        Auto-enabled for upload
                      </span>
                    )}
                  </div>
                  {createSnapshot && (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={snapshotLabel}
                        onChange={(e) => setSnapshotLabel(e.target.value)}
                        placeholder="Snapshot label (e.g., 'Before refactoring')"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        required={createSnapshot}
                      />
                    </div>
                  )}
                </div>

                {/* Error Display */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-3">
              <button
                type="submit"
                disabled={isPending || !formData.name.trim() || (createSnapshot && !snapshotLabel.trim())}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="mt-3 sm:mt-0 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:w-auto sm:text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ComponentEditModal;
