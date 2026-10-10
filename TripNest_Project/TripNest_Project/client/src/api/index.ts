import { financeAccessToken, getFinanceSession } from './financeSession';
import type { ApiErrorBody } from '../../../shared/types';

export class ApiError extends Error {
  status: number;
  code: string | null;
  fields: Record<string, string> | null;

  constructor(status: number, body: ApiErrorBody | { error: string } | null) {
    const error = body?.error;
    super(
      typeof error === 'string'
        ? error
        : error?.message || 'Could not reach the TripNest server. Please try again.',
    );
    this.status = status;
    this.code = typeof error === 'object' ? error.code : null;
    this.fields = typeof error === 'object' ? error.fields : null;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}

// #explain_notes: Bookings use the existing verified finance session, never a user ID header.
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (path.startsWith('/bookings')) {
    const session = await getFinanceSession('traveler');
    headers.Authorization = 'Bearer ' + financeAccessToken(session.token);
  }
  let response: Response;
  try {
    response = await fetch('/api' + path, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, null);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data);
  return data as T;
}
