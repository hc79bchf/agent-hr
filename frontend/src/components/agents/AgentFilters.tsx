/**
 * AgentFilters component for filtering and searching agents.
 */

import { SearchInput } from '../ui';
import type { AgentStatus } from '../../types';

/**
 * Filter state interface.
 */
export interface AgentFilterState {
  search: string;
  status: AgentStatus | '';
}

/**
 * AgentFilters component props.
 */
interface AgentFiltersProps {
  filters: AgentFilterState;
  onFilterChange: (filters: AgentFilterState) => void;
  onUploadClick?: () => void;
}

/**
 * Available status options for filtering.
 */
const STATUS_OPTIONS: Array<{ value: AgentStatus | ''; label: string }> = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'deprecated', label: 'Deprecated' },
];

/**
 * Filter controls for the agent list.
 */
export function AgentFilters({
  filters,
  onFilterChange,
  onUploadClick,
}: AgentFiltersProps) {
  const handleSearchChange = (search: string) => {
    onFilterChange({ ...filters, search });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const status = e.target.value as AgentStatus | '';
    onFilterChange({ ...filters, status });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      {/* Search Input */}
      <div className="flex-1">
        <SearchInput
          value={filters.search}
          onChange={handleSearchChange}
          placeholder="Search agents..."
          className="w-full"
        />
      </div>

      {/* Status Filter */}
      <div className="sm:w-48">
        <select
          value={filters.status}
          onChange={handleStatusChange}
          className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Upload Button */}
      {onUploadClick && (
        <button
          onClick={onUploadClick}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <svg
            className="-ml-1 mr-2 h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          Upload New Agent
        </button>
      )}
    </div>
  );
}
