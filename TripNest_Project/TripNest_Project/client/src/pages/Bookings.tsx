// البحث عن خدمات السفر ومراجعة الحجز وتأكيده وإلغاؤه. المسؤول: abed alrahman.
// My Bookings list, trip booking cost summary, booking details, and cancellation.

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { ApiError } from '../api';
import { cancelBooking, fetchBooking, fetchTripBookingSummary } from '../api/bookings';
import { useAppDispatch, useAppSelector } from '../store';
import { bookingSaved, loadMyBookings } from '../store/bookingsSlice';
import { categoryInfo } from '../features/bookings/categories';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  pluralize,
} from '../features/bookings/format';
import { PolicyBox, PriceSummary } from '../features/bookings/components/PriceSummary';
import { DemoNotice, StatusMessage } from '../features/bookings/components/StatusMessage';
import type {
  Booking,
  BookingStatus,
  CancelBookingResponse,
  TripBookingSummary,
} from '../../../shared/types';
import '../features/bookings/bookings.css';

// ---------- Shared pieces ----------

function StatusBadge({ status }: { status: BookingStatus }) {
  return status === 'confirmed' ? (
    <span className="badge badge--good">Confirmed (demo)</span>
  ) : (
    <span className="badge badge--muted">Cancelled</span>
  );
}

function bookingWhen(booking: Booking): string {
  if (booking.category === 'hotel') {
    const nights = booking.priceBreakdown.nights || 0;
    return `${formatDate(booking.startDate)} → ${formatDate(booking.endDate)} · ${pluralize(nights, 'night')}`;
  }

  return formatDate(booking.startDate);
}

function bookingParty(booking: Booking): string {
  switch (booking.category) {
    case 'hotel':
      return `${pluralize(booking.rooms, 'room')}, ${pluralize(booking.travelers, 'guest')}`;
    case 'esim':
      return pluralize(booking.quantity, 'eSIM');
    case 'activity':
      return pluralize(booking.quantity, 'ticket');
    case 'transfer':
      return pluralize(booking.travelers, 'passenger');
    default:
      return pluralize(booking.travelers, 'traveler');
  }
}

function SignInRequired() {
  return (
    <section className="page">
      <StatusMessage tone="info" title="Sign in to see your bookings">
        Open the saved demo trip. Real sign-in will be connected by the accounts team.
      </StatusMessage>
    </section>
  );
}

// ---------- Trip booking cost (shared with the cost planner) ----------

