/**
 * Tests for StatusDropdown component.
 * Following TDD: Write tests first, see them fail, then implement.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusDropdown } from './StatusDropdown';
import { vi, describe, it, expect } from 'vitest';

describe('StatusDropdown', () => {
  it('renders current status as badge', () => {
    render(<StatusDropdown status="draft" onChange={vi.fn()} />);
    expect(screen.getByText('draft')).toBeInTheDocument();
  });

  it('shows dropdown options on click', () => {
    render(<StatusDropdown status="draft" onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('draft'));
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('deprecated')).toBeInTheDocument();
  });

  it('calls onChange when option selected', () => {
    const onChange = vi.fn();
    render(<StatusDropdown status="draft" onChange={onChange} />);
    fireEvent.click(screen.getByText('draft'));
    fireEvent.click(screen.getByText('active'));
    expect(onChange).toHaveBeenCalledWith('active');
  });

  it('does not call onChange for deprecated without confirmation', () => {
    const onChange = vi.fn();
    render(<StatusDropdown status="active" onChange={onChange} requireConfirmForDeprecate />);
    fireEvent.click(screen.getByText('active'));
    fireEvent.click(screen.getByText('deprecated'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onDeprecateClick when deprecated clicked with confirmation required', () => {
    const onDeprecateClick = vi.fn();
    render(
      <StatusDropdown
        status="active"
        onChange={vi.fn()}
        requireConfirmForDeprecate
        onDeprecateClick={onDeprecateClick}
      />
    );
    fireEvent.click(screen.getByText('active'));
    fireEvent.click(screen.getByText('deprecated'));
    expect(onDeprecateClick).toHaveBeenCalled();
  });

  it('closes dropdown when clicking outside', () => {
    render(
      <div>
        <StatusDropdown status="draft" onChange={vi.fn()} />
        <button data-testid="outside">Outside</button>
      </div>
    );
    fireEvent.click(screen.getByText('draft'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('does not open dropdown when disabled', () => {
    render(<StatusDropdown status="draft" onChange={vi.fn()} disabled />);
    fireEvent.click(screen.getByText('draft'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('highlights current status in dropdown', () => {
    render(<StatusDropdown status="active" onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('active'));
    const activeOption = screen.getByRole('option', { name: 'active' });
    expect(activeOption).toHaveAttribute('aria-selected', 'true');
  });
});
