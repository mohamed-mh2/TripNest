export type PendingFamily =
  | { kind: 'create'; key: string; amountMinor: number }
  | { kind: 'pay'; key: string; token: string; testOutcome: 'approve' | 'decline' };

export function readFamilyPending(raw: string | null): PendingFamily | null {
  try {
    const data: unknown = JSON.parse(raw ?? 'null');
    if (!data || typeof data !== 'object') return null;
    const p = data as Record<string, unknown>;
    if (
      typeof p.key !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.key)
    )
      return null;
    if (
      p.kind === 'create' &&
      typeof p.amountMinor === 'number' &&
      Number.isSafeInteger(p.amountMinor) &&
      p.amountMinor >= 500 &&
      p.amountMinor <= 500000
    )
      return { kind: 'create', key: p.key, amountMinor: p.amountMinor };
    if (
      p.kind === 'pay' &&
      typeof p.token === 'string' &&
      /^[a-f0-9]{64}$/.test(p.token) &&
      (p.testOutcome === 'approve' || p.testOutcome === 'decline')
    )
      return { kind: 'pay', key: p.key, token: p.token, testOutcome: p.testOutcome };
  } catch {
    /* Corrupt storage must not become a payment. */
  }
  return null;
}
