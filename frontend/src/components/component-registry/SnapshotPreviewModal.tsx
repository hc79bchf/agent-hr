/**
 * SnapshotPreviewModal component.
 * Displays a read-only preview of a component snapshot.
 */

import type { ComponentSnapshot } from '../../types';

interface SnapshotPreviewModalProps {
  snapshot: ComponentSnapshot;
  isOpen: boolean;
  onClose: () => void;
}

export function SnapshotPreviewModal({
  snapshot,
  isOpen,
  onClose,
}: SnapshotPreviewModalProps) {
  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />
        <div className="relative inline-block bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-3xl sm:w-full max-h-[90vh] overflow-y-auto">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Snapshot: {snapshot.version_label}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Created {formatDate(snapshot.created_at)}
                  {snapshot.creator && ` by ${snapshot.creator.name}`}
                </p>
              </div>
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
                <h4 className="text-sm font-medium text-gray-700">Name</h4>
                <p className="mt-1 text-sm text-gray-900">{snapshot.name}</p>
              </div>

              {/* Description */}
              {snapshot.description && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700">Description</h4>
                  <p className="mt-1 text-sm text-gray-600">{snapshot.description}</p>
                </div>
              )}

              {/* Tags */}
              {snapshot.tags && snapshot.tags.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700">Tags</h4>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {snapshot.tags.map((tag) => (
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

              {/* Content */}
              {snapshot.content && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700">Content</h4>
                  <pre className="mt-1 text-xs text-gray-600 bg-gray-50 p-3 rounded-md overflow-auto max-h-64 font-mono">
                    {snapshot.content}
                  </pre>
                </div>
              )}

              {/* Metadata */}
              {snapshot.component_metadata && Object.keys(snapshot.component_metadata).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700">Metadata</h4>
                  <div className="mt-1 bg-gray-50 p-3 rounded-md">
                    <dl className="space-y-1">
                      {Object.entries(snapshot.component_metadata).map(([key, value]) => (
                        <div key={key} className="flex gap-2 text-sm">
                          <dt className="font-medium text-gray-600">{key}:</dt>
                          <dd className="text-gray-900">
                            {typeof value === 'string' ? value : JSON.stringify(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={onClose}
              className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:w-auto sm:text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SnapshotPreviewModal;
