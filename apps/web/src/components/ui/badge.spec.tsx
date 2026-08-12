import { render, screen } from '@testing-library/react';
import { Badge } from './badge';

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeTruthy();
  });

  it('applies default variant styling', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge.className).toContain('bg-surface-100');
  });

  it('applies success variant styling', () => {
    render(<Badge variant="success">Approved</Badge>);
    const badge = screen.getByText('Approved');
    expect(badge.className).toContain('bg-success-light');
  });

  it('applies danger variant styling', () => {
    render(<Badge variant="danger">Rejected</Badge>);
    const badge = screen.getByText('Rejected');
    expect(badge.className).toContain('bg-danger-light');
  });

  it('renders status dot when dot prop is true', () => {
    render(<Badge dot variant="success">Online</Badge>);
    const badge = screen.getByText('Online');
    const dot = badge.querySelector('.rounded-full');
    expect(dot).toBeTruthy();
    expect(dot!.className).toContain('bg-success');
  });

  it('does not render dot by default', () => {
    render(<Badge>No Dot</Badge>);
    const badge = screen.getByText('No Dot');
    const dot = badge.querySelector('.rounded-full');
    expect(dot).toBeNull();
  });

  it('applies custom className', () => {
    render(<Badge className="ml-2">Custom</Badge>);
    expect(screen.getByText('Custom').className).toContain('ml-2');
  });
});
