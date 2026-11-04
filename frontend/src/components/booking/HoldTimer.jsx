import { useEffect } from 'react';
import { Timer } from 'lucide-react';
import { mmss, useCountdown } from '../../hooks/useCountdown';

/** Shows the remaining seat-hold time and calls onExpire once it hits zero. */
export default function HoldTimer({ until, onExpire }) {
  const left = useCountdown(until);
  useEffect(() => {
    if (until && left === 0) onExpire?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, until]);
  if (!until) return null;
  const urgent = left < 120;
  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${urgent ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
      <Timer className="h-4 w-4" />
      Seats held for <span className="tabular-nums">{mmss(left)}</span>
    </div>
  );
}
