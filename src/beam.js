// Beam-Card Model — the game's canonical pure simulation
// (research/lsystem-growth.md). The turret fires a packet that draws a beam spine;
// strands are raked off the spine and grow as DETERMINISTIC L-SYSTEM TURTLES —
// there is no reproduce%, no reach budget. A turtle runs an F/L/R/K grammar on a
// loop at a per-strand PACE, hugging walls via a fixed searching reroute, and the
// descending trace scan is the clock. Coverage is the race: paint before the scan
// sweeps down through you.
//
// NO DOM in this file. The TURTLE VM is RNG-FREE (§1): same grammar + same field ⇒
// byte-for-byte identical growth. The only rng left is the trace scan's reclaim and
// terrain generation, both seeded (a (seed, params) pair replays identically).

import { mulberry32 } from './rng.js';
import {
  generateMachine, reclaimRow,
  FIELD_W, FIELD_H, idx, WALL, HONEY, OPEN, HARD, BUS, SECTORS,
} from './terrain.js';

export { FIELD_W, FIELD_H, SECTORS, WALL, idx };

// --- the 8 compass headings, indexed 0..7 CLOCKWISE from up (§2). A turtle's
// canonical launch heading is UP (0), away from the turret at the bottom edge;
// `L`/`R` step −1/+1 around the ring, so a grammar's turn-prefix is its launch aim.
export const HEADINGS = [
  [0, -1],  // 0 up
  [1, -1],  // 1 up-right
  [1, 0],   // 2 right
  [1, 1],   // 3 down-right
  [0, 1],   // 4 down
  [-1, 1],  // 5 down-left
  [-1, 0],  // 6 left
  [-1, -1], // 7 up-left
];
const SEED_HEADING = 0;   // up, away from the turret

// Searching reroute probe order (§3): straight ahead first, then gentle turns
// out, reverse last. The turtle takes the FIRST on-board, non-wall, UNBURNED cell —
// so it hugs walls and threads gaps with zero pathfinding and never re-treads.
const PROBE = [0, 1, -1, 2, -2, 3, -3, 4];

// --- shape vocabulary (spine curve; Fourier superposition when merged) ---
// Each returns a horizontal spine offset for normalised row t in [0,1].
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

// Summed offset of all selected shapes at row y (deterministic — the waveform
// preview matches the drawn spine exactly).
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

// The AIM turret oscillates across the block on a fixed period (pendulum/sine).
// The UI derives the current column from wall-clock `now`; the renderer and the
// launch handler both call this so they fire from exactly where it's drawn. Pure —
// the sim itself never calls it.
export const AIM_PERIOD = 2500;   // ms per full back-and-forth sweep
export function aimColAt(now) {
  const c = (FIELD_W - 1) / 2;
  return Math.round(c + c * Math.sin((2 * Math.PI * now) / AIM_PERIOD));
}

// Terrain folds into the PACE clock (§0 "terrain cost stands"): a turtle sitting on
// slow ground takes longer before its next step, fast ground (BUS) accelerates it,
// WALL is unreachable (the reroute never enters it). This keeps the five terrain
// types load-bearing in a race where there is no budget to spend cost against.
const PACE_SURCHARGE = [];
PACE_SURCHARGE[OPEN] = 0;
PACE_SURCHARGE[HARD] = 3;    // sticky ground — the scan catches you on it
PACE_SURCHARGE[WALL] = 0;    // never stood on (firebreak)
PACE_SURCHARGE[BUS] = -1;    // accelerant
PACE_SURCHARGE[HONEY] = 0;

const HEAT_NEW = 18;         // a fresh turtle burn is brightest (the searching tip)
const HEAT_DECAY = 2;        // heat cools each tick → frontier bright, body cool
const MAX_TURTLES = 3000;    // compute guard against a runaway fork/branch process

