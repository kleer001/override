// Beam-Card Model — the game's canonical pure simulation
// (research/lsystem-growth.md). The turret fires a packet that draws a beam spine;
// each launching card anchors ONE strand on the spine (bottom / top / centre of the
// open line) and it grows as a DETERMINISTIC L-SYSTEM TURTLE —
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
  FIELD_W, FIELD_H, COST, idx, WALL, HONEY, SECTORS,
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

// The AIM turret oscillates across the block on a fixed period (pendulum/sine).
// The UI derives the current column from wall-clock `now`; the renderer and the
// launch handler both call this so they fire from exactly where it's drawn. Pure —
// the sim itself never calls it.
export const AIM_PERIOD = 2500;   // ms per full back-and-forth sweep
export function aimColAt(now) {
  const c = (FIELD_W - 1) / 2;
  return Math.round(c + c * Math.sin((2 * Math.PI * now) / AIM_PERIOD));
}

// Terrain folds into the PACE clock (§0 "terrain cost stands"), DERIVED from the one
// COST table so the graded difficulty (terrain.js) and the felt difficulty can't
// drift apart: a turtle on slow ground (HARD) waits longer before its next step, a
// bus line speeds it up. Clamped so no single tile stalls or rushes a strand too hard
// (WALL is never stood on — the reroute never enters it). COST−1: OPEN 0, HARD +3,
// BUS −1, HONEY 0.
const PACE_MIN = -1, PACE_MAX = 3;
const paceSurcharge = (terr) => Math.max(PACE_MIN, Math.min(PACE_MAX, COST[terr] - 1));

const HEAT_NEW = 18;         // a fresh turtle burn is brightest (the searching tip)
const HEAT_DECAY = 2;        // burn brightness cools each tick → frontier bright, body cool
const MAX_TURTLES = 3000;    // compute guard against a runaway fork/branch process

