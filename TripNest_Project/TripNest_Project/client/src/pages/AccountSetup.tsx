import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/accounts';
import { saveAccountSession } from '../api/accountSession';
import { ApiError } from '../api';

export default function AccountSetup({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<{
    name: string;
    email: string;
    expires_at: string;
  } | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let current = true;
    void authApi
      .inspectSetup(token)
      .then((result) => {
        if (current) setInvitation(result.invitation);
      })
      .catch((reason) => {
        if (current)
          setError(
            reason instanceof Error ? reason.message : 'Could not open this invitation.',
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [token]);
  async function activate(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    if (password !== confirm) {
      setError('Your passwords do not match.');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      saveAccountSession(await authApi.activateSetup({ token, password }));
      window.location.replace('/account');
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.fields?.password || reason.message
          : 'Could not activate your account. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-card" id="main-content" tabIndex={-1}>
      <p className="eyebrow">WELCOME TO YOUR TRIPNEST ACCOUNT</p>
      <h1>Make it yours.</h1>
      <p>
        Choose your initial password to activate your account. This private invitation can
        be used once.
      </p>
      {loading && <p role="status">Checking your invitation…</p>}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {invitation && (
        <form onSubmit={activate} noValidate>
          <fieldset disabled={busy}>
            <label>
              Email
              <input aria-label="Email" readOnly value={invitation.email} />
            </label>
            <label>
              New password
              <input
                aria-label="New password"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label>
              Confirm password
              <input
                aria-label="Confirm password"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                maxLength={72}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </label>
            <label className="auth-show-password">
              <input
                type="checkbox"
                checked={show}
                onChange={(event) => setShow(event.target.checked)}
              />{' '}
              Show passwords
            </label>
            <p className="account-note">
              At least 8 characters. Choose a password you will use to sign in.
            </p>
            <button className="primary-button" disabled={busy}>
              {busy ? 'Activating…' : 'Activate my account'}
            </button>
          </fieldset>
        </form>
      )}
      {!loading && !invitation && (
        <Link className="secondary-button trip-link" to="/auth">
          Go to login
        </Link>
      )}
    </main>
  );
}
