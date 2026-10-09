// Asks the server for the price of the current selection (the client never calculates prices). المسؤول: abed alrahman.

import { useEffect, useState } from 'react';

import { ApiError } from '../../../api';
import { fetchQuote } from '../../../api/bookings';
import type { BookingSelection, QuoteResponse } from '../../../../../shared/types';


type QuoteStatus = 'idle' | 'loading' | 'ready' | 'invalid' | 'error';

interface QuoteState {
  status: QuoteStatus;
  result: QuoteResponse | null;
  fieldErrors: Record<string, string>;
  message: string | null;
}

const QUOTE_DELAY_MS = 350;


export function useQuote(serviceId: number, selection: BookingSelection | null): QuoteState {
  const [state, setState] = useState<QuoteState>({ status: 'idle', result: null, fieldErrors: {}, message: null });

  // #explain_notes: A string key so the effect reruns only when the selection really changes.
  const selectionKey = selection ? JSON.stringify(selection) : '';

  useEffect(() => {
    if (!selectionKey) {
      setState({ status: 'idle', result: null, fieldErrors: {}, message: null });
      return undefined;
    }

    let isCurrent = true;
    setState((previous) => ({ ...previous, status: 'loading' }));

    const timer = window.setTimeout(() => {
      fetchQuote(serviceId, JSON.parse(selectionKey) as BookingSelection)
        .then((result) => {
          if (isCurrent) {
            setState({ status: 'ready', result, fieldErrors: {}, message: null });
          }
        })
        .catch((error: ApiError) => {
          if (!isCurrent) {
            return;
          }

          if (error.status === 422) {
            setState({ status: 'invalid', result: null, fieldErrors: error.fields || {}, message: error.message });
          } else {
            setState({ status: 'error', result: null, fieldErrors: {}, message: error.message });
          }
        });
    }, QUOTE_DELAY_MS);

    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [serviceId, selectionKey]);

  return state;
}
