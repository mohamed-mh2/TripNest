import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Trip } from '../../../shared/types';

type LoadStatus = 'idle' | 'loading' | 'succeeded' | 'failed';
interface TripsState {
  trips: Trip[];
  selectedTripId: string | null;
  selectedTrip: Trip | null;
  listStatus: LoadStatus;
  listError: string | null;
  detailsStatus: LoadStatus;
  detailsError: string | null;
}

const initialState: TripsState = {
  trips: [], selectedTripId: null, selectedTrip: null,
  listStatus: 'idle', listError: null, detailsStatus: 'idle', detailsError: null,
};

const tripsSlice = createSlice({
  name: 'trips',
  initialState,
  reducers: {
    tripsLoading(state) { state.listStatus = 'loading'; state.listError = null; },
    tripsLoaded(state, action: PayloadAction<Trip[]>) {
      state.trips = action.payload;
      state.listStatus = 'succeeded';
      state.listError = null;
      if (!state.selectedTripId || !state.trips.some((trip) => trip.id === state.selectedTripId)) {
        state.selectedTripId = state.trips[0]?.id ?? null;
      }
      state.selectedTrip = state.trips.find((trip) => trip.id === state.selectedTripId) ?? null;
    },
    tripsFailed(state, action: PayloadAction<string>) {
      state.listStatus = 'failed';
      state.listError = action.payload;
    },
    selectTrip(state, action: PayloadAction<string | null>) {
      state.selectedTripId = action.payload;
      state.selectedTrip = state.trips.find((trip) => trip.id === action.payload) ?? null;
      state.detailsStatus = state.selectedTrip ? 'succeeded' : 'idle';
      state.detailsError = null;
    },
    tripDetailsLoading(state) { state.detailsStatus = 'loading'; state.detailsError = null; },
    tripDetailsFailed(state, action: PayloadAction<string>) {
      state.detailsStatus = 'failed';
      state.detailsError = action.payload;
      state.selectedTrip = null;
    },
    tripSaved(state, action: PayloadAction<Trip>) {
      const index = state.trips.findIndex((trip) => trip.id === action.payload.id);
      if (index < 0) state.trips.unshift(action.payload);
      else state.trips[index] = action.payload;
      state.selectedTripId = action.payload.id;
      state.selectedTrip = action.payload;
      state.listStatus = 'succeeded';
      state.listError = null;
      state.detailsStatus = 'succeeded';
      state.detailsError = null;
    },
    tripArchived(state, action: PayloadAction<string>) {
      state.trips = state.trips.filter((trip) => trip.id !== action.payload);
      if (state.selectedTripId === action.payload) {
        state.selectedTripId = state.trips[0]?.id ?? null;
        state.selectedTrip = state.trips[0] ?? null;
        state.detailsStatus = state.selectedTrip ? 'succeeded' : 'idle';
        state.detailsError = null;
      }
    },
  },
});

export const {
  tripsLoading, tripsLoaded, tripsFailed, selectTrip,
  tripDetailsLoading, tripDetailsFailed, tripSaved, tripArchived,
} = tripsSlice.actions;
export default tripsSlice.reducer;
