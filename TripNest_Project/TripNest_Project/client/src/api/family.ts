import {
  financeAccessToken,
  getFinanceSession,
  type FinanceRole,
} from './financeSession';

export type FamilyRequest = {
  id: string;
  amountMinor: number;
  currency: 'EUR';
  status: 'pending' | 'paid' | 'cancelled' | 'expired';
  createdAt: string;
  expiresAt: string;
  paidAt: string | null;
  simulation: true;
};

export type FamilyPreview = Pick<
  FamilyRequest,
  'id' | 'amountMinor' | 'currency' | 'status' | 'expiresAt' | 'simulation'
> & { recipientName: string; canPay: boolean; ownRequest: boolean };

export type FamilyReceipt = {
  id: string;
  amountMinor: number;
  currency: 'EUR';
  status: 'paid';
  paidAt: string;
  simulation: true;
};
let token = '';

export class FamilyError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function familyRequest<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  key?: string,
): Promise<T> {
  const response = await fetch('/api/support-requests' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + financeAccessToken(token),
      'Content-Type': 'application/json',
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response
    .json()
    .catch(() => ({ error: 'Unreadable response. Reconnect and retry.' }));
  if (!response.ok)
    throw new FamilyError(data.error ?? 'Request failed.', response.status);
  return data;
}
export async function connectFamily(role: FinanceRole) {
  token = (await getFinanceSession(role)).token;
  return familyRequest<FamilyRequest[]>('');
}

export function supportToken(value: string): string | null {
  const input = value.trim();
  if (/^[a-f0-9]{64}$/.test(input)) return input;
  try {
    const url = new URL(input);
    const result = new URLSearchParams(url.hash.slice(1)).get('support');
    return result && /^[a-f0-9]{64}$/.test(result) ? result : null;
  } catch {
    return null;
  }
}

export function shareSupport(token: string) {
  return window.location.origin + window.location.pathname + '#support=' + token;
}
