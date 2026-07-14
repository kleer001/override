// Headless balance harness for the Beam-Card model (research/ember-model.md §13).
//
// Runs the §6 escalation-stack decks (built from real §5 cards through the actual
// merge rules) across many seeds × all three sectors, on the same pure sim the
// browser sandbox uses (beam-sim.js) over the real terrain generator. Prints a
// win-rate + peak-coverage table per deck and the terrain difficulty gate.
//
//   node preview/beam-balance.js            # default sweep
//   node preview/beam-balance.js 24         # seeds 1..24
//
// The point: tune the SHARED terminal/scan constants (TUNE below) + the GROWTH
// level→(reproduce, spreadReach) mapping to the §13 target — a strong deck wins
// ~5/6, a weak deck 0/6, terrain still gates (~1/8 BRUTAL). Deck shapes come from
// cards; pool/reachCap/scan are terminal meta-stats shared by every deck.

import { createSim, stepSim, coverage, SECTORS } from '../src/beam.js';
import { generateMachine } from '../src/terrain.js';

// --- GROWTH aspect: level → (reproduce chance, child spread-reach) (§3). Cards
// carry a level; merging ADDS reproduce (cap) and MAXes spread-reach. ---
const GROWTH = {
  None: { r: 0.00, s: 0 },
  Low:  { r: 0.10, s: 4 },
  Med:  { r: 0.20, s: 6 },
  High: { r: 0.40, s: 8 },
};
const GROWTH_CAP = 0.60;   // merged reproduce cap (§3 / §6)

// --- the §5 card pool (representative slice). Each card is a bundled quad. ---
// shape is one of beam-sim SHAPES keys; dirs is a list of compass headings.
const C = {
  'SCRIPT.COM': { shape: 'linear', dirs: ['←'],        prob: 25,  growth: 'Low'  },
  'SCRIPT.SYS': { shape: 'linear', dirs: ['→'],        prob: 25,  growth: 'Low'  },
  'BUFFER.OVR': { shape: 'linear', dirs: ['←', '→'],   prob: 50,  growth: 'Med'  },
  'WORM':       { shape: 'sine',   dirs: ['←', '→'],   prob: 25,  growth: 'High' },
  'HARMONIC':   { shape: 'sine2',  dirs: ['←', '→'],   prob: 25,  growth: 'Med'  },
  'PHREAK':     { shape: 'sine3',  dirs: ['←'],        prob: 25,  growth: 'Low'  },
  'BLUEBOX':    { shape: 'rect',   dirs: ['↑'],        prob: 50,  growth: 'Low'  },
  'LOGICBOMB':  { shape: 'saw',    dirs: ['↓'],        prob: 50,  growth: 'Med'  },
  'ROOTKIT':    { shape: 'linear', dirs: ['←', '→'],   prob: 75,  growth: 'Med'  },
  'PAYLOAD':    { shape: 'sine',   dirs: ['←', '→'],   prob: 50,  growth: 'High' },
  'NOP.SLED':   { shape: 'linear', dirs: [],           prob: 50,  growth: 'None' },
  'TANGENT':    { shape: 'tan',    dirs: ['←', '→'],   prob: 10,  growth: 'None' },
};

// Amplitude/frequency are shape-family conventions (not a card aspect): curved
// shapes want a visible swing, linear ignores amp. Kept here so decks stay clean.
const AMP_FOR = (shapes) => (shapes.has('tan') ? 5 : shapes.size && !shapes.has('linear') || shapes.size > 1 ? 6 : 0);
const FREQ = 2;

// Merge a list of card names into one beam's aspect block (§3 merge rules).
function mergeDeck(names) {
  const shapes = new Set();
  const dirs = new Set();
  let prob = 0, repro = 0, spread = 0;
  for (const n of names) {
    const card = C[n];
    shapes.add(card.shape);
    for (const d of card.dirs) dirs.add(d);
    prob += card.prob;                                   // ADDS
    repro += GROWTH[card.growth].r;                      // ADDS
    spread = Math.max(spread, GROWTH[card.growth].s);    // MAX
  }
  return {
    shapes, dirs,
    prob: Math.min(100, prob),
    reproduce: Math.min(GROWTH_CAP, repro),
    spreadReach: spread,
    amp: AMP_FOR(shapes),
  };
}

// The §6 escalation stacks as end-state card lists (+ a deliberately weak starter).
const DECKS = {
  WEAK:     ['SCRIPT.COM'],                                              // one forbidden card
  CURTAIN:  ['SCRIPT.COM', 'SCRIPT.COM', 'SCRIPT.SYS', 'BUFFER.OVR', 'ROOTKIT'],
  LANCE:    ['SCRIPT.SYS', 'SCRIPT.SYS'],                                // thin, deep, low-growth
  HARMONIC: ['WORM', 'HARMONIC', 'PHREAK', 'PAYLOAD'],
  FENCE:    ['BLUEBOX', 'BLUEBOX', 'LOGICBOMB'],
  GLITCH:   ['TANGENT', 'TANGENT', 'WORM'],
};

