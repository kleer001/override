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
import { CARDS, mergeBeam, GROWTH, GROWTH_CAP } from '../src/cards.js';

// Merge a deck of card NAMES into one beam through the SHIPPING merge rules — this
// harness validates the real cards + real merge, not a parallel copy. mergeBeam
// returns shapes as a {key:bool} object; the sim reads that shape directly.
const mergeDeck = (names) => mergeBeam(names.map((n) => CARDS[n]));

// The §6 escalation stacks as end-state card lists (+ a deliberately weak starter).
const DECKS = {
  WEAK:     ['SCRIPT.COM'],                                              // the one-card starter (lin·←·50·Med) — soft-locks ~0%
  ONRAMP:   ['SCRIPT.COM', 'FORK.COM'],                                  // starter + the 10-ROOT deck-add → lin·←→·100·gr.60
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

// Build a full params block for a merged deck on one sector. mergeBeam already
// supplies shapes/amp/freq/dirs/probMode/prob/maskN/reproduce/spreadReach.
function paramsFor(merged, sectorIndex) {
  const sec = SECTORS[sectorIndex];
  return {
    ...merged,
    p: (sec.x0 + sec.x1) >> 1,
    dirs: new Set(merged.dirs),
    reproduce: Math.min(GROWTH_CAP, merged.reproduce * GROWTH_SCALE),
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
  const shapeList = Object.keys(merged.shapes).filter((k) => merged.shapes[k]).join('+');
  const beam = `${shapeList}·${[...merged.dirs].join('') || '—'}·${merged.prob}%·gr${merged.reproduce.toFixed(2)}`;
  console.log(
    pad(name, 10),
    pad(beam, 30),
    pad(`${wins}/${total} ${pct(wins, total)}`, 10),
    `${peaks[0].toFixed(0)} / ${med.toFixed(0)} / ${peaks[peaks.length - 1].toFixed(0)}`.padEnd(26),
  );
}
console.log('');
