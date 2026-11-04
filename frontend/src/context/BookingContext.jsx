import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Booking-journey state shared across Seats -> Passengers -> Summary -> Payment -> Success.
 * Persisted to sessionStorage so a refresh doesn't lose progress. The server remains the
 * source of truth: every stage re-validates against the API.
 */
const BookingContext = createContext(null);
const KEY = 'by_booking';

const empty = {
  schedule: null, // serialized schedule from search/seat API
  selectedSeats: [], // [{id, seatNumber, fare, deck}]
  hold: null, // {bookingId, accessToken, lockExpiresAt}
  passengers: {}, // seatId -> {name, age, gender}
  contact: { email: '', phone: '' },
  booking: null, // latest booking payload from the API
};

export function BookingProvider({ children }) {
  const [state, setState] = useState(() => {
    try {
      return { ...empty, ...JSON.parse(sessionStorage.getItem(KEY) || '{}') };
    } catch {
      return empty;
    }
  });

  useEffect(() => {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  const update = useCallback((patch) => setState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) })), []);
  const reset = useCallback(() => setState(empty), []);

  /** Remember access tokens of completed bookings so the success / manage pages can load them */
  const rememberTicket = useCallback((bookingCode, accessToken) => {
    try {
      const all = JSON.parse(localStorage.getItem('by_tickets') || '{}');
      all[bookingCode] = accessToken;
      localStorage.setItem('by_tickets', JSON.stringify(all));
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ ...state, update, reset, rememberTicket }), [state, update, reset, rememberTicket]);
  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export const useBooking = () => useContext(BookingContext);

export function ticketTokenFor(bookingCode) {
  try {
    return JSON.parse(localStorage.getItem('by_tickets') || '{}')[bookingCode];
  } catch {
    return undefined;
  }
}
