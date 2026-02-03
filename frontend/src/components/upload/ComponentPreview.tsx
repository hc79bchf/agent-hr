/**
 * ComponentPreview component for displaying detected components from uploaded files.
 * Shows parsed skills, tools, and memory components with selection checkboxes.
 */

import { useCallback, useMemo } from 'react';
import type { ComponentType } from '../../types';

/**
 * Detected component from file parsing.
 */
export interface DetectedComponent {
  /** Component name (derived from filename or content) */
  name: string;
  /** Component type */
  type: ComponentType;
  /** Source file path */
  sourcePath: string;
  /** Optional description */
  description?: string;
  /** File size in bytes */
  size: number;
  /** Whether the component is selected for upload */
  selected: boolean;
}

/**
 * ComponentPreview props.
 */
interface ComponentPreviewProps {
  /** Detected components to display */
  components: DetectedComponent[];
  /** Callback when selection changes */
  onSelectionChange: (components: DetectedComponent[]) => void;
  /** Whether the preview is loading */
  isLoading?: boolean;
  /** Error message if parsing failed */
  error?: string | null;
}

/**
 * Component type to display info mapping.
 */
const typeInfo: Record<ComponentType, { label: string; color: string; icon: string }> = {
  skill: {
    label: 'Skill',
    color: 'bg-purple-100 text-purple-800',
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  },
  mcp_tool: {
    label: 'MCP Tool',
    color: 'bg-blue-100 text-blue-800',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
  },
  memory: {
    label: 'Memory',
    color: 'bg-green-100 text-green-800',
    icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',
  },
  agent: {
    label: 'Agent',
    color: 'bg-orange-100 text-orange-800',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
  other: {
    label: 'Other',
    color: 'bg-gray-100 text-gray-800',
    icon: 'M4 7v10c0 2 1.5 3 3 3h10c1.5 0 3-1 3-3V7c0-2-1.5-3-3-3H7C5.5 4 4 5 4 7zm0 0h16',
  },
};

/**
 * Format file size for display.
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * ComponentPreview component for showing detected components with selection.
 */
export function ComponentPreview({
  components,
  onSelectionChange,
  isLoading = false,
  error = null,
}: ComponentPreviewProps) {
  // Group components by type
  const groupedComponents = useMemo(() => {
    const groups: Record<ComponentType, DetectedComponent[]> = {
      skill: [],
      mcp_tool: [],
      memory: [],
      agent: [],
      other: [],
    };

    components.forEach((component) => {
      groups[component.type].push(component);
    });

    return groups;
  }, [components]);

  // Count selected components
  const selectedCount = useMemo(() => {
    return components.filter((c) => c.selected).length;
  }, [components]);

  // Toggle single component selection
  const toggleComponent = useCallback(
    (index: number) => {
      const updated = components.map((c, i) =>
        i === index ? { ...c, selected: !c.selected } : c
      );
      onSelectionChange(updated);
    },
    [components, onSelectionChange]
  );

  // Toggle all components of a type
  const toggleType = useCallback(
    (type: ComponentType) => {
      const typeComponents = components.filter((c) => c.type === type);
      const allSelected = typeComponents.every((c) => c.selected);

      const updated = components.map((c) =>
        c.type === type ? { ...c, selected: !allSelected } : c
      );
      onSelectionChange(updated);
    },
    [components, onSelectionChange]
  );

  // Select all / deselect all
  const toggleAll = useCallback(() => {
    const allSelected = components.every((c) => c.selected);
    const updated = components.map((c) => ({ ...c, selected: !allSelected }));
    onSelectionChange(updated);
  }, [components, onSelectionChange]);

  // Loading state
  if (isLoading) {
    return (
      <div className="border rounded-lg p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mr-3"></div>
          <span className="text-sm text-gray-600">Analyzing files...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="border border-red-200 rounded-lg p-6 bg-red-50">
        <div className="flex items-center">
          <svg
            className="h-5 w-5 text-red-400 mr-2"
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
          <span className="text-sm text-red-700">{error}</span>
        </div>
      </div>
    );
  }

  // Empty state
  if (components.length === 0) {
    return (
      <div className="border border-dashed rounded-lg p-6 text-center">
        <svg
          className="mx-auto h-10 w-10 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
          />
        </svg>
        <p className="mt-2 text-sm text-gray-500">
          No components detected. Upload files to see preview.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header with select all */}
      <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={components.length > 0 && selectedCount === components.length}
            onChange={toggleAll}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm font-medium text-gray-700">
            Select All
          </span>
        </div>
        <span className="text-sm text-gray-500">
          {selectedCount} of {components.length} selected
        </span>
      </div>

      {/* Component groups */}
      <div className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
        {(Object.keys(groupedComponents) as ComponentType[]).map((type) => {
          const typeComponents = groupedComponents[type];
          if (typeComponents.length === 0) return null;

          const info = typeInfo[type];
          const allTypeSelected = typeComponents.every((c) => c.selected);
          const someTypeSelected = typeComponents.some((c) => c.selected);

          return (
            <div key={type}>
              {/* Type header */}
              <div className="bg-gray-50 px-4 py-2 flex items-center">
                <input
                  type="checkbox"
                  checked={allTypeSelected}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate = someTypeSelected && !allTypeSelected;
                    }
                  }}
                  onChange={() => toggleType(type)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <svg
                  className="ml-2 h-4 w-4 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={info.icon}
                  />
                </svg>
                <span className="ml-2 text-sm font-medium text-gray-700">
                  {info.label}s
                </span>
                <span
                  className={`ml-2 px-2 py-0.5 text-xs rounded-full ${info.color}`}
                >
                  {typeComponents.length}
                </span>
              </div>

              {/* Components of this type */}
              <ul className="divide-y divide-gray-100">
                {typeComponents.map((component) => {
                  const originalIndex = components.indexOf(component);
                  return (
                    <li key={originalIndex} className="px-4 py-2 hover:bg-gray-50">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={component.selected}
                          onChange={() => toggleComponent(originalIndex)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <div className="ml-3 flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {component.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {component.sourcePath}
                          </p>
                          {component.description && (
                            <p className="mt-0.5 text-xs text-gray-400 truncate">
                              {component.description}
                            </p>
                          )}
                        </div>
                        <span className="ml-2 text-xs text-gray-400">
                          {formatFileSize(component.size)}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      <div className="bg-gray-50 px-4 py-2 border-t">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {groupedComponents.skill.length} skill{groupedComponents.skill.length !== 1 ? 's' : ''},{' '}
            {groupedComponents.mcp_tool.length} tool{groupedComponents.mcp_tool.length !== 1 ? 's' : ''},{' '}
            {groupedComponents.memory.length} memor{groupedComponents.memory.length !== 1 ? 'ies' : 'y'},{' '}
            {groupedComponents.agent.length} agent{groupedComponents.agent.length !== 1 ? 's' : ''}
            {groupedComponents.other.length > 0 && (
              <>, {groupedComponents.other.length} other</>
            )}
          </span>
          <span>
            {formatFileSize(components.filter((c) => c.selected).reduce((sum, c) => sum + c.size, 0))} selected
          </span>
        </div>
      </div>
    </div>
  );
}
