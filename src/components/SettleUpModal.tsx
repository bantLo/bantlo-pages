import NeoButton from './NeoButton';
import { buildUpiIntentUrl, isUpiIntentSupported, UPI_CURRENCY } from '../lib/upi';

interface SettleUpModalProps {
  isOpen: boolean;
  payeeName: string;
  payeeUpiId?: string;
  amount: number;
  currency: string;
  groupName?: string;
  /**
   * Whether the viewer is the one who owes. Only the debtor can pay — showing
   * the option to anyone else offers a creditor a payment to themselves.
   */
  isPayer: boolean;
  onPayViaUpi: (url: string) => void;
  onMarkPaid: () => void;
  onClose: () => void;
}

/**
 * Asks how a debt is being cleared before anything is written.
 *
 * Two paths: hand off to a UPI app with the payment pre-filled, or record a
 * payment that already happened by other means. The UPI option appears only
 * when it can actually work — the payee has a handle, the group settles in INR,
 * and the platform can open an intent at all.
 */
export default function SettleUpModal({
  isOpen,
  payeeName,
  payeeUpiId,
  amount,
  currency,
  groupName,
  isPayer,
  onPayViaUpi,
  onMarkPaid,
  onClose,
}: SettleUpModalProps) {
  if (!isOpen) return null;

  const intentUrl = payeeUpiId
    ? buildUpiIntentUrl({ payeeUpiId, payeeName, amount, note: `bantLo ${groupName || 'settlement'}` })
    : null;

  // UPI settles in INR, so other currencies keep manual entry.
  const upiUsable = isPayer && !!intentUrl && currency === UPI_CURRENCY;
  const canOpenIntent = upiUsable && isUpiIntentSupported();
  // Desktop can't hand off to a payment app, so the useful thing is the address.
  const showCopyableHandle = upiUsable && !isUpiIntentSupported();

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 9999, padding: '1rem'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-dark)',
          border: '2px solid var(--border-color)',
          padding: '1.5rem',
          width: '100%',
          maxWidth: '420px',
          boxShadow: '8px 8px 0px rgba(0,0,0,0.6)'
        }}
      >
        <p className="np-text-muted" style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Settle Up
        </p>
        <h2 style={{ margin: '0.5rem 0 1.5rem 0', fontSize: '1.3rem' }}>
          Pay <span style={{ color: 'var(--text-accent)' }}>{currency} {amount.toFixed(2)}</span> to {payeeName}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {canOpenIntent && (
            <>
              <NeoButton
                variant="primary"
                style={{ width: '100%', borderColor: 'var(--text-accent)' }}
                onClick={() => onPayViaUpi(intentUrl!)}
              >
                Pay via UPI
              </NeoButton>
              <p className="np-text-muted" style={{ margin: '-0.25rem 0 0.5rem 0', fontSize: '0.75rem', lineHeight: 1.5 }}>
                Opens your UPI app with the amount filled in. Check the payee name there before confirming.
              </p>
            </>
          )}

          {showCopyableHandle && (
            <div style={{ padding: '0.75rem', border: '1px dashed var(--border-color)', marginBottom: '0.5rem' }}>
              <p className="np-text-muted" style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem' }}>
                {payeeName}'s UPI ID — pay from your phone, then mark it paid here.
              </p>
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 'bold', wordBreak: 'break-all' }}>{payeeUpiId}</p>
            </div>
          )}

          {isPayer && !intentUrl && (
            <p className="np-text-muted" style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', lineHeight: 1.5 }}>
              {payeeName} hasn't added a UPI ID, so there's nothing to pay into from here.
              They can add one under Account Settings to enable one-tap payments.
            </p>
          )}

          <NeoButton style={{ width: '100%' }} onClick={onMarkPaid}>
            Already Paid — Mark Settled
          </NeoButton>

          <NeoButton style={{ width: '100%', borderColor: 'var(--text-secondary)' }} onClick={onClose}>
            Cancel
          </NeoButton>
        </div>
      </div>
    </div>
  );
}
