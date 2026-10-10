import { useEffect, useState, type ReactNode } from 'react';
import { authApi, tripsApi, type AccountUser, type Trip } from '../../api/accounts';
import {
  getAccountToken,
  getAccountTripId,
  setAccountTrip,
  clearAccountSession,
  isDemoWorkspace,
} from '../../api/accountSession';
import { ApiError } from '../../api';
import { getFinanceSession } from '../../api/financeSession';
import { store } from '../../store';
import { loadServerBudget } from '../../store/budgetSlice';
import { setBudgetSource } from '../../store/financeUiSlice';

export default function AccountBootstrap({
  children,
}: {
  children: (user: AccountUser | null, trips: Trip[]) => ReactNode;
}) {
  const [state, setState] = useState<{
    busy: boolean;
    user: AccountUser | null;
    trips: Trip[];
    error: string;
  }>({
    busy: !!getAccountToken() || isDemoWorkspace(),
    user: null,
    trips: [],
    error: '',
  });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!getAccountToken() && !isDemoWorkspace()) return;
    let active = true;
    setState((s) => ({ ...s, busy: true, error: '' }));
    void (async () => {
      try {
        const { user } = getAccountToken() ? await authApi.me() : { user: null };
        const preferredTripId =
          getAccountTripId() || (await getFinanceSession('traveler')).tripId;
        const { trips } = await tripsApi.list();
        if (!active) return;
        const activeTrips = trips.filter((t) => t.status === 'active');
        const selected =
          activeTrips.find((t) => t.id === preferredTripId) || activeTrips[0];
        setAccountTrip(selected?.id);
        if (user)
          store.dispatch(
            loadServerBudget({
              budgetInCents: 0,
              reserveInCents: 0,
              expenses: [],
              bookings: [],
            }),
          );
        if (user) store.dispatch(setBudgetSource('database'));
        setState({ busy: false, user, trips: activeTrips, error: '' });
      } catch (e) {
        if (!active) return;
        if (e instanceof ApiError && e.status === 401) {
          clearAccountSession();
          window.location.replace('/auth?expired=1');
          return;
        }
        setState((s) => ({
          ...s,
          busy: false,
          error: e instanceof Error ? e.message : 'Could not open your account.',
        }));
      }
    })();
    return () => {
      active = false;
    };
  }, [retry]);
  useEffect(() => {
    if (!state.user) return;
    let checking = false;
    const check = async () => {
      if (checking || document.visibilityState === 'hidden') return;
      checking = true;
      try {
        await authApi.me();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          clearAccountSession();
          window.location.replace('/auth?expired=1');
        }
      } finally {
        checking = false;
      }
    };
    const timer = window.setInterval(() => void check(), 60000);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', check);
    };
  }, [state.user]);
  if (state.busy)
    return (
      <main className="account-workspace">
        <p role="status">Opening your travel workspace…</p>
      </main>
    );
  if (state.error)
    return (
      <main className="account-workspace">
        <h1>Could not open your account</h1>
        <p role="alert">{state.error}</p>
        <button onClick={() => setRetry((n) => n + 1)}>Try again</button>
        <p>Your saved account data has not been changed.</p>
      </main>
    );
  return children(state.user, state.trips);
}
