// Madin Abed: account access and personal trip management.
import { useState, type FormEvent } from 'react';

import { ApiError } from '../api';
import { authApi } from '../api/accounts';
import { saveAccountSession, openDemoWorkspace } from '../api/accountSession';

type Mode = 'login' | 'register';

export default function Auth() {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setFieldErrors({});
    setBusy(true);
    try {
      const result =
        mode === 'register'
          ? await authApi.register({ name, email, password })
          : await authApi.login({ email, password });
      saveAccountSession(result);
      window.location.assign('/trips');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fields || {});
      } else setError('Could not connect to the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-card">
      <p className="eyebrow">YOUR JOURNEY, TOGETHER</p>
      <h1>TripNest</h1>
      <p>Save your trips, manage bookings and keep your travel plans in one place.</p>
      {new URLSearchParams(location.search).has('expired') && (
        <p className="form-error" role="alert">
          Your session expired. Sign in again to open your saved data.
        </p>
      )}
      <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
      <div className="auth-tabs" role="tablist" aria-label="Account access">
        <button
          type="button"
          role="tab"
          disabled={busy}
          aria-selected={mode === 'login'}
          onClick={() => {
            setMode('login');
            setError('');
            setFieldErrors({});
          }}
        >
          Login
        </button>
        <button
          type="button"
          role="tab"
          disabled={busy}
          aria-selected={mode === 'register'}
          onClick={() => {
            setMode('register');
            setError('');
            setFieldErrors({});
          }}
        >
          Register
        </button>
      </div>
      <form onSubmit={submit} noValidate>
        <fieldset disabled={busy}>
          {mode === 'register' && (
            <label>
              Full name
              <input
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                maxLength={100}
              />
              {fieldErrors.name && (
                <span className="field-error">{fieldErrors.name}</span>
              )}
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength={254}
            />
            {fieldErrors.email && (
              <span className="field-error">{fieldErrors.email}</span>
            )}
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={mode === 'register' ? 8 : 1}
              maxLength={72}
            />
            {fieldErrors.password && (
              <span className="field-error">{fieldErrors.password}</span>
            )}
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create account'}
          </button>
        </fieldset>
      </form>
      {import.meta.env.DEV && (
        <button className="secondary-button" disabled={busy} onClick={openDemoWorkspace}>
          Explore demo workspace
        </button>
      )}
      <p className="account-note">
        Payments and travel reservations are simulated for this student project.
      </p>
    </main>
  );
}
