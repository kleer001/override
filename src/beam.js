// Beam-Card Model — the game's canonical pure simulation (research/ember-model.md
// §2–§9). This is the reference implementation the whole game runs on: src/battle.js
// layers run/aggression/CODE concerns on top, and preview/beam.html + beam-balance.js
// consume it directly for calibration.
//
// NO DOM in this file. All randomness flows through a seeded mulberry32 rng so a
// (seed, params) pair replays identically. Terrain generation + reclaimRow are
// reused from src/terrain.js.

import { mulberry32, randInt } from './rng.js';
import {
  generateMachine, reclaimRow,
  FIELD_W, FIELD_H, COST, idx, WALL, HONEY, SECTORS,
} from './terrain.js';

export { FIELD_W, FIELD_H, SECTORS, WALL, idx };

// --- direction vocabulary (ember-model.md §3): the 8 compass headings ---
export const DIRVEC = {
  '←': [-1, 0],  // ←
  '→': [1, 0],   // →
  '↑': [0, -1],  // ↑
  '↓': [0, 1],   // ↓
  '↖': [-1, -1], // ↖
  '↗': [1, -1],  // ↗
  '↘': [1, 1],   // ↘
  '↙': [-1, 1],  // ↙
};
export const DIR_KEYS = Object.keys(DIRVEC);

// --- shape vocabulary (ember-model.md §3, shape aspect) ---
// Each returns a horizontal spine offset for normalised row t in [0,1].
// Multiple selected shapes SUM (Fourier superposition). `a` = amplitude (cells),
// `f` = base frequency (cycles up the field). Harmonics are baked in
// (sine2 = octave, sine3 = 3rd harmonic) so summing them squares the wave.
export const SHAPES = {
  linear: () => 0,                                            // pencil (straight)
  sine:  (t, a, f) => a * Math.sin(2 * Math.PI * f * t),
  sine2: (t, a, f) => a * Math.sin(2 * Math.PI * (2 * f) * t),
  sine3: (t, a, f) => a * Math.sin(2 * Math.PI * (3 * f) * t),
  rect:  (t, a, f) => a * (2 * Math.abs(Math.sin(2 * Math.PI * f * t)) - 1),
  tan:   (t, a, f) => a * Math.tan(2 * Math.PI * f * t),      // asymptote blowout
  saw:   (t, a, f) => a * (2 * (((f * t) % 1) + 1) % 1 - 1),
};
export const SHAPE_KEYS = Object.keys(SHAPES);

// Summed offset of all selected shapes at row y (deterministic — no rng, so the
// waveform preview matches the drawn spine exactly).
export function shapeOffset(params, y) {
  const t = FIELD_H > 1 ? y / (FIELD_H - 1) : 0;
  let off = 0;
  for (const k of SHAPE_KEYS) {
    if (params.shapes[k]) off += SHAPES[k](t, params.amp, params.freq);
  }
  return off;
}

// Spine x at row y: x(y) = round(p + Σ shape(y)), clamped on-board (§2).
export function spineX(params, y) {
  const x = Math.round(params.p + shapeOffset(params, y));
  return x < 0 ? 0 : x > FIELD_W - 1 ? FIELD_W - 1 : x;
}

const clampBudgetCost = (terr, jit) => {
  const base = COST[terr];
  if (base === Infinity) return Infinity;                     // WALL stays a firebreak
  return base + jit;                                          // ±1 terrain jitter
};

// Default parameter block. DOM mutates a live copy so sliders take effect on the
// running sim; spine params are re-read every emitted row.
export function defaultParams() {
  return {
    p: 13,                                     // trigger column
    shapes: { linear: true, sine: false, sine2: false, sine3: false, rect: false, tan: false, saw: false },
    amp: 4,                                     // shape amplitude (cells)
    freq: 2,                                     // shape base frequency
    dirs: new Set(['←', '→']),           // emission direction union (mild curtain by default)
    probMode: 'prob',                            // 'prob' (additive %) | 'mask' (every-Nth)
    prob: 60,                                     // merged emission probability %
    maskN: 5,                                     // every-Nth deterministic mask
    pool: 1000,                                    // REACH pool for the whole packet (§4; calibrated on the 62×28 block)
    reachCap: 20,                                  // max REACH any one ember may hold
    spreadReach: 6,                                // GROWTH: reach of a child spawned when an ember reproduces
    reproduce: 0.15,                               // GROWTH: per-step chance a burning ember spawns a spreading child
    scanSpeed: 0.40,                               // scan rows advanced per tick
    reclaim: 6,                                     // reclaimed cells per scanned row
    breachHold: 15,                                 // ticks held ≥win to breach
    winCoverage: 50,                                // % of claimable cells to breach
  };
}

