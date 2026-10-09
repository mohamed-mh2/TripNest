// تجميع Redux Toolkit slices للحساب والرحلة المختارة والحجوزات والميزانية والمحفظة؛ لا تحفظ أسراراً في الحالة. المسؤول: الفريق.
// #explain_notes: wallet and support slices are added here by their owners when implemented.

import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';

import sessionReducer from './sessionSlice';
import bookingsReducer from './bookingsSlice';


export const store = configureStore({
  reducer: {
    session: sessionReducer,
    bookings: bookingsReducer,
  },
});


export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