// #explain_notes: Shows the same net figure the cost planner uses: total booked minus refunds.
// It reloads whenever planRevision changes (after a booking or a cancellation).
function TripCostSummary({ tripId }: { tripId: string }) {
  const planRevision = useAppSelector((state) => state.bookings.planRevision);
  const [summary, setSummary] = useState<TripBookingSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    setFailed(false);
    fetchTripBookingSummary(tripId)
      .then((result) => {
        if (isCurrent) {
          setSummary(result);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setFailed(true);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [tripId, planRevision]);

  if (failed) {
    return <p className="field__error">Could not load the booking cost for this trip.</p>;
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="cost-summary" aria-label="Booking cost for this trip">
      <div>
        <span className="cost-summary__label">Booked</span>
        <strong>{formatMoney(summary.bookedTotalMinor, summary.currency)}</strong>
      </div>
      <div>
        <span className="cost-summary__label">Refunded</span>
        <strong>− {formatMoney(summary.refundedMinor, summary.currency)}</strong>
      </div>
      <div className="cost-summary__net">
        <span className="cost-summary__label">Net booking cost</span>
        <strong>{formatMoney(summary.netMinor, summary.currency)}</strong>
      </div>
      <p className="muted small">
        Used by the trip cost planner. Bookings are counted once and are not added as
        extra expenses.
      </p>
    </div>
  );
}

// ---------- My Bookings ----------

const STATUS_TABS: Array<{ id: BookingStatus | null; label: string }> = [
  { id: null, label: 'All' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'cancelled', label: 'Cancelled' },
];

function BookingRow({ booking }: { booking: Booking }) {
  const info = categoryInfo(booking.category);

  return (
    <article className="booking-row">
      <div className="booking-row__icon" aria-hidden="true">
        {info.icon}
      </div>
      <div className="booking-row__main">
        <h3>{booking.serviceName}</h3>
        <p className="muted">
          {bookingWhen(booking)} · {bookingParty(booking)}
        </p>
        <p className="muted small">
          Ref. {booking.reference} · Trip: {booking.tripTitle}
        </p>
      </div>
      <div className="booking-row__side">
        <StatusBadge status={booking.status} />
        <strong>{formatMoney(booking.totalMinor, booking.currency)}</strong>
        {booking.refundedMinor > 0 && (
          <span className="small refund-text">
            Refunded {formatMoney(booking.refundedMinor, booking.currency)}
          </span>
        )}
        <Link to={`/bookings/${booking.id}`} className="button">
          Details
        </Link>
      </div>
    </article>
  );
}

export function MyBookingsPage() {
  const dispatch = useAppDispatch();
  const { currentUserId, trips } = useAppSelector((state) => state.session);
  const { myBookings, myBookingsStatus, myBookingsError } = useAppSelector(
    (state) => state.bookings,
  );
  const [tripId, setTripId] = useState<string | null>(null);
  const [status, setStatus] = useState<BookingStatus | null>(null);

  useEffect(() => {
    if (currentUserId !== null) {
      dispatch(loadMyBookings({ tripId, status }));
    }
  }, [dispatch, currentUserId, tripId, status]);

  if (currentUserId === null) {
    return <SignInRequired />;
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>My Bookings</h1>
          <p className="page-header__subtitle">Demo bookings attached to your trips.</p>
        </div>
        <Link to="/services" className="button button--primary">
          Book a service
        </Link>
      </header>

      <div className="bookings-toolbar">
        <label className="field">
          <span className="field__label">Trip</span>
          <select
            value={tripId ?? ''}
            onChange={(event) =>
              setTripId(event.target.value ? event.target.value : null)
            }
          >
            <option value="">All trips</option>
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.title}
              </option>
            ))}
          </select>
        </label>

        <div className="segmented" role="tablist" aria-label="Booking status">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={status === tab.id}
              className={
                status === tab.id
                  ? 'segmented__item segmented__item--active'
                  : 'segmented__item'
              }
              onClick={() => setStatus(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {tripId !== null && <TripCostSummary tripId={tripId} />}

      {myBookingsStatus === 'loading' && (
        <p className="muted" aria-busy="true">
          Loading your bookings...
        </p>
      )}

      {myBookingsStatus === 'error' && (
        <StatusMessage
          tone="error"
          title="Could not load your bookings"
          action={
            <button
              type="button"
              className="button"
              onClick={() => dispatch(loadMyBookings({ tripId, status }))}
            >
              Try again
            </button>
          }
        >
          {myBookingsError}
        </StatusMessage>
      )}

      {myBookingsStatus === 'ready' && myBookings.length === 0 && (
        <StatusMessage
          tone="empty"
          title="No bookings yet"
          action={
            <Link to="/services" className="button">
              Browse services
            </Link>
          }
        >
          {status || tripId
            ? 'No bookings match these filters.'
            : 'Your confirmed demo bookings will appear here.'}
        </StatusMessage>
      )}

      {myBookingsStatus === 'ready' && myBookings.length > 0 && (
        <div className="booking-list">
          {myBookings.map((booking) => (
            <BookingRow key={booking.id} booking={booking} />
          ))}
        </div>
      )}
    </section>
  );
}

// ---------- Booking details and cancellation ----------

