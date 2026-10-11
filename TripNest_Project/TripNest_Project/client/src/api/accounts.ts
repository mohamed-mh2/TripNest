import { apiRequest } from './index';
import type { AccountUser, Trip } from '../../../shared/types';
export type { Trip, AccountUser } from '../../../shared/types';
type LoginResult = { token: string; user: AccountUser; expiresAt: string };
export const authApi = {
  register: (body: { name: string; email: string; password: string }) =>
    apiRequest<LoginResult>('/auth/register', { method: 'POST', body }),
  login: (body: { email: string; password: string }) =>
    apiRequest<LoginResult>('/auth/login', { method: 'POST', body }),
  me: () => apiRequest<{ user: AccountUser }>('/auth/me'),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
  updateProfile: (body: { name: string }) =>
    apiRequest<{ user: AccountUser }>('/auth/profile', { method: 'PATCH', body }),
  inspectSetup: (token: string) =>
    apiRequest<{ invitation: { name: string; email: string; expires_at: string } }>(
      '/auth/setup/preview',
      { method: 'POST', body: { token } },
    ),
  activateSetup: (body: { token: string; password: string }) =>
    apiRequest<LoginResult>('/auth/setup/activate', { method: 'POST', body }),
};
export const tripsApi = {
  list: () => apiRequest<{ trips: Trip[] }>('/trips'),
  get: (id: string) => apiRequest<{ trip: Trip }>('/trips/' + encodeURIComponent(id)),
  create: (body: unknown) =>
    apiRequest<{ trip: Trip }>('/trips', { method: 'POST', body }),
  update: (id: string, body: unknown) =>
    apiRequest<{ trip: Trip }>('/trips/' + encodeURIComponent(id), {
      method: 'PATCH',
      body,
    }),
  archive: (id: string) =>
    apiRequest<{ trip: Trip }>('/trips/' + encodeURIComponent(id), { method: 'DELETE' }),
  restore: (id: string) =>
    apiRequest<{ trip: Trip }>('/trips/' + encodeURIComponent(id) + '/restore', {
      method: 'POST',
    }),
};
