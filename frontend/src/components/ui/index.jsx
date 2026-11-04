import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, X } from 'lucide-react';

const variants = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/25',
  secondary: 'bg-white text-ink-900 border border-slate-300 hover:border-slate-400 hover:bg-slate-50',
  ghost: 'text-ink-700 hover:bg-slate-100',
  dark: 'bg-ink-900 text-white hover:bg-black',
  danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
};
const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3.5 text-base' };

export function Button({ variant = 'primary', size = 'md', loading, disabled, className = '', children, icon: Icon, ...props }) {
  return (
    <motion.button
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </motion.button>
  );
}

export const Spinner = ({ className = 'h-6 w-6' }) => <Loader2 className={`animate-spin text-brand-600 ${className}`} />;

export function FullPageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-ink-500">
      <Spinner className="h-8 w-8" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export const Skeleton = ({ className = '' }) => <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />;

const badgeTones = {
  green: 'bg-green-50 text-green-700 ring-green-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  slate: 'bg-slate-100 text-slate-700 ring-slate-500/20',
};
export const Badge = ({ tone = 'slate', children, className = '' }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${badgeTones[tone]} ${className}`}>{children}</span>
);

export const statusTone = (s) =>
  ({ CONFIRMED: 'green', PAID: 'green', SUCCEEDED: 'green', SYNCED: 'green', SENT: 'green', PENDING: 'amber', PROCESSING: 'amber', CREATED: 'amber', FAILED: 'red', CANCELLED: 'red', EXPIRED: 'slate', REFUNDED: 'blue', NOT_CONFIGURED: 'slate' }[s] || 'slate');

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      {Icon && (
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <Icon className="h-7 w-7" />
        </div>
      )}
      <h3 className="text-lg font-bold">{title}</h3>
      {children && <div className="mt-1 max-w-md text-sm text-ink-500">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{title}</h3>
              <button onClick={onClose} className="rounded-lg p-1.5 text-ink-500 hover:bg-slate-100" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Field({ label, error, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="label">{label}</span>}
      {children}
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}
