import { lazy, Suspense, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Home from './pages/Home';
import About from './pages/About';
import Auth from './pages/Auth';
import AccountSetup from './pages/AccountSetup';
import { SiteHeader, SiteFooter } from './components/SiteLayout';
import { getAccountToken } from './api/accountSession';
import { isWorkspaceHash } from './features/workspace';
import './Account.css';
import './Modern.css';
import './Refinement.css';

const TravelWorkspace = lazy(() => import('./TravelWorkspace'));

export default function App() {
  const route = useLocation();
  const publicPage =
    route.pathname === '/about' ||
    (route.pathname === '/' && !isWorkspaceHash(route.hash));
  useEffect(() => {
    const names: Record<string, string> = {
      '/about': 'About us',
      '/auth': 'Account access',
      '/account': 'My account',
      '/trips': 'My trips',
      '/services': 'Travel services',
      '/bookings': 'My bookings',
      '/readiness': 'Trip readiness',
      '/help': 'Help center',
    };
    document.title = `TripNest | ${publicPage && route.pathname === '/' ? 'Your next adventure' : names[route.pathname] || 'Travel workspace'}`;
    if (publicPage) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [route.pathname, publicPage]);
  // #explain_notes: Visitors can open Home/About without loading the database or chart library.
  if (route.pathname === '/about') return <About />;
  if (publicPage) return <Home />;
  const setupToken =
    route.pathname === '/auth'
      ? new URLSearchParams(route.hash.slice(1)).get('setup')
      : null;
  if (route.pathname === '/auth' && (!getAccountToken() || setupToken))
    return (
      <>
        <SiteHeader />
        <div className="auth-public">
          {setupToken ? <AccountSetup token={setupToken} /> : <Auth />}
        </div>
        <SiteFooter />
      </>
    );
  return (
    <Suspense
      fallback={
        <main className="account-workspace">
          <p role="status">Opening your travel space…</p>
        </main>
      }
    >
      <TravelWorkspace />
    </Suspense>
  );
}
