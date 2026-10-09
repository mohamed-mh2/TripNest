// Category-specific key facts for a service (route, stars, data, vehicle, time...). المسؤول: abed alrahman.

import { formatDuration, formatMoney } from '../format';
import type { TravelService } from '../../../../../shared/types';


export function serviceFacts(service: TravelService): string[] {
  const a = service.attributes;

  switch (service.category) {
    case 'flight':
    case 'train':
    case 'ferry':
      return [
        `${a.origin} → ${a.destination}`,
        `Departs ${a.departureTime}`,
        a.durationMin ? formatDuration(a.durationMin) : '',
        a.baggage || a.seatClass || '',
      ].filter(Boolean);

    case 'hotel':
      return [
        `${'★'.repeat(a.stars || 0)} ${a.neighborhood || ''}`.trim(),
        `Up to ${a.maxGuestsPerRoom} guests per room`,
        a.touristTaxPerGuestNightMinor
          ? `Tourist tax ${formatMoney(a.touristTaxPerGuestNightMinor, service.currency)} per guest per night`
          : '',
      ].filter(Boolean);

    case 'esim':
      return [
        a.dataGb === null || a.dataGb === undefined ? 'Unlimited data' : `${a.dataGb} GB data`,
        `Valid ${a.validityDays} days`,
        `Coverage: ${a.coverage}`,
      ];

    case 'transfer':
      return [
        a.transferType || '',
        `${a.origin} → ${a.destination}`,
        a.vehicleCapacity ? `Up to ${a.vehicleCapacity} passengers per vehicle` : '',
        a.validityHours ? `Valid ${a.validityHours} hours` : '',
      ].filter(Boolean);

    case 'activity':
      return [
        a.ticketType || '',
        `Starts ${a.startTime}`,
        a.durationMin ? formatDuration(a.durationMin) : '',
        a.meetingPoint ? `Meet at ${a.meetingPoint}` : '',
      ].filter(Boolean);

    default:
      return [];
  }
}


export function ServiceFacts({ service }: { service: TravelService }) {
  return (
    <ul className="facts">
      {serviceFacts(service).map((fact) => (
        <li key={fact}>{fact}</li>
      ))}
    </ul>
  );
}


export function PolicyBadge({ service }: { service: TravelService }) {
  const policy = service.cancellationPolicy;

  if (policy.freeCancelHours !== null) {
    return <span className="badge badge--good">Free cancellation ({policy.freeCancelHours} h before)</span>;
  }

  if (policy.lateRefundPercent > 0) {
    return <span className="badge badge--warn">Partly refundable</span>;
  }

  return <span className="badge badge--muted">Non-refundable</span>;
}
