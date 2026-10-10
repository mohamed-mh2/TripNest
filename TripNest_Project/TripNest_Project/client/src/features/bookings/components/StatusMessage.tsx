// Reusable loading, empty, error, success, and demo notices for the bookings screens. المسؤول: abed alrahman.

import type { ReactNode } from 'react';

type Tone = 'info' | 'success' | 'error' | 'warning' | 'empty';

interface StatusMessageProps {
  tone: Tone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

export function StatusMessage({ tone, title, children, action }: StatusMessageProps) {
  return (
    <div
      className={`status status--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <div className="status__body">
        <strong className="status__title">{title}</strong>
        {children && <div className="status__text">{children}</div>}
      </div>
      {action && <div className="status__action">{action}</div>}
    </div>
  );
}

export function LoadingCards({ count = 6 }: { count?: number }) {
  return (
    <div className="service-grid" aria-busy="true" aria-label="Loading services">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="service-card service-card--skeleton">
          <div className="skeleton skeleton--title" />
          <div className="skeleton skeleton--line" />
          <div className="skeleton skeleton--line skeleton--short" />
        </div>
      ))}
    </div>
  );
}

export function DemoNotice({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`demo-notice${compact ? ' demo-notice--compact' : ''}`}>
      <span className="demo-badge">Demo</span>
      {compact
        ? 'Demo prices and availability. No real ticket, reservation, or eSIM is issued.'
        : 'This is a demonstration catalog. Prices, availability, and payments are simulated, and no real ticket, hotel reservation, or eSIM is issued.'}
    </p>
  );
}
