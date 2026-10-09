import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { ApiError, bookingsApi, isPresentationMode, tripsApi, type Booking } from '../api';
import type { AppDispatch, RootState } from '../store';
import { selectTrip, tripDetailsFailed, tripDetailsLoading, tripSaved } from '../store/tripsSlice';

function formatDate(value: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

export default function TripDetails() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const { trips, selectedTrip, selectedTripId, detailsStatus, detailsError } = useSelector((state: RootState) => state.trips);
  const trip = selectedTripId === id ? selectedTrip : trips.find((item) => item.id === id) ?? null;
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const tripsPath = isPresentationMode ? '/trips?demo=1' : '/trips';

  useEffect(() => {
    let active = true;
    dispatch(selectTrip(id ?? null));
    setBookings([]);
    setBookingsLoading(true);
    setBookingsError('');

    if (!id) {
      dispatch(tripDetailsFailed('Trip ID is missing.'));
      setBookingsLoading(false);
      return () => { active = false; };
    }

    dispatch(tripDetailsLoading());
    tripsApi.get(id)
      .then(({ trip: result }) => { if (active) dispatch(tripSaved(result)); })
      .catch((error: unknown) => {
        if (active) dispatch(tripDetailsFailed(error instanceof ApiError ? error.message : 'Could not load this trip.'));
      });

    bookingsApi.list()
      .then(({ bookings: rows }) => { if (active) setBookings(rows.filter((booking) => booking.tripId === id)); })
      .catch((error: unknown) => {
        if (active) setBookingsError(error instanceof ApiError ? error.message : 'Could not load this trip’s saved offers.');
      })
      .finally(() => { if (active) setBookingsLoading(false); });

    return () => { active = false; };
  }, [id, dispatch, retryCount]);

  if (detailsStatus === 'loading' || (detailsStatus === 'idle' && !trip)) return <main className="page-shell"><p role="status">Loading trip details…</p></main>;
  if (detailsError || !trip) return <main className="page-shell"><p className="form-error" role="alert">{detailsError || 'Trip not found.'}</p><div className="card-actions"><button className="secondary-button" onClick={() => setRetryCount((count) => count + 1)}>Try again</button><Link className="secondary-button trip-link" to={tripsPath}>Back to trips</Link></div></main>;

  return <main className="page-shell">
    <header className="page-heading trip-detail-heading">
      <div><p className="eyebrow">TRIP DETAILS</p><h1>{trip.name}</h1><p>{trip.destination}</p></div>
      <Link className="secondary-button trip-link" to={tripsPath}>Back to trips</Link>
    </header>
    <section className="panel trip-detail-card" aria-label="Trip information">
      <dl className="trip-facts">
        <div><dt>Destination</dt><dd>{trip.destination}</dd></div>
        <div><dt>Start date</dt><dd>{formatDate(trip.start_date)}</dd></div>
        <div><dt>End date</dt><dd>{formatDate(trip.end_date)}</dd></div>
        <div><dt>Travelers</dt><dd>{trip.traveler_count == null ? 'Not specified' : trip.traveler_count}</dd></div>
        <div><dt>Planned budget</dt><dd>{trip.budget_amount == null ? 'Not specified' : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(Number(trip.budget_amount))}</dd></div>
        <div className="trip-notes-fact"><dt>Notes</dt><dd>{trip.notes || 'No notes added.'}</dd></div>
      </dl>
    </section>

    <section className="section-gap" aria-labelledby="trip-bookings-heading">
      <div className="page-heading"><div><p className="eyebrow">SAVED TO THIS TRIP</p><h2 id="trip-bookings-heading">Bookings & saved offers</h2></div></div>
      <p className="demo-notice">Saved items are part of your TripNest itinerary. They are not confirmed reservations with travel providers.</p>
      {bookingsLoading && <p role="status">Loading saved offers…</p>}
      {bookingsError && <><p className="form-error" role="alert">{bookingsError}</p><button className="secondary-button" onClick={() => setRetryCount((count) => count + 1)}>Retry loading saved offers</button></>}
      {!bookingsLoading && !bookingsError && bookings.length === 0 && <div className="panel empty-state">No saved offers for this trip yet.</div>}
      {!bookingsLoading && !bookingsError && bookings.length > 0 && <div className="trip-list">
        {bookings.map((booking) => <article className="panel trip-card" key={booking.id}>
          <div>
            <p className="eyebrow">{booking.serviceName} · {booking.status}</p>
            <h3>{booking.offerTitle}</h3>
            <p>{booking.destination} · {booking.quantity} {booking.quantity === 1 ? 'item' : 'items'}</p>
          </div>
          <strong>{new Intl.NumberFormat(undefined, { style: 'currency', currency: booking.currency }).format(Number(booking.priceEach) * booking.quantity)}</strong>
        </article>)}
      </div>}
    </section>
  </main>;
}
