import { useEffect, useState } from 'react';
import TravelSupport from './TravelSupport';
import CashPackages from './CashPackages';
import './TravelFunds.css';

export default function TravelFunds({ visible }: { visible: boolean }) {
  const [tab, setTab] = useState<'support' | 'cash'>(() =>
    location.hash === '#cash' ? 'cash' : 'support',
  );
  useEffect(() => {
    const openShared = () => {
      if (location.hash === '#cash') setTab('cash');
      if (
        location.hash === '#funds' ||
        new URLSearchParams(location.hash.slice(1)).has('support')
      )
        setTab('support');
    };
    window.addEventListener('hashchange', openShared);
    return () => window.removeEventListener('hashchange', openShared);
  }, []);

  function chooseTab(next: typeof tab) {
    setTab(next);
    location.hash = next === 'cash' ? 'cash' : 'funds';
  }

  return (
    <main className="funds-page">
      <header className="funds-hero">
        <div>
          <span className="funds-kicker">TRIPNEST / TRAVEL FUNDS</span>
          <h1>Keep the journey going.</h1>
          <p>A little backup for you. A helping hand from anyone you trust.</p>
          <span className="funds-demo">
            Demo experience · All funds and payments are simulated
          </span>
        </div>
        <div className="funds-orbit" aria-hidden="true">
          <span>↗</span>
          <small>
            READY FOR
            <br />
            WHAT'S NEXT
          </small>
        </div>
      </header>

      <div
        className="funds-switch"
        role="tablist"
        aria-label="Choose how to receive travel funds"
      >
        <button
          id="support-tab"
          role="tab"
          aria-selected={tab === 'support'}
          aria-controls="support-panel"
          tabIndex={tab === 'support' ? 0 : -1}
          onKeyDown={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
              e.preventDefault();
              const next =
                e.key === 'Home'
                  ? 'support'
                  : e.key === 'End'
                    ? 'cash'
                    : tab === 'support'
                      ? 'cash'
                      : 'support';
              chooseTab(next);
              document.getElementById(next + '-tab')?.focus();
            }
          }}
          onClick={() => chooseTab('support')}
        >
          <span>↗</span>
          <div>
            <b>Request support</b>
            <small>Someone adds credit to your wallet</small>
          </div>
        </button>
        <button
          id="cash-tab"
          role="tab"
          aria-selected={tab === 'cash'}
          aria-controls="cash-panel"
          tabIndex={tab === 'cash' ? 0 : -1}
          onKeyDown={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
              e.preventDefault();
              const next =
                e.key === 'Home'
                  ? 'support'
                  : e.key === 'End'
                    ? 'cash'
                    : tab === 'support'
                      ? 'cash'
                      : 'support';
              chooseTab(next);
              document.getElementById(next + '-tab')?.focus();
            }
          }}
          onClick={() => chooseTab('cash')}
        >
          <span>◇</span>
          <div>
            <b>Cash packages</b>
            <small>Buy a code for cash or wallet credit</small>
          </div>
        </button>
      </div>

      <div
        id="support-panel"
        role="tabpanel"
        aria-labelledby="support-tab"
        hidden={tab !== 'support'}
      >
        <TravelSupport visible={visible && tab === 'support'} />
      </div>
      <div
        id="cash-panel"
        role="tabpanel"
        aria-labelledby="cash-tab"
        hidden={tab !== 'cash'}
      >
        <CashPackages visible={visible && tab === 'cash'} />
      </div>
    </main>
  );
}
