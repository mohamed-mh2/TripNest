import type { CreateBookingRequest } from '../../../../shared/types';

const prefix = 'tripnest.pending-booking.';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function decodePendingBooking(value: string | null): CreateBookingRequest | null {
  try {
    const body = JSON.parse(value ?? 'null');
    if (
      !body ||
      !Number.isSafeInteger(body.serviceId) ||
      body.serviceId <= 0 ||
      !uuid.test(body.tripId) ||
      !uuid.test(body.idempotencyKey) ||
      !['demo_card_approve', 'demo_card_decline'].includes(body.paymentCardId) ||
      !Number.isSafeInteger(body.expectedTotalMinor) ||
      body.expectedTotalMinor < 0 ||
      !body.selection ||
      typeof body.selection !== 'object' ||
      Array.isArray(body.selection)
    )
      return null;
    return body;
  } catch {
    return null;
  }
}

export function readPendingBooking(userId: string): CreateBookingRequest | null {
  try {
    return decodePendingBooking(sessionStorage.getItem(prefix + userId));
  } catch {
    return null;
  }
}

// #explain_notes: Preserve the same request after a lost response or refresh; no payment credentials are stored.
export function rememberPendingBooking(userId: string, body: CreateBookingRequest) {
  sessionStorage.setItem(prefix + userId, JSON.stringify(body));
}

export function clearPendingBooking(userId: string) {
  try {
    sessionStorage.removeItem(prefix + userId);
  } catch {
    /* Server idempotency still applies. */
  }
}