// Default parameter block (preview sandbox). DOM mutates a live copy so sliders
// take effect on the running sim.
export function defaultParams() {
  return {
    p: 30,                                     // trigger column
    shapes: { linear: true, sine: false, sine2: false, sine3: false, rect: false, tan: false, saw: false },
    amp: 6,                                     // shape amplitude (cells)
    freq: 2,                                     // shape base frequency
    chain: [{ grammar: 'FFKFK', pace: 2, seeds: 12, connector: 'SCATTER' }],
    seedFan: 2,                                  // launch-heading fan half-width — radiates a card's strands off the spine (anti-crowding, §8)
    scanSpeed: 0.40,                             // scan rows advanced per tick
    reclaim: 6,                                   // reclaimed cells per scanned row
    breachHold: 15,                               // ticks held ≥win to breach
    winCoverage: 50,                              // % of claimable cells to breach
  };
}

// Build a sim over an EXISTING machine (the game's persistent board). sectorIndex
// 0..2; rng is a seeded mulberry32 (distinct from the terrain-gen rng). The strand
// swarm is seeded immediately (fire == createSim); stepSim then races it the scan.
export function createSimOn(machine, sectorIndex, params, rng) {
  const sector = machine.sectors[sectorIndex % machine.sectors.length];
  let claim = 0;
  for (let y = 0; y < FIELD_H; y++)
    for (let x = sector.x0; x <= sector.x1; x++)
      if (machine.t[idx(x, y)] !== WALL) claim++;

  const sim = {
    machine, sector, claim,
    params,
    rng,
    heat: new Float32Array(FIELD_W * FIELD_H),      // per-cell burn strength (render ramp)
    turtleBurned: new Uint8Array(FIELD_W * FIELD_H), // cells an F advance burned (re-tread invariant)
    reclaimed: new Set(),                            // cells reclaimed on the last tick (flash)
    turtles: [],                                      // live strands (turtle VM)
    segStart: [],                                     // per-segment start seed points (OVERLAY reference)
    scanRow: 0, scanAcc: 0,                            // trace scan position
    honeyBurned: 0, honeySpike: 0,                    // honeypots burned (trace spike)
    breachLeft: -1,                                    // breach countdown (ticks)
    cov: 0,                                             // cached coverage %, refreshed each tick
    reTread: 0,                                          // count of F-onto-already-F-burned (must stay 0)
    outcome: null,                                       // null | 'win' | 'traced'
    tick: 0,
  };
  seedSwarm(sim);
  return sim;
}

// Convenience: fresh machine + sim (sandbox / balance harness / tests).
export function createSim(seed, sectorIndex, params) {
  const machine = generateMachine(seed >>> 0);
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  return createSimOn(machine, sectorIndex, params, rng);
}

// Burn a cell. `fromF` marks a turtle-advance/fork burn (the re-tread invariant
// guard — those land only on verified-unburned cells, so it must stay 0; seed
// placements may legitimately overlap and are not counted). Area comes entirely from
// the strands' own branching skeleton (fork density) — no smolder fill — so coverage
// is earned by the deck's grammar, not a blind flood.
function burn(sim, x, y, fromF = false) {
  const c = idx(x, y);
  const was = sim.machine.burned[c];
  if (!was && sim.machine.t[c] === HONEY) sim.honeyBurned++;   // tripped bait
  sim.machine.burned[c] = 1;
  sim.heat[c] = HEAT_NEW;
  if (fromF) {
    if (sim.turtleBurned[c]) sim.reTread++;
    sim.turtleBurned[c] = 1;
  }
}

// --- seeding (§7 connector chain) --------------------------------------------
// The deck is read top-to-bottom. Segment 0 always seeds fresh off the spine; a
// later segment's coupling is set by the PRECEDING segment's connector:
//   SCATTER → the next card seeds fresh off the spine (order-blind swarm)
//   OVERLAY → the next card seeds the SAME points, concurrently
//   SPROUT/BRANCH → deferred: seeded from the previous card's tips when they trap
function validSpineCells(sim) {
  const p = sim.params, out = [];
  for (let y = 0; y < FIELD_H; y++) {
    const x = spineX(p, y);
    if (sim.machine.t[idx(x, y)] !== WALL) out.push({ x, y });
  }
  return out;
}

// n points evenly spaced over the valid spine, phase-shifted per segment so
// independent SCATTER segments decorrelate instead of stacking on the same cells.
function pickEven(valid, n, phase) {
  const m = valid.length, out = [];
  if (m === 0 || n <= 0) return out;
  for (let k = 0; k < n; k++) {
    const i = (Math.floor(((k + 0.5) / n) * m) + phase) % m;
    out.push(valid[(i + m) % m]);
  }
  return out;
}

