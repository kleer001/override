// Battle = breaching one sector (a node) with the Beam-Card model
// (research/lsystem-growth.md). Slotted cards form an ordered CONNECTOR CHAIN; a
// turret fires ONE packet at a trigger column, drawing a spine up the field; strands
// are raked off the spine and grow as deterministic L-SYSTEM TURTLES at a per-card
// pace while you watch. A single TRACE SCAN descends — its descent is the run clock.
// Win by reaching WIN_COVERAGE and HOLDING it through a breach timer before the scan
// bottoms out.
//
// The machine persists across a run, so conquered sectors stay burned and the board
// fills up. This layer wraps the pure sim in src/beam.js with the run's aggression
// dial and a battle log.

import { mulberry32 } from './rng.js';
import { generateMachine, sectorStats, FIELD_W, FIELD_H, WIN_COVERAGE } from './terrain.js';
import { createSimOn, stepSim, coverage, aimColAt, heatAt } from './beam.js';
import { buildChain, beamGutterLines } from './cards.js';

export { generateMachine };
export const REDRAW_COST = 10;      // ROOT spent to reshuffle the hand in assemble
export const SLOTS = 3;             // beam slots in assemble (Tier 1)

// --- Tier-1 shared terminal/scan constants (un-tuned, research/lsystem-growth.md
// §10; the pace-vs-scan knife-edge is where balance lives). ---
export const SCAN_SPEED = 0.40;     // scan rows/tick at aggression 1
export const RECLAIM = 6;           // reclaimed cells/row at aggression 1
export const BREACH_HOLD = 15;      // ticks held ≥WIN_COVERAGE to breach

// --- SURVIVAL mode (pre-collision-detection): a fixed brisk scan so a self-avoiding
// literal line must outlast ~8s (research/lsystem-growth.md: pace-1/scan-0.45 puts
// the win rate at a findable ~15-23% of formulas). Aggression-independent — the
// pre-CD phase is a fixed-difficulty training ground, not the tunable game. ---
export const SURVIVAL_SCAN = 0.45;
export const SURVIVAL_MIN_CELLS = 10;   // a strand must draw this much to count as alive (anti-spinner)
// A thin survival line covers only ~2% of the full block, so survival wins pay a FLAT
// ROOT bounty (not coverage%). The tutorial pays 15 and COLLISION DETECTION costs 35,
// so it takes a couple of real levels beyond the tutorial to bank it.
export const SURVIVAL_REWARD = 15;

// --- AGGRESSION: the single difficulty dial. It scales the whole trace scan (the
// enemy), mirroring how your deck scales the whole beam. The player raises it for
// free (harder scan, bigger reward) or spends ROOT to lower it (safer). The one-
// anchor beam paints less than the old seed swarm, so the winnable band is compact:
// ~0.20 (easy) to ~0.65 (even the grail loses past here). Every constant is scaled
// to that range. ---
export const AGGRO_BASE = 0.40;        // reference "standard" aggression (reward is relative to your own baseline)
export const AGGRO_STEP = 0.10;
export const AGGRO_MIN = 0.20;         // absolute floor — matches the DDA baseline's low end
export const AGGRO_MAX = 0.65;         // top of the winnable range (grail's knife-edge)
export const AGGRO_REDUCE_COST = 15;   // ROOT to lower aggression one step

// Reward/draft are relative to the run's baseline, so the current default always
// pays "standard" and cranking ABOVE it is what pays more. The draft step (0.15 ≈
// 1.5 aggro steps) is scaled to the compact band so cranking earns a pick or two.
export function rewardMult(aggro, base = AGGRO_BASE) { return aggro / base; }
export function draftPicks(aggro, base = AGGRO_BASE) {
  return Math.max(1, 1 + Math.floor((aggro - base) / 0.15 + 1e-9));
}

// ROOT paid for a run — proportional to the area you burned, every run (win OR loss),
// scaled by how far above your baseline you dialled the aggression. A 50% breach at
// baseline pays 50; a 15% survival scratch pays 15. The single payout rule.
export function coverageReward(crackPct, aggro, base = AGGRO_BASE) {
  return Math.round(Math.max(0, crackPct) * rewardMult(aggro, base));
}

// Build the full beam params for a node from an already-built chain. The COLLISION-
// DETECTION upgrade (extra.collision) picks the whole regime — turtle behaviour, scan,
// and win mode all key off it, so pre- and post-CD play never diverge into separate
// code paths. Every key the sim reads is set here explicitly (no defaultParams
// fallback in the game).
function beamParams(machine, secIdx, merged, aggro, extra) {
  const sector = machine.sectors[secIdx];
  const collision = extra.collision !== false;
  return {
    p: extra.triggerCol != null
      ? Math.max(sector.x0, Math.min(sector.x1, extra.triggerCol | 0))
      : (sector.x0 + sector.x1) >> 1,            // default: fire from sector centre
    chain: merged.chain,
    collision,
    // COVERAGE regime scales the scan by aggression; SURVIVAL regime is a fixed brisk scan.
    scanSpeed: collision ? SCAN_SPEED * aggro : SURVIVAL_SCAN,
    reclaim: collision ? Math.max(1, Math.round(RECLAIM * aggro)) : 0,
    breachHold: BREACH_HOLD,
    winCoverage: WIN_COVERAGE,
    survivalMinCells: SURVIVAL_MIN_CELLS,
  };
}

