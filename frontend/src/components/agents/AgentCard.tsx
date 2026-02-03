/**
 * AgentCard component for displaying agent information in a card layout.
 */

import type { Agent } from '../../types';
import { Badge, getStatusVariant } from '../ui';

/**
 * AgentCard component props.
 */
interface AgentCardProps {
  agent: Agent;
  onClick?: (agent: Agent) => void;
}

/**
 * Formats a date string to a readable format.
 * @param dateString - ISO date string.
 * @returns Formatted date string.
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Card component for displaying an individual agent.
 */
export function AgentCard({ agent, onClick }: AgentCardProps) {
  const handleClick = () => {
    onClick?.(agent);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(agent);
    }
  };

  return (
    <div
      className="bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-200 cursor-pointer border border-gray-200"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`View agent ${agent.name}`}
    >
      <div className="p-5">
        {/* Header: Name and Status */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 truncate pr-2">
            {agent.name}
          </h3>
          <div className="flex items-center gap-2">
            {agent.is_running && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Running
              </span>
            )}
            <Badge variant={getStatusVariant(agent.status)}>
              {agent.status}
            </Badge>
          </div>
        </div>

        {/* Description */}
        {agent.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {agent.description}
          </p>
        )}

        {/* Author */}
        {agent.author && (
          <p className="text-sm text-gray-500 mb-2">
            by {agent.author.name}
          </p>
        )}

        {/* Tags */}
        {agent.tags && agent.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {agent.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="info" className="text-xs">
                {tag}
              </Badge>
            ))}
            {agent.tags.length > 3 && (
              <span className="text-xs text-gray-500">
                +{agent.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Footer: Metadata */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <span>{agent.version_count} version{agent.version_count !== 1 ? 's' : ''}</span>
            <span>Updated {formatDate(agent.updated_at)}</span>
          </div>
          {agent.department && (
            <span className="truncate max-w-[100px]" title={agent.department}>
              {agent.department}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