function spawnTurtle(sim, x, y, heading, seg) {
  if (sim.turtles.length >= MAX_TURTLES) return;
  sim.turtles.push({ x, y, heading: heading & 7, pc: 0, seg, clock: 0 });
  burn(sim, x, y);   // the launch/tip cell (seed — overlaps allowed, not re-tread)
}

// A symmetric fan of heading offsets around the canonical launch (0, ±1, ±2, …),
// so a card's strands RADIATE off the spine instead of stacking into one column and
// self-trapping. Deterministic — the offset is purely the strand's index.
function fanOffsets(half) {
  const out = [0];
  for (let k = 1; k <= half; k++) out.push(-k, k);
  return out;
}

function seedSwarm(sim) {
  const p = sim.params, valid = validSpineCells(sim);
  const fan = fanOffsets(Math.max(0, p.seedFan | 0));
  sim.segStart = [];
  for (let i = 0; i < p.chain.length; i++) {
    const seg = p.chain[i];
    let points;
    if (i === 0) points = pickEven(valid, seg.seeds, i);
    else {
      const conn = p.chain[i - 1].connector;
      if (conn === 'SCATTER') points = pickEven(valid, seg.seeds, i);
      else if (conn === 'OVERLAY') {
        const prev = sim.segStart[i - 1];
        points = prev && prev.length ? prev.slice(0, seg.seeds || prev.length) : pickEven(valid, seg.seeds, i);
      } else points = null;   // SPROUT / BRANCH → seeded on trap, not at launch
    }
    sim.segStart[i] = points || [];
    if (points) points.forEach((pt, k) => spawnTurtle(sim, pt.x, pt.y, SEED_HEADING + fan[k % fan.length], i));
  }
}

// --- the turtle VM (§3) ------------------------------------------------------
// Effective pace for a strand: its segment's pace plus the terrain surcharge of the
// cell it sits on (min 1). Slow ground stalls it into the scan; a bus line speeds it.
function paceOf(sim, t) {
  const base = sim.params.chain[t.seg].pace;
  return Math.max(1, base + PACE_SURCHARGE[sim.machine.t[idx(t.x, t.y)]]);
}

// Searching reroute: probe headings PROBE-order, take the first on-board, non-wall,
// UNBURNED cell; commit the heading and burn it. Returns false if the turtle is
// trapped (all eight blocked) — the caller then runs the connector handoff.
function advance(sim, t) {
  for (const off of PROBE) {
    const h = (t.heading + off + 8) & 7;
    const [dx, dy] = HEADINGS[h];
    const nx = t.x + dx, ny = t.y + dy;
    if (nx < 0 || nx >= FIELD_W || ny < 0 || ny >= FIELD_H) continue;   // off-board
    const c = idx(nx, ny);
    if (sim.machine.t[c] === WALL || sim.machine.burned[c]) continue;   // firebreak / trail
    t.x = nx; t.y = ny; t.heading = h;
    burn(sim, nx, ny, true);
    return true;
  }
  return false;
}

// `K`: fork a child heading turned +2 (parent −1); the child shares nothing and
// reads the grammar fresh (pc 0). It launches one cell FORWARD into the first open
// cell along a short probe so it starts on live ground instead of the burned parent
// cell (which would trap it instantly). Bounded by MAX_TURTLES.
function fork(sim, t, spawned) {
  if (sim.turtles.length + spawned.length >= MAX_TURTLES) return;
  const ch = (t.heading + 2) & 7;
  for (const off of [0, 1, -1, 2, -2]) {
    const h = (ch + off + 8) & 7;
    const [dx, dy] = HEADINGS[h];
    const nx = t.x + dx, ny = t.y + dy;
    if (nx < 0 || nx >= FIELD_W || ny < 0 || ny >= FIELD_H) continue;
    const c = idx(nx, ny);
    if (sim.machine.t[c] === WALL || sim.machine.burned[c]) continue;
    spawned.push({ x: nx, y: ny, heading: h, pc: 0, seg: t.seg, clock: 0 });
    burn(sim, nx, ny, true);
    break;
  }
  t.heading = (t.heading + 7) & 7;   // parent −1
}

