import { useEffect, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { useAppDispatch, useAppSelector } from '../store';
import {
  loadServerBudget,
  addExpense,
  updateExpense,
  removeExpense,
  updatePlan,
  storageKey,
  storageNotice,
} from '../store/budgetSlice';
import {
  calculateBudget,
  decodeBudget,
  emptyBudget,
  categories,
  formatMoney,
  parseAmount,
  type Category,
  type Expense,
} from '../features/budget/model';
import './Budget.css';
import { setBudgetSource } from '../store/financeUiSlice';
import {
  connectLocalBudget,
  saveRemotePlan,
  saveRemoteExpense,
  deleteRemoteExpense,
} from '../api/budget';

// Mohamed mhamed: budget workspace. Redux holds saved values; local state holds form drafts.

export default function Budget({ onOpenAssistant }: { onOpenAssistant: () => void }) {
  const budget = useAppSelector((state) => state.budget);
  const dispatch = useAppDispatch();
  const totals = calculateBudget(budget);
  const [budgetInput, setBudgetInput] = useState(String(budget.budgetInCents / 100));
  const [reserveInput, setReserveInput] = useState(String(budget.reserveInCents / 100));
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('Other');
  const [coveredBooking, setCoveredBooking] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [planError, setPlanError] = useState('');
  const [expenseError, setExpenseError] = useState('');
  const [message, setMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const remoteMode = useAppSelector(
    (state) => state.financeUi.budgetSource === 'database',
  );
  const bookingRevision = useAppSelector((state) => state.bookings.planRevision);
  useEffect(() => {
    if (remoteMode && bookingRevision > 0) void sync(connectLocalBudget);
  }, [remoteMode, bookingRevision]);

  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  // #explain_notes: Remember which plan the customer opened, without copying either plan over the other.
  useEffect(() => {
    try {
      if (localStorage.getItem('tripnest.plan-source') === 'database')
        void connectDatabase();
    } catch {
      /* Browser practice remains available when storage is blocked. */
    }
  }, []);

  // #explain_notes: Browser practice data is saved separately from the database-backed plan.
  useEffect(() => {
    if (remoteMode) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, ...budget }));
      setSaveError('');
    } catch {
      setSaveError(
        'Could not save in this browser. Keep this tab open to retain your changes.',
      );
    }
  }, [budget, remoteMode]);

  const breakdown = [
    ...categories
      .map((item) => ({
        category: item,
        total: budget.expenses
          .filter((expense) => expense.category === item && !expense.coveredByBookingId)
          .reduce((sum, expense) => sum + expense.amountInCents, 0),
      }))
      .filter((item) => item.total > 0),
    ...((budget.bookedNetInCents ?? 0) > 0
      ? [{ category: 'Net bookings', total: budget.bookedNetInCents ?? 0 }]
      : []),
    ...(budget.reserveInCents > 0
      ? [{ category: 'Safety buffer', total: budget.reserveInCents }]
      : []),
  ];

  async function savePlan() {
    const budgetInCents = parseAmount(budgetInput);
    const reserveInCents = parseAmount(reserveInput);
    if (budgetInCents === null || reserveInCents === null) {
      setPlanError('Use amounts from 0 to 1,000,000 EUR with up to 2 decimal places.');
      return;
    }
    if (remoteMode) {
      if (!(await sync(() => saveRemotePlan(budgetInCents, reserveInCents)))) return;
    } else dispatch(updatePlan({ budgetInCents, reserveInCents }));
    setPlanError('');
    setMessage('Your estimates are saved. No money has been moved.');
  }

  function clearForm() {
    setName('');
    setAmount('');
    setCategory('Other');
    setCoveredBooking('');
    setEditingId(null);
    setExpenseError('');
  }

  // #explain_notes: Save a planned cost; this does not spend money from the wallet.

  async function saveExpense() {
    const cents = parseAmount(amount);
    if (!name.trim() || name.trim().length > 80 || cents === null || cents === 0) {
      setExpenseError(
        'Enter a name (1–80 characters) and a positive amount up to 1,000,000 EUR with up to 2 decimal places.',
      );
      return;
    }
    if (!editingId && budget.expenses.length >= 1000) {
      setExpenseError('This practice budget supports up to 1,000 expenses.');
      return;
    }
    const expense: Expense = {
      id: editingId ?? crypto.randomUUID(),
      name: name.trim(),
      amountInCents: cents,
      category,
      coveredByBookingId: coveredBooking || null,
    };
    if (remoteMode) {
      if (!(await sync(() => saveRemoteExpense(expense, Boolean(editingId))))) return;
    } else dispatch(editingId ? updateExpense(expense) : addExpense(expense));
    setMessage(editingId ? 'Expense updated.' : 'Expense added.');
    clearForm();
    nameRef.current?.focus();
  }

  async function sync(operation: () => Promise<typeof budget>) {
    setBusy(true);
    setApiError('');
    try {
      dispatch(loadServerBudget(await operation()));
      return true;
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : 'Connection failed. Please retry.',
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  // #explain_notes: Connect the local demo session and load its saved trip budget.

  async function connectDatabase() {
    setBusy(true);
    setApiError('');
    try {
      const saved = await connectLocalBudget();
      dispatch(setBudgetSource('database'));
      dispatch(loadServerBudget(saved));
      setBudgetInput(String(saved.budgetInCents / 100));
      setReserveInput(String(saved.reserveInCents / 100));
      clearForm();
      setDeleteId(null);
      setSaveError('');
      try {
        localStorage.setItem('tripnest.plan-source', 'database');
      } catch {
        /* Saving the trip still succeeded. */
      }
      setMessage(
        'Your saved demo trip is ready. Your browser practice plan is kept separately.',
      );
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Connection failed.');
    } finally {
      setBusy(false);
    }
  }

  function openPractice() {
    let saved = emptyBudget;
    try {
      saved = decodeBudget(localStorage.getItem(storageKey) ?? '') ?? emptyBudget;
      localStorage.setItem('tripnest.plan-source', 'practice');
    } catch {
      /* Start an in-memory practice plan if browser storage is unavailable. */
    }
    dispatch(setBudgetSource('practice'));
    dispatch(loadServerBudget(saved));
    setBudgetInput(String(saved.budgetInCents / 100));
    setReserveInput(String(saved.reserveInCents / 100));
    clearForm();
    setDeleteId(null);
    setApiError('');
    setMessage('Browser practice plan opened. Your saved trip stays separate.');
  }

  async function deleteExpense(id: string) {
    if (remoteMode) {
      if (!(await sync(() => deleteRemoteExpense(id)))) return;
    } else dispatch(removeExpense(id));
    setDeleteId(null);
    if (editingId === id) clearForm();
    setMessage('Expense deleted.');
  }

  function startEdit(expense: Expense) {
    setEditingId(expense.id);
    setCoveredBooking(expense.coveredByBookingId ?? '');
    setName(expense.name);
    setAmount(String(expense.amountInCents / 100));
    setCategory(expense.category);
    setExpenseError('');
    setDeleteId(null);
    nameRef.current?.focus();
  }

  return (
    <main className="budget-page" lang="en" dir="ltr">
      <header className="planner-nav">
        <a className="planner-logo" href="#">
          Trip<span>Nest</span>
          <span className="logo-dot">✦</span>
        </a>
        <span className="nav-section">PLAN YOUR NEXT CHAPTER</span>
        <span className="nav-tag">Trip cost planner</span>
      </header>

      <section className="travel-hero" aria-labelledby="planner-title">
        <div className="hero-copy">
          <span className="eyebrow">DREAM IT. PLAN IT. GO.</span>
          <h1 id="planner-title">
            Your next adventure,
            <br />
            <em>thoughtfully planned.</em>
          </h1>
          <p>
            Work out what your future trip could cost. Explore your options, estimate
            expenses, and build a plan that feels right for you.
          </p>
          <a className="hero-cta" href="#plan-settings">
            Plan my trip costs <span aria-hidden="true">↗</span>
          </a>
          <span className="hero-footnote">
            Future trip estimates · All amounts in EUR
          </span>
        </div>
        <div className="hero-photo">
          <img
            src="/images/travel-planner-hero.png"
            alt="Sunlit Mediterranean coastal town and turquoise sea, with a travel notebook on a terrace"
            width="1536"
            height="1024"
            fetchPriority="high"
          />
          <div className="photo-caption">
            <span>ROOM FOR A LITTLE WANDERLUST</span>
            <strong>Good trips start with a little planning.</strong>
          </div>
          <span className="photo-stamp" aria-hidden="true">
            YOUR NEXT
            <br />
            ADVENTURE ↗
          </span>
        </div>
      </section>

      <section className="assistant-invite">
        <div>
          <span className="eyebrow">A LITTLE HELP TO GET STARTED</span>
          <h2>What could your trip really cost?</h2>
          <p>
            Build an estimate for transport, stays, food and experiences. Explore a likely
            range before committing to a plan.
          </p>
        </div>
        <button onClick={onOpenAssistant} type="button">
          <span aria-hidden="true">✦</span> Open cost assistant{' '}
          <span aria-hidden="true">↗</span>
        </button>
      </section>

      <aside className="planning-banner">
        <span className="planning-symbol" aria-hidden="true">
          ◎
        </span>
        <div>
          <strong>A travel calculator, not a wallet.</strong>
          <p>
            These are estimates for a future trip. Your planned budget is a spending
            target, not deposited money. Saving or editing this plan never charges you or
            moves funds.
          </p>
        </div>
        <span className="planning-chip">Planning only</span>
      </aside>
      <div className="section-intro">
        <div>
          <span className="eyebrow">THE BIG PICTURE</span>
          <h2>Your estimated trip costs</h2>
        </div>
        <span className="local-note">
          {remoteMode
            ? 'Trip plan · Saved in PostgreSQL'
            : 'Practice plan · Saved on this browser'}
        </span>
      </div>
      <aside className="practice-note">
        {remoteMode ? (
          <>
            <span>
              Saved demo trip · Net booked costs:{' '}
              {formatMoney(budget.bookedNetInCents ?? 0)}. This is still a planning
              calculator.
            </span>
            <button type="button" disabled={busy} onClick={connectDatabase}>
              Refresh saved trip
            </button>
            <button
              type="button"
              disabled={busy}
              className="secondary"
              onClick={openPractice}
            >
              Switch to browser practice
            </button>
          </>
        ) : (
          <>
            <p>
              Practice stays in this browser. Open your saved demo trip to keep a separate
              plan in your demo account.
            </p>
            <button type="button" disabled={busy} onClick={connectDatabase}>
              Open saved demo trip
            </button>
          </>
        )}
      </aside>
      {busy && <p role="status">Saving or loading your trip…</p>}
      {apiError && (
        <p className="error" role="alert">
          {apiError}
        </p>
      )}
      {storageNotice && <p className="warning">{storageNotice}</p>}
      {saveError && (
        <p className="warning" role="alert">
          {saveError}
        </p>
      )}
      <p className="status" role="status">
        {message}
      </p>

      <section className="summary" aria-label="Budget summary">
        <article>
          <span>Planned spending limit</span>
          <strong>{formatMoney(budget.budgetInCents)}</strong>
        </article>
        <article>
          <span>Estimates + net bookings</span>
          <strong>
            {formatMoney(totals.expensesInCents + (budget.bookedNetInCents ?? 0))}
          </strong>
        </article>
        <article>
          <span>Planned safety buffer</span>
          <strong>{formatMoney(budget.reserveInCents)}</strong>
        </article>
        <article className={totals.remainingInCents < 0 ? 'over-budget' : 'remaining'}>
          <span>
            {totals.remainingInCents < 0
              ? 'Above your planned limit'
              : 'Room left in your plan'}
          </span>
          <strong>{formatMoney(Math.abs(totals.remainingInCents))}</strong>
        </article>
      </section>
      {totals.remainingInCents < 0 && (
        <p className="warning">
          Your estimated costs and safety buffer exceed your planned limit. Adjust your
          estimates or choose a higher spending target.
        </p>
      )}

      {remoteMode &&
        (budget.bookings ?? []).some((booking) => booking.status !== 'cancelled') &&
        budget.expenses.some((expense) => !expense.coveredByBookingId) && (
          <aside
            className="booking-plan-note"
            aria-label="Review estimates after booking"
          >
            <strong>Booked something you already estimated?</strong>
            <p>
              Review your estimates after each booking. Link a fully covered estimate to
              its confirmed booking so it is counted once. For a partially covered
              estimate, keep only the costs you still expect to pay.
            </p>
            <a href="#planned-expenses">Review planned expenses →</a>
          </aside>
        )}

      <div className="budget-grid" inert={busy}>
        <section className="panel" id="plan-settings">
          <span className="step-label">01 / YOUR TARGET</span>
          <h2>Set your spending plan</h2>
          <p>
            Choose what you would like to spend, including a little extra for unexpected
            costs.
          </p>
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              savePlan();
            }}
          >
            <label htmlFor="budget">Planned trip budget (EUR)</label>
            <input
              id="budget"
              type="number"
              min="0"
              max="1000000"
              step="0.01"
              value={budgetInput}
              onChange={(event) => setBudgetInput(event.target.value)}
            />
            <label htmlFor="reserve">Safety buffer (EUR)</label>
            <input
              id="reserve"
              type="number"
              min="0"
              max="1000000"
              step="0.01"
              value={reserveInput}
              onChange={(event) => setReserveInput(event.target.value)}
            />
            {planError && (
              <p className="error" role="alert">
                {planError}
              </p>
            )}
            <button type="submit">Save estimates</button>
          </form>
        </section>

        <section className="panel">
          <span className="step-label">02 / EXPECTED COSTS</span>
          <h2>{editingId ? 'Edit estimated expense' : 'What might you spend?'}</h2>
          <p>Add an estimate for food, transport, accommodation, or something fun.</p>
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              saveExpense();
            }}
          >
            <label htmlFor="expense-name">Estimated expense</label>
            <input
              ref={nameRef}
              id="expense-name"
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Airport taxi"
            />
            <div className="form-row">
              <div>
                <label htmlFor="expense-amount">Estimated amount (EUR)</label>
                <input
                  id="expense-amount"
                  type="number"
                  min="0.01"
                  max="1000000"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  value={category}
                  onChange={(event) => {
                    const selected = categories.find(
                      (item) => item === event.target.value,
                    );
                    if (selected) setCategory(selected);
                  }}
                >
                  {categories.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
            </div>
            {remoteMode && (
              <label>
                Already covered by a booking?
                <select
                  value={coveredBooking}
                  onChange={(event) => setCoveredBooking(event.target.value)}
                >
                  <option value="">No — count this as an additional estimate</option>
                  {(budget.bookings ?? [])
                    .filter((booking) => booking.status !== 'cancelled')
                    .map((booking) => (
                      <option key={booking.id} value={booking.id}>
                        {booking.serviceName || `Booking ${booking.id.slice(0, 8)}`}
                        {booking.reference ? ` · ${booking.reference}` : ''} · net{' '}
                        {formatMoney(booking.netMinor)}
                      </option>
                    ))}
                </select>
                <small>
                  A linked estimate is excluded because the booking is counted separately.
                </small>
              </label>
            )}

            {expenseError && (
              <p className="error" role="alert">
                {expenseError}
              </p>
            )}
            <div className="actions">
              <button type="submit">
                {editingId ? 'Save estimate' : 'Add to my plan'}
              </button>
              {editingId && (
                <button className="secondary" type="button" onClick={clearForm}>
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="panel" id="planned-expenses">
          <span className="step-label">03 / YOUR CHECKLIST</span>
          <h2>
            Planned expenses <span className="count">{budget.expenses.length}</span>
          </h2>
          {budget.expenses.length === 0 ? (
            <p className="empty">
              Your adventure is a blank page. Add your first estimate to start shaping the
              plan.
            </p>
          ) : (
            <ul className="expense-list">
              {budget.expenses.map((expense) => (
                <li key={expense.id}>
                  <div className="expense-line">
                    <div>
                      <strong>{expense.name}</strong>
                      <small>
                        {expense.category}
                        {expense.coveredByBookingId
                          ? ' · Covered by booking (not counted twice)'
                          : expense.bookingCancelled
                            ? ' · Booking cancelled; estimate counted again'
                            : ''}
                      </small>
                    </div>
                    <strong>{formatMoney(expense.amountInCents)}</strong>
                  </div>
                  {deleteId === expense.id ? (
                    <div className="actions">
                      <span>Delete this expense?</span>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          void deleteExpense(expense.id);
                        }}
                      >
                        Confirm delete
                      </button>
                      <button
                        className="secondary"
                        type="button"
                        onClick={() => setDeleteId(null)}
                      >
                        Keep expense
                      </button>
                    </div>
                  ) : (
                    <div className="actions">
                      <button
                        className="secondary"
                        type="button"
                        aria-label={`Edit ${expense.name}`}
                        onClick={() => startEdit(expense)}
                      >
                        Edit
                      </button>
                      <button
                        className="secondary"
                        type="button"
                        aria-label={`Delete ${expense.name}`}
                        onClick={() => setDeleteId(expense.id)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <span className="step-label">04 / COST BREAKDOWN</span>
          <h2>A picture of your plans</h2>
          <p>
            Your additional estimates, net booking costs after refunds, and safety buffer.
            Linked estimates are counted through their booking only.
          </p>
          {breakdown.length === 0 ? (
            <p className="empty">
              Your cost breakdown will appear here as you add estimates.
            </p>
          ) : (
            <>
              <div className="chart" aria-hidden="true">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={breakdown.map((item) => ({ ...item, euros: item.total / 100 }))}
                    layout="vertical"
                    margin={{ left: 12, right: 20 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="category"
                      type="category"
                      width={110}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Bar
                      dataKey="euros"
                      fill="#147d92"
                      radius={[0, 5, 5, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="breakdown">
                {breakdown.map((item) => (
                  <li key={item.category}>
                    <span>{item.category}</span>
                    <strong>{formatMoney(item.total)}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
      <footer className="planner-footer">
        <strong>Plan with confidence. Travel with curiosity.</strong>
        <p>
          This calculator uses your estimates. When connected to the database, saved
          booking costs after refunds are included separately. Live provider prices are
          not connected. Your wallet balance is separate.
        </p>
      </footer>
    </main>
  );
}
