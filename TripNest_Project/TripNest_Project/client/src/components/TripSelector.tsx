import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { loadBookingSession } from '../store/sessionSlice';
import { ErrorState, FormField } from './SharedUI';

export default function TripSelector({
  id,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const dispatch = useAppDispatch();
  const session = useAppSelector((state) => state.session);
  useEffect(() => {
    if (session.tripsStatus === 'idle') void dispatch(loadBookingSession());
  }, [dispatch, session.tripsStatus]);
  useEffect(() => {
    if (
      session.tripsStatus === 'ready' &&
      !session.trips.some((trip) => trip.id === value)
    )
      onChange(session.trips[0]?.id || '');
  }, [session.tripsStatus, session.trips, value, onChange]);
  if (session.tripsStatus === 'error')
    return (
      <ErrorState
        title="Your trips could not be loaded"
        message={session.error || undefined}
        onRetry={() => void dispatch(loadBookingSession())}
      />
    );
  return (
    <FormField
      id={id}
      label="Your saved trip"
      hint={
        session.tripsStatus === 'ready' && !session.trips.length
          ? 'Create a trip in the trip planner first.'
          : undefined
      }
    >
      <select
        id={id}
        className="tn-select"
        value={value}
        disabled={disabled || session.tripsStatus !== 'ready' || !session.trips.length}
        onChange={(event) => onChange(event.target.value)}
      >
        {!value && (
          <option value="">
            {session.tripsStatus === 'loading' ? 'Loading trips…' : 'Choose a trip'}
          </option>
        )}
        {session.trips.map((trip) => (
          <option key={trip.id} value={trip.id}>
            {trip.title} · {trip.destinationCity || 'Destination not set'}
          </option>
        ))}
      </select>
    </FormField>
  );
}
