import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import budgetReducer from './budgetSlice';
import walletReducer from './walletSlice';
import financeUiReducer from './financeUiSlice';
import sessionReducer from './sessionSlice';
import bookingsReducer from './bookingsSlice';
import { supportReducer } from './supportSlice';

// The team can register other feature reducers alongside budget here.

export const store = configureStore({
  reducer: {
    budget: budgetReducer,
    wallet: walletReducer,
    financeUi: financeUiReducer,
    session: sessionReducer,
    bookings: bookingsReducer,
    support: supportReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;

export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();

export const useAppSelector = useSelector.withTypes<RootState>();
