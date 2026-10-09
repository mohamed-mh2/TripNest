// Service details page with the booking panel. المسؤول: abed alrahman.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiError } from '../../api';
import { fetchService } from '../../api/bookings';
import { categoryInfo } from './categories';
import { formatMoney } from './format';
import { PolicyBadge, ServiceFacts } from './components/ServiceFacts';
import { CheckoutPanel } from './components/CheckoutPanel';
import { DemoNotice, StatusMessage } from './components/StatusMessage';
import type { TravelService } from '../../../../shared/types';
import './bookings.css';


export default function ServiceDetailsPage() {
  const { serviceId } = useParams();
  const [service, setService] = useState<TravelService | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let isCurrent = true;

    setService(null);
    setError(null);

    fetchService(Number(serviceId))
      .then((result) => {
        if (isCurrent) {
          setService(result.service);
        }
      })
      .catch((loadError: ApiError) => {
        if (isCurrent) {
          setError(loadError);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [serviceId]);

  if (error) {
    return (
      <section className="page">
        <StatusMessage
          tone={error.status === 404 ? 'empty' : 'error'}
          title={error.status === 404 ? 'Service not found' : 'Could not load this service'}
          action={<Link className="button" to="/services">Back to services</Link>}
        >
          {error.message}
        </StatusMessage>
      </section>
    );
  }

  if (!service) {
    return <p className="page-message" aria-busy="true">Loading service...</p>;
  }

  const info = categoryInfo(service.category);
  const amenities = service.attributes.amenities || [];

  return (
    <section className="page">
      <Link to={`/services?category=${service.category}`} className="back-link">
        ← Back to {info.label}
      </Link>

      <div className="details-layout">
        <div className="details-main">
          <p className="eyebrow">{info.icon} {info.label}</p>
          <h1>{service.name}</h1>
          <p className="service-card__provider">
            {service.providerName} · {service.city} · ★ {service.rating.toFixed(1)}
          </p>

          <DemoNotice compact />

          <p className="details-description">{service.description}</p>

          <ServiceFacts service={service} />

          {amenities.length > 0 && (
            <ul className="chips" aria-label="Amenities">
              {amenities.map((amenity) => <li key={amenity}>{amenity}</li>)}
            </ul>
          )}

          <dl className="details-list">
            <div>
              <dt>Price</dt>
              <dd>{formatMoney(service.unitPriceMinor, service.currency)} per {service.unitLabel}</dd>
            </div>
            {service.bookingFeeMinor > 0 && (
              <div>
                <dt>Booking fee</dt>
                <dd>{formatMoney(service.bookingFeeMinor, service.currency)} per booking (non-refundable)</dd>
              </div>
            )}
            {service.attributes.touristTaxPerGuestNightMinor ? (
              <div>
                <dt>Tourist tax</dt>
                <dd>
                  {formatMoney(service.attributes.touristTaxPerGuestNightMinor, service.currency)} per guest per night
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Cancellation</dt>
              <dd>
                <PolicyBadge service={service} />
                <p className="muted">{service.cancellationPolicy.summary}</p>
              </dd>
            </div>
          </dl>
        </div>

        <CheckoutPanel service={service} />
      </div>
    </section>
  );
}
