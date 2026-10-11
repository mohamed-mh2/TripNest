import type { TravelService, TripSummary } from '../../../../shared/types';
import type { SelectionForm } from './components/SelectionFields';

// #explain_notes: Prefill from the selected trip; unset dates must never look like saved dates.
export function prefillForTrip(
  service: TravelService,
  form: SelectionForm,
  trip: TripSummary,
  today = new Date().toISOString().slice(0, 10),
): SelectionForm {
  const count = trip.travelerCount || 1;
  const start =
    trip.datesConfigured === false ? '' : trip.startDate > today ? trip.startDate : today;
  if (service.category === 'hotel') {
    const perRoom = service.attributes.maxGuestsPerRoom || 2;
    const rooms = Math.min(5, Math.ceil(count / perRoom));
    return {
      ...form,
      checkIn: start,
      checkOut: start && trip.endDate > start ? trip.endDate : '',
      rooms: String(rooms),
      guests: String(Math.min(count, rooms * perRoom)),
    };
  }
  return {
    ...form,
    date: start,
    travelers: String(Math.min(count, service.category === 'transfer' ? 20 : 9)),
    quantity: String(Math.min(count, service.category === 'esim' ? 6 : 10)),
  };
}
