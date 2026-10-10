import AccountBootstrap from './features/accounts/AccountBootstrap';
import { authApi, type AccountUser, type Trip } from './api/accounts';
import {
  isDemoWorkspace,
  getAccountTripId,
  openAccountTrip,
  clearAccountSession,
} from './api/accountSession';
import Auth from './pages/Auth';
import Trips from './pages/Trips';
import TripDetails from './pages/TripDetails';
import { Routes, Route, Link } from 'react-router-dom';
import './Account.css';
import { ApiError } from './api';
import { useEffect, useState } from 'react';
import Budget from './pages/Budget';
import Wallet from './pages/Wallet';
import TravelFunds from './pages/TravelFunds';
import CostAssistant from './components/CostAssistant';
import { workspacePage, workspaceHash, type WorkspacePage } from './features/workspace';
import './Modern.css';
import { useLocation, useNavigate } from 'react-router-dom';
import BookingWorkspace from './features/bookings/BookingWorkspace';
import Readiness from './pages/Services';
import HelpCenter from './pages/Support';

export default function App() {
  return (
    <AccountBootstrap>
      {(user, trips) => <Workspace user={user} trips={trips} />}
    </AccountBootstrap>
  );
}

function Workspace({ user, trips }: { user: AccountUser | null; trips: Trip[] }) {
  const route = useLocation();
  const routerNavigate = useNavigate();
  const helpWorkspace = ['/readiness', '/help'].includes(route.pathname);
  const otherWorkspace = route.pathname !== '/';
  const accountWorkspace =
    route.pathname === '/auth' || route.pathname.startsWith('/trips');
  const bookingWorkspace = otherWorkspace && !helpWorkspace && !accountWorkspace;
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [route.pathname]);
  const [page, setPage] = useState<WorkspacePage>(() => workspacePage(location.hash));
  const [assistantOpen, setAssistantOpen] = useState(false);
  useEffect(() => {
    const showShared = () => {
      setPage(workspacePage(location.hash));
      if (!['#plan-settings', '#planned-expenses'].includes(location.hash))
        window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('hashchange', showShared);
    return () => window.removeEventListener('hashchange', showShared);
  }, []);

  function navigate(next: typeof page) {
    setPage(next);
    routerNavigate('/#' + workspaceHash(next));
    window.scrollTo({
      top: 0,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  }

  const accountActive = !!user || isDemoWorkspace();
  async function signOut() {
    try {
      await authApi.logout();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearAccountSession();
        window.location.assign('/auth');
        return;
      }
      if (
        !window.confirm(
          'Could not revoke the server session. Sign out on this browser only?',
        )
      )
        return;
    }
    clearAccountSession();
    window.location.assign('/auth');
  }
  if (!accountActive) return <Auth />;
  const tripReady = !!getAccountTripId();
  return (
    <>
      <header className="app-bar">
        <button
          className="app-brand"
          aria-label="TripNest home"
          onClick={() => navigate('budget')}
        >
          Trip<span>Nest</span>
          <i aria-hidden="true">↗</i>
        </button>
        <nav className="feature-nav" aria-label="Travel workspace">
          {[
            { id: 'trips', name: 'My trips', icon: '◌' },
            { id: 'services', name: 'Services', icon: '✈' },
            { id: 'bookings', name: 'My bookings', icon: '✓' },
            { id: 'budget', name: 'Trip planner', icon: '◈' },
            { id: 'wallet', name: 'Wallet', icon: '▤' },
            { id: 'funds', name: 'Travel funds', icon: '↗' },
            { id: 'readiness', name: 'Readiness', icon: '☑' },
            { id: 'help', name: 'Help center', icon: '?' },
          ].map((item) => (
            <button
              key={item.id}
              aria-current={
                (
                  otherWorkspace
                    ? route.pathname.startsWith('/' + item.id)
                    : page === item.id
                )
                  ? 'page'
                  : undefined
              }
              onClick={() =>
                ['trips', 'services', 'bookings', 'readiness', 'help'].includes(item.id)
                  ? routerNavigate('/' + item.id)
                  : navigate(item.id as typeof page)
              }
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>
        <div className="app-tools">
          <span className="app-demo-indicator">
            <i />
            {user ? user.name : 'Demo workspace'}
          </span>
          {user ? (
            <button className="account-access" onClick={() => void signOut()}>
              Sign out
            </button>
          ) : (
            <button className="account-access" onClick={() => routerNavigate('/auth')}>
              Sign in
            </button>
          )}
          <button
            className="assistant-header-button"
            disabled={!tripReady}
            onClick={() => setAssistantOpen(true)}
            aria-haspopup="dialog"
            aria-label="Open trip cost assistant"
            title="Trip cost assistant"
          >
            <span aria-hidden="true">✦</span>
            <b>Cost assistant</b>
          </button>
        </div>
      </header>

      {(user || isDemoWorkspace()) && (
        <div className="account-trip-bar">
          <label>
            Active trip{' '}
            <select
              aria-label="Active trip"
              value={getAccountTripId() || ''}
              onChange={(e) => openAccountTrip(e.target.value)}
            >
              {!trips.length && <option value="">No trips yet</option>}
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.name} · {trip.destination}
                </option>
              ))}
            </select>
          </label>
          <Link to="/trips">Manage trips</Link>
        </div>
      )}
      {!tripReady && !otherWorkspace && page === 'budget' && (
        <main className="account-workspace">
          <h1>Plan your first trip</h1>
          <p>Create a trip with your destination, travel dates and estimated budget.</p>
          <Link className="primary-button trip-link" to="/trips">
            Create a trip
          </Link>
        </main>
      )}
      {/* #explain_notes: Pages stay mounted so switching never copies the saved trip into practice storage. */}
      {tripReady && (
        <div hidden={otherWorkspace || page !== 'budget'} className="workspace-view">
          <Budget onOpenAssistant={() => setAssistantOpen(true)} />
        </div>
      )}
      <div hidden={otherWorkspace || page !== 'wallet'} className="workspace-view">
        <Wallet visible={!otherWorkspace && page === 'wallet'} />
      </div>
      <div hidden={otherWorkspace || page !== 'funds'} className="workspace-view">
        <TravelFunds visible={!otherWorkspace && page === 'funds'} />
      </div>
      {accountWorkspace && (
        <Routes>
          <Route
            path="/auth"
            element={
              user ? (
                <main className="account-workspace">
                  <h1>Welcome, {user.name}</h1>
                  <Link to="/trips">Open my trips</Link>
                </main>
              ) : (
                <Auth />
              )
            }
          />
          <Route path="/trips" element={<Trips />} />
          <Route path="/trips/:id" element={<TripDetails />} />
        </Routes>
      )}
      {bookingWorkspace && <BookingWorkspace />}
      {route.pathname === '/readiness' && <Readiness />}
      {route.pathname === '/help' && (
        <HelpCenter administrator={user?.role === 'admin'} />
      )}
      <CostAssistant
        key={getAccountTripId() || 'demo'}
        savedTrip={trips.find((trip) => trip.id === getAccountTripId())}
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
      />
    </>
  );
}
