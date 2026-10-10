import { financeAccessToken, getFinanceSession } from './financeSession';
import type { WalletData } from './wallet';

export type CashPackage = {
  id: string;
  name: string;
  amountMinor: number;
  description: string;
};

export type Voucher = {
  id: string;
  packageId: string;
  amountMinor: number;
  status: 'ready' | 'pickup_reserved' | 'collected' | 'wallet_credited';
  paymentMethod: 'demo_card' | 'wallet';
  code?: string;
  expiresAt: string;
  createdAt: string;
  canCollect?: boolean;
  purchasedByYou?: boolean;
};

export type CashCatalog = {
  packages: CashPackage[];
  destination: string;
  pickup: string;
  currency: string;
  simulation: boolean;
};
let cashToken = '';

export class CashError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export async function cashRequest<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  key?: string,
): Promise<T> {
  const response = await fetch('/api' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + financeAccessToken(cashToken),
      'Content-Type': 'application/json',
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response
    .json()
    .catch(() => ({ error: 'Unreadable server response.' }));
  if (!response.ok) throw new CashError(data.error ?? 'Request failed.', response.status);
  return data;
}
export async function connectCash(role: 'traveler' | 'family') {
  const data = await getFinanceSession(role);
  cashToken = data.token;
  return Promise.all([
    cashRequest<CashCatalog>('/cash/packages'),
    cashRequest<Voucher[]>('/cash/vouchers'),
    cashRequest<WalletData>('/wallet'),
  ]);
}
