/**
 * AccessLevelBadge component.
 * Displays a colored badge for component access levels.
 */

import type { ComponentAccessLevel } from '../../types';

interface AccessLevelBadgeProps {
  level: ComponentAccessLevel;
  size?: 'sm' | 'md';
}

const LEVEL_STYLES: Record<ComponentAccessLevel, string> = {
  viewer: 'bg-gray-100 text-gray-700',
  executor: 'bg-blue-100 text-blue-700',
  contributor: 'bg-green-100 text-green-700',
};

const LEVEL_LABELS: Record<ComponentAccessLevel, string> = {
  viewer: 'Viewer',
  executor: 'Executor',
  contributor: 'Contributor',
};

const SIZE_STYLES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export function AccessLevelBadge({ level, size = 'sm' }: AccessLevelBadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${LEVEL_STYLES[level]} ${SIZE_STYLES[size]}`}
    >
      {LEVEL_LABELS[level]}
    </span>
  );
}

export default AccessLevelBadge;
