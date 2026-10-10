import { financeAccessToken, getFinanceSession } from './financeSession';

export type WalletEntry = {
  id: string;
  amountMinor: number;
  kind: 'demo_topup' | 'family_support' | 'cash_purchase' | 'cash_to_wallet';
  createdAt: string;
};

export type WalletData = {
  id: string;
  currency: 'EUR';
  balanceMinor: number;
  entryCount: number;
  simulation: true;
  entries: WalletEntry[];
};
let walletToken = '';

async function walletRequest(
  method = 'GET',
  body?: unknown,
  key?: string,
): Promise<WalletData> {
  if (!walletToken) walletToken = (await getFinanceSession('traveler')).token;
  const response = await fetch('/api/wallet' + (method === 'POST' ? '/topups' : ''), {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + financeAccessToken(walletToken),
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response
    .json()
    .catch(() => ({ error: 'The server returned an unreadable response.' }));
  if (!response.ok) throw new Error(data.error ?? 'Wallet request failed.');
  return data;
}
export async function connectDemoWallet() {
  const session = await getFinanceSession('traveler');
  walletToken = session.token;
  return walletRequest();
}

export const refreshWallet = () => walletRequest();

export const topupWallet = (amountMinor: number, key: string) =>
  walletRequest('POST', { amountMinor }, key);
