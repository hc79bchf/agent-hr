/**
 * AddMemoryModal component for creating and editing agent memories.
 * Supports both text input and file upload modes.
 */

import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../ui/Modal';
import { memoryService } from '../../services';
import { agentKeys } from '../../hooks';
import type { Component } from '../../types';
import type { MemoryType } from '../../types/memory';
import { MEMORY_TYPE_INFO, CREATABLE_MEMORY_TYPES } from '../../types/memory';

/**
 * Props for AddMemoryModal.
 */
interface AddMemoryModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Agent ID to add memory to */
  agentId: string;
  /** Optional existing memory for edit mode */
  existingMemory?: Component | null;
  /** Optional default memory type for new memories */
  defaultMemoryType?: MemoryType;
  /** Callback when memory is saved */
  onSuccess?: () => void;
}

/**
 * AddMemoryModal component.
 */
export function AddMemoryModal({
  isOpen,
  onClose,
  agentId,
  existingMemory,
  defaultMemoryType = 'long_term',
  onSuccess,
}: AddMemoryModalProps) {
  const queryClient = useQueryClient();
  const isEditMode = Boolean(existingMemory);

  // Form state
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [memoryType, setMemoryType] = useState<MemoryType>('long_term');
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens/closes or memory changes
  useEffect(() => {
    if (isOpen) {
      if (existingMemory) {
        setName(existingMemory.name);
        setContent(existingMemory.content || '');
        setMemoryType((existingMemory.memory_type as MemoryType) || 'long_term');
      } else {
        setName('');
        setContent('');
        setMemoryType(defaultMemoryType);
      }
      setError(null);
    }
  }, [isOpen, existingMemory, defaultMemoryType]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: { name: string; content: string; memory_type: MemoryType }) =>
      memoryService.create(agentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.all });
      handleClose();
      onSuccess?.();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create memory');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: { name: string; content: string; memory_type?: MemoryType }) =>
      memoryService.update(agentId, existingMemory!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.all });
      handleClose();
      onSuccess?.();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to update memory');
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Handle close
  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      setName('');
      setContent('');
      setMemoryType(defaultMemoryType);
      setError(null);
      onClose();
    }
  }, [isSubmitting, onClose, defaultMemoryType]);

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!content.trim()) {
      setError('Content is required');
      return;
    }

    setError(null);

    if (isEditMode) {
      updateMutation.mutate({
        name: name.trim(),
        content: content.trim(),
        memory_type: memoryType,
      });
    } else {
      createMutation.mutate({
        name: name.trim(),
        content: content.trim(),
        memory_type: memoryType,
      });
    }
  }, [name, content, memoryType, isEditMode, createMutation, updateMutation]);

  // Footer buttons
  const footer = (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={handleClose}
        disabled={isSubmitting}
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || !name.trim() || !content.trim()}
        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting
          ? isEditMode
            ? 'Saving...'
            : 'Adding...'
          : isEditMode
          ? 'Save Changes'
          : 'Add Memory'}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditMode ? 'Edit Memory' : 'Add Memory'}
      size="lg"
      footer={footer}
      closeOnEscape={!isSubmitting}
      closeOnBackdropClick={!isSubmitting}
    >
      <div className="space-y-4">
        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Name field */}
        <div>
          <label htmlFor="memory-name" className="block text-sm font-medium text-gray-700">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="memory-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Company Policies, Product Knowledge"
            disabled={isSubmitting}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
          />
        </div>

        {/* Memory Type field */}
        <div>
          <label htmlFor="memory-type" className="block text-sm font-medium text-gray-700">
            Memory Type
          </label>
          <select
            id="memory-type"
            value={memoryType}
            onChange={(e) => setMemoryType(e.target.value as MemoryType)}
            disabled={isSubmitting}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
          >
            {CREATABLE_MEMORY_TYPES.map((type) => (
              <option key={type} value={type}>
                {MEMORY_TYPE_INFO[type].label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {MEMORY_TYPE_INFO[memoryType].description}
          </p>
        </div>

        {/* Content field */}
        <div>
          <label htmlFor="memory-content" className="block text-sm font-medium text-gray-700">
            Content <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-500 mb-1">
            Enter the knowledge or context you want the agent to remember. Supports Markdown.
          </p>
          <textarea
            id="memory-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            placeholder="Enter memory content here...

# Example Format

## Key Facts
- Fact 1
- Fact 2

## Guidelines
- Guideline 1
- Guideline 2"
            disabled={isSubmitting}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono disabled:bg-gray-100"
          />
        </div>

        {/* Character count */}
        <div className="text-xs text-gray-500 text-right">
          {content.length.toLocaleString()} characters
        </div>
      </div>
    </Modal>
  );
}