// Connector handoff on self-trap (§7): the trapping strand's segment connector
// governs how the NEXT segment couples off this tip. SPROUT continues the heading;
// BRANCH fans two children out (±2). SCATTER/OVERLAY already seeded at launch, so
// they hand off nothing here — the trapped strand simply dies.
function handoff(sim, t, spawned) {
  const chain = sim.params.chain, next = t.seg + 1;
  if (next >= chain.length) return;
  const conn = chain[t.seg].connector;
  const add = (heading) => { if (sim.turtles.length + spawned.length < MAX_TURTLES) spawned.push({ x: t.x, y: t.y, heading: heading & 7, pc: 0, seg: next, clock: 0 }); };
  if (conn === 'SPROUT') add(t.heading);
  else if (conn === 'BRANCH') { add(t.heading + 2); add(t.heading + 6); }
}

// Advance every live strand one grammar step when its pace clock is due. Deferred
// forks/handoffs are collected and appended after the pass (never mutate mid-loop).
function stepTurtles(sim) {
  const chain = sim.params.chain;
  const next = [], spawned = [];
  for (const t of sim.turtles) {
    t.clock++;
    if (t.clock < paceOf(sim, t)) { next.push(t); continue; }
    t.clock = 0;
    const g = chain[t.seg].grammar;
    const sym = g[t.pc % g.length];
    t.pc++;
    if (sym === 'L') { t.heading = (t.heading + 7) & 7; next.push(t); }
    else if (sym === 'R') { t.heading = (t.heading + 1) & 7; next.push(t); }
    else if (sym === 'K') { fork(sim, t, spawned); next.push(t); }
    else if (advance(sim, t)) next.push(t);      // 'F'
    else handoff(sim, t, spawned);               // self-trapped → connector handoff, strand dies
  }
  sim.turtles = next.concat(spawned);
}

// The trace scan (§5): descend at scanSpeed; on each crossed row reclaim up to
// `reclaim` burned cells back to neutral. Honeypots tripped since the last tick
// nudge the scan faster.
function advanceScan(sim) {
  const p = sim.params;
  sim.reclaimed = new Set();
  sim.scanAcc += p.scanSpeed + sim.honeySpike;
  sim.honeySpike = 0;
  while (sim.scanAcc >= 1 && sim.scanRow < FIELD_H) {
    const y = sim.scanRow, before = [];
    for (let x = sim.sector.x0; x <= sim.sector.x1; x++)
      if (sim.machine.burned[idx(x, y)]) before.push(idx(x, y));
    reclaimRow(sim.machine, sim.sector, y, p.reclaim, sim.rng);
    for (const c of before) if (!sim.machine.burned[c]) { sim.reclaimed.add(c); sim.heat[c] = 0; sim.turtleBurned[c] = 0; }
    sim.scanRow++;
    sim.scanAcc -= 1;
  }
}

// Cool every burned cell a notch so the advancing tip stays brightest and the
// branches behind it fade (a cheap full-field pass on a 62×28 block).
function decayHeat(sim) {
  const h = sim.heat;
  for (let i = 0; i < h.length; i++) if (h[i] > 0) h[i] = Math.max(0, h[i] - HEAT_DECAY);
}

export function coverage(sim) {
  const { sector } = sim;
  let b = 0;
  for (let y = 0; y < FIELD_H; y++)
    for (let x = sector.x0; x <= sector.x1; x++)
      if (sim.machine.burned[idx(x, y)]) b++;
  return sim.claim ? (b / sim.claim) * 100 : 0;
}

// One tick of the watch: step strands → scan → resolve win/traced. The run ends
// when the scan bottoms out; win by holding ≥winCoverage through the breach timer
// before it lands (§5). Returns a small readout snapshot.
export function stepSim(sim) {
  if (sim.outcome) return snapshot(sim);
  sim.tick++;

  const honeyBefore = sim.honeyBurned;
  decayHeat(sim);
  stepTurtles(sim);
  if (sim.honeyBurned > honeyBefore) sim.honeySpike += (sim.honeyBurned - honeyBefore);
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
    strands: sim.turtles.length,
    scanRow: sim.scanRow,
    breachLeft: sim.breachLeft,
    outcome: sim.outcome,
  };
}