// Build a sim over an EXISTING machine (the game's persistent board). sectorIndex
// 0..2; rng is a seeded mulberry32 (distinct from the terrain-gen rng). The battle
// layer uses this so conquered sectors persist across a run on one shared machine.
export function createSimOn(machine, sectorIndex, params, rng) {
  const sector = machine.sectors[sectorIndex % machine.sectors.length];
  // claimable = every non-WALL cell in the sector (coverage denominator).
  let claim = 0;
  for (let y = 0; y < FIELD_H; y++)
    for (let x = sector.x0; x <= sector.x1; x++)
      if (machine.t[idx(x, y)] !== WALL) claim++;

  return {
    machine, sector, claim,
    params,
    rng,
    heat: new Float32Array(FIELD_W * FIELD_H),      // per-cell burn strength (render ramp)
    reclaimed: new Set(),                            // cells reclaimed on the last tick (flash)
    embers: [],                                       // live embers
    spineRow: FIELD_H - 1,                             // next spine row to emit (bottom→top)
    maskIdx: 0,                                          // deterministic mask counter
    scanRow: 0, scanAcc: 0,                               // trace scan position
    honeyBurned: 0,                                        // honeypots burned so far (trace spike)
    breachLeft: -1,                                        // breach countdown (ticks)
    cov: 0,                                                 // cached coverage %, refreshed each tick
    outcome: null,                                          // null | 'win' | 'traced'
    tick: 0,
  };
}

// Convenience: fresh machine + sim (sandbox / balance harness / tests).
export function createSim(seed, sectorIndex, params) {
  const machine = generateMachine(seed >>> 0);
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  return createSimOn(machine, sectorIndex, params, rng);
}

function burn(sim, x, y, strength) {
  const c = idx(x, y);
  if (!sim.machine.burned[c] && sim.machine.t[c] === HONEY) sim.honeyBurned++;  // tripped bait
  sim.machine.burned[c] = 1;
  if (strength > sim.heat[c]) sim.heat[c] = strength;         // hottest wins (near-spine glow)
}

// Shared REACH pool split across the packet's EXPECTED ember count (§4): many
// embers (wide / high-prob / many directions) → each shallow; few embers (a
// lance) → each deep, up to reachCap. Uses the expected count rather than a
// pre-rolled plan so live slider tweaks take effect on the running sim.
function emberShare(sim) {
  const p = sim.params;
  let rows = 0;
  for (let y = 0; y < FIELD_H; y++)
    if (sim.machine.t[idx(spineX(p, y), y)] !== WALL) rows++;
  const hitRate = p.probMode === 'mask'
    ? 1 / Math.max(1, p.maskN)
    : Math.min(100, p.prob) / 100;
  const expected = Math.max(1, rows * hitRate * Math.max(1, p.dirs.size));
  return Math.min(p.reachCap, p.pool / expected);
}

// Emit one spine row: roll merged probability, and on a hit spawn one ember per
// unioned direction (§3–§4), each with its share of the packet REACH pool. Burns
// the spine contact cell itself.
function emitSpineRow(sim, y) {
  const p = sim.params;
  const sx = spineX(p, y);
  if (sim.machine.t[idx(sx, y)] === WALL) return;             // spine grounded on a firewall — no seed

  let hit;
  if (p.probMode === 'mask') {
    hit = (sim.maskIdx % Math.max(1, p.maskN)) === 0;
    sim.maskIdx++;
  } else {
    hit = sim.rng() < Math.min(100, p.prob) / 100;
  }
  if (!hit) return;

  const share = emberShare(sim);
  burn(sim, sx, y, share);                                    // spine contact cell
  for (const dir of p.dirs) {
    const [dx, dy] = DIRVEC[dir];
    sim.embers.push({ x: sx, y, dx, dy, budget: share, alive: true });
  }
}

const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const MAX_EMBERS = 3000;   // compute guard against a runaway branching process

