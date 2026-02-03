/**
 * FolderDetailModal component for viewing folder contents.
 */

import type { ComponentFolder, ComponentFolderDetail, ComponentInFolder, ComponentType } from '../../types';
import { Badge, Modal } from '../ui';

/**
 * FolderDetailModal component props.
 */
interface FolderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: ComponentFolder | null;
  folderDetail: ComponentFolderDetail | null;
  isLoading?: boolean;
  onPublishFolder?: (folder: ComponentFolder) => void;
  onPublishComponent?: (component: ComponentInFolder) => void;
  onViewComponent?: (component: ComponentInFolder) => void;
}

/**
 * Get icon for component type.
 */
function getComponentIcon(type: ComponentType): JSX.Element {
  switch (type) {
    case 'skill':
      return (
        <svg
          className="h-4 w-4 text-indigo-500"
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
      );
    case 'mcp_tool':
      return (
        <svg
          className="h-4 w-4 text-green-500"
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
      );
    case 'memory':
      return (
        <svg
          className="h-4 w-4 text-purple-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
          />
        </svg>
      );
    case 'agent':
      return (
        <svg
          className="h-4 w-4 text-orange-500"
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
      );
    default:
      return (
        <svg
          className="h-4 w-4 text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      );
  }
}

/**
 * Get badge variant for component type.
 */
function getTypeBadgeVariant(type: ComponentType): 'info' | 'success' | 'warning' | 'default' {
  switch (type) {
    case 'skill':
      return 'info';
    case 'mcp_tool':
      return 'success';
    case 'memory':
      return 'warning';
    case 'agent':
      return 'default';
    default:
      return 'default';
  }
}

/**
 * Get label for component type.
 */
function getTypeLabel(type: ComponentType): string {
  switch (type) {
    case 'skill':
      return 'Skill';
    case 'mcp_tool':
      return 'MCP Tool';
    case 'memory':
      return 'Memory';
    case 'agent':
      return 'Agent';
    default:
      return type;
  }
}

/**
 * Modal component for viewing folder contents.
 */
export function FolderDetailModal({
  isOpen,
  onClose,
  folder,
  folderDetail,
  isLoading = false,
  onPublishFolder,
  onPublishComponent,
  onViewComponent,
}: FolderDetailModalProps) {
  if (!folder) return null;

  const components = folderDetail?.components || [];
  const isUngrouped = folder.id === '00000000-0000-0000-0000-000000000000';

  const modalTitle = (
    <div className="flex items-center gap-3">
      <div className="p-2 bg-gray-100 rounded-lg">
        <svg
          className="h-5 w-5 text-gray-600"
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
      </div>
      <div>
        <span className="text-lg font-medium text-gray-900">{folder.name}</span>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant={getTypeBadgeVariant(folder.type)} className="text-xs">
            {getTypeLabel(folder.type)}
          </Badge>
          <span className="text-sm text-gray-500">
            {folder.file_count} {folder.file_count === 1 ? 'file' : 'files'}
          </span>
        </div>
      </div>
    </div>
  );

  const footer = (
    <div className="flex justify-end">
      <button
        type="button"
        className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="lg"
      footer={footer}
    >
      {/* Custom Header */}
      <div className="mb-4">
        {modalTitle}
      </div>

      {/* Description */}
      {folder.description && (
        <p className="text-sm text-gray-600 mb-4">{folder.description}</p>
      )}

      {/* Source Path */}
      {folder.source_path && (
        <p className="text-xs text-gray-400 font-mono mb-4">{folder.source_path}</p>
      )}

      {/* Folder Actions */}
      {onPublishFolder && !isUngrouped && (
        <div className="mb-4">
          <button
            onClick={() => onPublishFolder(folder)}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <svg
              className="h-4 w-4 mr-1.5"
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
            Publish Folder to Library
          </button>
        </div>
      )}

      {/* Component List */}
      <div className="border-t border-gray-200 pt-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Files in this folder</h4>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-12 bg-gray-100 rounded animate-pulse"
              />
            ))}
          </div>
        ) : components.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No files in this folder
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {components.map((component) => (
              <div
                key={component.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {getComponentIcon(folder.type)}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {component.name}
                    </p>
                    {component.description && (
                      <p className="text-xs text-gray-500 truncate">
                        {component.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {onViewComponent && (
                    <button
                      onClick={() => onViewComponent(component)}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                      title="View"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    </button>
                  )}
                  {onPublishComponent && (
                    <button
                      onClick={() => onPublishComponent(component)}
                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                      title="Publish to Library"
                    >
                      <svg
                        className="h-4 w-4"
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
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
