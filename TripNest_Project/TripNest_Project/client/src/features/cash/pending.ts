export type CashOrder = {
  key: string;
  packageId: string;
  paymentMethod: 'demo_card' | 'wallet';
  testOutcome: 'approve' | 'decline';
};

// #explain_notes: Browser storage is untrusted. Only a complete, known checkout may be resumed.

export function readCashPending(raw: string | null): CashOrder | null {
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
      typeof p.packageId !== 'string' ||
      !['essentials', 'rescue', 'explore'].includes(p.packageId)
    )
      return null;
    if (p.paymentMethod !== 'demo_card' && p.paymentMethod !== 'wallet') return null;
    if (p.testOutcome !== 'approve' && p.testOutcome !== 'decline') return null;
    return {
      key: p.key,
      packageId: p.packageId,
      paymentMethod: p.paymentMethod,
      testOutcome: p.testOutcome,
    };
  } catch {
    return null;
  }
}
