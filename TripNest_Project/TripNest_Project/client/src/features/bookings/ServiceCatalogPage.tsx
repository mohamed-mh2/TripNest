// Services page: category navigation, search, filters, sorting, and results. المسؤول: abed alrahman.

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAppDispatch, useAppSelector } from '../../store';
import { categoryChanged, filtersChanged, filtersReset } from '../../store/bookingsSlice';
import { categoryInfo, isServiceCategory } from './categories';
import { useServiceSearch } from './hooks/useServiceSearch';
import { CategoryTabs } from './components/CategoryTabs';
import { ServiceFiltersPanel } from './components/ServiceFiltersPanel';
import { ServiceCard } from './components/ServiceCard';
import { DemoNotice, LoadingCards, StatusMessage } from './components/StatusMessage';
import type { ServiceCategory } from '../../../../shared/types';
import './bookings.css';

export default function ServiceCatalogPage() {
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { category, filters } = useAppSelector((state) => state.bookings);

  // #explain_notes: The category lives in the URL (?category=hotel) so it survives refresh and can be shared.
  const urlCategory = searchParams.get('category');

  useEffect(() => {
    if (isServiceCategory(urlCategory) && urlCategory !== category) {
      dispatch(categoryChanged(urlCategory));
    }
  }, [dispatch, urlCategory, category]);

  const activeCategory: ServiceCategory = isServiceCategory(urlCategory)
    ? urlCategory
    : category;
  const { services, facets, status, error, retry } = useServiceSearch(
    activeCategory,
    filters,
  );
  const info = categoryInfo(activeCategory);

  function selectCategory(next: ServiceCategory) {
    dispatch(categoryChanged(next));
    setSearchParams({ category: next });
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Travel services</h1>
          <p className="page-header__subtitle">
            Find and book transport, stays, data, and experiences for your trip.
          </p>
        </div>
      </header>

      <DemoNotice />

      <CategoryTabs active={activeCategory} onChange={selectCategory} />

      <ServiceFiltersPanel
        category={activeCategory}
        filters={filters}
        facets={facets}
        onChange={(changes) => dispatch(filtersChanged(changes))}
        onReset={() => dispatch(filtersReset())}
      />

      <div className="results-heading">
        <h2>{info.label}</h2>
        {status === 'ready' && (
          <span className="results-count">
            {services.length} {services.length === 1 ? 'option' : 'options'}
          </span>
        )}
      </div>

      {status === 'loading' && <LoadingCards />}

      {status === 'error' && (
        <StatusMessage
          tone="error"
          title="Could not load services"
          action={
            <button type="button" className="button" onClick={retry}>
              Try again
            </button>
          }
        >
          {error}
        </StatusMessage>
      )}

      {status === 'ready' && services.length === 0 && (
        <StatusMessage
          tone="empty"
          title="No services match these filters"
          action={
            <button
              type="button"
              className="button"
              onClick={() => dispatch(filtersReset())}
            >
              Reset filters
            </button>
          }
        >
          Try a different search, a higher price limit, or fewer filters.
        </StatusMessage>
      )}

      {status === 'ready' && services.length > 0 && (
        <div className="service-grid">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      )}
    </section>
  );
}
