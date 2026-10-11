import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authApi, type AccountUser } from '../api/accounts';
import { ApiError } from '../api';

export default function Account({ user }: { user: AccountUser }) {
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await authApi.updateProfile({ name });
      window.location.assign('/account?saved=1');
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : 'Could not save your name. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="account-workspace profile-page" id="main-content" tabIndex={-1}>
      <header className="profile-heading">
        <span className="profile-avatar" aria-hidden="true">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <p className="eyebrow">YOUR TRIPNEST ACCOUNT</p>
          <h1>A little space for you.</h1>
          <p>
            {user.role === 'admin'
              ? 'Administrator · Travel planning and help desk access'
              : 'Traveler · Your plans, all together'}
          </p>
        </div>
      </header>
      {new URLSearchParams(location.search).has('saved') && (
        <p className="account-success" role="status">
          Your display name was saved.
        </p>
      )}
      <div className="profile-grid">
        <section className="panel">
          <h2>Your profile</h2>
          <form onSubmit={save} noValidate>
            <fieldset disabled={busy}>
              <label>
                Full name
                <input
                  aria-label="Full name"
                  value={name}
                  maxLength={100}
                  autoComplete="name"
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label>
                Email
                <input aria-label="Email" value={user.email || ''} readOnly />
              </label>
              <p className="account-note">This email is your sign-in address.</p>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <button className="primary-button" disabled={busy}>
                {busy ? 'Saving…' : 'Save profile'}
              </button>
            </fieldset>
          </form>
        </section>
        <aside className="panel profile-links">
          <p className="eyebrow">YOUR NEXT STEP</p>
          <h2>Back to the good part.</h2>
          <p>Keep your adventures and travel tools within reach.</p>
          <Link className="primary-button trip-link" to="/trips">
            Open my trips ↗
          </Link>
          <Link className="secondary-button trip-link" to="/#wallet">
            View my wallet ↗
          </Link>
          {user.role === 'admin' && (
            <Link className="secondary-button trip-link" to="/help">
              Open admin help desk ↗
            </Link>
          )}
          <p className="account-note">Open your account menu at the top to sign out.</p>
        </aside>
      </div>
    </main>
  );
}
