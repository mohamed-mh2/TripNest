// أنواع TypeScript للواجهة تصف JSON المتبادل مع REST API؛ خادم JavaScript لا يستورد هذا الملف مباشرة؛ دون any. المسؤول: الفريق.

// ---------- Session and trips (placeholder shapes until accounts and trips are implemented) ----------

export interface DemoUser {
  id: string;
  fullName: string;
  role: 'customer' | 'admin';
}

export interface TripSummary {
  id: string;
  title: string;
  destinationCity: string;
  currency: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'archived';
}

// ---------- Travel services and bookings (abed alrahman) ----------

export type ServiceCategory =
  'flight' | 'train' | 'ferry' | 'hotel' | 'esim' | 'transfer' | 'activity';

export type PriceUnit =
  'per_traveler' | 'per_room_night' | 'per_item' | 'per_vehicle' | 'per_ticket';

export type ServiceSort = 'recommended' | 'price_asc' | 'price_desc' | 'rating' | 'name';

export interface ServiceAttributes {
  origin?: string;
  destination?: string;
  departureTime?: string;
  durationMin?: number;
  baggage?: string;
  seatClass?: string;
  stars?: number;
  maxGuestsPerRoom?: number;
  neighborhood?: string;
  checkInTime?: string;
  touristTaxPerGuestNightMinor?: number;
  amenities?: string[];
  coverage?: string;
  dataGb?: number | null;
  validityDays?: number;
  vehicleCapacity?: number;
  transferType?: string;
  pickupTime?: string;
  validityHours?: number;
  startTime?: string;
  meetingPoint?: string;
  ticketType?: string;
}

export interface CancellationPolicy {
  freeCancelHours: number | null;
  lateRefundPercent: number;
  summary: string;
  freeCancelUntil?: string | null;
}

export interface TravelService {
  id: number;
  category: ServiceCategory;
  name: string;
  providerName: string;
  city: string;
  description: string;
  unitPriceMinor: number;
  currency: string;
  priceUnit: PriceUnit;
  unitLabel: string;
  bookingFeeMinor: number;
  dailyCapacity: number | null;
  rating: number;
  attributes: ServiceAttributes;
  isDemo: boolean;
  cancellationPolicy: CancellationPolicy;
}

export interface ServiceFilters {
  q: string;
  origin: string;
  destination: string;
  coverage: string;
  transferType: string;
  minStars: string;
  minDataGb: string;
  maxPrice: string;
  minRating: string;
  freeCancellation: boolean;
  sort: ServiceSort;
}

export interface ServiceFacets {
  origins: string[];
  destinations: string[];
  coverages: string[];
  transferTypes: string[];
  minPriceMinor: number;
  maxPriceMinor: number;
}

export interface BookingSelection {
  date?: string;
  checkIn?: string;
  checkOut?: string;
  travelers?: number;
  rooms?: number;
  guests?: number;
  quantity?: number;
}

export interface PriceLine {
  kind: 'base' | 'tax' | 'fee';
  label: string;
  quantity: number;
  unitPriceMinor: number;
  amountMinor: number;
}

export interface BookingQuote {
  serviceId: number;
  category: ServiceCategory;
  startDate: string;
  endDate: string;
  startsAt: string;
  travelers: number;
  rooms: number;
  quantity: number;
  nights: number;
  billableUnits: number;
  capacityUnits: number;
  unitLabel: string;
  unitPriceMinor: number;
  lines: PriceLine[];
  subtotalMinor: number;
  taxesMinor: number;
  feesMinor: number;
  totalMinor: number;
  currency: string;
  cancellationPolicy: CancellationPolicy;
}

export interface QuoteResponse {
  quote: BookingQuote;
  availability: {
    remaining: number | null;
    isAvailable: boolean;
  };
}

export interface DemoPaymentCard {
  id: string;
  label: string;
  description: string;
}

export type BookingStatus = 'confirmed' | 'cancelled';

export interface Booking {
  id: string;
  reference: string;
  tripId: string;
  tripTitle: string;
  serviceId: number;
  category: ServiceCategory;
  serviceName: string;
  status: BookingStatus;
  startDate: string;
  endDate: string;
  startsAt: string;
  travelers: number;
  rooms: number;
  quantity: number;
  unitPriceMinor: number;
  subtotalMinor: number;
  taxesMinor: number;
  feesMinor: number;
  totalMinor: number;
  refundedMinor: number;
  netMinor: number;
  currency: string;
  priceBreakdown: {
    lines?: PriceLine[];
    unitLabel?: string;
    nights?: number;
    billableUnits?: number;
  };
  paymentMethod: string;
  paymentReference: string;
  isDemo: boolean;
  createdAt: string;
  cancelledAt: string | null;
  cancellationPolicy: CancellationPolicy;
  cancellationPreview: {
    canCancel: boolean;
    refundMinor: number;
    refundPercent: number;
    reason: string;
  };
}

export interface CreateBookingRequest {
  serviceId: number;
  tripId: string;
  selection: BookingSelection;
  paymentCardId: string;
  idempotencyKey: string;
  expectedTotalMinor: number;
}

export interface CancelBookingResponse {
  booking: Booking;
  refund: {
    amountMinor: number;
    percent: number;
    reason: string;
    currency: string;
    isSimulation: boolean;
    note: string;
  };
}

// #explain_notes: Shape used by the cost planner (Student 3): netMinor = bookedTotalMinor - refundedMinor.
export interface TripBookingSummary {
  tripId: string;
  currency: string;
  bookingCount: number;
  bookedTotalMinor: number;
  refundedMinor: number;
  netMinor: number;
}

export interface ApiErrorBody {
  error: {
    message: string;
    code: string | null;
    fields: Record<string, string> | null;
  };
}
