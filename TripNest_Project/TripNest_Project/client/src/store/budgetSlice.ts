import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  decodeBudget,
  emptyBudget,
  validCents,
  validExpense,
  type Expense,
  type BudgetState,
} from '../features/budget/model';

export const storageKey = 'tripnest.practice-budget.v1';
let initialState = emptyBudget;
export let storageNotice = '';
try {
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    const decoded = decodeBudget(saved);
    if (decoded) initialState = decoded;
    else
      storageNotice = 'Saved practice data could not be read. A fresh budget was loaded.';
  }
} catch {
  storageNotice =
    'Browser storage is unavailable. Your changes may not survive a reload.';
}

const budgetSlice = createSlice({
  name: 'budget',
  initialState,
  reducers: {
    loadServerBudget(_state, action: PayloadAction<BudgetState>) {
      return action.payload;
    },
    updatePlan(
      state,
      action: PayloadAction<{ budgetInCents: number; reserveInCents: number }>,
    ) {
      if (
        validCents(action.payload.budgetInCents) &&
        validCents(action.payload.reserveInCents)
      ) {
        state.budgetInCents = action.payload.budgetInCents;
        state.reserveInCents = action.payload.reserveInCents;
      }
    },
    addExpense(state, action: PayloadAction<Expense>) {
      if (
        validExpense(action.payload) &&
        state.expenses.length < 1000 &&
        !state.expenses.some((expense) => expense.id === action.payload.id)
      )
        state.expenses.push(action.payload);
    },
    // #explain_notes: An assistant proposal is applied as one batch and replaying its IDs adds nothing twice.
    addEstimates(state, action: PayloadAction<Expense[]>) {
      const items = action.payload;
      if (
        !items.length ||
        !items.every(validExpense) ||
        new Set(items.map((e) => e.id)).size !== items.length
      )
        return;
      const fresh = items.filter((item) => !state.expenses.some((e) => e.id === item.id));
      if (state.expenses.length + fresh.length > 1000) return;
      state.expenses.push(...fresh);
    },

    updateExpense(state, action: PayloadAction<Expense>) {
      const index = state.expenses.findIndex(
        (expense) => expense.id === action.payload.id,
      );
      if (index >= 0 && validExpense(action.payload))
        state.expenses[index] = action.payload;
    },
    removeExpense(state, action: PayloadAction<string>) {
      state.expenses = state.expenses.filter((expense) => expense.id !== action.payload);
    },
  },
});

export const {
  loadServerBudget,
  updatePlan,
  addExpense,
  addEstimates,
  updateExpense,
  removeExpense,
} = budgetSlice.actions;
export default budgetSlice.reducer;
