// Headless balance harness for the L-system growth model
// (research/lsystem-growth.md §5, §10).
//
// Builds the roster decks from real cards through the actual buildChain, then races
// each on the same pure sim the browser sandbox uses (src/beam.js) over the real
// terrain generator. Prints a win-rate + peak-coverage table per deck and the
// terrain difficulty gate.
//
//   node preview/beam-balance.js            # default sweep
//   node preview/beam-balance.js 24         # seeds 1..24
//
// The point: tune the SHARED scan constants (TUNE below) to the §10 target — a
// strong deck wins most, the weak one-card starter ~never, terrain still gates.
// Area comes from the strands' branching skeleton (fork density), not a smolder
// flood. Env overrides for sweeps, e.g.:
//   SCANSPEED=0.30 RECLAIM=8 node preview/beam-balance.js

import { createSim, stepSim, SECTORS } from '../src/beam.js';
import { generateMachine } from '../src/terrain.js';
import { CARDS, buildChain } from '../src/cards.js';

const mergeDeck = (names) => buildChain(names.map((n) => CARDS[n]));

// The §5/§10 archetypes as card lists (+ the deliberately weak one-card starter).
const DECKS = {
  WEAK:     ['SCRIPT.COM'],                                  // one slow runner — soft-locks under 50%
  STARTER:  ['SCRIPT.COM', 'FORK.COM'],                      // the shipping starter — barely cracks EASY
  CURTAIN:  ['BUFFER.OVR', 'ROOTKIT', 'WORM'],               // wide fast worm + branch + sprout
  HARMONIC: ['WORM', 'HARMONIC', 'PAYLOAD'],                 // coilers that overlay + sprout
  FENCE:    ['BLUEBOX', 'BLUEBOX', 'LOGICBOMB'],             // vertical jets + downward drill
  GLITCH:   ['TANGENT', 'TANGENT', 'WORM'],                  // few fast blowout runners + spread
  SOLO0DAY: ['0DAY'],                                        // the grail on its own
};

// --- shared scan constants under calibration (the tuning surface) ---
const envN = (k, d) => (process.env[k] !== undefined ? +process.env[k] : d);
const TUNE = {
  scanSpeed: envN('SCANSPEED', 0.30),     // scan rows/tick (aggression 0.75 ≈ 0.30)
  reclaim: envN('RECLAIM', 6),            // reclaimed cells per scanned row
  breachHold: envN('BREACHHOLD', 15),     // ticks held ≥win to breach
  winCoverage: envN('WINCOV', 50),        // % of claimable cells to breach
};

function paramsFor(merged, sectorIndex) {
  const sec = SECTORS[sectorIndex];
  return { ...merged, p: (sec.x0 + sec.x1) >> 1, chain: merged.chain, ...TUNE };
}

function runBattle(seed, sectorIndex, merged) {
  const sim = createSim(seed, sectorIndex, paramsFor(merged, sectorIndex));
  let peak = 0;
  for (let t = 0; t < 800 && !sim.outcome; t++) {
    const snap = stepSim(sim);   // stepSim already caches coverage — don't rescan
    if (snap.coverage > peak) peak = snap.coverage;
  }
  return { outcome: sim.outcome ?? 'traced', peak, reTread: sim.reTread };
}

// --- sweep ---
const SEEDS = Math.max(1, parseInt(process.argv[2], 10) || 8);
const seedList = Array.from({ length: SEEDS }, (_, i) => i + 1);

const diffCount = { EASY: 0, MED: 0, HARD: 0, BRUTAL: 0 };
let sectorsTotal = 0;
for (const seed of seedList) {
  const m = generateMachine(seed);
  for (const s of m.sectors) { diffCount[s.difficulty]++; sectorsTotal++; }
}

console.log(`\nL-SYSTEM BALANCE — ${SEEDS} seeds × ${SECTORS.length} sector = ${sectorsTotal} battles/deck`);
console.log(`TUNE ${JSON.stringify(TUNE)}\n`);
console.log('terrain gate:',
  Object.entries(diffCount).map(([k, v]) => `${k} ${v} (${(100 * v / sectorsTotal).toFixed(0)}%)`).join('  '));
console.log('');

const pct = (n, d) => `${(100 * n / d).toFixed(0)}%`;
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('deck', 10), pad('chain', 26), pad('win', 11), pad('peak (min/med/max)', 20), 'reTread');
console.log('-'.repeat(82));

let reTreadTotal = 0;
for (const [name, cards] of Object.entries(DECKS)) {
  const merged = mergeDeck(cards);
  let wins = 0, total = 0, rt = 0;
  const peaks = [];
  for (const seed of seedList) for (let si = 0; si < SECTORS.length; si++) {
    const { outcome, peak, reTread } = runBattle(seed, si, merged);
    total++; if (outcome === 'win') wins++;
    peaks.push(peak); rt += reTread;
  }
  reTreadTotal += rt;
  peaks.sort((a, b) => a - b);
  const med = peaks[peaks.length >> 1];
  const label = merged.chain.map((s) => s.grammar).join('·');
  console.log(
    pad(name, 10),
    pad(label.slice(0, 25), 26),
    pad(`${wins}/${total} ${pct(wins, total)}`, 11),
    pad(`${peaks[0].toFixed(0)} / ${med.toFixed(0)} / ${peaks[peaks.length - 1].toFixed(0)}`, 20),
    rt,
  );
}
console.log('-'.repeat(82));
console.log(`re-tread invariant (must be 0): ${reTreadTotal}`);
