import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { apiRequest } from '../api';
import type { TripSummary } from '../../../shared/types';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';
interface SessionState {
  currentUserId: string | null;
  trips: TripSummary[];
  tripsStatus: LoadStatus;
  error: string | null;
}
const initialState: SessionState = {
  currentUserId: null,
  trips: [],
  tripsStatus: 'idle',
  error: null,
};

// #explain_notes: Read-only bridge to Student 1's future accounts/trips; no parallel login system.
export const loadBookingSession = createAsyncThunk(
  'session/loadBookingSession',
  async () => apiRequest<{ userId: string; trips: TripSummary[] }>('/bookings/session'),
);

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    demoUserSelected(state) {
      state.currentUserId = null;
      state.trips = [];
      state.tripsStatus = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadBookingSession.pending, (state) => {
        state.tripsStatus = 'loading';
        state.error = null;
      })
      .addCase(loadBookingSession.fulfilled, (state, action) => {
        state.currentUserId = action.payload.userId;
        state.trips = action.payload.trips;
        state.tripsStatus = 'ready';
      })
      .addCase(loadBookingSession.rejected, (state, action) => {
        state.currentUserId = null;
        state.trips = [];
        state.tripsStatus = 'error';
        state.error = action.error.message || 'Could not open the saved trip.';
      });
  },
});
export const { demoUserSelected } = sessionSlice.actions;
export default sessionSlice.reducer;
