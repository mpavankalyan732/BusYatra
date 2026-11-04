import crypto from 'node:crypto';

// ---- money (integer paise) ----
export const formatInr = (paise) =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
/** PDFKit's built-in fonts cannot render the ₹ glyph */
export const formatInrAscii = (paise) =>
  `Rs. ${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---- tokens ----
export const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Natural sort for seat numbers: A2 < A10 < B1 */
export const seatSort = (a, b) => a.localeCompare(b, 'en', { numeric: true });
