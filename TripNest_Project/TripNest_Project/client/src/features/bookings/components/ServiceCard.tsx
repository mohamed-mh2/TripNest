// Service result card for the catalog grid. المسؤول: abed alrahman.

import { Link } from 'react-router-dom';

import { formatMoney } from '../format';
import { PolicyBadge, ServiceFacts } from './ServiceFacts';
import type { TravelService } from '../../../../../shared/types';

export function ServiceCard({ service }: { service: TravelService }) {
  return (
    <article className="service-card">
      <header className="service-card__header">
        <div>
          <h3 className="service-card__title">{service.name}</h3>
          <p className="service-card__provider">{service.providerName}</p>
        </div>
        <span className="rating" aria-label={`Rated ${service.rating} out of 5`}>
          ★ {service.rating.toFixed(1)}
        </span>
      </header>

      <ServiceFacts service={service} />

      <div className="service-card__badges">
        <PolicyBadge service={service} />
        {service.isDemo && <span className="badge badge--demo">Demo price</span>}
      </div>

      <footer className="service-card__footer">
        <p className="price">
          <strong>{formatMoney(service.unitPriceMinor, service.currency)}</strong>
          <span> / {service.unitLabel}</span>
        </p>
        <Link to={`/services/${service.id}`} className="button button--primary">
          View details
        </Link>
      </footer>
    </article>
  );
}
