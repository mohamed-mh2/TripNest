// Redux Toolkit slice لإدارة الحساب والرحلة المختارة في الشاشات المشتركة. المسؤول: madin abed.
// #explain_notes: Placeholder added by Student 2 for the development-only demo session and the
// signed-in customer's trips. madin abed can replace the demo user with real login state.

import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { apiRequest, setDemoUserId } from '../api';
import type { DemoUser, TripSummary } from '../../../shared/types';


type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface SessionState {
  demoUsers: DemoUser[];
  currentUserId: number | null;
  trips: TripSummary[];
  tripsStatus: LoadStatus;
  usersStatus: LoadStatus;
}

const STORAGE_KEY = 'tripnest.demoUserId';


// #explain_notes: Remembers the chosen demo customer in this browser only (convenience, not security).
function readStoredUserId(): number | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && /^\d+$/.test(stored) ? Number(stored) : null;
  } catch {
    return null;
  }
}


function storeUserId(userId: number | null): void {
  try {
    if (userId === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, String(userId));
    }
  } catch {
    // Storage can be unavailable (private mode); the session still works until reload.
  }
}


const initialUserId = readStoredUserId();
setDemoUserId(initialUserId);

const initialState: SessionState = {
  demoUsers: [],
  currentUserId: initialUserId,
  trips: [],
  tripsStatus: 'idle',
  usersStatus: 'idle',
};


export const loadDemoUsers = createAsyncThunk('session/loadDemoUsers', async () => {
  const response = await apiRequest<{ users: DemoUser[] }>('/auth/demo-users');
  return response.users;
});


export const loadTrips = createAsyncThunk('session/loadTrips', async () => {
  const response = await apiRequest<{ trips: TripSummary[] }>('/trips');
  return response.trips;
});


const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    demoUserSelected(state, action: PayloadAction<number | null>) {
      state.currentUserId = action.payload;
      state.trips = [];
      state.tripsStatus = 'idle';
      setDemoUserId(action.payload);
      storeUserId(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadDemoUsers.pending, (state) => {
        state.usersStatus = 'loading';
      })
      .addCase(loadDemoUsers.fulfilled, (state, action) => {
        state.usersStatus = 'ready';
        state.demoUsers = action.payload;
      })
      .addCase(loadDemoUsers.rejected, (state) => {
        state.usersStatus = 'error';
      })
      .addCase(loadTrips.pending, (state) => {
        state.tripsStatus = 'loading';
      })
      .addCase(loadTrips.fulfilled, (state, action) => {
        state.tripsStatus = 'ready';
        state.trips = action.payload;
      })
      .addCase(loadTrips.rejected, (state) => {
        state.tripsStatus = 'error';
      });
  },
});


export const { demoUserSelected } = sessionSlice.actions;

export default sessionSlice.reducer;
