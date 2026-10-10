// Madin Abed: account access and personal trip management.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { tripsApi, type Trip } from '../api/accounts';
import { apiRequest } from '../api';
import { openAccountTrip } from '../api/accountSession';
import type { Booking } from '../../../shared/types';

export default function TripDetails() {
  const { id } = useParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [busy, setBusy] = useState(true);
  const [bookingsBusy, setBookingsBusy] = useState(true);
  const [error, setError] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setTrip(null);
    setBookings([]);
    setBookingsBusy(true);
    setError('');
    setBookingError('');
    if (!id) {
      setError('Trip ID missing.');
      setBusy(false);
      return;
    }
    void tripsApi
      .get(id)
      .then(({ trip }) => {
        if (active) setTrip(trip);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not load trip.');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    void apiRequest<{ bookings: Booking[] }>('/bookings')
      .then(({ bookings }) => {
        if (active) setBookings(bookings.filter((b) => b.tripId === id));
      })
      .catch((e) => {
        if (active)
          setBookingError(e instanceof Error ? e.message : 'Could not load bookings.');
      })
      .finally(() => {
        if (active) setBookingsBusy(false);
      });
    return () => {
      active = false;
    };
  }, [id, retry]);
  const money = (n: number) =>
    new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' }).format(n);
  return (
    <main className="account-workspace page-shell">
      <Link to="/trips" className="secondary-button trip-link">
        ← My trips
      </Link>
      {busy && <p role="status">Loading your trip…</p>}
      {error && (
        <div className="form-error" role="alert">
          <p>{error}</p>
          <button onClick={() => setRetry((n) => n + 1)}>Try again</button>
        </div>
      )}
      {trip && (
        <>
          <header className="page-heading">
            <div>
              <p className="eyebrow">
                {trip.status === 'archived' ? 'ARCHIVED TRIP' : 'YOUR NEXT ADVENTURE'}
              </p>
              <h1>{trip.name}</h1>
              <p>{trip.destination}</p>
            </div>
          </header>
          <section className="panel">
            <h2>Trip overview</h2>
            <dl className="trip-overview">
              <div>
                <dt>Travel dates</dt>
                <dd>
                  {trip.start_date || 'Start not set'} — {trip.end_date || 'End not set'}
                </dd>
              </div>
              <div>
                <dt>Travelers</dt>
                <dd>{trip.traveler_count}</dd>
              </div>
              <div>
                <dt>Planned budget</dt>
                <dd>{money(trip.budget_amount)}</dd>
              </div>
            </dl>
            <p className="account-note">
              This budget is for estimating trip costs. It is separate from your wallet
              balance.
            </p>
            {trip.notes && <p className="trip-notes">{trip.notes}</p>}
            {trip.status === 'active' && (
              <div className="card-actions">
                <button
                  className="primary-button"
                  onClick={() => openAccountTrip(trip.id)}
                >
                  Open cost planner
                </button>
                <Link className="secondary-button trip-link" to="/services">
                  Explore services
                </Link>
                <Link className="secondary-button trip-link" to="/readiness">
                  Travel readiness
                </Link>
              </div>
            )}
          </section>
          <section className="panel">
            <h2>Demo bookings</h2>
            <p className="account-note">
              Payments and reservations are simulated. No real tickets are issued.
            </p>
            {bookingError && <p role="alert">{bookingError}</p>}
            {bookingsBusy && <p role="status">Loading bookings…</p>}
            {!bookingsBusy && !bookingError && !bookings.length && (
              <p>No bookings for this trip yet.</p>
            )}
            <ul className="trip-bookings">
              {bookings.map((b) => (
                <li key={b.id}>
                  <Link to={'/bookings/' + b.id}>{b.serviceName || b.reference}</Link>
                  <span>
                    {b.status} · {money(b.totalMinor / 100)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
