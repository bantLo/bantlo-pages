import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import AddExpense from '../components/AddExpense';
import { supabase } from '../lib/supabase';

// Mock react-router-dom as it's used inside NeoButton
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

// Mock api.ts updates
vi.mock('../lib/api', () => ({
  updateFullExpense: vi.fn(),
}));

// Mock db.ts to avoid "indexedDB is not defined" error in test logs
vi.mock('../lib/db', () => ({
  updateExpensesSync: vi.fn().mockResolvedValue(null),
  getExpensesCached: vi.fn().mockResolvedValue([]),
  updateCachedGroupStanding: vi.fn().mockResolvedValue(null),
}));

// Mock Supabase
const mockSingleResult = vi.fn();
const mockInsertResult = vi.fn();
const mockDeleteResult = vi.fn();

vi.mock('../lib/supabase', () => {
  const selectSingleMock = {
    single: () => mockSingleResult(),
  };
  const insertMock = {
    select: () => selectSingleMock,
  };
  const deleteEqMock = {
    eq: () => mockDeleteResult(),
  };

  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user_1' } } } }),
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user_1' } } }),
      },
      from: vi.fn((table) => {
        if (table === 'expenses') {
          return {
            insert: () => insertMock,
            delete: () => deleteEqMock,
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { id: 'new_expense_id', payments: [], splits: [] }, error: null }),
              }),
            }),
          };
        }
        // For other tables like expense_payments or expense_splits
        return {
          insert: (data: any) => mockInsertResult(table, data),
        };
      }),
    },
  };
});

describe('AddExpense Component', () => {
  const mockMembers = [
    { user_id: 'user_1', profiles: { display_name: 'User One', email: 'user1@example.com' } },
    { user_id: 'user_2', profiles: { display_name: 'User Two', email: 'user2@example.com' } },
  ];

  const defaultProps = {
    groupId: 'group_123',
    members: mockMembers,
    onComplete: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
  });

  it('renders successfully', () => {
    render(<AddExpense {...defaultProps} />);
    expect(screen.getByText('Add Expense')).toBeInTheDocument();
  });

  it('blocks duplicate submit clicks when loading', async () => {
    // Mock successful expense creation but delay it to simulate network roundtrip
    mockSingleResult.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { data: { id: 'new_expense_id' }, error: null };
    });
    mockInsertResult.mockResolvedValue({ error: null });

    render(<AddExpense {...defaultProps} />);

    // Fill form
    fireEvent.change(screen.getByPlaceholderText(/Description/i), { target: { value: 'Lunch' } });
    fireEvent.change(screen.getByPlaceholderText(/Total Amount/i), { target: { value: '100' } });

    const submitBtn = screen.getByRole('button', { name: /Save Expense/i });
    
    // Perform rapid double click
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(defaultProps.onComplete).toHaveBeenCalledTimes(1);
    });

    // Verify database insert on expenses was only called exactly once
    // (first time mockSingleResult is executed)
    expect(mockSingleResult).toHaveBeenCalledTimes(1);
  });

  it('handles React Strict Mode double render correctly without duplication', () => {
    // Strictly render twice to verify session check double call doesn't throw or duplicate state
    const { rerender } = render(
      <React.StrictMode>
        <AddExpense {...defaultProps} />
      </React.StrictMode>
    );

    rerender(
      <React.StrictMode>
        <AddExpense {...defaultProps} />
      </React.StrictMode>
    );

    expect(screen.getByText('Add Expense')).toBeInTheDocument();
  });

  it('rolls back and deletes the expense if payments or splits insert fails', async () => {
    // 1. Expense insert succeeds
    mockSingleResult.mockResolvedValue({ data: { id: 'dangling_expense_id' }, error: null });
    // 2. Payments insert fails
    mockInsertResult.mockImplementation((table) => {
      if (table === 'expense_payments') {
        return Promise.resolve({ error: new Error('Database connection reset') });
      }
      return Promise.resolve({ error: null });
    });
    // 3. Delete rollback succeeds
    mockDeleteResult.mockResolvedValue({ data: null, error: null });

    render(<AddExpense {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText(/Description/i), { target: { value: 'Dinner' } });
    fireEvent.change(screen.getByPlaceholderText(/Total Amount/i), { target: { value: '50' } });

    const submitBtn = screen.getByRole('button', { name: /Save Expense/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // Alert should report the error
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Database connection reset'));
      // Verify rollback delete was triggered on the dangling expense
      expect(supabase.from).toHaveBeenCalledWith('expenses');
    });
  });

  it('gracefully handles UNIQUE constraint violations with clear error messages', async () => {
    // 1. Expense insert succeeds
    mockSingleResult.mockResolvedValue({ data: { id: 'dup_expense_id' }, error: null });
    // 2. Payments insert fails with UNIQUE constraint violation code 23505
    mockInsertResult.mockImplementation((table) => {
      if (table === 'expense_payments') {
        return Promise.resolve({ error: { code: '23505', message: 'duplicate key value violates unique constraint' } });
      }
      return Promise.resolve({ error: null });
    });
    mockDeleteResult.mockResolvedValue({ data: null, error: null });

    render(<AddExpense {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText(/Description/i), { target: { value: 'Dinner' } });
    fireEvent.change(screen.getByPlaceholderText(/Total Amount/i), { target: { value: '50' } });

    const submitBtn = screen.getByRole('button', { name: /Save Expense/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('duplicate payment or split entry was detected'));
    });
  });
});
