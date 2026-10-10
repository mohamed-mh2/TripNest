import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { addEstimates, loadServerBudget } from '../store/budgetSlice';
import { BudgetApiError, saveRemoteEstimates } from '../api/budget';
import {
  calculateBudget,
  formatMoney,
  parseAmount,
  type Expense,
} from '../features/budget/model';
import {
  estimateTrip,
  exampleRanges,
  type CostRange,
  type EstimateResult,
  type Itinerary,
} from '../features/assistant/estimate';
import './CostAssistant.css';

type Props = { open: boolean; onClose: () => void };
type DraftRange = Omit<CostRange, 'low' | 'likely' | 'high'> & {
  low: string;
  likely: string;
  high: string;
};
const toDraft = (ranges: CostRange[]): DraftRange[] =>
  ranges.map((r) => ({
    ...r,
    low: String(r.low / 100),
    likely: String(r.likely / 100),
    high: String(r.high / 100),
  }));

export default function CostAssistant({ open, onClose }: Props) {
  const budget = useAppSelector((s) => s.budget);
  const source = useAppSelector((s) => s.financeUi.budgetSource);
  const dispatch = useAppDispatch();
  const dialog = useRef<HTMLDialogElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const lock = useRef(false);
  const [step, setStep] = useState(1);
  const [trip, setTrip] = useState({
    destination: 'Barcelona',
    days: '7',
    nights: '6',
    travelers: '1',
    rooms: '1',
  });
  const [ranges, setRanges] = useState<DraftRange[]>(() =>
    toDraft(exampleRanges(budget)),
  );
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const [pending, setPending] = useState<Expense[] | null>(null);
  const baseline = useRef({
    budget: JSON.stringify(budget),
    source,
    total: 0,
    count: 0,
    target: budget.budgetInCents,
  });

  useEffect(() => {
    if (open && !dialog.current?.open) {
      // #explain_notes: Reopening after a changed plan must not show an old forecast.
      if (
        result &&
        !pending &&
        (baseline.current.budget !== JSON.stringify(budget) ||
          baseline.current.source !== source)
      ) {
        setResult(null);
        setStep(1);
        setApplied(false);
        setError('');
        setMessage('Your plan changed. Build a fresh forecast using your latest costs.');
        setRanges(toDraft(exampleRanges(budget)));
      } else if (step === 1 && !result && !pending) {
        setRanges(toDraft(exampleRanges(budget)));
      }
      dialog.current?.showModal();
    }
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  // #explain_notes: Each step starts at its heading, including for keyboard users.
  useEffect(() => {
    if (!open) return;
    stepHeading.current?.focus({ preventScroll: true });
    if (dialog.current) dialog.current.scrollTop = 0;
  }, [step, open]);

  function itinerary(): Itinerary {
    return {
      ...trip,
      days: Number(trip.days),
      nights: Number(trip.nights),
      travelers: Number(trip.travelers),
      rooms: Number(trip.rooms),
    };
  }

  function updateRange(id: string, field: 'low' | 'likely' | 'high', value: string) {
    setRanges((current) =>
      current.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  }

  function generate() {
    setError('');
    setMessage('');
    try {
      const inputs = ranges.map((r) => {
        const low = parseAmount(r.low),
          likely = parseAmount(r.likely),
          high = parseAmount(r.high);
        if (r.include && (low === null || likely === null || high === null))
          throw new Error(
            `${r.label}: enter valid amounts with up to two decimal places.`,
          );
        return { ...r, low: low ?? 0, likely: likely ?? 0, high: high ?? 0 };
      });
      const next = estimateTrip(itinerary(), inputs, budget);
      baseline.current = {
        budget: JSON.stringify(budget),
        source,
        total: calculateBudget(budget).estimatedInCents,
        count: budget.expenses.length,
        target: budget.budgetInCents,
      };
      setResult(next);
      setPending(null);
      setApplied(false);
      setStep(3);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function restart() {
    if (busy || pending) return;
    setResult(null);
    setStep(1);
    setRanges(toDraft(exampleRanges(budget)));
    setError('');
    setMessage('');
    setApplied(false);
  }

  // #explain_notes: Only the proposed extra costs are added. Saved bookings, expenses and reserve stay counted once.

  async function apply() {
    if (!result || applied || lock.current) return;
    if (baseline.current.source !== source) {
      setError(
        pending
          ? 'Return to the original plan before retrying these costs.'
          : 'Your plan changed. Start a new estimate to use the latest costs.',
      );
      return;
    }
    if (!pending && baseline.current.budget !== JSON.stringify(budget)) {
      setError('Your plan changed. Start a new estimate to use the latest costs.');
      return;
    }
    const expenses =
      pending ?? result.rows.map((row) => ({ ...row, id: crypto.randomUUID() }));
    if (!expenses.length) {
      setError('There are no additional costs to add.');
      return;
    }
    if (budget.expenses.length + expenses.length > 1000) {
      setError('Your plan supports at most 1,000 expenses.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    setPending(expenses);
    try {
      if (source === 'database')
        dispatch(
          loadServerBudget(
            await saveRemoteEstimates(
              expenses,
              baseline.current.total,
              baseline.current.count,
            ),
          ),
        );
      else dispatch(addEstimates(expenses));
      setApplied(true);
      setPending(null);
      setMessage(
        'Expected costs added to your ' +
          (source === 'database' ? 'saved trip.' : 'browser practice plan.'),
      );
    } catch (e) {
      if (e instanceof BudgetApiError && e.status >= 400 && e.status < 500) {
        setPending(null);
        setError(e.message + ' Refresh your plan and start another estimate.');
      } else
        setError((e as Error).message + ' Retry this same estimate to check its result.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="cost-assistant"
      aria-labelledby="assistant-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
      onClose={onClose}
    >
      <header className="assistant-heading">
        <div>
          <span className="assistant-label">✦ TRIPNEST ASSISTANT</span>
          <h2 id="assistant-title">Make room for the unexpected.</h2>
          <p>A guided cost estimate for your next adventure.</p>
        </div>
        <button
          className="assistant-close"
          disabled={busy}
          onClick={onClose}
          aria-label="Close cost assistant"
        >
          ×
        </button>
      </header>

      <ol className="assistant-progress" aria-label="Estimate progress">
        {['Your trip', 'Cost ranges', 'Your forecast'].map((label, i) => (
          <li key={label} aria-current={step === i + 1 ? 'step' : undefined}>
            <span>{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <div className="assistant-body">
        {step === 1 && (
          <section>
            <h3 ref={stepHeading} tabIndex={-1}>
              Where are you heading?
            </h3>
            <p>
              Start with the basics. You can change every example amount in the next step.
            </p>
            <label>
              Destination
              <input
                maxLength={80}
                value={trip.destination}
                onChange={(e) => setTrip({ ...trip, destination: e.target.value })}
              />
            </label>
            <div className="assistant-form-grid">
              {(['days', 'nights', 'travelers', 'rooms'] as const).map((key) => (
                <label key={key}>
                  {
                    {
                      days: 'Trip days',
                      nights: 'Hotel nights',
                      travelers: 'Travelers',
                      rooms: 'Hotel rooms',
                    }[key]
                  }
                  <input
                    type="number"
                    min={key === 'nights' ? 0 : 1}
                    max={key === 'days' || key === 'nights' ? 60 : 20}
                    step="1"
                    value={trip[key]}
                    onChange={(e) =>
                      setTrip({
                        ...trip,
                        [key]: e.target.value,
                        ...(key === 'days'
                          ? { nights: String(Math.max(0, Number(e.target.value) - 1)) }
                          : {}),
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <p className="assistant-note">
              Accommodation uses rooms × nights. Food and local transport use travelers ×
              days. All amounts are in EUR.
            </p>
            <button
              className="assistant-primary"
              onClick={() => {
                try {
                  estimateTrip(itinerary(), [], budget);
                  setError('');
                  setStep(2);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Next: set cost ranges <span aria-hidden="true">→</span>
            </button>
          </section>
        )}

        {step === 2 && (
          <section>
            <h3 ref={stepHeading} tabIndex={-1}>
              Give your estimate a little flexibility.
            </h3>
            <p>
              These are illustrative inputs, not destination prices. Edit the low, most
              likely and high costs using your own quotes or expectations.
            </p>
            <div className="assistant-existing">
              <b>
                {formatMoney(calculateBudget(budget).estimatedInCents)} already in your
                plan
              </b>
              <span>
                Saved additional expenses + net bookings + safety buffer are included as
                fixed costs. Include only extra, uncovered costs below.
              </span>
            </div>
            <div className="assistant-cost-list">
              {ranges.map((r) => (
                <article key={r.id} className={r.include ? '' : 'is-excluded'}>
                  <label className="assistant-check">
                    <input
                      type="checkbox"
                      checked={r.include}
                      onChange={(e) =>
                        setRanges((current) =>
                          current.map((item) =>
                            item.id === r.id
                              ? { ...item, include: e.target.checked }
                              : item,
                          ),
                        )
                      }
                    />
                    <span>
                      <b>{r.label}</b>
                      <small>
                        {r.unit === 'room-night'
                          ? 'Per room / night'
                          : r.unit === 'person-day'
                            ? 'Per traveler / day'
                            : 'Per traveler / whole trip'}
                      </small>
                    </span>
                  </label>
                  {r.include && (
                    <div className="assistant-rate-grid">
                      {(['low', 'likely', 'high'] as const).map((field) => (
                        <label key={field}>
                          {
                            {
                              low: 'Low (€)',
                              likely: 'Most likely (€)',
                              high: 'High (€)',
                            }[field]
                          }
                          <input
                            aria-label={r.label + ' ' + field + ' EUR'}
                            type="number"
                            min="0"
                            step="0.01"
                            value={r[field]}
                            onChange={(e) => updateRange(r.id, field, e.target.value)}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
            <p className="assistant-note">
              Categories already in your plan start unchecked. When bookings exist, return
              travel and accommodation also start unchecked; check them only for
              additional costs.
            </p>
            <div className="assistant-actions">
              <button className="assistant-secondary" onClick={() => setStep(1)}>
                ← Back
              </button>
              <button className="assistant-primary" onClick={generate}>
                Build my forecast ✦
              </button>
            </div>
          </section>
        )}

        {step === 3 && result && (
          <section>
            <div className="forecast-intro">
              <span className="assistant-label">
                YOUR {trip.destination.toUpperCase()} FORECAST
              </span>
              <h3 ref={stepHeading} tabIndex={-1}>
                A clearer picture of your trip.
              </h3>
              <p>
                {trip.travelers} traveler(s) · {trip.days} days · {trip.nights} nights
              </p>
            </div>
            <div className="forecast-total">
              <small>Expected total · includes your saved plan</small>
              <strong>{formatMoney(result.expected)}</strong>
              <span>
                {result.hasUncertainty ? (
                  <>
                    80% modeled range:{' '}
                    <b>
                      {formatMoney(result.p10)} – {formatMoney(result.p90)}
                    </b>
                  </>
                ) : (
                  'Fixed estimate · No variable costs selected'
                )}
              </span>
            </div>
            <div className="forecast-metrics">
              <div>
                <span>Within your {formatMoney(baseline.current.target)} target</span>
                <b>
                  {result.hasUncertainty
                    ? result.chanceWithinBudget + '%'
                    : result.expected <= baseline.current.target
                      ? 'Within target'
                      : 'Over target'}
                </b>
                <small>
                  {result.hasUncertainty
                    ? 'of simulated scenarios'
                    : 'Based on your fixed estimates, not a probability'}
                </small>
              </div>
              <div>
                <span>
                  {result.hasUncertainty ? 'Higher-cost scenario' : 'Fixed estimate'}
                </span>
                <b>{formatMoney(result.p90)}</b>
                <small>
                  {result.hasUncertainty
                    ? '90th percentile · 10% of scenarios cost more'
                    : 'Add an extra cost range to explore uncertainty'}
                </small>
              </div>
            </div>
            {result.hasUncertainty && (
              <>
                <div
                  className="forecast-chart"
                  role="img"
                  aria-label={`Distribution from ${formatMoney(result.histogram[0].from)} to ${formatMoney(result.histogram[11].to)}. Median ${formatMoney(result.p50)}.`}
                >
                  {result.histogram.map((bin, i) => (
                    <span
                      key={i}
                      style={{
                        height:
                          (bin.count /
                            Math.max(...result.histogram.map((b) => b.count))) *
                            100 +
                          '%',
                      }}
                      title={`${formatMoney(bin.from)}–${formatMoney(bin.to)}: ${bin.count} scenarios`}
                    />
                  ))}
                </div>
                <div className="forecast-chart-labels">
                  <span>Lower cost</span>
                  <span>Higher cost</span>
                </div>
              </>
            )}
            <ul className="forecast-breakdown">
              <li>
                <span>Existing plan (fixed)</span>
                <b>{formatMoney(result.fixed)}</b>
              </li>
              {result.rows.map((row) => (
                <li key={row.category}>
                  <span>{row.category} · expected extra cost</span>
                  <b>{formatMoney(row.amountInCents)}</b>
                </li>
              ))}
            </ul>
            <details className="assistant-method">
              <summary>How this forecast works</summary>
              <p>
                We simulate {result.simulations.toLocaleString('en')} scenarios using
                independent triangular distributions based on your low, most likely and
                high inputs. The expected cost uses the average of those three values. The
                range shows the 10th to 90th percentiles, not a guarantee. Real costs can
                fall outside your inputs; season, exchange rates and correlated price
                changes are not modeled. No live prices or AI service are connected.
              </p>
            </details>
            <p className="assistant-note">
              Adding uses expected extra costs only. Your spending limit and safety buffer
              stay as you set them. Destination is a label; your inputs determine prices.
            </p>
            <div className="assistant-actions">
              {!applied && (
                <button
                  className="assistant-secondary"
                  disabled={busy || !!pending}
                  onClick={() => {
                    setError('');
                    setMessage('');
                    setStep(2);
                  }}
                >
                  Edit cost ranges
                </button>
              )}
              <button
                className="assistant-secondary"
                disabled={busy || !!pending}
                onClick={restart}
              >
                Start another estimate
              </button>
              <button
                className="assistant-primary"
                disabled={busy || applied || !result.rows.length}
                onClick={apply}
              >
                {busy
                  ? 'Saving…'
                  : applied
                    ? '✓ Added to planner'
                    : pending
                      ? 'Retry adding these costs'
                      : 'Add expected costs to planner →'}
              </button>
            </div>
            <p className="assistant-save-location">
              Saving to:{' '}
              {source === 'database'
                ? 'your connected trip in PostgreSQL'
                : 'this browser’s practice plan'}
            </p>
          </section>
        )}
        {error && (
          <p role="alert" className="assistant-error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="assistant-success">
            {message}
          </p>
        )}
      </div>
    </dialog>
  );
}
