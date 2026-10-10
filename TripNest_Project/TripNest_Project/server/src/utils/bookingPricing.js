// Category-specific validation and server-side price calculation for travel services. المسؤول: abed alrahman.

import {
  isValidDateString,
  todayString,
  daysBetween,
  combineDateAndTime,
} from './dates.js';
import { describePolicy, freeCancelDeadline } from './cancellationPolicy.js';

const SERVICE_CATEGORIES = [
  'flight',
  'train',
  'ferry',
  'hotel',
  'esim',
  'transfer',
  'activity',
];
const TRANSPORT_CATEGORIES = ['flight', 'train', 'ferry'];

const UNIT_LABELS = {
  per_traveler: 'traveler',
  per_room_night: 'room-night',
  per_item: 'eSIM',
  per_vehicle: 'vehicle',
  per_ticket: 'ticket',
};

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function readWholeNumber(selection, field, label, min, max, errors) {
  const value = Number(selection[field]);

  if (!Number.isInteger(value) || value < min || value > max) {
    errors[field] = `${label} must be a whole number from ${min} to ${max}.`;
    return null;
  }

  return value;
}

function readFutureDate(selection, field, label, today, errors) {
  const value = selection[field];

  if (!isValidDateString(value)) {
    errors[field] = `Choose a valid ${label.toLowerCase()}.`;
    return null;
  }

  if (value < today) {
    errors[field] = `${label} cannot be in the past.`;
    return null;
  }

  return value;
}

// #explain_notes: Each category reads only its own fields and returns billable units
// (what the price multiplies) and capacity units (what uses up daily availability).
function readSelection(service, selection, today, errors) {
  const attributes = service.attributes || {};

  if (TRANSPORT_CATEGORIES.includes(service.category)) {
    const date = readFutureDate(selection, 'date', 'Travel date', today, errors);
    const travelers = readWholeNumber(selection, 'travelers', 'Travelers', 1, 9, errors);

    return {
      startDate: date,
      endDate: date,
      startTime: attributes.departureTime,
      travelers,
      rooms: 0,
      quantity: travelers,
      nights: 0,
      billableUnits: travelers,
      capacityUnits: travelers,
      baseLabel: travelers ? `Fare for ${plural(travelers, 'traveler')}` : '',
    };
  }

  if (service.category === 'hotel') {
    const checkIn = readFutureDate(selection, 'checkIn', 'Check-in date', today, errors);
    const checkOut = readFutureDate(
      selection,
      'checkOut',
      'Check-out date',
      today,
      errors,
    );
    const rooms = readWholeNumber(selection, 'rooms', 'Rooms', 1, 5, errors);
    const maxGuestsPerRoom = attributes.maxGuestsPerRoom || 2;
    const maxGuests = (rooms || 1) * maxGuestsPerRoom;
    const guests = readWholeNumber(
      selection,
      'guests',
      `Guests (up to ${maxGuestsPerRoom} per room)`,
      1,
      maxGuests,
      errors,
    );
    let nights = 0;

    if (checkIn && checkOut) {
      nights = daysBetween(checkIn, checkOut);

      if (nights < 1) {
        errors.checkOut = 'Check-out must be after check-in.';
      } else if (nights > 30) {
        errors.checkOut = 'Stays are limited to 30 nights.';
      }
    }

    return {
      startDate: checkIn,
      endDate: checkOut,
      startTime: attributes.checkInTime,
      travelers: guests,
      rooms,
      quantity: rooms,
      nights,
      billableUnits: (rooms || 0) * nights,
      capacityUnits: rooms,
      baseLabel: rooms ? `${plural(rooms, 'room')} x ${plural(nights, 'night')}` : '',
      touristTaxUnits: (guests || 0) * nights,
    };
  }

  if (service.category === 'esim') {
    const date = readFutureDate(selection, 'date', 'Activation date', today, errors);
    const quantity = readWholeNumber(
      selection,
      'quantity',
      'Number of eSIMs',
      1,
      6,
      errors,
    );

    return {
      startDate: date,
      endDate: date,
      startTime: '00:00',
      travelers: quantity,
      rooms: 0,
      quantity,
      nights: 0,
      billableUnits: quantity,
      capacityUnits: quantity,
      baseLabel: quantity ? plural(quantity, 'eSIM package') : '',
    };
  }

  if (service.category === 'transfer') {
    const date = readFutureDate(selection, 'date', 'Pickup date', today, errors);
    const travelers = readWholeNumber(
      selection,
      'travelers',
      'Passengers',
      1,
      20,
      errors,
    );
    const isPerVehicle = service.price_unit === 'per_vehicle';
    const vehicleCapacity = attributes.vehicleCapacity || 1;
    const vehicles = travelers ? Math.ceil(travelers / vehicleCapacity) : 0;
    const units = isPerVehicle ? vehicles : travelers;

    return {
      startDate: date,
      endDate: date,
      startTime: attributes.pickupTime,
      travelers,
      rooms: 0,
      quantity: units,
      nights: 0,
      billableUnits: units,
      capacityUnits: units,
      baseLabel: isPerVehicle
        ? `${plural(vehicles, 'vehicle')} for ${plural(travelers || 0, 'passenger')}`
        : `${plural(travelers || 0, 'passenger')}`,
    };
  }

  if (service.category === 'activity') {
    const date = readFutureDate(selection, 'date', 'Activity date', today, errors);
    const tickets = readWholeNumber(selection, 'quantity', 'Tickets', 1, 10, errors);

    return {
      startDate: date,
      endDate: date,
      startTime: attributes.startTime,
      travelers: tickets,
      rooms: 0,
      quantity: tickets,
      nights: 0,
      billableUnits: tickets,
      capacityUnits: tickets,
      baseLabel: tickets ? plural(tickets, 'ticket') : '',
    };
  }

  errors.category = 'This service category cannot be booked.';
  return null;
}

