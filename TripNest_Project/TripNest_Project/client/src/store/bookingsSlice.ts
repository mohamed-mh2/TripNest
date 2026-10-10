// Redux Toolkit slice لإدارة مرشحات العروض والحجوزات وحالات تحميلها في الشاشات المشتركة. المسؤول: abed alrahman.

import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import * as bookingsApi from '../api/bookings';
import { demoUserSelected } from './sessionSlice';
import type {
  Booking,
  BookingStatus,
  ServiceCategory,
  ServiceFilters,
} from '../../../shared/types';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface BookingsState {
  category: ServiceCategory;
  filters: ServiceFilters;
  myBookings: Booking[];
  myBookingsStatus: LoadStatus;
  myBookingsError: string | null;
  // #explain_notes: Increases after every booking or cancellation. The cost planner (Student 3)
  // can watch this number and reload its plan so booking costs stay current.
  planRevision: number;
}

export const DEFAULT_FILTERS: ServiceFilters = {
  q: '',
  origin: '',
  destination: '',
  coverage: '',
  transferType: '',
  minStars: '',
  minDataGb: '',
  maxPrice: '',
  minRating: '',
  freeCancellation: false,
  sort: 'recommended',
};

const initialState: BookingsState = {
  category: 'flight',
  filters: DEFAULT_FILTERS,
  myBookings: [],
  myBookingsStatus: 'idle',
  myBookingsError: null,
  planRevision: 0,
};

export const loadMyBookings = createAsyncThunk(
  'bookings/loadMine',
  async (filters: { tripId?: string | null; status?: BookingStatus | null } = {}) => {
    const response = await bookingsApi.fetchMyBookings(filters);
    return response.bookings;
  },
);

function upsertBooking(list: Booking[], booking: Booking): Booking[] {
  const exists = list.some((item) => item.id === booking.id);

  return exists
    ? list.map((item) => (item.id === booking.id ? booking : item))
    : [booking, ...list];
}

const bookingsSlice = createSlice({
  name: 'bookings',
  initialState,
  reducers: {
    categoryChanged(state, action: PayloadAction<ServiceCategory>) {
      if (state.category !== action.payload) {
        state.category = action.payload;
        state.filters = {
          ...DEFAULT_FILTERS,
          sort: state.filters.sort,
          q: state.filters.q,
        };
      }
    },
    filtersChanged(state, action: PayloadAction<Partial<ServiceFilters>>) {
      state.filters = { ...state.filters, ...action.payload };
    },
    filtersReset(state) {
      state.filters = DEFAULT_FILTERS;
    },
    // #explain_notes: Called after a confirmed booking or a cancellation returned by the server.
    bookingSaved(state, action: PayloadAction<Booking>) {
      state.myBookings = upsertBooking(state.myBookings, action.payload);
      state.planRevision += 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadMyBookings.pending, (state) => {
        state.myBookingsStatus = 'loading';
        state.myBookingsError = null;
      })
      .addCase(loadMyBookings.fulfilled, (state, action) => {
        state.myBookingsStatus = 'ready';
        state.myBookings = action.payload;
      })
      .addCase(loadMyBookings.rejected, (state, action) => {
        state.myBookingsStatus = 'error';
        state.myBookingsError = action.error.message || 'Could not load your bookings.';
      })
      .addCase(demoUserSelected, (state) => {
        state.myBookings = [];
        state.myBookingsStatus = 'idle';
      });
  },
});

export const { categoryChanged, filtersChanged, filtersReset, bookingSaved } =
  bookingsSlice.actions;

export default bookingsSlice.reducer;
