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
  const route = useLocation();
  const routerNavigate = useNavigate();
  const helpWorkspace = ['/readiness', '/help'].includes(route.pathname);
  const otherWorkspace = route.pathname !== '/';
  const bookingWorkspace = otherWorkspace && !helpWorkspace;
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
                ['services', 'bookings', 'readiness', 'help'].includes(item.id)
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
            Demo workspace
          </span>
          <button
            className="assistant-header-button"
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

      {/* #explain_notes: Pages stay mounted so switching never copies the saved trip into practice storage. */}
      <div hidden={otherWorkspace || page !== 'budget'} className="workspace-view">
        <Budget onOpenAssistant={() => setAssistantOpen(true)} />
      </div>
      <div hidden={otherWorkspace || page !== 'wallet'} className="workspace-view">
        <Wallet visible={!otherWorkspace && page === 'wallet'} />
      </div>
      <div hidden={otherWorkspace || page !== 'funds'} className="workspace-view">
        <TravelFunds visible={!otherWorkspace && page === 'funds'} />
      </div>
      {bookingWorkspace && <BookingWorkspace />}
      {route.pathname === '/readiness' && <Readiness />}
      {route.pathname === '/help' && <HelpCenter />}
      <CostAssistant open={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </>
  );
}
