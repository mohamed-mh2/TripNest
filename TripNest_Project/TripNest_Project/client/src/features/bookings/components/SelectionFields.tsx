// Category-specific booking inputs: dates, travelers, rooms, guests, or quantity. المسؤول: abed alrahman.

import { TRANSPORT_CATEGORIES } from '../categories';
import type {
  BookingSelection,
  TravelService,
  TripSummary,
} from '../../../../../shared/types';

export interface SelectionForm {
  date: string;
  checkIn: string;
  checkOut: string;
  travelers: string;
  rooms: string;
  guests: string;
  quantity: string;
}

export const EMPTY_SELECTION_FORM: SelectionForm = {
  date: '',
  checkIn: '',
  checkOut: '',
  travelers: '1',
  rooms: '1',
  guests: '1',
  quantity: '1',
};

// #explain_notes: Sends only the fields the category uses. Returns null until the required dates are chosen.
export function toSelection(
  service: TravelService,
  form: SelectionForm,
): BookingSelection | null {
  if (service.category === 'hotel') {
    if (!form.checkIn || !form.checkOut) {
      return null;
    }

    return {
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      rooms: Number(form.rooms),
      guests: Number(form.guests),
    };
  }

  if (!form.date) {
    return null;
  }

  if (
    TRANSPORT_CATEGORIES.includes(service.category) ||
    service.category === 'transfer'
  ) {
    return { date: form.date, travelers: Number(form.travelers) };
  }

  return { date: form.date, quantity: Number(form.quantity) };
}

interface SelectionFieldsProps {
  service: TravelService;
  form: SelectionForm;
  trip: TripSummary | null;
  minDate: string;
  errors: Record<string, string>;
  onChange: (changes: Partial<SelectionForm>) => void;
}

function FieldError({ message }: { message?: string }) {
  return message ? <span className="field__error">{message}</span> : null;
}

function NumberField(props: {
  label: string;
  value: string;
  min: number;
  max: number;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span className="field__label">{props.label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={props.min}
        max={props.max}
        step={1}
        value={props.value}
        aria-invalid={Boolean(props.error)}
        onChange={(event) => props.onChange(event.target.value)}
      />
      <FieldError message={props.error} />
    </label>
  );
}

function DateField(props: {
  label: string;
  value: string;
  min: string;
  max?: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span className="field__label">{props.label}</span>
      <input
        type="date"
        value={props.value}
        min={props.min}
        max={props.max}
        aria-invalid={Boolean(props.error)}
        onChange={(event) => props.onChange(event.target.value)}
      />
      <FieldError message={props.error} />
    </label>
  );
}

const DATE_LABELS: Record<string, string> = {
  flight: 'Travel date',
  train: 'Travel date',
  ferry: 'Travel date',
  esim: 'Activation date',
  transfer: 'Pickup date',
  activity: 'Activity date',
};

export function SelectionFields({
  service,
  form,
  trip,
  minDate,
  errors,
  onChange,
}: SelectionFieldsProps) {
  const maxDate = trip?.endDate;

  if (service.category === 'hotel') {
    const maxGuests =
      Math.max(Number(form.rooms) || 1, 1) * (service.attributes.maxGuestsPerRoom || 2);

    return (
      <div className="selection-grid">
        <DateField
          label="Check-in"
          value={form.checkIn}
          min={minDate}
          max={maxDate}
          error={errors.checkIn}
          onChange={(checkIn) => onChange({ checkIn })}
        />
        <DateField
          label="Check-out"
          value={form.checkOut}
          min={form.checkIn || minDate}
          max={maxDate}
          error={errors.checkOut}
          onChange={(checkOut) => onChange({ checkOut })}
        />
        <NumberField
          label="Rooms"
          value={form.rooms}
          min={1}
          max={5}
          error={errors.rooms}
          onChange={(rooms) => onChange({ rooms })}
        />
        <NumberField
          label={`Guests (max ${maxGuests})`}
          value={form.guests}
          min={1}
          max={maxGuests}
          error={errors.guests}
          onChange={(guests) => onChange({ guests })}
        />
      </div>
    );
  }

  const usesTravelers =
    TRANSPORT_CATEGORIES.includes(service.category) || service.category === 'transfer';

  return (
    <div className="selection-grid">
      <DateField
        label={DATE_LABELS[service.category]}
        value={form.date}
        min={minDate}
        max={maxDate}
        error={errors.date}
        onChange={(date) => onChange({ date })}
      />

      {usesTravelers ? (
        <NumberField
          label={service.category === 'transfer' ? 'Passengers' : 'Travelers'}
          value={form.travelers}
          min={1}
          max={service.category === 'transfer' ? 20 : 9}
          error={errors.travelers}
          onChange={(travelers) => onChange({ travelers })}
        />
      ) : (
        <NumberField
          label={service.category === 'esim' ? 'Number of eSIMs' : 'Tickets'}
          value={form.quantity}
          min={1}
          max={service.category === 'esim' ? 6 : 10}
          error={errors.quantity}
          onChange={(quantity) => onChange({ quantity })}
        />
      )}
    </div>
  );
}
