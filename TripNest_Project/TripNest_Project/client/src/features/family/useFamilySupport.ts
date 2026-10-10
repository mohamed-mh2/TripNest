import { useEffect, useRef, useState } from 'react';
import {
  connectFamily,
  familyRequest,
  FamilyError,
  shareSupport,
  supportToken,
  type FamilyRequest,
  type FamilyPreview,
  type FamilyReceipt,
} from '../../api/family';
import type { FinanceRole } from '../../api/financeSession';
import { readFamilyPending, type PendingFamily } from '../../features/family/pending';
import { connectDemoWallet } from '../../api/wallet';
import { useAppDispatch } from '../../store';
import { walletLoaded } from '../../store/walletSlice';
import { parseAmount } from '../budget/model';

export function useFamilySupport(visible: boolean) {
  const dispatch = useAppDispatch();
  const lock = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [role, setRole] = useState<FinanceRole>('traveler');
  const [active, setActive] = useState<FinanceRole | null>(null);
  const [requests, setRequests] = useState<FamilyRequest[]>([]);
  const [amount, setAmount] = useState('100');
  const [link, setLink] = useState('');
  const [input, setInput] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get('support') ?? '',
  );
  const [preview, setPreview] = useState<FamilyPreview | null>(null);
  const [receipt, setReceipt] = useState<FamilyReceipt | null>(null);
  const [pending, setPending] = useState<PendingFamily | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState<'approve' | 'decline'>('approve');

  useEffect(() => {
    if (!visible) return;
    if (!active) {
      void connect();
      return;
    }
    void run(refresh);
    const update = () => {
      void run(refresh);
    };
    window.addEventListener('focus', update);
    return () => window.removeEventListener('focus', update);
  }, [visible, active]);
  useEffect(() => {
    const loadLink = () => {
      const shared = new URLSearchParams(window.location.hash.slice(1)).get('support');
      if (shared) {
        setInput(shared);
        setPreview(null);
        setReceipt(null);
      }
    };
    window.addEventListener('hashchange', loadLink);
    return () => window.removeEventListener('hashchange', loadLink);
  }, []);

  const storageKey = (r: FinanceRole) => 'tripnest.family.pending.' + r;

  // #explain_notes: All mutations share a guard so rapid clicks cannot start a second operation.

  async function run(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed. Retry safely.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function connect() {
    await run(async () => {
      setActive(null);
      setPreview(null);
      setReceipt(null);
      setLink('');
      setPending(null);
      const rows = await connectFamily(role);
      setRequests(rows);
      setActive(role);
      let saved: PendingFamily | null = null;
      try {
        saved = readFamilyPending(sessionStorage.getItem(storageKey(role)));
      } catch {
        /* Storage may be disabled. */
      }
      setPending(saved);
      if (saved?.kind === 'create') setAmount(String(saved.amountMinor / 100));
      if (saved?.kind === 'pay') setInput(saved.token);
      setMessage(
        saved
          ? 'An unfinished operation was restored. Retry it to check the result.'
          : 'Connected as ' + (role === 'traveler' ? 'traveler.' : 'supporter.'),
      );
    });
  }

  async function refresh() {
    setRequests(await familyRequest<FamilyRequest[]>(''));
    if (active === 'traveler') dispatch(walletLoaded(await connectDemoWallet()));
  }

  async function afterSuccess() {
    try {
      await refresh();
    } catch {
      setError('The operation succeeded. Reconnect to refresh the list and wallet.');
    }
  }

  function remember(operation: PendingFamily) {
    if (!active) throw new Error('Connect first.');
    sessionStorage.setItem(storageKey(active), JSON.stringify(operation));
    setPending(operation);
  }

  function forget() {
    if (active) sessionStorage.removeItem(storageKey(active));
    setPending(null);
  }

  function rejectKnown(e: unknown) {
    if (e instanceof FamilyError && e.status >= 400 && e.status < 500) forget();
    throw e;
  }

  async function create() {
    await run(async () => {
      if (pending?.kind === 'pay')
        throw new Error('Resolve the unfinished payment first.');
      const cents =
        pending?.kind === 'create' ? pending.amountMinor : parseAmount(amount);
      if (cents === null || cents < 500 || cents > 500000)
        throw new Error('Enter 5 to 5,000 EUR with up to two decimal places.');
      const op: PendingFamily = pending ?? {
        kind: 'create',
        key: crypto.randomUUID(),
        amountMinor: cents,
      };
      if (op.kind !== 'create') return;
      remember(op);
      try {
        const data = await familyRequest<FamilyRequest & { token?: string }>(
          '',
          'POST',
          { amountMinor: op.amountMinor },
          op.key,
        );
        forget();
        setLink(data.token ? shareSupport(data.token) : '');
        setMessage(
          data.token
            ? 'Request ready. Copy the link and share it privately yourself.'
            : 'This request already exists. Its current status is shown below.',
        );
        await afterSuccess();
      } catch (e) {
        rejectKnown(e);
      }
    });
  }

  async function inspect() {
    await run(async () => {
      setPreview(null);
      setReceipt(null);
      const token = supportToken(input);
      if (!token)
        throw new Error('Paste a complete support link or its 64-character token.');
      setPreview(await familyRequest<FamilyPreview>('/resolve', 'POST', { token }));
      setOutcome('approve');
    });
  }

  // #explain_notes: The server decides the recipient and amount from the link, never from editable form fields.

  async function pay() {
    await run(async () => {
      const token = pending?.kind === 'pay' ? pending.token : supportToken(input);
      if (!token) throw new Error('Review a support link first.');
      if (pending?.kind === 'create')
        throw new Error('Resolve the unfinished request creation first.');
      const op: PendingFamily = pending ?? {
        kind: 'pay',
        key: crypto.randomUUID(),
        token,
        testOutcome: outcome,
      };
      if (op.kind !== 'pay') return;
      remember(op);
      try {
        const data = await familyRequest<FamilyReceipt>(
          '/pay',
          'POST',
          { token: op.token, testOutcome: op.testOutcome },
          op.key,
        );
        forget();
        setReceipt(data);
        setPreview(null);
        dialog.current?.close();
        setMessage('Demo support confirmed. The recipient was credited once.');
        await afterSuccess();
      } catch (e) {
        rejectKnown(e);
      }
    });
  }

  async function cancel(id: string) {
    await run(async () => {
      await familyRequest('/' + id + '/cancel', 'POST');
      setLink('');
      setMessage('Support request cancelled.');
      await afterSuccess();
    });
  }

  async function share(id: string) {
    await run(async () => {
      const data = await familyRequest<{ token: string }>('/' + id + '/share', 'POST');
      setLink(shareSupport(data.token));
    });
  }

  return {
    dialog,
    role,
    setRole,
    active,
    requests,
    amount,
    setAmount,
    link,
    input,
    setInput,
    preview,
    setPreview,
    receipt,
    setReceipt,
    pending,
    busy,
    message,
    error,
    outcome,
    setOutcome,
    connect,
    create,
    inspect,
    pay,
    cancel,
    share,
    run,
    refresh,
    setMessage,
    setError,
  };
}
