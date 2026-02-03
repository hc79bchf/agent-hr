/**
 * Modal for publishing a component to the library.
 */

import { useState, useEffect } from 'react';
import { usePublishToLibrary } from '../../hooks';
import type { Component } from '../../types';

interface PublishToLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  component: Component | null;
  versionId: string;
  onSuccess?: () => void;
}

/**
 * Modal for publishing an agent's component to the shared library.
 */
export function PublishToLibraryModal({
  isOpen,
  onClose,
  component,
  versionId,
  onSuccess,
}: PublishToLibraryModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');

  const publishMutation = usePublishToLibrary();

  // Reset form when component changes
  useEffect(() => {
    if (component) {
      setName(component.name);
      setDescription(component.description || '');
      setTags('');
    }
  }, [component]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!component || !versionId) return;

    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    publishMutation.mutate(
      {
        versionId,
        componentId: component.id,
        data: {
          name: name.trim() || undefined,
          description: description.trim() || undefined,
          tags: tagList.length > 0 ? tagList : undefined,
        },
      },
      {
        onSuccess: () => {
          onSuccess?.();
          onClose();
        },
      }
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-25 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Publish to Library
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Publish this component to the shared library so other agents can use it.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Component Type (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">
                {component?.type === 'skill'
                  ? 'Skill'
                  : component?.type === 'mcp_tool'
                  ? 'MCP Tool'
                  : component?.type === 'memory'
                  ? 'Memory'
                  : component?.type || 'Unknown'}
              </div>
            </div>

            {/* Name */}
            <div>
              <label
                htmlFor="publish-name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Name
              </label>
              <input
                type="text"
                id="publish-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Component name"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="publish-description"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Description
              </label>
              <textarea
                id="publish-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Brief description of what this component does"
              />
            </div>

            {/* Tags */}
            <div>
              <label
                htmlFor="publish-tags"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Tags (comma-separated)
              </label>
              <input
                type="text"
                id="publish-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="e.g., utility, data-processing, api"
              />
            </div>

            {/* Error message */}
            {publishMutation.isError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">
                  {publishMutation.error?.message || 'Failed to publish component'}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={publishMutation.isPending || !name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {publishMutation.isPending ? 'Publishing...' : 'Publish to Library'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
