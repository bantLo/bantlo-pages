import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddSettlement from '../components/AddSettlement';
import { createSettlement } from '../lib/api';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

// Mock api.ts methods
vi.mock('../lib/api', () => ({
  createSettlement: vi.fn(),
  updateSettlement: vi.fn(),
}));

describe('AddSettlement Component', () => {
  const mockMembers = [
    { user_id: 'user_1', profiles: { display_name: 'User One', email: 'user1@example.com' } },
    { user_id: 'user_2', profiles: { display_name: 'User Two', email: 'user2@example.com' } },
  ];

  const defaultProps = {
    groupId: 'group_123',
    members: mockMembers,
    onComplete: vi.fn(),
    onCancel: vi.fn(),
    initialFromId: 'user_1',
    initialToId: 'user_2',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
  });

  it('renders successfully', () => {
    render(<AddSettlement {...defaultProps} />);
    expect(screen.getByText('Record Payment')).toBeInTheDocument();
  });

  it('blocks double-click submissions when loading', async () => {
    // Make createSettlement slow
    vi.mocked(createSettlement).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { id: 'settle_expense_id' } as any;
    });

    render(<AddSettlement {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText(/Amount/i), { target: { value: '150.50' } });

    const submitBtn = screen.getByRole('button', { name: /Settle/i });
    
    // Rapid double click
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(defaultProps.onComplete).toHaveBeenCalledTimes(1);
    });

    expect(createSettlement).toHaveBeenCalledTimes(1);
  });

  it('gracefully handles database UNIQUE constraint violation', async () => {
    vi.mocked(createSettlement).mockRejectedValue({
      code: '23505',
      message: 'duplicate key value violates unique constraint',
    });

    render(<AddSettlement {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText(/Amount/i), { target: { value: '150.50' } });

    const submitBtn = screen.getByRole('button', { name: /Settle/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('duplicate payment or split entry was detected'));
    });
  });
});
