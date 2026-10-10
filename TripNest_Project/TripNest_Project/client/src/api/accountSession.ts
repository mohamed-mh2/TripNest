import type { AccountUser } from '../../../shared/types';

const KEY = 'tripnest.account-session.v1';
type SavedSession = { token: string; tripId?: string; expiresAt: string };
let saved: SavedSession | null = null;
let demoTripId: string | undefined;
let mode = import.meta.env.DEV ? 'demo' : 'signed-out';
try {
  mode = sessionStorage.getItem('tripnest.account-mode') || mode;
  demoTripId = sessionStorage.getItem('tripnest.demo-trip') || undefined;
  const raw = sessionStorage.getItem(KEY);
  if (raw) {
    const value = JSON.parse(raw) as Partial<SavedSession>;
    if (
      typeof value.token === 'string' &&
      typeof value.expiresAt === 'string' &&
      Date.parse(value.expiresAt) > Date.now()
    )
      saved = {
        token: value.token,
        expiresAt: value.expiresAt,
        tripId: typeof value.tripId === 'string' ? value.tripId : undefined,
      };
    else {
      sessionStorage.removeItem(KEY);
      mode = 'signed-out';
    }
  }
} catch {
  mode = 'signed-out';
}

export const getAccountToken = () => saved?.token || '';
export const getAccountTripId = () =>
  saved?.tripId ?? (isDemoWorkspace() ? demoTripId : undefined);
export const isDemoWorkspace = () => !saved && mode === 'demo' && import.meta.env.DEV;
export const hasAccount = () => !!saved;

export function saveAccountSession(result: {
  token: string;
  expiresAt: string;
  user: AccountUser;
}) {
  saved = { token: result.token, expiresAt: result.expiresAt };
  mode = 'account';
  sessionStorage.setItem(KEY, JSON.stringify(saved));
  sessionStorage.setItem('tripnest.account-mode', mode);
}
export function setAccountTrip(id: string | undefined) {
  if (!saved) {
    if (isDemoWorkspace()) {
      demoTripId = id;
      if (id) sessionStorage.setItem('tripnest.demo-trip', id);
      else sessionStorage.removeItem('tripnest.demo-trip');
    }
    return;
  }
  saved.tripId = id;
  sessionStorage.setItem(KEY, JSON.stringify(saved));
}
export function clearAccountSession() {
  saved = null;
  mode = 'signed-out';
  sessionStorage.removeItem(KEY);
  sessionStorage.setItem('tripnest.account-mode', mode);
}
export function openDemoWorkspace() {
  clearAccountSession();
  mode = 'demo';
  sessionStorage.setItem('tripnest.account-mode', mode);
  window.location.assign('/services');
}
// #explain_notes: A reload discards every feature's drafts and cached data on account/trip changes.
export function openAccountTrip(id: string, path = '/#budget') {
  setAccountTrip(id);
  window.location.assign(path);
}
