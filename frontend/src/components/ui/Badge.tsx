/**
 * Badge component for displaying status and tag labels.
 */

import { ReactNode } from 'react';

/**
 * Badge variant types.
 */
export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

/**
 * Badge component props.
 */
interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

/**
 * Variant to Tailwind class mapping.
 */
const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
};

/**
 * Badge component for status indicators and tags.
 */
export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
  const variantClass = variantClasses[variant];

  return (
    <span className={`${baseClasses} ${variantClass} ${className}`}>
      {children}
    </span>
  );
}

/**
 * Maps agent status to badge variant.
 * @param status - The agent status.
 * @returns The corresponding badge variant.
 */
export function getStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'active':
      return 'success';
    case 'draft':
      return 'warning';
    case 'deprecated':
      return 'error';
    default:
      return 'default';
  }
}