// Advance every live ember one cell in its heading, spending REACH against the
// COST table with ±1 jitter; BUS refunds, WALL / off-board / budget≤0 kills it.
// GROWTH (the 4th aspect): as it burns, an ember may REPRODUCE — spawn a child
// that spreads to a random unburned orthogonal neighbour with a fresh spreadReach
// budget — so the fire keeps burning and filling 2D instead of dying at pool's end.
function stepEmbers(sim) {
  const p = sim.params, alive = [];
  for (const e of sim.embers) {
    const nx = e.x + e.dx, ny = e.y + e.dy;
    if (nx < 0 || nx >= FIELD_W || ny < 0 || ny >= FIELD_H) continue;   // off-board → spent
    const terr = sim.machine.t[idx(nx, ny)];
    if (terr === WALL) continue;                                          // firebreak → spent
    const cost = clampBudgetCost(terr, randInt(sim.rng, -1, 1));
    e.budget -= cost;                                                     // BUS (-1) refunds
    e.x = nx; e.y = ny;
    burn(sim, nx, ny, Math.max(0, e.budget));

    // reproduce into a fresh unburned neighbour (keeps the fire alive)
    if (p.reproduce > 0 && sim.embers.length + alive.length < MAX_EMBERS && sim.rng() < p.reproduce) {
      const o = randInt(sim.rng, 0, 3);
      for (let k = 0; k < 4; k++) {
        const [cdx, cdy] = ORTHO[(o + k) & 3];
        const cx = e.x + cdx, cy = e.y + cdy;
        if (cx < 0 || cx >= FIELD_W || cy < 0 || cy >= FIELD_H) continue;
        const c = idx(cx, cy);
        if (sim.machine.t[c] === WALL || sim.machine.burned[c]) continue;
        alive.push({ x: e.x, y: e.y, dx: cdx, dy: cdy, budget: p.spreadReach });
        break;
      }
    }
    if (e.budget > 0) alive.push(e);
  }
  sim.embers = alive;
}

// The trace scan (§9): descend at scanSpeed; on each crossed row reclaim up to
// `reclaim` burned cells back to neutral. Reuses the real reclaimRow, snapshotting
// the row first so freshly-reclaimed cells can flash (render ramp `X`). Honeypots
// tripped since the last tick nudge the scan faster (§9 trace spike).
function advanceScan(sim) {
  const p = sim.params;
  sim.reclaimed = new Set();
  sim.scanAcc += p.scanSpeed + (sim.honeySpike || 0);
  sim.honeySpike = 0;
  while (sim.scanAcc >= 1 && sim.scanRow < FIELD_H) {
    const y = sim.scanRow;
    const before = [];
    for (let x = sim.sector.x0; x <= sim.sector.x1; x++)
      if (sim.machine.burned[idx(x, y)]) before.push(idx(x, y));
    reclaimRow(sim.machine, sim.sector, y, p.reclaim, sim.rng);
    for (const c of before) if (!sim.machine.burned[c]) { sim.reclaimed.add(c); sim.heat[c] = 0; }
    sim.scanRow++;
    sim.scanAcc -= 1;
  }
}

export function coverage(sim) {
  const { sector } = sim;
  let b = 0;
  for (let y = 0; y < FIELD_H; y++)
    for (let x = sector.x0; x <= sector.x1; x++)
      if (sim.machine.burned[idx(x, y)]) b++;
  return sim.claim ? (b / sim.claim) * 100 : 0;
}

// One tick of the watch: emit next spine row, step embers, advance scan, resolve
// win/traced. Returns a small readout snapshot.
export function stepSim(sim) {
  if (sim.outcome) return snapshot(sim);
  sim.tick++;

  const honeyBefore = sim.honeyBurned;
  if (sim.spineRow >= 0) { emitSpineRow(sim, sim.spineRow); sim.spineRow--; }
  stepEmbers(sim);
  if (sim.honeyBurned > honeyBefore) sim.honeySpike = (sim.honeySpike || 0) + (sim.honeyBurned - honeyBefore);
  advanceScan(sim);

  const cov = sim.cov = coverage(sim);
  const p = sim.params;
  if (cov >= p.winCoverage) {
    if (sim.breachLeft < 0) sim.breachLeft = p.breachHold;   // start breach timer
    else if (sim.breachLeft === 0) sim.outcome = 'win';
    else sim.breachLeft--;
  } else if (sim.breachLeft >= 0) {
    sim.breachLeft = -1;                                      // dropped under → reset
  }
  if (!sim.outcome && sim.scanRow >= FIELD_H) sim.outcome = 'traced';   // scan bottomed = run end

  return snapshot(sim);
}

export function snapshot(sim) {
  return {
    tick: sim.tick,
    coverage: sim.cov,
    embers: sim.embers.length,
    scanRow: sim.scanRow,
    breachLeft: sim.breachLeft,
    outcome: sim.outcome,
    spineDone: sim.spineRow < 0,
  };
}
