/**
 * FolderList component for displaying a list of component folders.
 */

import { useState } from 'react';
import type { ComponentFolder, ComponentInFolder } from '../../types';
import { FolderCard } from './FolderCard';
import { FolderDetailModal } from './FolderDetailModal';
import { useFolderDetail } from '../../hooks';

/**
 * FolderList component props.
 */
interface FolderListProps {
  folders: ComponentFolder[];
  agentId: string;
  versionId: string;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  onPublishFolder?: (folder: ComponentFolder) => void;
  onPublishComponent?: (component: ComponentInFolder, folder: ComponentFolder) => void;
  onViewComponent?: (component: ComponentInFolder, folder: ComponentFolder) => void;
}

/**
 * Loading skeleton for folder cards.
 */
function FolderSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 bg-gray-200 rounded" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-4 bg-gray-200 rounded w-32" />
            <div className="h-4 bg-gray-200 rounded w-16" />
            <div className="h-4 bg-gray-200 rounded w-12" />
          </div>
          <div className="h-3 bg-gray-200 rounded w-full mb-1" />
          <div className="h-3 bg-gray-200 rounded w-2/3" />
        </div>
      </div>
    </div>
  );
}

/**
 * List component for displaying multiple folders.
 */
export function FolderList({
  folders,
  agentId,
  versionId,
  isLoading = false,
  emptyMessage = 'No folders found.',
  emptyIcon,
  onPublishFolder,
  onPublishComponent,
  onViewComponent,
}: FolderListProps) {
  const [selectedFolder, setSelectedFolder] = useState<ComponentFolder | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch folder detail when a folder is selected
  const { data: folderDetail, isLoading: isLoadingDetail } = useFolderDetail(
    agentId,
    versionId,
    selectedFolder?.id || '',
    { enabled: !!selectedFolder && selectedFolder.id !== '00000000-0000-0000-0000-000000000000' }
  );

  const handleFolderClick = (folder: ComponentFolder) => {
    setSelectedFolder(folder);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedFolder(null);
  };

  const handlePublishComponent = (component: ComponentInFolder) => {
    if (selectedFolder && onPublishComponent) {
      onPublishComponent(component, selectedFolder);
    }
  };

  const handleViewComponent = (component: ComponentInFolder) => {
    if (selectedFolder && onViewComponent) {
      onViewComponent(component, selectedFolder);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <FolderSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Empty state
  if (folders.length === 0) {
    return (
      <div className="text-center py-12">
        {emptyIcon || (
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
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        )}
        <h3 className="mt-2 text-sm font-medium text-gray-900">No folders</h3>
        <p className="mt-1 text-sm text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {folders.map((folder) => (
          <FolderCard
            key={folder.id}
            folder={folder}
            onClick={handleFolderClick}
            onPublish={onPublishFolder}
          />
        ))}
      </div>

      <FolderDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        folder={selectedFolder}
        folderDetail={folderDetail || null}
        isLoading={isLoadingDetail}
        onPublishFolder={onPublishFolder}
        onPublishComponent={onPublishComponent ? handlePublishComponent : undefined}
        onViewComponent={onViewComponent ? handleViewComponent : undefined}
      />
    </>
  );
}
