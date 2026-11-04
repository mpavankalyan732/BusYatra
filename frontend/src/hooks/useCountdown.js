import { useEffect, useState } from 'react';

/** Seconds remaining until `until` (Date|string), ticking every second. */
export function useCountdown(until) {
  const calc = () => (until ? Math.max(0, Math.floor((new Date(until) - Date.now()) / 1000)) : 0);
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    if (!until) return undefined;
    const t = setInterval(() => setLeft(calc()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [until]);
  return left;
}

export const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
