import { motion } from 'framer-motion';

/** Original inline SVG: a coach cruising past hills, with animated road and wheels. */
export default function HeroIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-xl select-none" aria-hidden>
      <svg viewBox="0 0 520 300" className="w-full">
        <defs>
          <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#fff1f2" />
            <stop offset="1" stopColor="#ffffff" />
          </linearGradient>
          <linearGradient id="body" x1="0" x2="1">
            <stop offset="0" stopColor="#e8384f" />
            <stop offset="1" stopColor="#b31b30" />
          </linearGradient>
        </defs>
        <rect width="520" height="300" rx="28" fill="url(#sky)" />
        <motion.circle cx="420" cy="70" r="30" fill="#fde68a" animate={{ y: [0, -6, 0] }} transition={{ duration: 6, repeat: Infinity }} />
        <motion.g animate={{ x: [0, -20, 0] }} transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}>
          <path d="M0 200 Q 90 120 180 190 T 360 180 T 520 170 V300 H0Z" fill="#fecdd3" opacity=".6" />
        </motion.g>
        <path d="M0 215 Q 120 160 250 205 T 520 200 V300 H0Z" fill="#fda4af" opacity=".45" />
        {/* clouds */}
        {[[70, 60, 1], [250, 45, 0.8]].map(([x, y, s], i) => (
          <motion.g key={i} animate={{ x: [0, 30, 0] }} transition={{ duration: 14 + i * 4, repeat: Infinity, ease: 'easeInOut' }}>
            <g transform={`translate(${x} ${y}) scale(${s})`} fill="#fff">
              <ellipse cx="0" cy="10" rx="34" ry="14" />
              <ellipse cx="22" cy="0" rx="22" ry="16" />
              <ellipse cx="-18" cy="4" rx="18" ry="12" />
            </g>
          </motion.g>
        ))}
        {/* road */}
        <rect y="238" width="520" height="62" fill="#1f2937" />
        <g className="road-dashes">
          {Array.from({ length: 10 }).map((_, i) => <rect key={i} x={i * 80} y="266" width="40" height="5" rx="2" fill="#f9fafb" opacity=".8" />)}
        </g>
        {/* bus */}
        <motion.g animate={{ y: [0, -2.5, 0] }} transition={{ duration: 0.6, repeat: Infinity }}>
          <rect x="110" y="140" width="290" height="100" rx="20" fill="url(#body)" />
          <rect x="110" y="208" width="290" height="10" fill="#8f1728" opacity=".5" />
          <path d="M370 140 h10 a20 20 0 0 1 20 20 v40 h-30z" fill="#bfdbfe" opacity=".95" />
          {[130, 180, 230, 280, 320].map((x) => <rect key={x} x={x} y="156" width="38" height="32" rx="6" fill="#dbeafe" />)}
          <rect x="132" y="196" width="140" height="6" rx="3" fill="#fff" opacity=".7" />
          <text x="222" y="232" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="800" fontSize="14" fill="#fff">BusYatra</text>
          <circle cx="398" cy="214" r="5" fill="#fde68a" />
          {[165, 345].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy="242" r="22" fill="#111827" />
              <motion.g style={{ originX: `${cx}px`, originY: '242px' }} animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}>
                <circle cx={cx} cy="242" r="10" fill="#9ca3af" />
                <rect x={cx - 1.5} y="232" width="3" height="20" fill="#4b5563" />
              </motion.g>
            </g>
          ))}
        </motion.g>
        {/* speed lines */}
        {[170, 190, 210].map((y, i) => (
          <motion.rect key={y} x="50" y={y} width="44" height="3" rx="1.5" fill="#e8384f" opacity=".4" animate={{ x: [60, 20], opacity: [0.5, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }} />
        ))}
      </svg>
    </div>
  );
}
