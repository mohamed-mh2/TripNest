import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { WalletData } from '../api/wallet';
type WalletState = { data: WalletData | null };
const initialState: WalletState = { data: null };
const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    walletLoaded(state, action: PayloadAction<WalletData>) {
      state.data = action.payload;
    },
  },
});

export const { walletLoaded } = walletSlice.actions;
export default walletSlice.reducer;
