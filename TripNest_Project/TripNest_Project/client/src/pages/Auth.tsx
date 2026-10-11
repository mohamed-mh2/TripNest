// Madin Abed: account access and personal trip management.
import { useState, useEffect, type FormEvent } from 'react';

import { ApiError } from '../api';
import { authApi } from '../api/accounts';
import { saveAccountSession, openDemoWorkspace } from '../api/accountSession';
import { loginDestination } from '../features/accounts/loginDestination';
import { useLocation } from 'react-router-dom';

type Mode = 'login' | 'register';

export default function Auth() {
  const route = useLocation();
  const [mode, setMode] = useState<Mode>(() =>
    new URLSearchParams(location.search).get('mode') === 'register'
      ? 'register'
      : 'login',
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setMode(
      new URLSearchParams(route.search).get('mode') === 'register' ? 'register' : 'login',
    );
    setPassword('');
    setConfirmPassword('');
    setError('');
    setFieldErrors({});
  }, [route.search]);

  useEffect(() => {
    document.querySelector<HTMLInputElement>('.auth-card [aria-invalid="true"]')?.focus();
  }, [fieldErrors]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setFieldErrors({});
    if (mode === 'register' && password !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'Your passwords do not match.' });
      setError('Please confirm the same password.');
      return;
    }
    setBusy(true);
    try {
      const result =
        mode === 'register'
          ? await authApi.register({ name, email, password })
          : await authApi.login({ email, password });
      saveAccountSession(result);
      window.location.assign(
        loginDestination(location.pathname, location.search, location.hash),
      );
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
    <main className="auth-card" id="main-content" tabIndex={-1}>
      <p className="eyebrow">YOUR JOURNEY, TOGETHER</p>
      <h1>
        {mode === 'login'
          ? 'Your next chapter awaits.'
          : 'A world of plans. Your own space.'}
      </h1>
      <p>
        {mode === 'login'
          ? 'Log in to pick up where your journey left off.'
          : 'Create an account to save your trips, bookings and travel tools together.'}
      </p>
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
            setPassword('');
            setConfirmPassword('');
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
            setPassword('');
            setConfirmPassword('');
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
                aria-label="Full name"
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'auth-name-error' : undefined}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                maxLength={100}
              />
              {fieldErrors.name && (
                <span className="field-error" id="auth-name-error">
                  {fieldErrors.name}
                </span>
              )}
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              aria-label="Email"
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'auth-email-error' : undefined}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength={254}
            />
            {fieldErrors.email && (
              <span className="field-error" id="auth-email-error">
                {fieldErrors.email}
              </span>
            )}
          </label>
          <label>
            Password
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              aria-label="Password"
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'auth-password-error' : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={mode === 'register' ? 8 : 1}
              maxLength={72}
            />
            {fieldErrors.password && (
              <span className="field-error" id="auth-password-error">
                {fieldErrors.password}
              </span>
            )}
          </label>
          {mode === 'register' && (
            <label>
              Confirm password
              <input
                aria-label="Confirm password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                maxLength={72}
                required
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                aria-describedby={
                  fieldErrors.confirmPassword ? 'auth-confirm-error' : undefined
                }
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              {fieldErrors.confirmPassword && (
                <span className="field-error" id="auth-confirm-error">
                  {fieldErrors.confirmPassword}
                </span>
              )}
            </label>
          )}
          <label className="auth-show-password">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) => setShowPassword(event.target.checked)}
            />{' '}
            Show password{mode === 'register' ? 's' : ''}
          </label>
          {mode === 'register' && (
            <p className="account-note">Use at least 8 characters for your password.</p>
          )}
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
      <p className="account-note auth-demo-note">
        Payments and travel reservations are simulated for this student project.
      </p>
    </main>
  );
}
