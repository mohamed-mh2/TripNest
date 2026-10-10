// باقات eSIM والأنشطة وقائمة الاستعداد وربطها بمحرك الحجز. المسؤول: mohamed fody.

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import TripSelector from '../components/TripSelector';
import { Link } from 'react-router-dom';

import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageShell,
  ProgressMeter,
} from '../components/SharedUI';
import {
  exportTripSummary,
  loadReadiness,
  selectSupport,
  toggleReadinessItem,
  type ReadinessItem,
  type SupportThunkDispatch,
} from '../store/supportSlice';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function BookingIntegration({
  title,
  id,
  detail,
  category,
}: {
  title: string;
  id: string;
  detail: string;
  category: string;
}) {
  return (
    <section
      className="tn-card"
      aria-labelledby={id}
      data-booking-integration="abed-alrahman"
    >
      <h2 id={id}>{title}</h2>
      <p className="tn-muted">{detail}</p>
      <Link className="tn-button" to={`/services?category=${category}`}>
        Explore {title}
      </Link>
    </section>
  );
}

function ReadinessList({
  items,
  savingKey,
  onToggle,
}: {
  items: ReadinessItem[];
  savingKey: ReadinessItem['key'] | null;
  onToggle: (item: ReadinessItem) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No checklist items"
        message="This trip does not have any readiness items yet."
      />
    );
  }

  return (
    <ul className="tn-list">
      {items.map((item) => {
        const pending = savingKey === item.key;
        const status = pending
          ? 'Saving'
          : item.completed
            ? 'Completed'
            : 'Not completed';
        const action = item.completed ? 'Mark as not completed' : 'Mark as completed';
        return (
          <li key={item.key}>
            <button
              className="tn-check"
              type="button"
              aria-pressed={item.completed}
              aria-busy={pending}
              disabled={savingKey !== null}
              onClick={() => onToggle(item)}
            >
              <span aria-hidden="true">{item.completed ? '✓' : '○'}</span>
              <span className="tn-check-copy">
                <span className="tn-check-title">{item.title}</span>
                <span className="tn-check-status">{item.description}</span>
                <span className="tn-check-status">
                  {status}. {action}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default function Services() {
  const dispatch = useDispatch<SupportThunkDispatch>();
  const support = useSelector(selectSupport);
  const [tripId, setTripId] = useState('');
  const readiness = support.readiness;

  useEffect(() => {
    if (tripId) void dispatch(loadReadiness(tripId));
  }, [dispatch, tripId]);

  function loadTrip() {
    if (tripId) void dispatch(loadReadiness(tripId));
  }

  function toggle(item: ReadinessItem) {
    if (!readiness.tripId) {
      return;
    }
    void dispatch(
      toggleReadinessItem({
        tripId: readiness.tripId,
        itemKey: item.key,
        completed: !item.completed,
      }),
    );
  }

  return (
    <PageShell
      title="Ready for takeoff?"
      subtitle="One checklist for the essentials. Prepare your saved trip, then travel with confidence."
      actions={
        <button
          className="tn-button-secondary"
          type="button"
          disabled={support.summaryExport.loading || !UUID_PATTERN.test(tripId)}
          onClick={() => void dispatch(exportTripSummary(tripId))}
        >
          {support.summaryExport.loading ? 'Preparing summary' : 'Download trip summary'}
        </button>
      }
    >
      <p className="tn-banner" role="note">
        Your checklist is saved to this trip. Mark an item complete after checking the
        details; a checkmark does not create a booking.
      </p>
      <section className="tn-card" aria-labelledby="readiness-heading">
        <div className="tn-row">
          <h2 id="readiness-heading">Trip readiness</h2>
        </div>
        <p className="tn-muted">Check the essentials before you travel.</p>
        <TripSelector
          id="readiness-trip"
          value={tripId}
          onChange={setTripId}
          disabled={readiness.savingKey !== null}
        />
        {readiness.loading ? <LoadingState label="Loading your checklist" /> : null}
        {!readiness.loading && readiness.error && readiness.items.length === 0 ? (
          <ErrorState
            title="The checklist could not be loaded."
            message={`${readiness.error} Nothing was marked complete.`}
            onRetry={loadTrip}
          />
        ) : null}
        {!readiness.loading && readiness.items.length > 0 ? (
          <>
            {readiness.error ? (
              <ErrorState title="That change was not saved." message={readiness.error} />
            ) : null}
            <ProgressMeter
              label="Readiness progress"
              completed={readiness.progress.completed}
              total={readiness.progress.total}
              percentage={readiness.progress.percentage}
            />
            <p className="tn-meta">
              Completed {readiness.progress.completed}. Remaining{' '}
              {readiness.progress.total - readiness.progress.completed}.
            </p>
            <ReadinessList
              items={readiness.items}
              savingKey={readiness.savingKey}
              onToggle={toggle}
            />
          </>
        ) : null}
        {support.summaryExport.error ? (
          <p className="tn-field-error" role="alert">
            {support.summaryExport.error}
          </p>
        ) : null}
      </section>
      <div className="tn-grid tn-grid-2">
        <BookingIntegration
          id="esim-heading"
          title="eSIM packages"
          category="esim"
          detail="Land connected. Compare data packages and buy a demo eSIM through the shared checkout."
        />
        <BookingIntegration
          id="activities-heading"
          title="Activities"
          category="activity"
          detail="Make room for memorable experiences. Browse tours, attractions and event tickets."
        />
      </div>
    </PageShell>
  );
}
