import { useEffect, useRef, useState } from 'react';
import { connectDemoWallet, refreshWallet, topupWallet } from '../api/wallet';
import { useAppDispatch, useAppSelector } from '../store';
import { walletLoaded } from '../store/walletSlice';
import { formatMoney, parseAmount } from '../features/budget/model';
import './Wallet.css';

const creditPackages = [
  {
    name: 'Weekend',
    amountMinor: 5000,
    description: 'A little extra for a short escape.',
    detail: '50 EUR in simulated wallet credit',
  },
  {
    name: 'Explorer',
    amountMinor: 15000,
    description: 'More room for the experiences you love.',
    detail: '150 EUR in simulated wallet credit',
  },
  {
    name: 'Long stay',
    amountMinor: 30000,
    description: 'A bigger cushion for a longer journey.',
    detail: '300 EUR in simulated wallet credit',
  },
];
type Checkout = { amountMinor: number; label: string };
type PendingTopup = { key: string; amountMinor: number };
// Keep an uncertain request's key across refreshes, so a retry cannot add funds twice.

function readPending(walletId: string): PendingTopup | null {
  try {
    const value: unknown = JSON.parse(
      sessionStorage.getItem('tripnest.topup.' + walletId) ?? 'null',
    );
    if (!value || typeof value !== 'object') return null;
    const item = value as Record<string, unknown>;
    if (
      typeof item.key === 'string' &&
      /^[0-9a-f-]{36}$/i.test(item.key) &&
      typeof item.amountMinor === 'number' &&
      Number.isInteger(item.amountMinor) &&
      item.amountMinor >= 100 &&
      item.amountMinor <= 500000
    )
      return { key: item.key, amountMinor: item.amountMinor };
  } catch {
    /* Corrupt browser state never becomes a server balance. */
  }
  return null;
}