// --- SHARED terminal/scan constants under calibration (the tuning surface) ---
// Every value is env-overridable for quick sweeps, e.g.  POOL=1000 RECLAIM=5 node …
const envN = (k, d) => (process.env[k] !== undefined ? +process.env[k] : d);
const TUNE = {
  pool: envN('POOL', 1000),             // REACH pool (terminal meta-stat, shared by every deck)
  reachCap: envN('REACHCAP', 20),       // max REACH any one ember may hold
  scanSpeed: envN('SCANSPEED', 0.40),   // scan rows advanced per tick
  reclaim: envN('RECLAIM', 6),          // reclaimed cells per scanned row
  breachHold: envN('BREACHHOLD', 15),   // ticks held ≥win to breach
  winCoverage: envN('WINCOV', 50),      // % of claimable cells to breach
};
// GROWTH_SCALE multiplies every deck's merged reproduce (ablation: 0 = no growth).
const GROWTH_SCALE = envN('GROWTH_SCALE', 1);

const SHAPE_KEYS = ['linear', 'sine', 'sine2', 'sine3', 'rect', 'tan', 'saw'];

// Build a full params block for a merged deck on one sector.
function paramsFor(merged, sectorIndex) {
  const sec = SECTORS[sectorIndex];
  const shapes = {};
  for (const k of SHAPE_KEYS) shapes[k] = merged.shapes.has(k);
  return {
    p: (sec.x0 + sec.x1) >> 1,
    shapes, amp: merged.amp, freq: FREQ,
    dirs: new Set(merged.dirs),
    probMode: 'prob', prob: merged.prob, maskN: 5,
    reproduce: Math.min(GROWTH_CAP, merged.reproduce * GROWTH_SCALE), spreadReach: merged.spreadReach,
    ...TUNE,
  };
}

// Run one battle to its outcome; return { outcome, peak } (peak coverage %).
function runBattle(seed, sectorIndex, merged) {
  const sim = createSim(seed, sectorIndex, paramsFor(merged, sectorIndex));
  let peak = 0;
  for (let t = 0; t < 600 && !sim.outcome; t++) {
    stepSim(sim);
    const c = coverage(sim);
    if (c > peak) peak = c;
  }
  return { outcome: sim.outcome ?? 'traced', peak };
}

// --- sweep ---
const SEEDS = Math.max(1, parseInt(process.argv[2], 10) || 8);
const seedList = Array.from({ length: SEEDS }, (_, i) => i + 1);

// terrain difficulty gate (independent of any deck)
const diffCount = { EASY: 0, MED: 0, HARD: 0, BRUTAL: 0 };
let sectorsTotal = 0;
for (const seed of seedList) {
  const m = generateMachine(seed);
  for (const s of m.sectors) { diffCount[s.difficulty]++; sectorsTotal++; }
}

console.log(`\nBEAM-CARD BALANCE — ${SEEDS} seeds × ${SECTORS.length} sectors = ${sectorsTotal} battles/deck`);
console.log(`TUNE ${JSON.stringify(TUNE)}`);
console.log(`GROWTH None/Low/Med/High reproduce = 0/${GROWTH.Low.r}/${GROWTH.Med.r}/${GROWTH.High.r} (cap ${GROWTH_CAP})\n`);

console.log('terrain gate:',
  Object.entries(diffCount).map(([k, v]) => `${k} ${v} (${(100 * v / sectorsTotal).toFixed(0)}%)`).join('  '));
console.log('');

const pct = (n, d) => `${(100 * n / d).toFixed(0)}%`;
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('deck', 10), pad('merged beam', 30), pad('win', 10), pad('peak cov  (min/med/max)', 26));
console.log('-'.repeat(78));

for (const [name, cards] of Object.entries(DECKS)) {
  const merged = mergeDeck(cards);
  let wins = 0, total = 0;
  const peaks = [];
  for (const seed of seedList) for (let si = 0; si < SECTORS.length; si++) {
    const { outcome, peak } = runBattle(seed, si, merged);
    total++; if (outcome === 'win') wins++;
    peaks.push(peak);
  }
  peaks.sort((a, b) => a - b);
  const med = peaks[peaks.length >> 1];
  const beam = `${[...merged.shapes].join('+')}·${[...merged.dirs].join('') || '—'}·${merged.prob}%·gr${merged.reproduce.toFixed(2)}`;
  console.log(
    pad(name, 10),
    pad(beam, 30),
    pad(`${wins}/${total} ${pct(wins, total)}`, 10),
    `${peaks[0].toFixed(0)} / ${med.toFixed(0)} / ${peaks[peaks.length - 1].toFixed(0)}`.padEnd(26),
  );
}
console.log('');
