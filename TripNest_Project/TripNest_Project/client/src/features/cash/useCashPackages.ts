import { readCashPending, type CashOrder } from '../../features/cash/pending';
import { useEffect, useRef, useState } from 'react';
import {
  CashError,
  cashRequest,
  connectCash,
  type CashCatalog,
  type Voucher,
  type CashPackage,
} from '../../api/cash';
import type { WalletData } from '../../api/wallet';
import { useAppDispatch, useAppSelector } from '../../store';
import { walletLoaded } from '../../store/walletSlice';

// #explain_notes: These identities let us demonstrate both sides of a shared gift locally.
type Role = 'traveler' | 'family';
type Order = CashOrder;

export function useCashPackages(visible: boolean) {
  const requestInFlight = useRef(false);
  const dispatch = useAppDispatch(),
    dialog = useRef<HTMLDialogElement>(null);
  const [role, setRole] = useState<Role>('traveler'),
    [active, setActive] = useState<Role | null>(null),
    [catalog, setCatalog] = useState<CashCatalog | null>(null),
    [vouchers, setVouchers] = useState<Voucher[]>([]),
    [identityWallet, setWallet] = useState<WalletData | null>(null);
  const travelerWallet = useAppSelector((state) => state.wallet.data);
  const wallet = active === 'traveler' ? travelerWallet : identityWallet;
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [selected, setSelected] = useState<CashPackage | null>(null),
    [method, setMethod] = useState<'demo_card' | 'wallet'>('demo_card'),
    [outcome, setOutcome] = useState<'approve' | 'decline'>('approve'),
    [pending, setPending] = useState<Order | null>(null),
    [code, setCode] = useState(''),
    [mode, setMode] = useState<'wallet' | 'cash'>('cash');
  const [purchase, setPurchase] = useState<Voucher | null>(null);
  const [focusedVoucher, setFocusedVoucher] = useState<string | null>(null);

  // #explain_notes: Traveler balances share Redux; returning to this page also refreshes voucher status.
  useEffect(() => {
    if (!visible) return;
    const update = async () => {
      if (!active) {
        await connect();
        return;
      }
      if (requestInFlight.current) return;
      requestInFlight.current = true;
      setBusy(true);
      setError('');
      try {
        await refresh();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        requestInFlight.current = false;
        setBusy(false);
      }
    };
    void update();
    window.addEventListener('focus', update);
    return () => window.removeEventListener('focus', update);
  }, [visible, active]);

  // #explain_notes: Only the traveler updates the shared wallet; family funds stay separate.
  const saveWallet = (w: WalletData, r: Role) => {
    setWallet(w);
    if (r === 'traveler') dispatch(walletLoaded(w));
  };

  async function refresh() {
    if (!active) return;
    const [v, w] = await Promise.all([
      cashRequest<Voucher[]>('/cash/vouchers'),
      cashRequest<WalletData>('/wallet'),
    ]);
    setVouchers(v);
    saveWallet(w, active);
  }

  // #explain_notes: Load this identity and recover any unfinished purchase after a refresh.

  async function connect() {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const [c, v, w] = await connectCash(role);
      setCatalog(c);
      setVouchers(v);
      saveWallet(w, role);
      setActive(role);
      setPurchase(null);
      setCode('');
      let stored: Order | null = null;
      try {
        stored = readCashPending(sessionStorage.getItem('tripnest-cash-' + role));
      } catch {
        /* A malformed saved request is ignored. */
      }
      if (stored && !c.packages.some((p) => p.id === stored?.packageId)) stored = null;
      setPending(stored);
      if (stored)
        setMessage(
          'An unfinished purchase is saved. Resume it below to check its result.',
        );
    } catch (e) {
      setActive(null);
      setCatalog(null);
      setError((e as Error).message);
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  function open(pack: CashPackage) {
    setError('');
    setMessage('');
    setSelected(pack);
    setMethod(pending?.paymentMethod ?? 'demo_card');
    setOutcome(pending?.testOutcome ?? 'approve');
    dialog.current?.showModal();
  }

  // #explain_notes: Reuse the request key on retries so the same purchase is not charged twice.

  async function buy() {
    if (requestInFlight.current) return;
    if (!selected || !active || busy) return;
    requestInFlight.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    const order = pending ?? {
      key: crypto.randomUUID(),
      packageId: selected.id,
      paymentMethod: method,
      testOutcome: outcome,
    };
    try {
      sessionStorage.setItem('tripnest-cash-' + active, JSON.stringify(order));
      setPending(order);
      const v = await cashRequest<Voucher>('/cash/vouchers', 'POST', order, order.key);
      sessionStorage.removeItem('tripnest-cash-' + active);
      setPending(null);
      setPurchase(v.code ? v : null);
      dialog.current?.close();
      setMessage(
        v.code
          ? 'Package purchased. Your code is in My packages below. Share it privately or redeem it here.'
          : 'This purchase was already completed. See its status below.',
      );
      try {
        await refresh();
      } catch {
        setError(
          'Purchase succeeded, but the list could not refresh. Reconnect to see it.',
        );
      }
    } catch (e) {
      if (e instanceof CashError && e.status >= 400 && e.status < 500) {
        sessionStorage.removeItem('tripnest-cash-' + active);
        setPending(null);
      }
      setError((e as Error).message);
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  // #explain_notes: A code becomes wallet credit OR a cash reservation, never both.

  async function redeem(inputCode = code, inputMode = mode) {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const v = await cashRequest<Voucher>('/cash/redeem', 'POST', {
        code: inputCode,
        mode: inputMode,
      });
      if (purchase?.id === v.id) setPurchase(null);
      setFocusedVoucher(v.id);
      setMessage(
        v.status === 'wallet_credited'
          ? 'Code redeemed: demo credit is now in your wallet.'
          : 'Your simulated cash pickup is reserved. Complete it in My packages.',
      );
      setCode('');
      try {
        await refresh();
      } catch {
        setError('Redemption succeeded. Reconnect to refresh your balance and packages.');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  // #explain_notes: Record a simulated pickup. No real cash is issued.

  async function collect(id: string) {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await cashRequest('/cash/vouchers/' + id + '/collect', 'POST');
      setFocusedVoucher(id);
      setMessage('Demo collection completed. No real cash has been issued.');
      try {
        await refresh();
      } catch {
        setError('Collection recorded. Reconnect to refresh the list.');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  return {
    dialog,
    role,
    setRole,
    active,
    catalog,
    vouchers,
    wallet,
    busy,
    message,
    error,
    selected,
    method,
    setMethod,
    outcome,
    setOutcome,
    pending,
    code,
    setCode,
    mode,
    purchase,
    focusedVoucher,
    setFocusedVoucher,
    setMode,
    connect,
    open,
    buy,
    redeem,
    collect,
    setMessage,
    setError,
  };
}