export default function Wallet({ visible }: { visible: boolean }) {
  const wallet = useAppSelector((state) => state.wallet.data);
  const dispatch = useAppDispatch();
  const [amount, setAmount] = useState('50');
  const [pending, setPending] = useState<PendingTopup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const requestInFlight = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [testOutcome, setTestOutcome] = useState('approve');
  const [checkoutError, setCheckoutError] = useState('');

  // #explain_notes: Fetch fresh activity on entry and when returning from another tab.
  useEffect(() => {
    if (!visible) return;
    void connect();
    const refreshOnFocus = () => {
      void connect();
    };
    window.addEventListener('focus', refreshOnFocus);
    return () => window.removeEventListener('focus', refreshOnFocus);
  }, [visible]);
  useEffect(() => {
    if (checkout && !dialogRef.current?.open) dialogRef.current?.showModal();
    if (!checkout && dialogRef.current?.open) dialogRef.current.close();
  }, [checkout]);

  // #explain_notes: Validate the amount before opening the demo payment dialog.

  function reviewPayment(packageAmount?: number, packageName?: string) {
    const cents = pending?.amountMinor ?? packageAmount ?? parseAmount(amount);
    if (cents === null || cents < 100 || cents > 500000) {
      setError('Enter an amount from 1 to 5,000 EUR with up to 2 decimal places.');
      return;
    }
    setError('');
    setCheckoutError('');
    setTestOutcome('approve');
    setCheckout({
      amountMinor: cents,
      label: pending
        ? 'Pending wallet top-up'
        : packageName
          ? packageName + ' credit package'
          : 'Custom wallet top-up',
    });
  }

  async function connect() {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const data = await connectDemoWallet();
      dispatch(walletLoaded(data));
      setPending(readPending(data.id));
      setMessage('Connected to your local demo wallet.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed.');
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  async function refresh() {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setError('');
    try {
      dispatch(walletLoaded(await refreshWallet()));
      setMessage('Balance and activity refreshed.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refresh failed.');
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  // #explain_notes: Save simulated credit using one request key, including when retrying.

  async function addFunds() {
    if (!wallet || !checkout || requestInFlight.current) return;
    if (testOutcome === 'decline' && !pending) {
      setCheckoutError(
        'Demo payment declined. No funds were added. Choose the successful test outcome to try again.',
      );
      return;
    }
    const cents = pending?.amountMinor ?? checkout.amountMinor;
    if (cents === null || cents < 100 || cents > 500000) {
      setError('Enter an amount from 1 to 5,000 EUR with up to 2 decimal places.');
      return;
    }
    const operation = pending ?? { key: crypto.randomUUID(), amountMinor: cents };
    // Save the retry key before sending. If storage is unavailable, no request is made.
    try {
      sessionStorage.setItem('tripnest.topup.' + wallet.id, JSON.stringify(operation));
    } catch {
      setCheckoutError('Allow browser session storage before adding demo funds.');
      return;
    }
    requestInFlight.current = true;
    setPending(operation);
    setBusy(true);
    setError('');
    setCheckoutError('');
    try {
      const data = await topupWallet(operation.amountMinor, operation.key);
      dispatch(walletLoaded(data));
      sessionStorage.removeItem('tripnest.topup.' + wallet.id);
      setPending(null);
      setCheckout(null);
      setMessage(
        formatMoney(operation.amountMinor) +
          ' in demo funds confirmed. No real payment was made.',
      );
    } catch (e) {
      setCheckoutError(
        (e instanceof Error ? e.message : 'Connection interrupted.') +
          ' Retry the pending operation to check its result safely.',
      );
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="wallet-page" lang="en">
      <header className="wallet-heading">
        <div>
          <span className="eyebrow">TRIPNEST / DEMO WALLET</span>
          <h1>
            Your travel wallet.
            <br />
            <em>A world of possibilities.</em>
          </h1>
          <p>Your card, credit packages, and activity — together for the journey.</p>
        </div>
        <span className="wallet-tag">Simulation only</span>
      </header>

      <aside className="wallet-notice">
        <strong>No real money. No card details.</strong>
        <p>
          This wallet is a university project simulation. Adding funds creates a database
          record, not a payment. It never changes your planned trip budget.
        </p>
      </aside>
      <div className="wallet-feedback" aria-live="polite">
        {busy ? 'Working…' : message}
      </div>
      {error && (
        <p className="wallet-error" role="alert">
          {error}
        </p>
      )}
      {!wallet ? (
        <section className="wallet-panel">
          <h2>Open your local demo wallet</h2>
          <p>Open your saved demo balance and activity.</p>
          <button onClick={connect} disabled={busy}>
            {busy ? 'Opening your wallet…' : 'Try opening wallet again'}
          </button>
        </section>
      ) : (
        <>
          <div className="wallet-layout">
            <section className="wallet-card-zone">
              <div className="wallet-balance">
                <span>YOUR SIMULATED BALANCE</span>
                <strong>{formatMoney(wallet.balanceMinor)}</strong>
                <small>Demo funds in EUR · Saved to your demo account</small>
              </div>
              <div
                className="visa-card"
                aria-label="TripNest illustrative Visa card. Not issued and cannot be used for payments."
              >
                <div className="visa-top">
                  <strong>
                    TripNest<span>✦</span>
                  </strong>
                  <span className="card-demo-badge">DEMO CARD</span>
                </div>
                <div className="card-chip" aria-hidden="true"></div>
                <div className="card-number">
                  •••• &nbsp; •••• &nbsp; •••• &nbsp; 4242
                </div>
                <div className="visa-bottom">
                  <div>
                    <small>CARDHOLDER</small>
                    <span>DEMO TRAVELER</span>
                  </div>
                  <strong className="visa-wordmark">VISA</strong>
                </div>
              </div>
              <p className="card-caption">
                Illustrative card only. Not issued by Visa or a bank; it cannot make
                payments.
              </p>
            </section>

            <section className="wallet-panel">
              <span className="eyebrow">MAKE ROOM FOR MORE</span>
              <h2>Top up your demo wallet</h2>
              <p>Choose an amount, then review a simulated card payment.</p>
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  reviewPayment();
                }}
              >
                <label htmlFor="topup-amount">Simulated amount (EUR)</label>
                <input
                  id="topup-amount"
                  type="number"
                  min="1"
                  max="5000"
                  step="0.01"
                  value={pending ? String(pending.amountMinor / 100) : amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={busy || Boolean(pending)}
                />
                <div className="wallet-presets">
                  {[25, 50, 100].map((value) => (
                    <button
                      className="wallet-secondary"
                      key={value}
                      type="button"
                      disabled={busy || Boolean(pending)}
                      onClick={() => setAmount(String(value))}
                    >
                      €{value}
                    </button>
                  ))}
                </div>
                {pending && (
                  <p>
                    A request for {formatMoney(pending.amountMinor)} is pending
                    confirmation. Retrying uses the same request, so funds are not added
                    twice.
                  </p>
                )}
                <button type="submit" disabled={busy}>
                  {pending ? 'Review pending payment' : 'Continue to demo payment →'}
                </button>
              </form>

            </section>

          </div>
          <section className="credit-packages" aria-labelledby="packages-title">
            <div className="package-heading">
              <div>
                <span className="eyebrow">PICK YOUR PACE</span>
                <h2 id="packages-title">A little credit for every kind of trip.</h2>
              </div>
              <span className="wallet-tag">Wallet credit packages</span>
            </div>
            <p>
              Fixed amounts of simulated wallet credit. These packages do not include
              bookings, eSIMs, or cash collection.
            </p>
            <div className="package-grid">
              {creditPackages.map((pack, index) => (
                <article
                  key={pack.name}
                  className={'package-card ' + (index === 1 ? 'featured-package' : '')}
                >
                  <span className="package-number">
                    0{index + 1} /{' '}
                    {index === 0
                      ? 'SHORT ESCAPES'
                      : index === 1
                        ? 'NEW EXPERIENCES'
                        : 'LONGER ADVENTURES'}
                  </span>
                  <h3>{pack.name}</h3>
                  <p>{pack.description}</p>
                  <strong className="package-price">
                    {formatMoney(pack.amountMinor)}
                  </strong>
                  <ul>
                    <li>{pack.detail}</li>
                    <li>No demo fees or recurring charge</li>
                    <li>One simulated card payment</li>
                  </ul>
                  <button
                    type="button"
                    disabled={busy || Boolean(pending)}
                    onClick={() => reviewPayment(pack.amountMinor, pack.name)}
                  >
                    Choose {pack.name} →
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="wallet-panel wallet-history">
            <div className="wallet-history-heading">
              <div>
                <span className="eyebrow">YOUR ACTIVITY</span>
                <h2>Credits and spending, in one place.</h2>
              </div>
              <button className="wallet-secondary" onClick={refresh} disabled={busy}>
                Refresh activity
              </button>
            </div>
            {wallet.entries.length === 0 ? (
              <p className="wallet-empty">
                No transactions yet. Add demo funds to see your first entry here.
              </p>
            ) : (
              <>
                <p>
                  Showing the latest {wallet.entries.length} of {wallet.entryCount}{' '}
                  transactions.
                </p>
                <ul>
                  {wallet.entries.map((entry) => (
                    <li key={entry.id}>
                      <div>
                        <strong>
                          {entry.kind === 'demo_topup'
                            ? 'Demo top-up'
                            : entry.kind === 'cash_purchase'
                              ? 'Cash package purchase'
                              : entry.kind === 'cash_to_wallet'
                                ? 'Gift code to wallet'
                                : 'Travel support (demo)'}
                        </strong>
                        <small>{new Date(entry.createdAt).toLocaleString('en-GB')}</small>
                        <small>Reference: {entry.id.slice(0, 8)}</small>
                      </div>
                      <div
                        className={
                          entry.amountMinor < 0 ? 'wallet-debit' : 'wallet-credit'
                        }
                      >
                        <strong>
                          {entry.amountMinor > 0 ? '+' : ''}
                          {formatMoney(entry.amountMinor)}
                        </strong>
                        <small>Confirmed · simulated</small>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

        </>
      )}
      <dialog
        ref={dialogRef}
        className="demo-checkout"
        aria-labelledby="checkout-title"
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setCheckout(null);
        }}
      >
        {checkout && (
          <>
            <header className="checkout-heading">
              <div>
                <span className="eyebrow">SIMULATION ONLY</span>
                <h2 id="checkout-title">Review your demo payment</h2>
              </div>
              <button
                type="button"
                className="checkout-close wallet-secondary"
                aria-label="Close checkout"
                disabled={busy}
                onClick={() => setCheckout(null)}
              >
                ×
              </button>
            </header>

            <p>
              No card will be charged. Use the preset test card below; do not enter real
              payment details.
            </p>
            <section className="order-summary" aria-label="Order summary">
              <strong>{checkout.label}</strong>
              <dl>
                <div>
                  <dt>Simulated wallet credit</dt>
                  <dd>{formatMoney(checkout.amountMinor)}</dd>
                </div>
                <div>
                  <dt>Demo fee</dt>
                  <dd>€0.00</dd>
                </div>
                <div className="order-total">
                  <dt>Demo payment total</dt>
                  <dd>{formatMoney(checkout.amountMinor)}</dd>
                </div>
              </dl>
            </section>

            <div className="test-payment-card">
              <span className="visa-wordmark">VISA</span>
              <div>
                <strong>Preset test payment card · 4242</strong>
                <small>Simulation method — separate from your wallet card</small>
              </div>
            </div>
            <label htmlFor="payment-outcome">Choose a test outcome</label>
            <select
              id="payment-outcome"
              value={testOutcome}
              disabled={busy || Boolean(pending)}
              onChange={(event) => {
                setTestOutcome(event.target.value);
                setCheckoutError('');
              }}
            >
              <option value="approve">Successful demo payment</option>
              <option value="decline">Declined demo payment</option>
            </select>
            {pending && (
              <p className="pending-note">
                An operation is awaiting confirmation. Retrying checks the same payment
                and does not create a second credit.
              </p>
            )}
            {checkoutError && (
              <p className="wallet-error" role="alert">
                {checkoutError}
              </p>
            )}
            <button
              className="confirm-payment"
              type="button"
              disabled={busy}
              onClick={() => void addFunds()}
            >
              {busy
                ? 'Confirming…'
                : pending
                  ? 'Retry same demo payment'
                  : `Pay ${formatMoney(checkout.amountMinor)} (demo)`}
            </button>
            <p className="checkout-footnote">
              A successful simulation credits your demo wallet. Packages appear as demo
              top-ups in your activity. Your trip budget stays unchanged.
            </p>
          </>
        )}
      </dialog>
      <footer className="wallet-bottom">
        Trip planner = future cost estimates. Demo wallet = simulated account balance.
        Open Travel funds to buy or redeem a cash package code.
      </footer>
    </main>
  );
}
