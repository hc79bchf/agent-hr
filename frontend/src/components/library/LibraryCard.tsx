/**
 * LibraryCard component for displaying a library component with add functionality.
 */

import { Badge } from '../ui/Badge';
import type { LibraryComponent } from '../../types';

/**
 * Props for the LibraryCard component.
 */
interface LibraryCardProps {
  /** The library component to display. */
  component: LibraryComponent;
  /** Whether this component is already added to the agent. */
  isAdded?: boolean;
  /** Whether the component is currently being added. */
  isAdding?: boolean;
  /** Callback when the add button is clicked. */
  onAdd?: () => void;
}

/**
 * Displays a library component card with metadata and add/added state.
 */
export function LibraryCard({ component, isAdded, isAdding, onAdd }: LibraryCardProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 truncate">{component.name}</h4>
          <Badge variant="info" className="mt-1">{component.type}</Badge>
        </div>
      </div>

      {component.description && (
        <p className="text-xs text-gray-600 mt-2 line-clamp-2">{component.description}</p>
      )}

      {component.tags && component.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {component.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <span className="text-xs text-gray-400">
          Used by {component.usage_count} agent{component.usage_count !== 1 ? 's' : ''}
        </span>

        {isAdded ? (
          <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Added
          </span>
        ) : (
          <button
            onClick={onAdd}
            disabled={isAdding}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded disabled:opacity-50"
          >
            {isAdding ? (
              <>
                <svg className="animate-spin w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Adding...
              </>
            ) : (
              <>
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Add
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
