/**
 * StatusDropdown component for changing agent status.
 * Displays current status as a badge with dropdown to change it.
 */
import { useState, useRef, useEffect } from 'react';
import { Badge, getStatusVariant } from './Badge';
import type { AgentStatus } from '../../types';

/**
 * Props for StatusDropdown component.
 */
interface StatusDropdownProps {
  /** Current status value */
  status: AgentStatus;
  /** Callback when status changes */
  onChange: (status: AgentStatus) => void;
  /** Whether the dropdown is disabled */
  disabled?: boolean;
  /** Whether to require confirmation before deprecating */
  requireConfirmForDeprecate?: boolean;
  /** Callback when deprecate is clicked and confirmation is required */
  onDeprecateClick?: () => void;
}

/** Available status options */
const STATUS_OPTIONS: AgentStatus[] = ['draft', 'active', 'deprecated'];

/**
 * Dropdown component for selecting agent status.
 * Shows current status as a badge and allows changing via dropdown.
 */
export function StatusDropdown({
  status,
  onChange,
  disabled = false,
  requireConfirmForDeprecate = false,
  onDeprecateClick,
}: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Handles clicking on a status option.
   */
  const handleOptionClick = (newStatus: AgentStatus) => {
    if (newStatus === status) {
      setIsOpen(false);
      return;
    }

    if (newStatus === 'deprecated' && requireConfirmForDeprecate) {
      setIsOpen(false);
      onDeprecateClick?.();
      return;
    }

    onChange(newStatus);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="cursor-pointer disabled:cursor-not-allowed"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        type="button"
      >
        <Badge variant={getStatusVariant(status)}>
          {status}
          <svg
            className="ml-1 h-3 w-3 inline"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </Badge>
      </button>

      {isOpen && (
        <div
          className="absolute z-10 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg"
          role="listbox"
          aria-label="Status options"
        >
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => handleOptionClick(option)}
              className={`
                w-full px-3 py-2 text-left text-sm hover:bg-gray-100
                ${option === status ? 'bg-gray-50 font-medium' : ''}
                ${option === 'deprecated' ? 'text-red-600' : ''}
              `}
              role="option"
              aria-selected={option === status}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
