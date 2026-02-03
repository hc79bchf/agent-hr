/**
 * DropZone component for drag-and-drop file uploads.
 * Supports single files, multiple files, and folder uploads.
 */

import { useCallback, useState, useRef, DragEvent, ChangeEvent } from 'react';

/**
 * File with path information for folder uploads.
 * Uses a type alias instead of interface to avoid extending File issues.
 */
export type FileWithPath = File & {
  /** Relative path for folder uploads, empty string for single files */
  readonly webkitRelativePath: string;
};

/**
 * DropZone component props.
 */
interface DropZoneProps {
  /** Callback when files are selected */
  onFilesSelected: (files: FileWithPath[]) => void;
  /** Accept multiple files */
  multiple?: boolean;
  /** Accept folder uploads */
  allowFolders?: boolean;
  /** Accepted file types (e.g., '.json,.yaml,.yml') */
  accept?: string;
  /** Whether the dropzone is disabled */
  disabled?: boolean;
  /** Current selected files (for display) */
  selectedFiles?: FileWithPath[];
  /** Additional class name */
  className?: string;
}

/**
 * DropZone component for file and folder uploads.
 */
export function DropZone({
  onFilesSelected,
  multiple = true,
  allowFolders = true,
  accept,
  disabled = false,
  selectedFiles = [],
  className = '',
}: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Handle drag events
  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  // Process files from DataTransfer
  const processDataTransfer = useCallback(
    async (dataTransfer: DataTransfer): Promise<FileWithPath[]> => {
      const files: FileWithPath[] = [];

      // Try to use DataTransferItemList for better folder support
      if (dataTransfer.items) {
        const items = Array.from(dataTransfer.items);

        for (const item of items) {
          if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry?.();
            if (entry) {
              const entryFiles = await readEntry(entry);
              files.push(...entryFiles);
            } else {
              const file = item.getAsFile();
              if (file) {
                files.push(file);
              }
            }
          }
        }
      } else {
        // Fallback to FileList
        files.push(...Array.from(dataTransfer.files));
      }

      return files;
    },
    []
  );

  // Recursively read directory entries
  const readEntry = useCallback(
    async (entry: FileSystemEntry): Promise<FileWithPath[]> => {
      const files: FileWithPath[] = [];

      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        const file = await new Promise<FileWithPath>((resolve, reject) => {
          fileEntry.file(
            (f) => {
              // Add webkitRelativePath for consistency
              Object.defineProperty(f, 'webkitRelativePath', {
                value: entry.fullPath.slice(1), // Remove leading /
                writable: false,
              });
              resolve(f as FileWithPath);
            },
            reject
          );
        });
        files.push(file);
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry;
        const reader = dirEntry.createReader();
        const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
          reader.readEntries(resolve, reject);
        });

        for (const childEntry of entries) {
          const childFiles = await readEntry(childEntry);
          files.push(...childFiles);
        }
      }

      return files;
    },
    []
  );

  // Handle drop event
  const handleDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      const files = await processDataTransfer(event.dataTransfer);
      if (files.length > 0) {
        onFilesSelected(multiple ? files : [files[0]]);
      }
    },
    [disabled, multiple, onFilesSelected, processDataTransfer]
  );

  // Handle file input change
  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files && files.length > 0) {
        onFilesSelected(Array.from(files) as FileWithPath[]);
      }
      // Reset input so same file can be selected again
      event.target.value = '';
    },
    [onFilesSelected]
  );

  // Click handlers for different upload types
  const handleClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  const handleFolderClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (!disabled && allowFolders) {
        folderInputRef.current?.click();
      }
    },
    [disabled, allowFolders]
  );

  // Clear selected files
  const handleClear = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onFilesSelected([]);
    },
    [onFilesSelected]
  );

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Get total size of selected files
  const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className={className}>
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />
      {allowFolders && (
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error - webkitdirectory is not in standard types
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />
      )}

      {/* Drop zone area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-colors duration-200
          ${
            isDragOver
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-300 hover:border-gray-400'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {selectedFiles.length === 0 ? (
          <>
            {/* Upload icon */}
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            {/* Instructions */}
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-900">
                {isDragOver ? 'Drop files here' : 'Drag and drop files here'}
              </p>
              <p className="mt-1 text-xs text-gray-500">or click to browse</p>
            </div>

            {/* Upload type buttons */}
            <div className="mt-4 flex justify-center gap-3">
              <button
                type="button"
                onClick={handleClick}
                disabled={disabled}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <svg
                  className="mr-1.5 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                Select Files
              </button>
              {allowFolders && (
                <button
                  type="button"
                  onClick={handleFolderClick}
                  disabled={disabled}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <svg
                    className="mr-1.5 h-4 w-4"
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
                  Select Folder
                </button>
              )}
            </div>

            {/* Accepted types hint */}
            {accept && (
              <p className="mt-3 text-xs text-gray-400">
                Accepted: {accept.split(',').join(', ')}
              </p>
            )}
          </>
        ) : (
          <>
            {/* Selected files summary */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <svg
                  className="h-5 w-5 text-green-500 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm font-medium text-gray-900">
                  {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                </span>
                <span className="ml-2 text-sm text-gray-500">
                  ({formatFileSize(totalSize)})
                </span>
              </div>
              <button
                type="button"
                onClick={handleClear}
                className="text-sm text-red-600 hover:text-red-500 focus:outline-none"
              >
                Clear
              </button>
            </div>

            {/* File list (scrollable) */}
            <div className="max-h-32 overflow-y-auto border rounded-md bg-gray-50">
              <ul className="divide-y divide-gray-200">
                {selectedFiles.slice(0, 10).map((file, index) => (
                  <li key={index} className="px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center min-w-0">
                      <svg
                        className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                        />
                      </svg>
                      <span className="text-xs text-gray-700 truncate">
                        {file.webkitRelativePath || file.name}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                      {formatFileSize(file.size)}
                    </span>
                  </li>
                ))}
                {selectedFiles.length > 10 && (
                  <li className="px-3 py-2 text-xs text-gray-500 text-center">
                    ...and {selectedFiles.length - 10} more files
                  </li>
                )}
              </ul>
            </div>

            {/* Change files hint */}
            <p className="mt-2 text-xs text-gray-400">
              Drop more files or click to change selection
            </p>
          </>
        )}
      </div>
    </div>
  );
}
