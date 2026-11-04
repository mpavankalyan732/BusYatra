/**
 * Seat layout templates.
 * Seater grid columns: 0,1 | 2 = aisle | 3,4
 * Sleeper grid (2+1):  0 = single berth | 1 = aisle | 2,3 = double berth
 */
const ROWS = 'ABCDEFGHIJKLMN';

function seaterGrid(rows, { windowDelta = 0 } = {}) {
  const seats = [];
  for (let r = 0; r < rows; r++) {
    [0, 1, 3, 4].forEach((col, i) => {
      const isWindow = col === 0 || col === 4;
      seats.push({
        seatNumber: `${ROWS[r]}${i + 1}`,
        deck: 'LOWER',
        row: r,
        col,
        kind: 'SEATER',
        isWindow,
        priceDelta: isWindow ? windowDelta : 0,
      });
    });
  }
  return seats;
}

function sleeperDeck(deck, prefix, rows, priceDelta) {
  const seats = [];
  let n = 1;
  for (let r = 0; r < rows; r++) {
    [0, 2, 3].forEach((col) => {
      seats.push({
        seatNumber: `${prefix}${n++}`,
        deck,
        row: r,
        col,
        kind: 'SLEEPER',
        isWindow: col === 0 || col === 3,
        priceDelta,
      });
    });
  }
  return seats;
}

export const LAYOUT_TEMPLATES = {
  SEATER_2X2_40: {
    label: 'Seater 2+2 (40 seats)',
    seatClass: 'SEATER',
    build: () => seaterGrid(10),
  },
  SEMI_SLEEPER_2X2_36: {
    label: 'Semi-sleeper 2+2 (36 seats, window +₹30)',
    seatClass: 'SEMI_SLEEPER',
    build: () => seaterGrid(9, { windowDelta: 3000 }),
  },
  SLEEPER_2X1_30: {
    label: 'Sleeper 2+1 (30 berths, lower +₹100)',
    seatClass: 'SLEEPER',
    build: () => [...sleeperDeck('LOWER', 'L', 5, 10000), ...sleeperDeck('UPPER', 'U', 5, 0)],
  },
};

export function buildLayout(template) {
  const t = LAYOUT_TEMPLATES[template];
  if (!t) throw new Error(`Unknown layout template ${template}`);
  return t.build();
}
