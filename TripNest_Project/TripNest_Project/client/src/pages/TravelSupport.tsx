import { useFamilySupport } from '../features/family/useFamilySupport';
import type { FinanceRole } from '../api/financeSession';
import { formatMoney } from '../features/budget/model';
import './FamilySupport.css';

export default function TravelSupport({ visible }: { visible: boolean }) {
  const {
    dialog,
    role,
    setRole,
    active,
    requests,
    amount,
    setAmount,
    link,
    input,
    setInput,
    preview,
    setPreview,
    receipt,
    setReceipt,
    pending,
    busy,
    message,
    error,
    outcome,
    setOutcome,
    connect,
    create,
    inspect,
    pay,
    cancel,
    share,
    run,
    refresh,
    setMessage,
    setError,
  } = useFamilySupport(visible);

  return (
    <section className="family-page funds-content">
      <section className="family-identity">
        <div>
          <h2>Choose your demo identity</h2>
          <p>
            Traveler creates a request → shares the link → Supporter reviews and confirms
            → Traveler refreshes the wallet.
          </p>
        </div>
        <label>
          Local demo identity
          <select
            disabled={busy}
            value={role}
            onChange={(e) => setRole(e.target.value as FinanceRole)}
          >
            <option value="traveler">Traveler</option>
            <option value="family">Supporter</option>
          </select>
        </label>
        <button disabled={busy} onClick={connect}>
          Connect as {role === 'family' ? 'supporter' : 'traveler'}
        </button>
      </section>

      <div aria-live="polite">
        {message && <p className="family-success">{message}</p>}
        {error && (
          <p className="family-error" role="alert">
            {error}
          </p>
        )}
      </div>

      {active && (
        <>
          <p className="family-connected">
            Connected: <b>{active === 'family' ? 'Supporter' : 'Traveler'}</b> · EUR ·
            Requests expire after 24 hours
          </p>
          {pending && (
            <p className="family-success">
              Unfinished {pending.kind === 'pay' ? 'payment' : 'request creation'} saved.{' '}
              {pending.kind === 'pay' ? (
                <button disabled={busy} onClick={pay}>
                  Retry same demo payment
                </button>
              ) : (
                <button disabled={busy} onClick={create}>
                  Retry same request
                </button>
              )}
            </p>
          )}

          <div className="family-grid">
            <section className="family-panel">
              <span className="family-eyebrow">01 / ASK FOR A HELPING HAND</span>
              <h2>Request wallet credit</h2>
              <p>
                Choose 5 to 5,000 EUR. Your supporter will see your first name and
                requested amount.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void create();
                }}
              >
                <label>
                  Requested amount (EUR)
                  <input
                    required
                    type="number"
                    min="5"
                    max="5000"
                    step="0.01"
                    disabled={busy || !!pending}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <button disabled={busy || !!pending}>Create support request</button>
              </form>

            </section>

            <section className="family-panel">
              <span className="family-eyebrow">02 / HELP SOMEONE ON THEIR TRIP</span>
              <h2>Open a support link</h2>
              <p>Review the request before confirming a simulated card payment.</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void inspect();
                }}
              >
                <label>
                  Private link or token
                  <input
                    required
                    autoComplete="off"
                    disabled={busy || !!pending}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      setPreview(null);
                      setReceipt(null);
                    }}
                    placeholder="Paste the link shared with you"
                  />
                </label>
                <button disabled={busy || !!pending}>Review request</button>
              </form>
              {preview && (
                <div className="family-preview">
                  <h3>Support for {preview.recipientName}</h3>
                  <strong>{formatMoney(preview.amountMinor)}</strong>
                  <p>
                    Status: {preview.status} · Expires{' '}
                    {new Date(preview.expiresAt).toLocaleString('en')}
                  </p>
                  {preview.ownRequest && (
                    <p>
                      You cannot fund your own request. Connect as the other demo identity
                      to try the donor side.
                    </p>
                  )}
                  {preview.canPay && (
                    <button
                      disabled={busy || !!pending}
                      onClick={() => {
                        setOutcome('approve');
                        dialog.current?.showModal();
                      }}
                    >
                      Continue to demo payment
                    </button>
                  )}
                </div>
              )}
              {receipt && (
                <div className="family-preview">
                  <h3>Demo receipt</h3>
                  <strong>{formatMoney(receipt.amountMinor)}</strong>
                  <p>Confirmed · Reference {receipt.id.slice(0, 8)}</p>
                  <p>No real payment was made.</p>
                </div>
              )}
            </section>

          </div>

          {link && (
            <section className="family-share">
              <h2>Your private support link</h2>
              <label>
                Copy and share this link yourself
                <input readOnly value={link} onFocus={(e) => e.target.select()} />
              </label>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setMessage('Link copied. Share it privately with someone you trust.');
                  } catch {
                    setError('Select the link and copy it manually.');
                  }
                }}
              >
                Copy private link
              </button>
              <p>
                The link works only while the request is pending and unexpired. On another
                device, use the deployed website address; localhost links work on this
                computer.
              </p>
            </section>
          )}

          <section className="family-panel">
            <div className="family-list-heading">
              <div>
                <span className="family-eyebrow">03 / KEEP TRACK</span>
                <h2>My support requests</h2>
              </div>
              <button disabled={busy} onClick={() => run(refresh)}>
                Refresh requests & wallet
              </button>
            </div>
            {!requests.length ? (
              <p>No requests yet. Create one when you need a helping hand.</p>
            ) : (
              <ul className="family-list">
                {requests.map((r) => (
                  <li key={r.id}>
                    <div>
                      <strong>{formatMoney(r.amountMinor)}</strong>
                      <span className={'family-status status-' + r.status}>
                        {r.status === 'pending' && new Date(r.expiresAt) <= new Date()
                          ? 'expired'
                          : r.status}
                      </span>
                    </div>
                    <p>
                      Expires {new Date(r.expiresAt).toLocaleString('en')} · Ref{' '}
                      {r.id.slice(0, 8)}
                    </p>
                    {r.status === 'pending' && new Date(r.expiresAt) > new Date() && (
                      <div className="family-actions">
                        <button disabled={busy} onClick={() => share(r.id)}>
                          Get share link
                        </button>
                        <button
                          className="family-secondary"
                          disabled={busy}
                          onClick={() => cancel(r.id)}
                        >
                          Cancel unpaid request
                        </button>
                      </div>
                    )}
                    {r.status === 'paid' && (
                      <small>
                        Demo credit added to your wallet. Refresh Demo wallet to view the
                        activity.
                      </small>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

        </>
      )}

      <dialog
        ref={dialog}
        className="family-checkout"
        aria-labelledby="support-checkout-title"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <h2 id="support-checkout-title">Review demo support</h2>
        <p>
          Recipient: <b>{preview?.recipientName}</b>
        </p>
        <p>
          Demo amount: <b>{formatMoney(preview?.amountMinor ?? 0)}</b>
        </p>
        <p>Saved Visa · test card ending 4242. No real card details are collected.</p>
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
        {error && (
          <p className="family-error" role="alert">
            {error}
          </p>
        )}
        <div className="family-actions">
          <button disabled={busy} onClick={pay}>
            {busy ? 'Processing…' : 'Confirm demo support'}
          </button>
          <button
            className="family-secondary"
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
