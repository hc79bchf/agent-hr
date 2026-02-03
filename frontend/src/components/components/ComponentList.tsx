/**
 * ComponentList component for displaying a list of components.
 */

import { useMemo } from 'react';
import type { Component } from '../../types';
import { ComponentCard } from './ComponentCard';

/**
 * ComponentList component props.
 */
interface ComponentListProps {
  components: Component[];
  onComponentClick?: (component: Component) => void;
  isLoading?: boolean;
  isSelectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (selectedIds: Set<string>) => void;
  isReadOnly?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  searchQuery?: string;
  onEdit?: (component: Component) => void;
  onDelete?: (component: Component) => void;
  onPublish?: (component: Component) => void;
}

/**
 * Loading skeleton for component cards.
 */
function ComponentSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-5 h-5 bg-gray-200 rounded" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-4 bg-gray-200 rounded w-32" />
            <div className="h-4 bg-gray-200 rounded w-16" />
          </div>
          <div className="h-3 bg-gray-200 rounded w-full mb-1" />
          <div className="h-3 bg-gray-200 rounded w-2/3" />
        </div>
      </div>
    </div>
  );
}

/**
 * List component for displaying multiple components.
 */
export function ComponentList({
  components,
  onComponentClick,
  isLoading = false,
  isSelectable = false,
  selectedIds = new Set(),
  onSelectionChange,
  isReadOnly = false,
  emptyMessage = 'No components found.',
  emptyIcon,
  searchQuery = '',
  onEdit,
  onDelete,
  onPublish,
}: ComponentListProps) {
  // Filter components based on search query
  const filteredComponents = useMemo(() => {
    if (!searchQuery.trim()) {
      return components;
    }
    const query = searchQuery.toLowerCase().trim();
    return components.filter(
      (component) =>
        component.name.toLowerCase().includes(query) ||
        component.description?.toLowerCase().includes(query) ||
        component.source_path?.toLowerCase().includes(query)
    );
  }, [components, searchQuery]);

  // Handle component selection
  const handleSelect = (component: Component, selected: boolean) => {
    if (!onSelectionChange) return;

    const newSelection = new Set(selectedIds);
    if (selected) {
      newSelection.add(component.id);
    } else {
      newSelection.delete(component.id);
    }
    onSelectionChange(newSelection);
  };

  // Handle select all
  const handleSelectAll = (selected: boolean) => {
    if (!onSelectionChange) return;

    if (selected) {
      onSelectionChange(new Set(filteredComponents.map((c) => c.id)));
    } else {
      onSelectionChange(new Set());
    }
  };

  // Check if all are selected
  const allSelected =
    filteredComponents.length > 0 &&
    filteredComponents.every((c) => selectedIds.has(c.id));
  const someSelected = filteredComponents.some((c) => selectedIds.has(c.id));

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <ComponentSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Empty state
  if (filteredComponents.length === 0) {
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
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        )}
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          {searchQuery ? 'No results found' : 'No components'}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          {searchQuery
            ? `No components match "${searchQuery}"`
            : emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Select All Header (when selectable) */}
      {isSelectable && (
        <div className="flex items-center justify-between pb-2 border-b border-gray-200">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) {
                  el.indeterminate = someSelected && !allSelected;
                }
              }}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            Select all ({filteredComponents.length} items)
          </label>
          {selectedIds.size > 0 && (
            <span className="text-sm text-indigo-600 font-medium">
              {selectedIds.size} selected
            </span>
          )}
        </div>
      )}

      {/* Component Cards */}
      {filteredComponents.map((component) => (
        <ComponentCard
          key={component.id}
          component={component}
          onClick={onComponentClick}
          isSelectable={isSelectable}
          isSelected={selectedIds.has(component.id)}
          onSelect={handleSelect}
          isReadOnly={isReadOnly}
          onEdit={onEdit}
          onDelete={onDelete}
          onPublish={onPublish}
        />
      ))}
    </div>
  );
}
