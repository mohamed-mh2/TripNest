// Booking panel: selection, server price review, trip choice, simulated payment, and confirmation. المسؤول: abed alrahman.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ApiError } from '../../../api';
import { createBooking, fetchPaymentOptions } from '../../../api/bookings';
import { useAppDispatch, useAppSelector } from '../../../store';
import { bookingSaved } from '../../../store/bookingsSlice';
import { useQuote } from '../hooks/useQuote';
import { addDays, formatDate, formatMoney } from '../format';
import { EMPTY_SELECTION_FORM, SelectionFields, toSelection, type SelectionForm } from './SelectionFields';
import { PolicyBox, PriceSummary } from './PriceSummary';
import { StatusMessage } from './StatusMessage';
import type { DemoPaymentCard, TravelService, TripSummary } from '../../../../../shared/types';


function createRequestKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `key-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}


function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}


// #explain_notes: Prefills dates from the trip so the first quote appears without extra typing.
function prefillForTrip(service: TravelService, form: SelectionForm, trip: TripSummary): SelectionForm {
  const start = trip.startDate > todayString() ? trip.startDate : todayString();

  if (service.category === 'hotel') {
    return {
      ...form,
      checkIn: start,
      checkOut: addDays(start, 1) <= trip.endDate ? addDays(start, 1) : trip.endDate,
    };
  }

  return { ...form, date: start };
}


function isOutsideTrip(service: TravelService, form: SelectionForm, trip: TripSummary | null): boolean {
  if (!trip) {
    return false;
  }

  const start = service.category === 'hotel' ? form.checkIn : form.date;
  const end = service.category === 'hotel' ? form.checkOut : form.date;

  return Boolean(start && end) && (start < trip.startDate || end > trip.endDate);
}


interface SubmitError {
  title: string;
  message: string;
  fields: Record<string, string>;
}


export function CheckoutPanel({ service }: { service: TravelService }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { currentUserId, trips, tripsStatus } = useAppSelector((state) => state.session);

  const [tripId, setTripId] = useState<number | null>(null);
  const [form, setForm] = useState<SelectionForm>(EMPTY_SELECTION_FORM);
  const [cards, setCards] = useState<DemoPaymentCard[]>([]);
  const [cardId, setCardId] = useState('demo_card_approve');
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [declineCount, setDeclineCount] = useState(0);
  const submittingRef = useRef(false);

  const trip = trips.find((item) => item.id === tripId) || null;

  useEffect(() => {
    if (tripId === null && trips.length > 0) {
      setTripId(trips[0].id);
      setForm((current) => prefillForTrip(service, current, trips[0]));
    }
  }, [trips, tripId, service]);

  useEffect(() => {
    if (currentUserId === null) {
      setCards([]);
      setTripId(null);
      return;
    }

    fetchPaymentOptions()
      .then((result) => setCards(result.cards))
      .catch(() => setCards([]));
  }, [currentUserId]);

  const selection = useMemo(() => toSelection(service, form), [service, form]);
  const quoteState = useQuote(service.id, selection);
  const outsideTrip = isOutsideTrip(service, form, trip);

  // #explain_notes: One request key per checkout intent. Double clicks and network retries reuse it,
  // so the server returns the same booking instead of charging twice. A new choice or a decline gets a new key.
  const requestKey = useMemo(
    () => createRequestKey(),
    [JSON.stringify(selection), tripId, cardId, declineCount],
  );

  function updateForm(changes: Partial<SelectionForm>) {
    setForm((current) => ({ ...current, ...changes }));
    setSubmitError(null);
  }

  function changeTrip(nextTripId: number) {
    const nextTrip = trips.find((item) => item.id === nextTripId);
    setTripId(nextTripId);
    setSubmitError(null);

    if (nextTrip) {
      setForm((current) => prefillForTrip(service, current, nextTrip));
    }
  }

  async function confirmBooking() {
    if (submittingRef.current || !selection || !trip) {
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await createBooking({
        serviceId: service.id,
        tripId: trip.id,
        selection,
        paymentCardId: cardId,
        idempotencyKey: requestKey,
      });

      dispatch(bookingSaved(result.booking));
      navigate(`/bookings/${result.booking.id}`, { state: { justBooked: true } });
    } catch (error) {
      const apiError = error as ApiError;

      if (apiError.code === 'PAYMENT_DECLINED') {
        setDeclineCount((count) => count + 1);
        setSubmitError({
          title: 'Payment declined (simulation)',
          message: 'The demo card was declined. No booking was created and nothing was charged. Choose the approving demo card to try again.',
          fields: {},
        });
      } else if (apiError.status === 0) {
        setSubmitError({
          title: 'Connection problem',
          message: 'We could not confirm the result. Pressing "Confirm and pay" again is safe: it will not create a second booking.',
          fields: {},
        });
      } else {
        setSubmitError({
          title: apiError.status === 401 ? 'Please sign in' : 'Booking not completed',
          message: apiError.message,
          fields: apiError.fields || {},
        });
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  const quote = quoteState.result?.quote || null;
  const availability = quoteState.result?.availability || null;
  const fieldErrors = { ...quoteState.fieldErrors, ...(submitError?.fields || {}) };
  const minDate = trip && trip.startDate > todayString() ? trip.startDate : todayString();

  const canConfirm = Boolean(
    currentUserId !== null
    && trip
    && quote
    && quoteState.status === 'ready'
    && availability?.isAvailable
    && !outsideTrip
    && acceptedPolicy
    && !isSubmitting,
  );

  return (
    <aside className="checkout" aria-label="Book this service">
      <section className="checkout__step">
        <h3><span className="step-number">1</span> Your selection</h3>
        <SelectionFields
          service={service}
          form={form}
          trip={trip}
          minDate={minDate}
          errors={fieldErrors}
          onChange={updateForm}
        />
      </section>

      <section className="checkout__step">
        <h3><span className="step-number">2</span> Price review</h3>

        {quoteState.status === 'idle' && <p className="muted">Choose dates to see the full price.</p>}
        {quoteState.status === 'loading' && <p className="muted" aria-live="polite">Calculating price...</p>}
        {quoteState.status === 'invalid' && <p className="field__error">{quoteState.message}</p>}
        {quoteState.status === 'error' && (
          <StatusMessage tone="error" title="Could not calculate the price">{quoteState.message}</StatusMessage>
        )}

        {quote && quoteState.status === 'ready' && (
          <>
            <PriceSummary lines={quote.lines} totalMinor={quote.totalMinor} currency={quote.currency} />
            {availability && availability.remaining !== null && (
              <p className={availability.isAvailable ? 'muted' : 'field__error'}>
                {availability.isAvailable
                  ? `${availability.remaining} left for the selected date (demo availability).`
                  : `Not enough availability: only ${availability.remaining} left for the selected dates.`}
              </p>
            )}
            <PolicyBox policy={quote.cancellationPolicy} />
          </>
        )}
      </section>

      <section className="checkout__step">
        <h3><span className="step-number">3</span> Trip</h3>

        {currentUserId === null && (
          <StatusMessage tone="info" title="Sign in to book">
            Choose a demo customer in the header to continue.
          </StatusMessage>
        )}

        {currentUserId !== null && tripsStatus === 'loading' && <p className="muted">Loading your trips...</p>}

        {currentUserId !== null && tripsStatus === 'error' && (
          <StatusMessage tone="error" title="Could not load your trips">Please refresh the page.</StatusMessage>
        )}

        {currentUserId !== null && tripsStatus === 'ready' && trips.length === 0 && (
          <StatusMessage tone="empty" title="No active trips">
            Bookings are attached to a trip. Create a trip first.
          </StatusMessage>
        )}

        {trips.length > 0 && (
          <label className="field">
            <span className="field__label">Book for trip</span>
            <select value={tripId ?? ''} onChange={(event) => changeTrip(Number(event.target.value))}>
              {trips.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} ({formatDate(item.startDate)} - {formatDate(item.endDate)})
                </option>
              ))}
            </select>
            {outsideTrip && trip && (
              <span className="field__error">
                Choose dates between {formatDate(trip.startDate)} and {formatDate(trip.endDate)}.
              </span>
            )}
          </label>
        )}
      </section>

      <section className="checkout__step">
        <h3><span className="step-number">4</span> Simulated payment</h3>
        <p className="muted">No real card is used. Choose a preset demo card to simulate the result.</p>

        <div className="card-options" role="radiogroup" aria-label="Demo payment card">
          {cards.map((card) => (
            <label key={card.id} className={`card-option${cardId === card.id ? ' card-option--active' : ''}`}>
              <input
                type="radio"
                name="demo-card"
                value={card.id}
                checked={cardId === card.id}
                onChange={() => {
                  setCardId(card.id);
                  setSubmitError(null);
                }}
              />
              <span>
                <strong>{card.label}</strong>
                <span className="card-option__hint">{card.description}</span>
              </span>
            </label>
          ))}
        </div>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={acceptedPolicy}
            onChange={(event) => setAcceptedPolicy(event.target.checked)}
          />
          I have read the price and the cancellation policy.
        </label>

        {submitError && (
          <StatusMessage tone="error" title={submitError.title}>{submitError.message}</StatusMessage>
        )}

        <button
          type="button"
          className="button button--primary button--block"
          disabled={!canConfirm}
          onClick={confirmBooking}
        >
          {isSubmitting
            ? 'Processing demo payment...'
            : `Confirm and pay${quote ? ` ${formatMoney(quote.totalMinor, quote.currency)}` : ''} (demo)`}
        </button>

        <p className="muted small">
          Demo booking: no real ticket, reservation, or eSIM is issued. <Link to="/bookings">View my bookings</Link>
        </p>
      </section>
    </aside>
  );
}