// --- Blank block: every cell OPEN, no firewalls or terrain — one sector spanning the
// field. Used by the TEST bench and by pre-collision (empty) battles.
export function blankMachine(seed = 0, id = 'TEST BENCH') {
  return {
    seed: seed >>> 0,
    t: new Uint8Array(FIELD_W * FIELD_H),          // all OPEN
    sectors: [{ id, x0: 0, x1: FIELD_W - 1, difficulty: 'OPEN' }],
    burned: new Uint8Array(FIELD_W * FIELD_H),
  };
}

// Fire the chain at the centre of a blank block with the trace scan disabled and the
// player's current collision state — the pattern draws until every strand traps/crashes.
// Nothing ends or wins the bench run; the caller stops stepping when the strands are gone.
export function createTestSim(program, collision = true) {
  const merged = buildChain(program.filter(Boolean));
  const params = {
    p: (FIELD_W - 1) >> 1,
    chain: merged.chain,
    collision,
    scanSpeed: 0, reclaim: 0,               // no scan — nothing erases the drawing
    breachHold: 0, winCoverage: 101,        // unreachable — the bench never resolves
    survivalMinCells: SURVIVAL_MIN_CELLS,
  };
  return createSimOn(blankMachine(), 0, params, mulberry32(1));
}

// Create a node: a beam battle over the run's shared machine. Does not fire yet —
// call fire() (or step it) to begin the watch.
export function createNode(machine, secIdx, aggro = AGGRO_BASE, baseAggro = AGGRO_BASE, program = [], extra = {}) {
  const sector = machine.sectors[secIdx];
  const merged = buildChain(program.filter(Boolean));
  const params = beamParams(machine, secIdx, merged, aggro, extra);
  const rng = mulberry32((machine.seed ^ (secIdx * 0x9e3779b9) ^ 0x85ebca6b) >>> 0);
  const sim = createSimOn(machine, secIdx, params, rng);
  return {
    machine, secIdx, sector, aggro, baseAggro,
    sim, program, beamLines: beamGutterLines(merged),   // cached 2-line gutter readout
    fired: false,
    outcome: null,
    log: [`> jacked into ${sector.id}. terrain: ${sector.difficulty}. aggression x${aggro.toFixed(2)}.`],
  };
}

// Coverage %, exposed as `crack` for the UI (kept name from the old model). Reads
// the value the sim cached on its last tick — no per-frame full-grid rescan.
export function crackPct(node) { return node.sim.cov; }

// The turret is committed — record the trigger column and open the watch.
export function fire(node) {
  node.fired = true;
  push(node, `> packet fired at col ${node.sim.params.p}. beam spine drawn — watch it spread.`);
}

// Advance the watch one tick (grow strands → scan). Mirrors stepSim and lifts the
// outcome resolution to the node. Returns the sim snapshot.
export function stepBattle(node) {
  if (node.outcome) return;
  const snap = stepSim(node.sim);
  if (snap.outcome && !node.outcome) resolve(node, snap.outcome);
  return snap;
}

function resolve(node, outcome) {
  node.outcome = outcome === 'win' ? 'win' : 'lose';
  const st = sectorStats(node.machine, node.sector);
  if (node.outcome === 'win') {
    node.sector.conquered = true;
    push(node, `> breach locked. ${node.sector.id} is yours — ${st.pct.toFixed(0)}% burned.`);
  } else {
    push(node, `> TRACE COMPLETE. discovered in ${node.sector.id}.`);
  }
}

// Peak coverage over a full battle (headless / tests): fire, then tick to an
// outcome, tracking the peak coverage along the way.
export function runBattlePeak(node) {
  fire(node);
  let peak = 0, guard = 0;
  while (!node.outcome && guard++ < 2000) {
    const snap = stepBattle(node);
    if (snap && snap.coverage > peak) peak = snap.coverage;
  }
  node.crack = node.sim.cov;
  return { node, peak };
}

// Whole battle in one call (headless / tests) — the outcome-only variant.
export function runBattle(node) { return runBattlePeak(node).node; }

// Re-expose sim helpers the UI needs (oscillating aim, burn brightness, and
// stepping the raw TEST-bench sim, which has no node wrapper).
export { coverage, aimColAt, heatAt, stepSim };

function push(node, line) {
  node.log.push(line);
  if (node.log.length > 6) node.log.shift();
}
