import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
const financeUiSlice = createSlice({
  name: 'financeUi',
  initialState: { budgetSource: 'practice' as 'practice' | 'database' },
  reducers: {
    setBudgetSource(state, action: PayloadAction<'practice' | 'database'>) {
      state.budgetSource = action.payload;
    },
  },
});

export const { setBudgetSource } = financeUiSlice.actions;
export default financeUiSlice.reducer;
