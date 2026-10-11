import { Link, NavLink } from 'react-router-dom';
import AccountMenu from './AccountMenu';
import ThemeToggle from './ThemeToggle';

export function Brand() {
  return (
    <Link
      to="/"
      className="site-brand"
      aria-label="TripNest home"
      onClick={() => window.scrollTo({ top: 0, behavior: 'instant' })}
    >
      Trip<span>Nest</span>
      <span className="brand-arrow" aria-hidden="true">
        ↗
      </span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <>
      <a
        className="site-skip"
        href="#main-content"
        onClick={(event) => {
          const content = document.getElementById('main-content');
          if (!content) return;
          // Keep activation/share fragments intact while moving keyboard focus.
          event.preventDefault();
          content.focus({ preventScroll: true });
          content.scrollIntoView({ behavior: 'instant', block: 'start' });
        }}
      >
        Skip to content
      </a>
      <header className="site-header">
        <Brand />
        <nav aria-label="Main navigation" className="site-links">
          <NavLink
            to="/"
            end
            onClick={() => window.scrollTo({ top: 0, behavior: 'instant' })}
          >
            Home
          </NavLink>
          <NavLink to="/services">Explore</NavLink>
          <NavLink to="/about">About us</NavLink>
        </nav>
        <div className="site-account-actions">
          <ThemeToggle />
          <AccountMenu />
        </div>
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <Brand />
        <p>
          Less switching tabs.
          <br />
          More making memories.
        </p>
      </div>
      <nav aria-label="Footer navigation">
        <Link to="/trips">My trips</Link>
        <Link to="/services">Travel services</Link>
        <Link to="/#planner">Cost planner</Link>
        <Link to="/#funds">Travel funds</Link>
        <Link to="/readiness">Readiness</Link>
        <Link to="/help">Help center</Link>
        <Link to="/about">About & photo credits</Link>
      </nav>
      <p className="site-footer-note">
        Built by four students. Bookings, payments, cards and cash collection are
        demonstrations. No real money moves.
      </p>
    </footer>
  );
}