// Default parameter block (preview sandbox). DOM mutates a live copy so sliders
// take effect on the running sim.
export function defaultParams() {
  return {
    p: 30,                                     // trigger column
    chain: [{ grammar: 'FFKFK', pace: 2, connector: 'SCATTER' }],
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
    heat: new Float32Array(FIELD_W * FIELD_H),      // per-cell burn TICK (render ramp derives brightness lazily)
    reclaimed: new Set(),                            // cells reclaimed on the last tick (flash)
    turtles: [],                                      // live strands (turtle VM)
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

// Burn a cell, stamping the tick so the render ramp can derive brightness lazily.
// `fromF` marks a turtle-advance/fork burn: those land only on cells the VM already
// checked were unburned, so burning an already-burned cell from an F is a re-tread —
// the tripwire that must stay 0 (seed placements may legitimately overlap, so they
// pass fromF=false). Area comes entirely from the strands' own branching skeleton
// (fork density) — no smolder fill — so coverage is earned by the grammar.
function burn(sim, x, y, fromF = false) {
  const c = idx(x, y);
  const was = sim.machine.burned[c];
  if (!was && sim.machine.t[c] === HONEY) sim.honeyBurned++;   // tripped bait
  if (fromF && was) sim.reTread++;                             // F landed on burned ground → re-tread
  sim.machine.burned[c] = 1;
  sim.heat[c] = sim.tick;
}

// --- seeding (§7 connector chain) --------------------------------------------
// ONE turtle per launching segment — coverage is earned by grammar fork density
// and pace alone. The deck is read top-to-bottom. Segment 0 always launches off
// the spine; a later segment's coupling is set by the PRECEDING segment's
// connector:
//   SCATTER → the next segment launches fresh off the spine (own anchor)
//   SPROUT  → deferred: grafted from the previous segment's tips when they trap
// (OVERLAY never reaches the sim — buildChain folds it into one spliced grammar.)
function validSpineCells(sim) {
  const x = Math.max(0, Math.min(FIELD_W - 1, sim.params.p | 0));   // spine = straight column at the trigger
  const out = [];
  for (let y = 0; y < FIELD_H; y++) if (sim.machine.t[idx(x, y)] !== WALL) out.push({ x, y });
  return out;
}

// Launch anchors, spread across whatever open spine the walls leave: the 1st
// launching card takes the first open cell off the turret (bottom), the 2nd the
// far end of the line (top), the 3rd the most central open cell — a full chain
// brackets the block even when firewall eats most of the column. (valid[] is
// ordered top-to-bottom, y=0 first.)
function anchorPoints(valid) {
  return [valid[valid.length - 1], valid[0], valid[valid.length >> 1]];
}

function spawnTurtle(sim, x, y, heading, seg) {
  if (sim.turtles.length >= MAX_TURTLES) return;
  sim.turtles.push({ x, y, heading: heading & 7, pc: 0, seg, clock: 0 });
  burn(sim, x, y);   // the launch/tip cell (seed — overlaps allowed, not re-tread)
}

function seedSwarm(sim) {
  const p = sim.params, valid = validSpineCells(sim);
  if (!valid.length) return;
  const anchors = anchorPoints(valid);
  let launches = 0;      // how many anchors have been claimed so far
  for (let i = 0; i < p.chain.length; i++) {
    const conn = i === 0 ? 'SCATTER' : p.chain[i - 1].connector;
    if (conn !== 'SCATTER') continue;   // SPROUT → grafted on trap, not at launch
    const pt = anchors[launches++ % anchors.length];
    spawnTurtle(sim, pt.x, pt.y, SEED_HEADING, i);
  }
}

// --- the turtle VM (§3) ------------------------------------------------------
// Effective pace for a strand: its segment's pace plus the terrain surcharge of the
// cell it sits on (min 1). Slow ground stalls it into the scan; a bus line speeds it.
function paceOf(sim, t) {
  const base = sim.params.chain[t.seg].pace;
  return Math.max(1, base + paceSurcharge(sim.machine.t[idx(t.x, t.y)]));
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

// Connector handoff on self-trap (§7): a SPROUT segment grafts the NEXT segment
// off this dead tip. The tip trapped because all 8 radius-1 neighbours are blocked,
// so a graft there is inert — we jump to the first open cell on the NEXT ring out
// (radius 2), forward-biased, so the chain leaps the wall/trail it hit and continues
// instead of dying on it. SCATTER seeded at launch and hands off nothing here.
function handoff(sim, t, spawned) {
  const chain = sim.params.chain, next = t.seg + 1;
  if (next >= chain.length || chain[t.seg].connector !== 'SPROUT') return;
  if (sim.turtles.length + spawned.length >= MAX_TURTLES) return;
  for (const off of PROBE) {
    const h = (t.heading + off + 8) & 7;
    const [dx, dy] = HEADINGS[h];
    const nx = t.x + dx * 2, ny = t.y + dy * 2;   // ring 2 — ring 1 is fully blocked
    if (nx < 0 || nx >= FIELD_W || ny < 0 || ny >= FIELD_H) continue;
    const c = idx(nx, ny);
    if (sim.machine.t[c] === WALL || sim.machine.burned[c]) continue;
    spawned.push({ x: nx, y: ny, heading: h, pc: 0, seg: next, clock: 0 });
    burn(sim, nx, ny, true);
    return;
  }
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
  for (const s of spawned) next.push(s);         // append this tick's forks/handoffs
  sim.turtles = next;
}

// The trace scan (§5): descend at scanSpeed; on each crossed row reclaim up to
// `reclaim` burned cells back to neutral. Honeypots tripped since the last tick
// nudge the scan faster.
function advanceScan(sim) {
  const p = sim.params;
  sim.reclaimed.clear();
  sim.scanAcc += p.scanSpeed + sim.honeySpike;
  sim.honeySpike = 0;
  while (sim.scanAcc >= 1 && sim.scanRow < FIELD_H) {
    const y = sim.scanRow, before = [];
    for (let x = sim.sector.x0; x <= sim.sector.x1; x++)
      if (sim.machine.burned[idx(x, y)]) before.push(idx(x, y));
    reclaimRow(sim.machine, sim.sector, y, p.reclaim, sim.rng);
    for (const c of before) if (!sim.machine.burned[c]) sim.reclaimed.add(c);
    sim.scanRow++;
    sim.scanAcc -= 1;
  }
}

// Render brightness of a burned cell, derived lazily from the tick it burned: newest
// burns are brightest (the searching tip), cooling by HEAT_DECAY each tick after, so
// the frontier reads bright and the branches behind it fade — with no per-tick pass
// over the field (only queried at render time, for burned cells).
export function heatAt(sim, c) {
  return Math.max(0, HEAT_NEW - (sim.tick - sim.heat[c]) * HEAT_DECAY);
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
