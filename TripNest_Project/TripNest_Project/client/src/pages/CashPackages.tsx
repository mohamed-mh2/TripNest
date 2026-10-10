import { useCashPackages } from '../features/cash/useCashPackages';
import type { FinanceRole as Role } from '../api/financeSession';
import { formatMoney as money } from '../features/budget/model';
import './CashPackages.css';
import { useEffect, useRef } from 'react';

export default function CashPackages({ visible }: { visible: boolean }) {
  const {
    dialog,
    role,
    setRole,
    active,
    catalog,
    vouchers,
    wallet,
    busy,
    message,
    error,
    selected,
    method,
    setMethod,
    outcome,
    setOutcome,
    pending,
    code,
    setCode,
    mode,
    purchase,
    focusedVoucher,
    setFocusedVoucher,
    setMode,
    connect,
    open,
    buy,
    redeem,
    collect,
    setMessage,
    setError,
  } = useCashPackages(visible);
  const receipt = useRef<HTMLElement>(null);
  useEffect(() => {
    if (purchase)
      receipt.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [purchase]);

  useEffect(() => {
    if (!focusedVoucher) return;
    const card = document.getElementById('cash-voucher-' + focusedVoucher);
    if (card) {
      card.focus({ preventScroll: true });
      card.scrollIntoView({ block: 'center', behavior: 'instant' });
      setFocusedVoucher(null);
    }
  }, [focusedVoucher, vouchers]);

  return (
    <section className="cash-page funds-content">
      {/* #explain_notes: Introduction and a clear simulation label. */}
      <section className="cash-steps" aria-label="How it works">
        <p>
          <b>01 / Choose</b>A €50, €100 or €250 cash package.
        </p>
        <p>
          <b>02 / Pay or gift</b>Use the saved test card or demo wallet. Share the code
          yourself.
        </p>
        <p>
          <b>03 / Receive</b>Redeem for wallet credit OR simulated local cash.
        </p>
      </section>

      {/* #explain_notes: Switch between the supporter buying a gift and the traveler receiving it. */}
      <section className="cash-connect">
        <div>
          <h2>Choose your demo identity</h2>
          <p>
            Use Supporter to buy a gift, copy its code, then connect as Traveler to redeem
            it.
          </p>
        </div>
        <label>
          Local demo identity
          <select
            value={role}
            disabled={busy}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option value="traveler">Traveler</option>
            <option value="family">Supporter</option>
          </select>
        </label>
        <button disabled={busy} onClick={connect}>
          {busy
            ? 'Please wait…'
            : 'Connect as ' + (role === 'family' ? 'supporter' : 'traveler')}
        </button>
      </section>

      <div aria-live="polite">
        {message && <p className="cash-success">{message}</p>}
        {error && !dialog.current?.open && (
          <p role="alert" className="cash-error">
            {error}
          </p>
        )}
      </div>
      {active && catalog && (
        <>
          {purchase?.code && (
            <section
              ref={receipt}
              className="cash-receipt"
              role="status"
              aria-label="Package ready"
            >
              <span className="cash-eyebrow">YOUR PACKAGE IS READY</span>
              <h2>{money(purchase.amountMinor)} for your next step</h2>
              <p>
                Use this package yourself now, or copy its code from My packages to send
                it privately.
              </p>
              <div className="cash-actions">
                <button disabled={busy} onClick={() => redeem(purchase.code!, 'cash')}>
                  Use for cash pickup
                </button>
                <button
                  disabled={busy}
                  className="cash-secondary"
                  onClick={() => redeem(purchase.code!, 'wallet')}
                >
                  Add to my wallet
                </button>
              </div>
            </section>
          )}
          <div className="cash-section-heading">
            <div>
              <span className="cash-eyebrow">
                {catalog.destination} · EUR · DEMO CATALOG
              </span>
              <h2>Cash when you need it</h2>
            </div>
            <p>
              Connected: <b>{active === 'family' ? 'Supporter' : 'Traveler'}</b>
              <br />
              Demo wallet: <b>{money(wallet?.balanceMinor ?? 0)}</b>
            </p>
          </div>
          <p>
            One code, one use. Redeem or collect within 7 days. Demo price equals package
            value; no demo fee. A real pickup provider is not connected.
          </p>
          {pending && (
            <p className="cash-success">
              A purchase needs its result checked.{' '}
              <button
                disabled={busy}
                onClick={() =>
                  open(catalog.packages.find((p) => p.id === pending.packageId)!)
                }
              >
                Resume purchase
              </button>
            </p>
          )}
          <section className="cash-grid">
            {catalog.packages.map((p, i) => (
              <article
                key={p.id}
                className={'cash-package ' + (i === 1 ? 'cash-featured' : '')}
              >
                <span>{i === 1 ? 'TRAVEL BACKUP' : 'LOCAL CASH PACKAGE'}</span>
                <h3>{p.name}</h3>
                <strong>{money(p.amountMinor)}</strong>
                <p>{p.description}</p>
                <ul>
                  <li>Use yourself or share the code</li>
                  <li>Choose cash pickup or wallet credit</li>
                  <li>Single use · valid for 7 days</li>
                </ul>
                <button disabled={busy || !!pending} onClick={() => open(p)}>
                  Buy demo package
                </button>
              </article>
            ))}
          </section>

          <section className="cash-redeem">
            <div>
              <span className="cash-eyebrow">SOMEONE HAS YOUR BACK</span>
              <h2>Have a code from someone you trust?</h2>
              <p>
                Enter the code they shared. Your choice is final once redeemed: the same
                code cannot provide both cash and wallet credit.
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void redeem();
              }}
            >
              <label>
                Package code
                <input
                  required
                  value={code}
                  placeholder="TN-…"
                  autoComplete="off"
                  disabled={busy}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <label>
                How would you like to receive it?
                <select
                  value={mode}
                  disabled={busy}
                  onChange={(e) => setMode(e.target.value as 'cash' | 'wallet')}
                >
                  <option value="cash">Reserve demo cash pickup</option>
                  <option value="wallet">Add credit to my demo wallet</option>
                </select>
              </label>
              <button disabled={busy || !code.trim()}>Redeem code</button>
              {error && <p className="cash-error">{error}</p>}
            </form>

          </section>

          <section>
            <h2>My packages</h2>
            {!vouchers.length && (
              <p>No packages yet. Buy one or redeem a code to get started.</p>
            )}
            <div className="cash-history">
              {vouchers.map((v) => (
                <article key={v.id} id={'cash-voucher-' + v.id} tabIndex={-1}>
                  <div>
                    <strong>{money(v.amountMinor)}</strong>
                    <span className="cash-status">
                      {new Date(v.expiresAt) < new Date() &&
                      ['ready', 'pickup_reserved'].includes(v.status)
                        ? 'Expired'
                        : {
                            ready: 'Ready to use',
                            pickup_reserved: 'Cash ready to collect',
                            collected: 'Cash collected',
                            wallet_credited: 'Added to wallet',
                          }[v.status]}
                    </span>
                  </div>
                  <p>
                    {v.purchasedByYou
                      ? 'Purchased by you'
                      : 'Received from a shared code'}{' '}
                    ·{' '}
                    {v.paymentMethod === 'wallet'
                      ? 'Demo wallet payment'
                      : 'Saved test card payment'}
                  </p>
                  <small>
                    Expires {new Date(v.expiresAt).toLocaleString('en')} · Ref{' '}
                    {v.id.slice(0, 8)}
                  </small>
                  {v.code && new Date(v.expiresAt) > new Date() && (
                    <div className="cash-code">
                      <code>{v.code}</code>
                      <button
                        disabled={busy}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(v.code!);
                            setMessage(
                              'Code copied. Share it privately with the recipient.',
                            );
                          } catch {
                            setError(
                              'Copy unavailable. Select and copy the code manually.',
                            );
                          }
                        }}
                      >
                        Copy code
                      </button>
                      <small>Anyone with this code can redeem it. Share privately.</small>
                      <div className="cash-actions">
                        <button disabled={busy} onClick={() => redeem(v.code!, 'cash')}>
                          Use for cash pickup
                        </button>
                        <button
                          disabled={busy}
                          className="cash-secondary"
                          onClick={() => redeem(v.code!, 'wallet')}
                        >
                          Add to my wallet
                        </button>
                      </div>
                    </div>
                  )}
                  {v.canCollect && new Date(v.expiresAt) > new Date() && (
                    <div>
                      <p>
                        {catalog.pickup} · {catalog.destination}
                      </p>
                      <button disabled={busy} onClick={() => collect(v.id)}>
                        Simulate cash collection
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>

        </>
      )}
      <dialog
        ref={dialog}
        className="cash-checkout"
        aria-labelledby="cash-checkout-title"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <h2 id="cash-checkout-title">Demo checkout</h2>
        <p>
          {selected?.name} · <b>{money(selected?.amountMinor ?? 0)}</b>
        </p>
        <p>No real card details are needed. This payment is simulated.</p>
        <label>
          Pay with
          <select
            disabled={busy || !!pending}
            value={method}
            onChange={(e) => setMethod(e.target.value as 'demo_card' | 'wallet')}
          >
            <option value="demo_card">Saved Visa · test card ending 4242</option>
            <option value="wallet">
              Demo wallet · {money(wallet?.balanceMinor ?? 0)}
            </option>
          </select>
        </label>
        {method === 'demo_card' && (
          <label>
            Test payment result
            <select
              disabled={busy || !!pending}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as 'approve' | 'decline')}
            >
              <option value="approve">Approved</option>
              <option value="decline">Declined</option>
            </select>
          </label>
        )}
        {error && (
          <p role="alert" className="cash-error">
            {error}
          </p>
        )}
        <div className="cash-actions">
          <button disabled={busy} onClick={buy}>
            {busy
              ? 'Processing…'
              : pending
                ? 'Retry same purchase'
                : 'Confirm demo purchase'}
          </button>
          <button
            className="cash-secondary"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            Close
          </button>
        </div>
      </dialog>
    </section>
  );
}
