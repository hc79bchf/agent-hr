/**
 * ComponentEditor component - Slide-out panel for editing component content.
 * Provides editable fields with markdown preview and version creation warning.
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Component, ComponentUpdate, ComponentEditResponse } from '../../types';
import { componentService } from '../../services';
import { componentKeys } from '../../hooks';
import { MarkdownPreview } from './MarkdownPreview';

/**
 * View mode for the editor content area.
 */
type ViewMode = 'edit' | 'preview' | 'split';

/**
 * ComponentEditor component props.
 */
interface ComponentEditorProps {
  /** Whether the editor panel is open */
  isOpen: boolean;
  /** Callback to close the editor */
  onClose: () => void;
  /** The component being edited */
  component: Component | null;
  /** The version ID of the component */
  versionId: string;
  /** Callback when a new version is created after save */
  onVersionCreated?: (response: ComponentEditResponse) => void;
  /** Callback when component is deleted */
  onDelete?: (componentId: string) => void;
}

/**
 * Confirmation modal for save/delete actions.
 */
interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const confirmButtonClass =
    confirmVariant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
      : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500';

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${confirmButtonClass}`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * ComponentEditor slide-out panel.
 * Allows editing name, description, and content with markdown preview.
 */
export function ComponentEditor({
  isOpen,
  onClose,
  component,
  versionId,
  onVersionCreated,
  onDelete,
}: ComponentEditorProps) {
  const queryClient = useQueryClient();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('split');

  // Modal state
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Track if form has changes
  const hasChanges =
    component &&
    (name !== component.name ||
      description !== (component.description || '') ||
      content !== (component.content || ''));

  // Initialize form when component changes
  useEffect(() => {
    if (component) {
      setName(component.name);
      setDescription(component.description || '');
      setContent(component.content || '');
    }
  }, [component]);

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: (data: ComponentUpdate) =>
      componentService.edit(versionId, component?.id || '', data),
    onSuccess: (response) => {
      // Invalidate component queries
      queryClient.invalidateQueries({ queryKey: componentKeys.all });
      setShowSaveConfirm(false);
      onVersionCreated?.(response);
      onClose();
    },
  });

  // Handle save with confirmation
  const handleSave = useCallback(() => {
    if (!component || !hasChanges) return;
    setShowSaveConfirm(true);
  }, [component, hasChanges]);

  // Confirm save
  const confirmSave = useCallback(() => {
    if (!component) return;

    const updates: ComponentUpdate = {};
    if (name !== component.name) updates.name = name;
    if (description !== (component.description || ''))
      updates.description = description || null;
    if (content !== (component.content || '')) updates.content = content || null;

    editMutation.mutate(updates);
  }, [component, name, description, content, editMutation]);

  // Handle delete with confirmation
  const handleDelete = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  // Confirm delete
  const confirmDelete = useCallback(() => {
    if (!component) return;
    // TODO: Implement delete API call
    console.log('Delete component:', component.id);
    setShowDeleteConfirm(false);
    onDelete?.(component.id);
    onClose();
  }, [component, onDelete, onClose]);

  // Handle close with unsaved changes warning
  const handleClose = useCallback(() => {
    if (hasChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close?'
      );
      if (!confirmed) return;
    }
    onClose();
  }, [hasChanges, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleClose]);

  if (!isOpen || !component) return null;

  const isReadOnly = component.type === 'mcp_tool';

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Slide-out Panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-4xl bg-white shadow-xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <h2 id="editor-title" className="text-lg font-semibold text-gray-900">
              {isReadOnly ? 'View Component' : 'Edit Component'}
            </h2>
            {isReadOnly && (
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded">
                Read-only (MCP Tool)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            {!isReadOnly && (
              <div className="flex items-center border border-gray-300 rounded-md">
                <button
                  type="button"
                  onClick={() => setViewMode('edit')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-l-md ${
                    viewMode === 'edit'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('split')}
                  className={`px-3 py-1.5 text-xs font-medium border-x border-gray-300 ${
                    viewMode === 'split'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Split
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-r-md ${
                    viewMode === 'preview'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Preview
                </button>
              </div>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded-md"
              aria-label="Close editor"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Name and Description Fields */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 space-y-4">
            <div>
              <label htmlFor="component-name" className="block text-sm font-medium text-gray-700">
                Name
              </label>
              <input
                type="text"
                id="component-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isReadOnly}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Component name"
              />
            </div>
            <div>
              <label
                htmlFor="component-description"
                className="block text-sm font-medium text-gray-700"
              >
                Description
              </label>
              <input
                type="text"
                id="component-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isReadOnly}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Brief description of the component"
              />
            </div>
          </div>

          {/* Content Editor/Preview Area */}
          <div className="flex-1 overflow-hidden">
            {isReadOnly || viewMode === 'preview' ? (
              /* Preview Only */
              <div className="h-full overflow-y-auto p-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Content Preview</h3>
                <div className="bg-white border border-gray-200 rounded-md p-4 min-h-[300px]">
                  <MarkdownPreview content={content} />
                </div>
              </div>
            ) : viewMode === 'edit' ? (
              /* Edit Only */
              <div className="h-full overflow-hidden p-6">
                <label htmlFor="component-content" className="block text-sm font-medium text-gray-700 mb-3">
                  Content (Markdown supported)
                </label>
                <textarea
                  id="component-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full h-[calc(100%-2rem)] rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono resize-none"
                  placeholder="Enter component content..."
                />
              </div>
            ) : (
              /* Split View */
              <div className="h-full flex">
                {/* Editor Pane */}
                <div className="w-1/2 border-r border-gray-200 overflow-hidden p-6">
                  <label
                    htmlFor="component-content-split"
                    className="block text-sm font-medium text-gray-700 mb-3"
                  >
                    Content (Markdown supported)
                  </label>
                  <textarea
                    id="component-content-split"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full h-[calc(100%-2rem)] rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono resize-none"
                    placeholder="Enter component content..."
                  />
                </div>

                {/* Preview Pane */}
                <div className="w-1/2 overflow-y-auto p-6 bg-gray-50">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Preview</h3>
                  <div className="bg-white border border-gray-200 rounded-md p-4 min-h-[300px]">
                    <MarkdownPreview content={content} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            {!isReadOnly && (
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <svg
                  className="-ml-0.5 mr-1.5 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            {!isReadOnly && (
              <button
                type="button"
                onClick={handleSave}
                disabled={!hasChanges || editMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Save Confirmation Modal */}
      <ConfirmModal
        isOpen={showSaveConfirm}
        title="Create New Version"
        message="Saving changes will create a new version of this agent. Previous versions will be preserved in the version history. Do you want to continue?"
        confirmLabel="Save & Create Version"
        confirmVariant="primary"
        onConfirm={confirmSave}
        onCancel={() => setShowSaveConfirm(false)}
        isLoading={editMutation.isPending}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Component"
        message="Are you sure you want to delete this component? This action cannot be undone and will create a new version without this component."
        confirmLabel="Delete Component"
        confirmVariant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Error Toast */}
      {editMutation.isError && (
        <div className="fixed bottom-4 right-4 z-[70] bg-red-50 border border-red-200 rounded-md p-4 shadow-lg max-w-md">
          <div className="flex items-start gap-3">
            <svg
              className="h-5 w-5 text-red-500 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-red-800">Error saving changes</h4>
              <p className="text-sm text-red-700 mt-1">
                {editMutation.error?.message || 'An unexpected error occurred'}
              </p>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
