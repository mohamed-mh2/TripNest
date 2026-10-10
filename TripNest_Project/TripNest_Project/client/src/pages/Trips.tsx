// Madin Abed: account access and personal trip management.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../api';
import { tripsApi, type Trip } from '../api/accounts';
import { openAccountTrip, getAccountTripId } from '../api/accountSession';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../store';
import { tripSaved, tripsFailed, tripsLoaded, tripsLoading } from '../store/tripsSlice';

const emptyForm = {
  name: '',
  destination: '',
  startDate: '',
  endDate: '',
  travelerCount: '1',
  budgetAmount: '1600',
  notes: '',
};

export default function Trips() {
  const dispatch = useDispatch<AppDispatch>();
  const { trips, listStatus, listError } = useSelector((state: RootState) => state.trips);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [message, setMessage] = useState(
    new URLSearchParams(location.search).has('saved')
      ? 'Trip saved. Its budget is shared with the cost planner.'
      : '',
  );
  const load = useCallback(async () => {
    dispatch(tripsLoading());
    try {
      dispatch(tripsLoaded((await tripsApi.list()).trips));
    } catch (e) {
      dispatch(
        tripsFailed(
          e instanceof ApiError ? e.message : 'Could not connect to the server.',
        ),
      );
    }
  }, [dispatch]);
  useEffect(() => {
    void load();
  }, [load]);

  function setField(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function startEdit(trip: Trip) {
    setError('');
    setFieldErrors({});
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setEditing(trip.id);
    setForm({
      name: trip.name,
      destination: trip.destination,
      startDate: trip.start_date || '',
      endDate: trip.end_date || '',
      travelerCount: trip.traveler_count?.toString() || '',
      budgetAmount: trip.budget_amount?.toString() || '',
      notes: trip.notes,
    });
  }

  function reset() {
    setEditing(null);
    setForm(emptyForm);
    setFieldErrors({});
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    const validation: Record<string, string> = {};
    const name = form.name.trim();
    const destination = form.destination.trim();
    const travelerCount = Number(form.travelerCount);
    const budgetAmount = Number(form.budgetAmount);
    if (name.length < 2 || name.length > 120)
      validation.name = 'Enter a trip name between 2 and 120 characters.';
    if (destination.length < 2 || destination.length > 160)
      validation.destination = 'Enter a destination between 2 and 160 characters.';
    if (
      !form.travelerCount ||
      !Number.isInteger(travelerCount) ||
      travelerCount < 1 ||
      travelerCount > 20
    )
      validation.travelerCount = 'Enter a whole number from 1 to 20.';
    if (
      !form.budgetAmount ||
      !Number.isFinite(budgetAmount) ||
      budgetAmount < 0 ||
      budgetAmount > 1000000 ||
      Math.abs(budgetAmount * 100 - Math.round(budgetAmount * 100)) > 1e-8
    )
      validation.budgetAmount =
        'Enter a budget from 0 to 1,000,000 EUR with up to 2 decimal places.';
    if (form.notes.length > 4000)
      validation.notes = 'Notes must be at most 4000 characters.';
    const validDate = (value: string) => {
      if (!value) return true;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const [year, month, day] = value.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      );
    };
    if (!validDate(form.startDate)) validation.startDate = 'Enter a valid start date.';
    if (!validDate(form.endDate)) validation.endDate = 'Enter a valid end date.';
    if (form.startDate && form.endDate && form.endDate < form.startDate)
      validation.endDate = 'End date must be on or after the start date.';
    setFieldErrors(validation);
    if (Object.keys(validation).length) {
      setError('Please correct the highlighted fields.');
      return;
    }
    setBusy(true);
    try {
      const result = editing
        ? await tripsApi.update(editing, {
            ...form,
            name,
            destination,
            startDate: form.startDate || null,
            endDate: form.endDate || null,
            travelerCount,
            budgetAmount,
          })
        : await tripsApi.create({
            ...form,
            name,
            destination,
            startDate: form.startDate || undefined,
            endDate: form.endDate || undefined,
            travelerCount,
            budgetAmount,
          });
      dispatch(tripSaved(result.trip));
      reset();
      if (!getAccountTripId()) openAccountTrip(result.trip.id, '/trips?saved=1');
      else window.location.assign('/trips?saved=1');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save this trip.');
      setFieldErrors(e instanceof ApiError ? (e.fields ?? {}) : {});
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(trip: Trip) {
    if (
      trip.status === 'active' &&
      !window.confirm(
        'Archive this trip? Saved bookings and expenses are kept. You can restore it later.',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      if (trip.status === 'active') await tripsApi.archive(trip.id);
      else await tripsApi.restore(trip.id);
      window.location.assign('/trips');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update trip status.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="account-workspace page-shell">
      <header className="page-heading">
        <div>
          <p className="eyebrow">PLAN YOUR NEXT ADVENTURE</p>
          <h1>My trips</h1>
        </div>
      </header>
      <section className="panel">
        <h2>{editing ? 'Edit trip' : 'Create a trip'}</h2>
        <p className="account-note">
          Your planned budget is an estimate. Creating or editing a trip does not charge
          your wallet.
        </p>
        <form onSubmit={save} noValidate>
          <fieldset className="trip-form" disabled={busy}>
            <label>
              Trip name
              <input
                required
                minLength={2}
                maxLength={120}
                value={form.name}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'trip-name-error' : undefined}
                onChange={(e) => setField('name', e.target.value)}
              />
              {fieldErrors.name && (
                <span className="field-error" id="trip-name-error" role="alert">
                  {fieldErrors.name}
                </span>
              )}
            </label>
            <label>
              Destination
              <input
                required
                minLength={2}
                maxLength={160}
                value={form.destination}
                aria-invalid={Boolean(fieldErrors.destination)}
                aria-describedby={
                  fieldErrors.destination ? 'trip-destination-error' : undefined
                }
                onChange={(e) => setField('destination', e.target.value)}
              />
              {fieldErrors.destination && (
                <span className="field-error" id="trip-destination-error" role="alert">
                  {fieldErrors.destination}
                </span>
              )}
            </label>
            <label>
              Start date
              <input
                type="date"
                value={form.startDate}
                aria-invalid={Boolean(fieldErrors.startDate)}
                aria-describedby={
                  fieldErrors.startDate ? 'trip-start-date-error' : undefined
                }
                onChange={(e) => setField('startDate', e.target.value)}
              />
              {fieldErrors.startDate && (
                <span className="field-error" id="trip-start-date-error" role="alert">
                  {fieldErrors.startDate}
                </span>
              )}
            </label>
            <label>
              End date
              <input
                type="date"
                value={form.endDate}
                min={form.startDate || undefined}
                aria-invalid={Boolean(fieldErrors.endDate)}
                aria-describedby={fieldErrors.endDate ? 'trip-end-date-error' : undefined}
                onChange={(e) => setField('endDate', e.target.value)}
              />
              {fieldErrors.endDate && (
                <span className="field-error" id="trip-end-date-error" role="alert">
                  {fieldErrors.endDate}
                </span>
              )}
            </label>
            <label>
              Travelers
              <input
                type="number"
                min="1"
                max="20"
                step="1"
                required
                value={form.travelerCount}
                aria-invalid={Boolean(fieldErrors.travelerCount)}
                aria-describedby={
                  fieldErrors.travelerCount ? 'trip-travelers-error' : undefined
                }
                onChange={(e) => setField('travelerCount', e.target.value)}
              />
              {fieldErrors.travelerCount && (
                <span className="field-error" id="trip-travelers-error" role="alert">
                  {fieldErrors.travelerCount}
                </span>
              )}
            </label>
            <label>
              Planned budget (EUR)
              <input
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                required
                value={form.budgetAmount}
                aria-invalid={Boolean(fieldErrors.budgetAmount)}
                aria-describedby={
                  fieldErrors.budgetAmount ? 'trip-budget-error' : undefined
                }
                onChange={(e) => setField('budgetAmount', e.target.value)}
              />
              {fieldErrors.budgetAmount && (
                <span className="field-error" id="trip-budget-error" role="alert">
                  {fieldErrors.budgetAmount}
                </span>
              )}
            </label>
            <label className="wide-field">
              Notes
              <textarea
                maxLength={4000}
                value={form.notes}
                aria-invalid={Boolean(fieldErrors.notes)}
                aria-describedby={fieldErrors.notes ? 'trip-notes-error' : undefined}
                onChange={(e) => setField('notes', e.target.value)}
              />
              {fieldErrors.notes && (
                <span className="field-error" id="trip-notes-error" role="alert">
                  {fieldErrors.notes}
                </span>
              )}
            </label>
            <div className="form-actions">
              <button className="primary-button" disabled={busy}>
                {busy ? 'Saving…' : editing ? 'Save changes' : 'Create trip'}
              </button>
              {editing && (
                <button type="button" className="secondary-button" onClick={reset}>
                  Cancel
                </button>
              )}
            </div>
          </fieldset>
        </form>
      </section>
      {message && (
        <p className="account-success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {listError && (
        <div className="form-error" role="alert">
          <p>{listError}</p>
          <button className="secondary-button" onClick={() => void load()}>
            Retry loading trips
          </button>
        </div>
      )}
      <label className="archive-toggle">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        Show archived trips
      </label>
      <section className="trip-list" aria-label="Your trips">
        {listStatus === 'loading' && <p role="status">Loading trips…</p>}
        {listStatus === 'succeeded' &&
          trips.filter((t) => t.status === (showArchived ? 'archived' : 'active'))
            .length === 0 && (
            <div className="panel empty-state">
              {showArchived
                ? 'No archived trips.'
                : 'No trips yet. Create one to get started.'}
            </div>
          )}
        {trips
          .filter((t) => t.status === (showArchived ? 'archived' : 'active'))
          .map((trip) => (
            <article className="panel trip-card" key={trip.id}>
              <div>
                <p className="eyebrow">
                  {trip.start_date || 'DATES NOT SET'}
                  {trip.end_date ? ` — ${trip.end_date}` : ''}
                </p>
                <h2>{trip.name}</h2>
                <p>{trip.destination}</p>
                <p>
                  {trip.traveler_count == null
                    ? 'Travelers: Not specified'
                    : `Travelers: ${trip.traveler_count}`}
                </p>
                <p>
                  {trip.budget_amount == null
                    ? 'Planned budget: Not specified'
                    : `Planned budget: ${new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(Number(trip.budget_amount))}`}
                </p>
                {trip.notes && <p className="trip-notes">{trip.notes}</p>}
              </div>
              <div className="card-actions">
                <Link
                  className="secondary-button trip-link"
                  to={`/trips/${encodeURIComponent(trip.id)}`}
                >
                  View details
                </Link>
                {trip.status === 'active' && (
                  <>
                    <button
                      className="primary-button"
                      disabled={busy}
                      onClick={() => openAccountTrip(trip.id)}
                    >
                      Open planner
                    </button>
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={() => startEdit(trip)}
                    >
                      Edit
                    </button>
                  </>
                )}
                <button
                  className="danger-button"
                  disabled={busy}
                  onClick={() => void changeStatus(trip)}
                >
                  {trip.status === 'active' ? 'Archive' : 'Restore'}
                </button>
              </div>
            </article>
          ))}
      </section>
    </main>
  );
}
