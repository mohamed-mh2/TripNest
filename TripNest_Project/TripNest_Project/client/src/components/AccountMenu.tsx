import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { authApi, type AccountUser } from '../api/accounts';
import { hasAccount, clearAccountSession } from '../api/accountSession';
import { ApiError } from '../api';

export default function AccountMenu({
  user: suppliedUser,
}: {
  user?: AccountUser | null;
}) {
  const [user, setUser] = useState(suppliedUser || null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const id = useId();
  const route = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [route.pathname, route.hash]);

  useEffect(() => {
    if (suppliedUser) {
      setUser(suppliedUser);
      return;
    }
    if (!hasAccount()) {
      setUser(null);
      return;
    }
    let current = true;
    void authApi
      .me()
      .then((result) => {
        if (current) setUser(result.user);
      })
      .catch((reason) => {
        if (current && reason instanceof ApiError && reason.status === 401) {
          clearAccountSession();
          setUser(null);
        }
      });
    return () => {
      current = false;
    };
  }, [suppliedUser]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const finishLogout = () => {
    clearAccountSession();
    window.location.assign('/?signedOut=1');
  };
  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await authApi.logout();
      finishLogout();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        finishLogout();
        return;
      }
      setError(
        'We could not reach the server to end this session. Try again, or sign out on this browser only.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!hasAccount())
    return (
      <div className="account-entry-links">
        <Link className="account-login-link" to="/auth">
          Log in
        </Link>
        <Link className="site-button site-button--small" to="/auth?mode=register">
          Create account <span aria-hidden="true">↗</span>
        </Link>
      </div>
    );

  return (
    <div className="account-menu" ref={root}>
      <button
        className="account-menu-toggle"
        ref={toggle}
        aria-label="Open account options"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span className="account-avatar" aria-hidden="true">
          {user?.name.slice(0, 1).toUpperCase() || 'T'}
        </span>
        <span className="account-toggle-label">
          {user?.name.split(' ')[0] || 'My account'}
        </span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="account-popover" id={id}>
          <div className="account-popover-person">
            <strong>{user?.name || 'Your account'}</strong>
            <span>{user?.email}</span>
            {user?.role === 'admin' && <small>Administrator</small>}
          </div>
          <Link to="/account">
            My account <span aria-hidden="true">↗</span>
          </Link>
          <Link to="/trips">
            My trips <span aria-hidden="true">↗</span>
          </Link>
          {user?.role === 'admin' && (
            <Link to="/help">
              Admin help desk <span aria-hidden="true">↗</span>
            </Link>
          )}
          <button
            className="account-signout"
            disabled={busy}
            onClick={() => void signOut()}
          >
            {busy ? 'Signing out…' : 'Sign out'}
          </button>
          {error && (
            <div className="account-logout-error">
              <p role="alert">{error}</p>
              <button disabled={busy} onClick={finishLogout}>
                Sign out on this browser only
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
