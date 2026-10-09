// Loads services and filter options for a category, with debounced filters and stale-response protection. المسؤول: abed alrahman.

import { useCallback, useEffect, useState } from 'react';

import { fetchServiceFacets, fetchServices } from '../../../api/bookings';
import type {
  ServiceCategory,
  ServiceFacets,
  ServiceFilters,
  TravelService,
} from '../../../../../shared/types';


type SearchStatus = 'loading' | 'ready' | 'error';

const SEARCH_DELAY_MS = 300;


export function useServiceSearch(category: ServiceCategory, filters: ServiceFilters) {
  const [services, setServices] = useState<TravelService[]>([]);
  const [facets, setFacets] = useState<ServiceFacets | null>(null);
  const [status, setStatus] = useState<SearchStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    setFacets(null);
    fetchServiceFacets(category)
      .then((result) => {
        if (isCurrent) {
          setFacets(result);
        }
      })
      .catch(() => {
        // Filter options are optional; the search still works without them.
      });

    return () => {
      isCurrent = false;
    };
  }, [category]);

  // #explain_notes: Waits briefly after typing, and ignores responses from older searches.
  useEffect(() => {
    let isCurrent = true;
    setStatus('loading');

    const timer = window.setTimeout(() => {
      fetchServices(category, filters)
        .then((result) => {
          if (isCurrent) {
            setServices(result.services);
            setError(null);
            setStatus('ready');
          }
        })
        .catch((searchError: Error) => {
          if (isCurrent) {
            setError(searchError.message);
            setStatus('error');
          }
        });
    }, SEARCH_DELAY_MS);

    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [category, filters, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { services, facets, status, error, retry };
}
