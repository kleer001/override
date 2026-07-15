// Battle = breaching one sector (a node) with the Beam-Card model
// (research/ember-model.md). Slotted cards MERGE into one beam; a turret fires ONE
// packet at a trigger column, drawing a spine up the field; embers emit off it,
// spread against the terrain COST table, and REPRODUCE (growth) while you watch.
// A single TRACE SCAN descends — its descent is the run clock. Win by reaching
// WIN_COVERAGE and HOLDING it through a breach timer before the scan bottoms out.
//
// The machine (three sectors) persists across a run, so conquered sectors stay
// burned and the board fills up. This layer wraps the pure sim in src/beam.js with
// the run's aggression dial, character bonuses, CODE digits, and a battle log.

import { mulberry32 } from './rng.js';
import { generateMachine, sectorStats, FIELD_H, WIN_COVERAGE } from './terrain.js';
import { createSimOn, stepSim, coverage, spineX, aimColAt } from './beam.js';
import { mergeBeam, beamGutterLines } from './cards.js';

export { generateMachine };
export const REDRAW_COST = 10;      // points spent to reshuffle the hand in assemble
export const SLOTS = 3;             // beam slots in assemble (Tier 1)

// --- Tier-1 shared terminal/scan constants (validated in beam-balance.js on the
// single 62×28 block: HARMONIC ~90% / CURTAIN ~60% strong, weak starter 0%). ---
export const POOL = 1000;           // base REACH pool (terminal meta-stat)
export const REACH_CAP = 20;        // max REACH any one ember may hold
export const SCAN_SPEED = 0.40;     // scan rows/tick at aggression 1
export const RECLAIM = 6;           // reclaimed cells/row at aggression 1
export const BREACH_HOLD = 15;      // ticks held ≥WIN_COVERAGE to breach

// --- AGGRESSION: the single difficulty dial. It scales the whole trace scan (the
// enemy), mirroring how your deck scales the whole beam. The player raises it for
// free (harder scan, bigger reward) or spends PTS to lower it (safer). ---
export const AGGRO_BASE = 0.75;        // the "real" graduated baseline (post-onboarding)
export const AGGRO_STEP = 0.25;
export const AGGRO_MIN = 0.5;
export const AGGRO_MAX = 2.5;
export const AGGRO_REDUCE_COST = 15;   // PTS to lower aggression one step

// Reward/draft are relative to the run's baseline, so the current default always
// pays "standard" and cranking ABOVE it is what pays more.
export function rewardMult(aggro, base = AGGRO_BASE) { return aggro / base; }
export function draftPicks(aggro, base = AGGRO_BASE) {
  return Math.max(1, 1 + Math.floor((aggro - base) / 0.5 + 1e-9));
}

// Build the full beam params for a node from an already-merged beam, overlaying the
// shared terminal/scan constants scaled by aggression + character bonuses. Every
// key the sim reads is set here explicitly (no defaultParams fallback in the game).
function beamParams(machine, secIdx, merged, aggro, char, extra) {
  const sector = machine.sectors[secIdx];
  return {
    p: extra.triggerCol != null
      ? Math.max(sector.x0, Math.min(sector.x1, extra.triggerCol | 0))
      : (sector.x0 + sector.x1) >> 1,            // default: fire from sector centre
    shapes: merged.shapes, amp: merged.amp, freq: merged.freq, dirs: merged.dirs,
    probMode: merged.probMode, prob: merged.prob, maskN: merged.maskN,
    reproduce: merged.reproduce, spreadReach: merged.spreadReach,
    pool: POOL + (char?.poolBonus || 0) + (extra.poolBonus || 0),
    reachCap: REACH_CAP + (char?.reachCapBonus || 0),
    scanSpeed: SCAN_SPEED * aggro,               // aggression = scan speed…
    reclaim: Math.max(1, Math.round(RECLAIM * aggro)),   // …and bite
    breachHold: BREACH_HOLD,
    winCoverage: WIN_COVERAGE,
  };
}

// Create a node: a beam battle over the run's shared machine. Does not fire yet —
// call fire() (or step it) to begin the watch.
export function createNode(machine, secIdx, char, aggro = AGGRO_BASE, baseAggro = AGGRO_BASE, program = [], extra = {}) {
  const sector = machine.sectors[secIdx];
  const merged = mergeBeam(program.filter(Boolean));
  const params = beamParams(machine, secIdx, merged, aggro, char, extra);
  const rng = mulberry32((machine.seed ^ (secIdx * 0x9e3779b9) ^ 0x85ebca6b) >>> 0);
  const sim = createSimOn(machine, secIdx, params, rng);
  return {
    machine, secIdx, sector, aggro, baseAggro, char,
    sim, program, beamLines: beamGutterLines(merged),   // cached 2-line gutter readout
    fired: false, packets: 1 + (char?.packetBonus || 0),
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

// Advance the watch one tick (emit → spread → reproduce → scan). Mirrors stepSim
// and lifts the outcome + CODE resolution to the node. Returns the sim snapshot.
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

// Re-expose sim helpers the UI needs (pending-spine preview, oscillating aim).
export { spineX, coverage, aimColAt };

function push(node, line) {
  node.log.push(line);
  if (node.log.length > 6) node.log.shift();
}
