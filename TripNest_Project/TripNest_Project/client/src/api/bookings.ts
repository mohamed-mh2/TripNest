// Travel services and bookings API calls. المسؤول: abed alrahman.

import { apiRequest } from './index';
import type {
  Booking,
  BookingSelection,
  BookingStatus,
  CancelBookingResponse,
  CreateBookingRequest,
  DemoPaymentCard,
  QuoteResponse,
  ServiceCategory,
  ServiceFacets,
  ServiceFilters,
  TravelService,
  TripBookingSummary,
} from '../../../shared/types';


// #explain_notes: The price filter is typed in euros by the customer and sent to the server in cents.
function buildServiceQuery(category: ServiceCategory, filters: ServiceFilters): string {
  const params = new URLSearchParams({ category, sort: filters.sort });

  const textFilters: Array<[string, string]> = [
    ['q', filters.q.trim()],
    ['origin', filters.origin],
    ['destination', filters.destination],
    ['coverage', filters.coverage],
    ['transferType', filters.transferType],
    ['minStars', filters.minStars],
    ['minDataGb', filters.minDataGb],
    ['minRating', filters.minRating],
  ];

  for (const [key, value] of textFilters) {
    if (value) {
      params.set(key, value);
    }
  }

  const maxPrice = Number(filters.maxPrice);

  if (filters.maxPrice && Number.isFinite(maxPrice) && maxPrice >= 0) {
    params.set('maxPriceMinor', String(Math.round(maxPrice * 100)));
  }

  if (filters.freeCancellation) {
    params.set('freeCancellation', 'true');
  }

  return params.toString();
}


export function fetchServices(category: ServiceCategory, filters: ServiceFilters) {
  return apiRequest<{ services: TravelService[] }>(`/services?${buildServiceQuery(category, filters)}`);
}


export function fetchServiceFacets(category: ServiceCategory) {
  return apiRequest<ServiceFacets>(`/services/facets?category=${category}`);
}


export function fetchService(serviceId: number) {
  return apiRequest<{ service: TravelService }>(`/services/${serviceId}`);
}


export function fetchQuote(serviceId: number, selection: BookingSelection) {
  return apiRequest<QuoteResponse>(`/services/${serviceId}/quote`, {
    method: 'POST',
    body: { selection },
  });
}


export function fetchPaymentOptions() {
  return apiRequest<{ isSimulation: boolean; cards: DemoPaymentCard[] }>('/bookings/payment-options');
}


export function createBooking(request: CreateBookingRequest) {
  return apiRequest<{ booking: Booking; replayed: boolean }>('/bookings', {
    method: 'POST',
    body: request,
  });
}


export function fetchMyBookings(filters: { tripId?: number | null; status?: BookingStatus | null } = {}) {
  const params = new URLSearchParams();

  if (filters.tripId) {
    params.set('tripId', String(filters.tripId));
  }

  if (filters.status) {
    params.set('status', filters.status);
  }

  const query = params.toString();

  return apiRequest<{ bookings: Booking[] }>(`/bookings${query ? `?${query}` : ''}`);
}


export function fetchBooking(bookingId: number) {
  return apiRequest<{ booking: Booking }>(`/bookings/${bookingId}`);
}


export function cancelBooking(bookingId: number) {
  return apiRequest<CancelBookingResponse>(`/bookings/${bookingId}/cancel`, { method: 'POST' });
}


export function fetchTripBookingSummary(tripId: number) {
  return apiRequest<TripBookingSummary>(`/bookings/trips/${tripId}/summary`);
}
