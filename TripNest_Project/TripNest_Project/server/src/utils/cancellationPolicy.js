// Cancellation policy wording and refund calculation for travel bookings. المسؤول: abed alrahman.

const HOUR_MS = 60 * 60 * 1000;

function describePolicy(freeCancelHours, lateRefundPercent, bookingFeeMinor = 0) {
  const feeNote = bookingFeeMinor > 0 ? ' The booking fee is non-refundable.' : '';

  if (freeCancelHours === null || freeCancelHours === undefined) {
    if (lateRefundPercent > 0) {
      return `Partially refundable: cancelling gives a ${lateRefundPercent}% refund before the service starts.${feeNote}`;
    }

    return 'Non-refundable: cancelling gives no refund.';
  }

  const lateText =
    lateRefundPercent > 0
      ? `After that, cancelling refunds ${lateRefundPercent}%.`
      : 'After that, cancelling gives no refund.';

  return `Free cancellation up to ${freeCancelHours} hours before the start time. ${lateText}${feeNote}`;
}

function freeCancelDeadline(startsAt, freeCancelHours) {
  if (freeCancelHours === null || freeCancelHours === undefined) {
    return null;
  }

  return new Date(new Date(startsAt).getTime() - freeCancelHours * HOUR_MS);
}

// #explain_notes: Refund = percentage of (total - non-refundable booking fee).
// Only a 'confirmed' booking that has not started can be cancelled, so a second cancellation never refunds again.
function calculateRefund(booking, now = new Date()) {
  if (booking.status !== 'confirmed') {
    return {
      canCancel: false,
      refundMinor: 0,
      refundPercent: 0,
      reason: 'This booking is already cancelled.',
    };
  }

  const startsAt = new Date(booking.starts_at);

  if (now.getTime() >= startsAt.getTime()) {
    return {
      canCancel: false,
      refundMinor: 0,
      refundPercent: 0,
      reason: 'This service has already started, so it can no longer be cancelled.',
    };
  }

  const hoursLeft = (startsAt.getTime() - now.getTime()) / HOUR_MS;
  const isFreeCancellation =
    booking.free_cancel_hours !== null && hoursLeft >= booking.free_cancel_hours;
  const refundPercent = isFreeCancellation ? 100 : booking.late_refund_percent;
  const refundableBase = booking.total_minor - booking.fees_minor;
  const refundMinor = Math.floor((refundableBase * refundPercent) / 100);

  let reason = "No refund applies under this booking's cancellation policy.";

  if (isFreeCancellation) {
    reason =
      booking.fees_minor > 0
        ? 'Free cancellation period: full refund except the non-refundable booking fee.'
        : 'Free cancellation period: full refund.';
  } else if (refundPercent > 0) {
    reason = `Late cancellation: ${refundPercent}% refund under the cancellation policy.`;
  }

  return {
    canCancel: true,
    refundMinor,
    refundPercent,
    reason,
  };
}

export { describePolicy, freeCancelDeadline, calculateRefund };