function CancellationSection({
  booking,
  onCancelled,
}: {
  booking: Booking;
  onCancelled: (result: CancelBookingResponse) => void;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const preview = booking.cancellationPreview;

  // #explain_notes: The ref blocks a second click before React re-renders; the server also refuses a repeat.
  async function cancelNow() {
    if (submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      onCancelled(await cancelBooking(booking.id));
    } catch (cancelError) {
      setError((cancelError as ApiError).message);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
      setIsConfirming(false);
    }
  }

  if (booking.status === 'cancelled') {
    return (
      <StatusMessage tone="info" title="This booking is cancelled">
        Cancelled on {booking.cancelledAt ? formatDateTime(booking.cancelledAt) : '-'}{' '}
        (UTC). Refund: {formatMoney(booking.refundedMinor, booking.currency)} to the demo
        card (simulated).
      </StatusMessage>
    );
  }

  if (!preview.canCancel) {
    return (
      <StatusMessage tone="warning" title="Cancellation not available">
        {preview.reason}
      </StatusMessage>
    );
  }

  return (
    <div className="cancel-box">
      <h2>Cancel booking</h2>
      <p>
        If you cancel now you will receive{' '}
        <strong>{formatMoney(preview.refundMinor, booking.currency)}</strong> (simulated
        refund). {preview.reason}
      </p>

      {error && (
        <StatusMessage tone="error" title="Cancellation failed">
          {error}
        </StatusMessage>
      )}

      {!isConfirming ? (
        <button
          type="button"
          className="button button--danger"
          onClick={() => setIsConfirming(true)}
        >
          Cancel booking
        </button>
      ) : (
        <div className="cancel-box__confirm">
          <p>
            <strong>Are you sure?</strong> This cannot be undone.
          </p>
          <button
            type="button"
            className="button button--danger"
            disabled={isSubmitting}
            onClick={cancelNow}
          >
            {isSubmitting
              ? 'Cancelling...'
              : `Yes, cancel and refund ${formatMoney(preview.refundMinor, booking.currency)}`}
          </button>
          <button
            type="button"
            className="button button--ghost"
            disabled={isSubmitting}
            onClick={() => setIsConfirming(false)}
          >
            Keep booking
          </button>
        </div>
      )}
    </div>
  );
}

export function BookingDetailsPage() {
  const dispatch = useAppDispatch();
  const { bookingId } = useParams();
  const location = useLocation();
  const currentUserId = useAppSelector((state) => state.session.currentUserId);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [refundResult, setRefundResult] = useState<
    CancelBookingResponse['refund'] | null
  >(null);
  const justBooked = Boolean(
    (location.state as { justBooked?: boolean } | null)?.justBooked,
  );

  useEffect(() => {
    if (currentUserId === null) {
      return undefined;
    }

    let isCurrent = true;

    setError(null);
    fetchBooking(bookingId ?? '')
      .then((result) => {
        if (isCurrent) {
          setBooking(result.booking);
        }
      })
      .catch((loadError: ApiError) => {
        if (isCurrent) {
          setError(loadError);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [bookingId, currentUserId]);

  if (currentUserId === null) {
    return <SignInRequired />;
  }

  if (error) {
    return (
      <section className="page">
        <StatusMessage
          tone={error.status === 404 ? 'empty' : 'error'}
          title={
            error.status === 404 ? 'Booking not found' : 'Could not load this booking'
          }
          action={
            <Link to="/bookings" className="button">
              Back to My Bookings
            </Link>
          }
        >
          {error.message}
        </StatusMessage>
      </section>
    );
  }

  if (!booking) {
    return (
      <p className="page-message" aria-busy="true">
        Loading booking...
      </p>
    );
  }

  function handleCancelled(result: CancelBookingResponse) {
    setBooking(result.booking);
    setRefundResult(result.refund);
    dispatch(bookingSaved(result.booking));
  }

  const lines = booking.priceBreakdown.lines || [];
  const info = categoryInfo(booking.category);

  return (
    <section className="page">
      <Link to="/bookings" className="back-link">
        ← Back to My Bookings
      </Link>

      {justBooked && booking.status === 'confirmed' && (
        <StatusMessage
          tone="success"
          title={`Booking confirmed · Reference ${booking.reference}`}
        >
          Your demo payment was approved. This is a simulated booking: no real ticket,
          reservation, or eSIM was issued.
        </StatusMessage>
      )}

      {refundResult && (
        <StatusMessage tone="success" title="Booking cancelled">
          Refund of {formatMoney(refundResult.amountMinor, refundResult.currency)} (
          {refundResult.percent}%). {refundResult.reason} {refundResult.note}
        </StatusMessage>
      )}

      <div className="details-layout">
        <div className="details-main">
          <p className="eyebrow">
            {info.icon} {info.label}
          </p>
          <h1>{booking.serviceName}</h1>
          <div className="service-card__badges">
            <StatusBadge status={booking.status} />
            <span className="badge badge--demo">Demo booking</span>
          </div>

          <dl className="details-list">
            <div>
              <dt>Reference</dt>
              <dd className="mono">{booking.reference}</dd>
            </div>
            <div>
              <dt>Trip</dt>
              <dd>{booking.tripTitle}</dd>
            </div>
            <div>
              <dt>When</dt>
              <dd>
                {bookingWhen(booking)} · starts {formatDateTime(booking.startsAt)} (UTC)
              </dd>
            </div>
            <div>
              <dt>Party</dt>
              <dd>{bookingParty(booking)}</dd>
            </div>
            <div>
              <dt>Booked on</dt>
              <dd>{formatDateTime(booking.createdAt)} (UTC)</dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>Simulated demo card · {booking.paymentReference}</dd>
            </div>
          </dl>

          <PolicyBox policy={booking.cancellationPolicy} />

          <DemoNotice compact />
        </div>

        <aside className="checkout">
          <section className="checkout__step">
            <h3>Price</h3>
            <PriceSummary
              lines={lines}
              totalMinor={booking.totalMinor}
              currency={booking.currency}
              totalLabel="Total paid (demo)"
            />
            {booking.refundedMinor > 0 && (
              <table className="price-table">
                <tbody>
                  <tr>
                    <th scope="row">Refunded</th>
                    <td>− {formatMoney(booking.refundedMinor, booking.currency)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Net cost</th>
                    <td>{formatMoney(booking.netMinor, booking.currency)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </section>

          <section className="checkout__step">
            <CancellationSection booking={booking} onCancelled={handleCancelled} />
          </section>
        </aside>
      </div>
    </section>
  );
}
