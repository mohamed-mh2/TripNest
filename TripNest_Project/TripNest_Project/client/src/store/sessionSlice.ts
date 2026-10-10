import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ApiUser } from '../api';

interface SessionState {
  user: ApiUser | null;
  token: string | null;
}

const initialState: SessionState = { user: null, token: null };
const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setSession: (_state, action: PayloadAction<SessionState>) => action.payload,
    clearSession: () => initialState,
  },
});

export const { setSession, clearSession } = sessionSlice.actions;
export default sessionSlice.reducer;
