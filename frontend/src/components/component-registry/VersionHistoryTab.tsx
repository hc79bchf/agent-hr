/**
 * VersionHistoryTab component.
 * Displays snapshot history for a component with create, preview, restore, and delete actions.
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { componentRegistryService } from '../../services/componentRegistry';
import type { ComponentSnapshot, ComponentRegistryEntry } from '../../types';
import { SnapshotPreviewModal } from './SnapshotPreviewModal';

interface VersionHistoryTabProps {
  componentId: string;
  onComponentUpdate: (updated: ComponentRegistryEntry) => void;
}

export function VersionHistoryTab({ componentId, onComponentUpdate }: VersionHistoryTabProps) {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newSnapshotLabel, setNewSnapshotLabel] = useState('');
  const [selectedSnapshot, setSelectedSnapshot] = useState<ComponentSnapshot | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // Fetch snapshots
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['component-snapshots', componentId],
    queryFn: () => componentRegistryService.listSnapshots(componentId),
  });

  // Create snapshot mutation
  const createMutation = useMutation({
    mutationFn: (label: string) =>
      componentRegistryService.createSnapshot(componentId, { version_label: label }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-snapshots', componentId] });
      setIsCreateModalOpen(false);
      setNewSnapshotLabel('');
      setCreateError(null);
    },
    onError: (err: Error) => {
      setCreateError(err.message || 'Failed to create snapshot');
    },
  });

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: (snapshotId: string) =>
      componentRegistryService.restoreSnapshot(componentId, snapshotId),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['component-registry'] });
      queryClient.invalidateQueries({ queryKey: ['component-snapshots', componentId] });
      onComponentUpdate(updated);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (snapshotId: string) =>
      componentRegistryService.deleteSnapshot(componentId, snapshotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-snapshots', componentId] });
    },
  });

  const handleCreateSnapshot = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (newSnapshotLabel.trim()) {
        createMutation.mutate(newSnapshotLabel.trim());
      }
    },
    [newSnapshotLabel, createMutation]
  );

  const handleRestore = useCallback(
    (snapshot: ComponentSnapshot) => {
      if (window.confirm(`Are you sure you want to restore to "${snapshot.version_label}"? This will overwrite the current component state.`)) {
        restoreMutation.mutate(snapshot.id);
      }
    },
    [restoreMutation]
  );

  const handleDelete = useCallback(
    (snapshot: ComponentSnapshot) => {
      if (window.confirm(`Are you sure you want to delete snapshot "${snapshot.version_label}"? This cannot be undone.`)) {
        deleteMutation.mutate(snapshot.id);
      }
    },
    [deleteMutation]
  );

  const handlePreview = useCallback((snapshot: ComponentSnapshot) => {
    setSelectedSnapshot(snapshot);
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-gray-600">Loading snapshots...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-sm text-red-700">
          {(error as Error)?.message || 'Failed to load snapshots'}
        </p>
      </div>
    );
  }

  const snapshots = data?.data || [];

  return (
    <div className="space-y-4">
      {/* Create Snapshot Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Snapshot
        </button>
      </div>

      {/* Create Snapshot Modal */}
      {isCreateModalOpen && (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
          <form onSubmit={handleCreateSnapshot} className="space-y-3">
            <div>
              <label htmlFor="snapshot-label" className="block text-sm font-medium text-gray-700">
                Snapshot Label
              </label>
              <input
                type="text"
                id="snapshot-label"
                value={newSnapshotLabel}
                onChange={(e) => setNewSnapshotLabel(e.target.value)}
                placeholder="e.g., 'Before refactoring' or 'v1.0'"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>
            {createError && (
              <p className="text-sm text-red-600">{createError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createMutation.isPending || !newSnapshotLabel.trim()}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setNewSnapshotLabel('');
                  setCreateError(null);
                }}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Snapshots List */}
      {snapshots.length === 0 ? (
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
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No snapshots</h3>
          <p className="mt-1 text-sm text-gray-500">
            Create a snapshot to save the current state of this component.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {snapshots.map((snapshot) => (
            <div
              key={snapshot.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">
                    {snapshot.version_label}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDate(snapshot.created_at)}
                    {snapshot.creator && ` by ${snapshot.creator.name}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePreview(snapshot)}
                    className="text-sm text-indigo-600 hover:text-indigo-500"
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => handleRestore(snapshot)}
                    disabled={restoreMutation.isPending}
                    className="text-sm text-green-600 hover:text-green-500 disabled:opacity-50"
                  >
                    {restoreMutation.isPending ? 'Restoring...' : 'Restore'}
                  </button>
                  <button
                    onClick={() => handleDelete(snapshot)}
                    disabled={deleteMutation.isPending}
                    className="text-sm text-red-600 hover:text-red-500 disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {selectedSnapshot && (
        <SnapshotPreviewModal
          snapshot={selectedSnapshot}
          isOpen={!!selectedSnapshot}
          onClose={() => setSelectedSnapshot(null)}
        />
      )}
    </div>
  );
}

export default VersionHistoryTab;
