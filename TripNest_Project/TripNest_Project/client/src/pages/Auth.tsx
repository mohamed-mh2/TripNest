import { useState, type FormEvent } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { authApi, ApiError, isPresentationMode } from '../api';
import type { RootState, AppDispatch } from '../store';
import { setSession } from '../store/sessionSlice';

type Mode = 'login' | 'register';

export default function Auth() {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.session.user);
  const navigate = useNavigate();

  if (user) return <main className="auth-card">{isPresentationMode?<><p className="eyebrow">LOCAL PRESENTATION</p><h1>TripNest preview</h1><p>This preview uses sample data. Register and Login still require the API and database.</p><button className="primary-button" onClick={() => navigate('/trips?demo=1')}>Explore the pages</button></>:<><p>Signed in as {user.name}</p><button onClick={() => navigate('/')}>Continue to TripNest</button></>}</main>;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setFieldErrors({});
    setBusy(true);
    try {
      const result = mode === 'register'
        ? await authApi.register({ name, email, password })
        : await authApi.login({ email, password });
      dispatch(setSession({ token: result.token, user: result.user }));
      navigate('/');
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
      <img className="site-logo auth-logo" src="/tripnest-logo.svg" alt="TripNest" />
      <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
      <div className="auth-tabs" role="tablist" aria-label="Account access">
        <button type="button" aria-selected={mode === 'login'} onClick={() => { setMode('login'); setError(''); }}>Login</button>
        <button type="button" aria-selected={mode === 'register'} onClick={() => { setMode('register'); setError(''); }}>Register</button>
      </div>
      <form onSubmit={submit} noValidate>
        {mode === 'register' && <label>Full name
          <input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={100} />
          {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
        </label>}
        <label>Email
          <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} />
          {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
        </label>
        <label>Password
          <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === 'register' ? 8 : 1} maxLength={72} />
          {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create account'}</button>
      </form>
    </main>
  );
}
