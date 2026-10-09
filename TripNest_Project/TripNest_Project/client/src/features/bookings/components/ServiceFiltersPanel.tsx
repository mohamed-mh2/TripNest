// Search, category-specific filters, price filter, and sorting for the services catalog. المسؤول: abed alrahman.

import { TRANSPORT_CATEGORIES } from '../categories';
import type {
  ServiceCategory,
  ServiceFacets,
  ServiceFilters,
  ServiceSort,
} from '../../../../../shared/types';


interface ServiceFiltersPanelProps {
  category: ServiceCategory;
  filters: ServiceFilters;
  facets: ServiceFacets | null;
  onChange: (changes: Partial<ServiceFilters>) => void;
  onReset: () => void;
}


const SORT_LABELS: Record<ServiceSort, string> = {
  recommended: 'Recommended',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  rating: 'Highest rated',
  name: 'Name (A-Z)',
};


function OptionSelect(props: {
  label: string;
  value: string;
  options: string[];
  anyLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span className="field__label">{props.label}</span>
      <select value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        <option value="">{props.anyLabel}</option>
        {props.options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}


const SEARCH_PLACEHOLDERS: Record<ServiceCategory, string> = {
  flight: 'Search flights or airlines',
  train: 'Search trains or operators',
  ferry: 'Search ferries or operators',
  hotel: 'Search hotels or areas',
  esim: 'Search eSIM packages',
  transfer: 'Search transfers or passes',
  activity: 'Search tours, attractions, events',
};


export function ServiceFiltersPanel({ category, filters, facets, onChange, onReset }: ServiceFiltersPanelProps) {
  const isTransport = TRANSPORT_CATEGORIES.includes(category);

  return (
    <form className="filters" onSubmit={(event) => event.preventDefault()} aria-label="Search and filters">
      <label className="field field--grow">
        <span className="field__label">Search</span>
        <input
          type="search"
          value={filters.q}
          placeholder={SEARCH_PLACEHOLDERS[category]}
          maxLength={100}
          onChange={(event) => onChange({ q: event.target.value })}
        />
      </label>

      {isTransport && (
        <>
          <OptionSelect
            label="From"
            value={filters.origin}
            options={facets?.origins || []}
            anyLabel="Any origin"
            onChange={(origin) => onChange({ origin })}
          />
          <OptionSelect
            label="To"
            value={filters.destination}
            options={facets?.destinations || []}
            anyLabel="Any destination"
            onChange={(destination) => onChange({ destination })}
          />
        </>
      )}

      {category === 'hotel' && (
        <label className="field">
          <span className="field__label">Hotel class</span>
          <select value={filters.minStars} onChange={(event) => onChange({ minStars: event.target.value })}>
            <option value="">Any stars</option>
            <option value="3">3 stars or more</option>
            <option value="4">4 stars or more</option>
            <option value="5">5 stars</option>
          </select>
        </label>
      )}

      {category === 'esim' && (
        <>
          <OptionSelect
            label="Coverage"
            value={filters.coverage}
            options={facets?.coverages || []}
            anyLabel="Any coverage"
            onChange={(coverage) => onChange({ coverage })}
          />
          <label className="field">
            <span className="field__label">Data</span>
            <select value={filters.minDataGb} onChange={(event) => onChange({ minDataGb: event.target.value })}>
              <option value="">Any amount</option>
              <option value="5">5 GB or more</option>
              <option value="10">10 GB or more</option>
              <option value="20">20 GB or more</option>
            </select>
          </label>
        </>
      )}

      {category === 'transfer' && (
        <OptionSelect
          label="Type"
          value={filters.transferType}
          options={facets?.transferTypes || []}
          anyLabel="All types"
          onChange={(transferType) => onChange({ transferType })}
        />
      )}

      <label className="field field--narrow">
        <span className="field__label">Max price (EUR)</span>
        <input
          type="number"
          min={0}
          step={1}
          inputMode="decimal"
          value={filters.maxPrice}
          placeholder={facets ? String(Math.ceil(facets.maxPriceMinor / 100)) : 'Any'}
          onChange={(event) => onChange({ maxPrice: event.target.value })}
        />
      </label>

      <label className="field">
        <span className="field__label">Rating</span>
        <select value={filters.minRating} onChange={(event) => onChange({ minRating: event.target.value })}>
          <option value="">Any rating</option>
          <option value="4">4.0 or more</option>
          <option value="4.5">4.5 or more</option>
        </select>
      </label>

      <label className="field">
        <span className="field__label">Sort by</span>
        <select value={filters.sort} onChange={(event) => onChange({ sort: event.target.value as ServiceSort })}>
          {(Object.keys(SORT_LABELS) as ServiceSort[]).map((sort) => (
            <option key={sort} value={sort}>{SORT_LABELS[sort]}</option>
          ))}
        </select>
      </label>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={filters.freeCancellation}
          onChange={(event) => onChange({ freeCancellation: event.target.checked })}
        />
        Free cancellation
      </label>

      <button type="button" className="button button--ghost" onClick={onReset}>
        Reset filters
      </button>
    </form>
  );
}
