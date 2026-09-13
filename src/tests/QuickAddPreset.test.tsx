import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import QuickAddPreset from '../components/QuickAddPreset';

// NeoButton calls useNavigate, so the modal needs a router in scope.
const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

const members = [
  { user_id: 'u1', profiles: { display_name: 'Harshit', email: 'h@x.com' } },
  { user_id: 'u2', profiles: { display_name: 'Jatin', email: 'j@x.com' } },
  { user_id: 'u3', profiles: { display_name: 'Ankit', email: 'a@x.com' } },
];

const milk = {
  id: 'p1',
  group_id: 'g1',
  name: 'Milk',
  default_amount: null,
  payer_id: null,
  members: [{ user_id: 'u1' }, { user_id: 'u2' }, { user_id: 'u3' }],
};

const rent = { ...milk, id: 'p2', name: 'Rent', default_amount: 45000, payer_id: 'u2' };

const defaultProps = {
  preset: milk,
  members,
  currency: 'INR',
  currentUserId: 'u1',
  onSubmit: vi.fn().mockResolvedValue(undefined),
  onEditDetails: vi.fn(),
  onClose: vi.fn(),
};

describe('QuickAddPreset', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders nothing without a preset', () => {
    render(<QuickAddPreset {...defaultProps} preset={null} />);
    expect(screen.queryByText('Quick Add')).not.toBeInTheDocument();
  });

  it('shows the preset name and its roster', () => {
    render(<QuickAddPreset {...defaultProps} />);
    expect(screen.getByRole('heading')).toHaveTextContent('Milk');
    expect(screen.getByText(/Splits 3 ways: Harshit, Jatin, Ankit/)).toBeInTheDocument();
  });

  it('leaves the amount empty when the preset has no default', () => {
    render(<QuickAddPreset {...defaultProps} />);
    expect(screen.getByPlaceholderText(/Amount/)).toHaveValue('');
  });

  it('prefills a fixed amount and puts it in the button', () => {
    render(<QuickAddPreset {...defaultProps} preset={rent} />);
    expect(screen.getByPlaceholderText(/Amount/)).toHaveValue('45000');
    // The figure lives in the action so a stale default is hard to tap past.
    expect(screen.getByText('Add INR 45000.00 Expense')).toBeInTheDocument();
  });

  it("defaults the payer to the preset's, falling back to the current user", () => {
    const { unmount } = render(<QuickAddPreset {...defaultProps} preset={rent} />);
    expect(screen.getByRole('combobox')).toHaveValue('u2');
    unmount();

    render(<QuickAddPreset {...defaultProps} />);
    expect(screen.getByRole('combobox')).toHaveValue('u1');
  });

  it('shows a last-time hint only when there is no fixed amount', () => {
    const { unmount } = render(<QuickAddPreset {...defaultProps} lastAmount={1240} />);
    expect(screen.getByText('Last time: INR 1240.00')).toBeInTheDocument();
    unmount();

    render(<QuickAddPreset {...defaultProps} preset={rent} lastAmount={1240} />);
    expect(screen.queryByText(/Last time/)).not.toBeInTheDocument();
  });

  it('submits amount, payer and roster', async () => {
    render(<QuickAddPreset {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText(/Amount/), { target: { value: '90' } });
    fireEvent.blur(screen.getByPlaceholderText(/Amount/));
    fireEvent.click(screen.getByText('Add INR 90.00 Expense'));

    await waitFor(() =>
      expect(defaultProps.onSubmit).toHaveBeenCalledWith(90, 'u1', ['u1', 'u2', 'u3'])
    );
  });

  it('accepts an arithmetic amount', async () => {
    render(<QuickAddPreset {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText(/Amount/), { target: { value: '30+30+30' } });
    fireEvent.blur(screen.getByPlaceholderText(/Amount/));

    await waitFor(() => expect(screen.getByText('Add INR 90.00 Expense')).toBeInTheDocument());
  });

  it('refuses to submit without an amount', async () => {
    render(<QuickAddPreset {...defaultProps} />);
    fireEvent.click(screen.getByText('Add Expense'));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount.'));
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('drops roster members who have left the group', () => {
    // A preset outlives removal; splitting to an ex-member would corrupt balances.
    render(<QuickAddPreset {...defaultProps} members={members.slice(0, 2)} />);
    expect(screen.getByText(/Splits 2 ways: Harshit, Jatin/)).toBeInTheDocument();
  });

  it('blocks submission when nobody in the preset is still a member', async () => {
    render(<QuickAddPreset {...defaultProps} members={[{ user_id: 'u9', profiles: { display_name: 'New' } }]} />);
    fireEvent.change(screen.getByPlaceholderText(/Amount/), { target: { value: '90' } });
    fireEvent.blur(screen.getByPlaceholderText(/Amount/));
    fireEvent.click(screen.getByText('Add INR 90.00 Expense'));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/no longer in the group|still in the group/i));
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('escapes to the full form via Edit details', () => {
    render(<QuickAddPreset {...defaultProps} />);
    fireEvent.click(screen.getByText('Edit details…'));
    expect(defaultProps.onEditDetails).toHaveBeenCalled();
  });
});