// #explain_notes: The only place where booking prices are calculated. The client never sends prices.
function calculateQuote(service, selection = {}, now = new Date()) {
  const errors = {};
  const today = todayString(now);
  const picked = readSelection(service, selection || {}, today, errors);

  if (!picked || Object.keys(errors).length > 0) {
    return { errors };
  }

  const attributes = service.attributes || {};
  const lines = [];

  const subtotalMinor = service.unit_price_minor * picked.billableUnits;

  lines.push({
    kind: 'base',
    label: picked.baseLabel,
    quantity: picked.billableUnits,
    unitPriceMinor: service.unit_price_minor,
    amountMinor: subtotalMinor,
  });

  let taxesMinor = 0;

  if (service.category === 'hotel' && attributes.touristTaxPerGuestNightMinor) {
    taxesMinor = attributes.touristTaxPerGuestNightMinor * picked.touristTaxUnits;

    lines.push({
      kind: 'tax',
      label: `Tourist tax (${plural(picked.touristTaxUnits, 'guest-night')})`,
      quantity: picked.touristTaxUnits,
      unitPriceMinor: attributes.touristTaxPerGuestNightMinor,
      amountMinor: taxesMinor,
    });
  }

  const feesMinor = service.booking_fee_minor || 0;

  if (feesMinor > 0) {
    lines.push({
      kind: 'fee',
      label: 'Booking fee (non-refundable)',
      quantity: 1,
      unitPriceMinor: feesMinor,
      amountMinor: feesMinor,
    });
  }

  const startsAt = combineDateAndTime(picked.startDate, picked.startTime);
  const deadline = freeCancelDeadline(startsAt, service.free_cancel_hours);

  return {
    errors: null,
    quote: {
      serviceId: service.id,
      category: service.category,
      startDate: picked.startDate,
      endDate: picked.endDate,
      startsAt: startsAt.toISOString(),
      travelers: picked.travelers,
      rooms: picked.rooms,
      quantity: picked.quantity,
      nights: picked.nights,
      billableUnits: picked.billableUnits,
      capacityUnits: picked.capacityUnits,
      unitLabel: UNIT_LABELS[service.price_unit],
      unitPriceMinor: service.unit_price_minor,
      lines,
      subtotalMinor,
      taxesMinor,
      feesMinor,
      totalMinor: subtotalMinor + taxesMinor + feesMinor,
      currency: service.currency,
      cancellationPolicy: {
        freeCancelHours: service.free_cancel_hours,
        lateRefundPercent: service.late_refund_percent,
        freeCancelUntil: deadline ? deadline.toISOString() : null,
        summary: describePolicy(
          service.free_cancel_hours,
          service.late_refund_percent,
          feesMinor,
        ),
      },
    },
  };
}

export { SERVICE_CATEGORIES, UNIT_LABELS, calculateQuote };
