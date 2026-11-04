import { motion } from 'framer-motion';

/** Wraps each route so stage changes slide/fade instead of jumping. */
export default function PageTransition({ children, className = '' }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.main>
  );
}
