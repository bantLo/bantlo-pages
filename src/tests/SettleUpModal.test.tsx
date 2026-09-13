import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SettleUpModal from '../components/SettleUpModal';

// NeoButton calls useNavigate, so the modal needs a router in scope.
const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

const setUserAgent = (ua: string) => {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
};

const defaultProps = {
  isOpen: true,
  payeeName: 'Ankit',
  payeeUpiId: 'ankit@ybl',
  amount: 2400,
  currency: 'INR',
  groupName: 'Flat 402',
  isPayer: true,
  onPayViaUpi: vi.fn(),
  onMarkPaid: vi.fn(),
  onClose: vi.fn(),
};

describe('SettleUpModal', () => {
  const originalUa = navigator.userAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    setUserAgent(MOBILE_UA);
  });

  afterEach(() => setUserAgent(originalUa));

  it('renders nothing when closed', () => {
    render(<SettleUpModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText(/Settle Up/i)).not.toBeInTheDocument();
  });

  it('shows the payee and amount', () => {
    render(<SettleUpModal {...defaultProps} />);
    expect(screen.getByRole('heading')).toHaveTextContent('Pay INR 2400.00 to Ankit');
  });

  it('offers both options when the payee has a UPI ID', () => {
    render(<SettleUpModal {...defaultProps} />);
    expect(screen.getByText('Pay via UPI')).toBeInTheDocument();
    expect(screen.getByText('Already Paid — Mark Settled')).toBeInTheDocument();
  });

  it('passes a well-formed intent URL to onPayViaUpi', async () => {
    render(<SettleUpModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Pay via UPI'));

    // NeoButton defers onClick by 150ms for its press animation.
    await waitFor(() => expect(defaultProps.onPayViaUpi).toHaveBeenCalledTimes(1));
    const url = defaultProps.onPayViaUpi.mock.calls[0][0] as string;
    expect(url.startsWith('upi://pay?')).toBe(true);

    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('pa')).toBe('ankit@ybl');
    expect(params.get('am')).toBe('2400.00');
  });

  it('hides the UPI option when the payee has no handle, and explains why', () => {
    render(<SettleUpModal {...defaultProps} payeeUpiId={undefined} />);
    expect(screen.queryByText('Pay via UPI')).not.toBeInTheDocument();
    expect(screen.getByText(/hasn't added a UPI ID/)).toBeInTheDocument();
    // Mark-paid must always remain available.
    expect(screen.getByText('Already Paid — Mark Settled')).toBeInTheDocument();
  });

  it('hides the UPI option for a non-INR group', () => {
    render(<SettleUpModal {...defaultProps} currency="USD" />);
    expect(screen.queryByText('Pay via UPI')).not.toBeInTheDocument();
    expect(screen.getByText('Already Paid — Mark Settled')).toBeInTheDocument();
  });

  it('hides the UPI option when the handle is malformed', () => {
    render(<SettleUpModal {...defaultProps} payeeUpiId="not-a-vpa" />);
    expect(screen.queryByText('Pay via UPI')).not.toBeInTheDocument();
  });

  it('falls back to a copyable handle on desktop', () => {
    setUserAgent(DESKTOP_UA);
    render(<SettleUpModal {...defaultProps} />);

    expect(screen.queryByText('Pay via UPI')).not.toBeInTheDocument();
    expect(screen.getByText('ankit@ybl')).toBeInTheDocument();
  });

  it('hides the UPI option when the viewer is the payee, not the payer', () => {
    // "Jatin pays Harshit" viewed by Harshit: he is owed the money, so offering
    // him a UPI payment would be a payment to himself.
    render(<SettleUpModal {...defaultProps} isPayer={false} />);

    expect(screen.queryByText('Pay via UPI')).not.toBeInTheDocument();
    expect(screen.queryByText(/hasn't added a UPI ID/)).not.toBeInTheDocument();
    expect(screen.getByText('Already Paid — Mark Settled')).toBeInTheDocument();
  });

  it('fires onMarkPaid and onClose from their buttons', async () => {
    render(<SettleUpModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Already Paid — Mark Settled'));
    await waitFor(() => expect(defaultProps.onMarkPaid).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(defaultProps.onClose).toHaveBeenCalledTimes(1));
  });
});
