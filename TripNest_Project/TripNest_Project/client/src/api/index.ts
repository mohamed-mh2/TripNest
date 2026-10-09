// اتصال الواجهة بواجهات API؛ تُفصل الطلبات حسب الميزة عند التنفيذ. المسؤول: الفريق.

import type { ApiErrorBody } from '../../../shared/types';


export class ApiError extends Error {
  status: number;
  code: string | null;
  fields: Record<string, string> | null;

  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.error?.message || 'Could not reach the TripNest server. Please try again.');
    this.status = status;
    this.code = body?.error?.code || null;
    this.fields = body?.error?.fields || null;
  }
}


// #explain_notes: Development-only demo session id. The real login (madin abed) should replace this
// with a token header while keeping apiRequest() unchanged for feature code.
let demoUserId: number | null = null;

export function setDemoUserId(userId: number | null): void {
  demoUserId = userId;
}


interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}


export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (demoUserId !== null) {
    headers['X-Demo-User'] = String(demoUserId);
  }

  let response: Response;

  try {
    response = await fetch(`/api${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, null);
  }

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(response.status, data as ApiErrorBody | null);
  }

  return data as T;
}
