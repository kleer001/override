// Battle = conquering one sector (a node). The machine (three sectors) persists
// across the run, so conquered sectors stay burned and the board fills up.
//
// The new model (research/ember-model.md): your program's accumulator sets the
// ENERGY each ping carries. A volley of finite pings lands at random cells and
// spends that energy infecting new ground (terrain cost, not a gate). Meanwhile a
// single TRACE SCAN descends the field, reclaiming cells row by row — its descent
// is the run clock. Win by reaching WIN_COVERAGE and HOLDING it through a breach
// timer before the scan bottoms out.

import { generateMachine, spreadPing, planPing, reclaimRow, sectorStats, FIELD_H, WIN_COVERAGE } from './terrain.js';
import { evalProgram } from './cards.js';

export { generateMachine };
export const CODE_DIGITS = 8;
export const REDRAW_COST = 10;      // points spent to reshuffle the hand in assemble

// Tier-1 tuning (later: per-tier / per-deck). See preview/ping.html to calibrate.
export const PINGS_PER_PASS = 3;    // volley size before FORK / character bonuses
export const SCAN_SPEED = 2;        // rows the trace scan descends per volley (at aggression 1)
export const RECLAIM_PER_ROW = 5;   // burned cells the scan reclaims per row (at aggression 1)
export const BREACH_HOLD = 2;       // volleys you must hold >= WIN_COVERAGE to win

// --- AGGRESSION: the single difficulty dial. It scales the whole trace scan
// (the enemy), mirroring how the accumulator scales your whole volley (you). The
// player raises it for free (harder scan, bigger reward) or spends PTS to lower
// it (safer). Per-tier baseline lives here for now (Tier 1 = 1.0).
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

export function newCode(rng) {
  return Array.from({ length: CODE_DIGITS }, () => Math.floor(rng() * 10));
}

export function createNode(machine, secIdx, char, aggro = AGGRO_BASE, baseAggro = AGGRO_BASE, extraEnergy = 0) {
  const sector = machine.sectors[secIdx];
  return {
    machine, secIdx, sector, aggro, baseAggro,
    tick: 0, crack: 0, outcome: null,
    scanRow: 0, scanAcc: 0, breachLeft: -1, honeyHit: 0,
    energy: 0, pings: 0, pingsLeft: 0, freeze: false,
    pingBonus: char ? (char.pingBonus || 0) : 0,
    energyBonus: (char ? (char.energyBonus || 0) : 0) + extraEnergy,
    log: [`> jacked into ${sector.id}. terrain: ${sector.difficulty}. aggression x${aggro.toFixed(2)}.`],
  };
}

export function crackPct(node) { return Math.min(100, node.crack); }

// Set up a volley: accumulator -> energy per ping, ping count (+FORK, +character),
// and whether INTERRUPT freezes the scan this volley. Does not lob yet.
export function beginVolley(node, program) {
  const ev = evalProgram(program);
  node.tick++;
  node.energy = Math.max(1, ev.value + node.energyBonus);
  node.pings = PINGS_PER_PASS + node.pingBonus + ev.flags.fork;
  node.pingsLeft = node.pings;
  node.freeze = ev.flags.interrupt;
  return ev;
}

// Lob one ping and refresh coverage (so the bar animates per ping).
export function lobOne(node) {
  if (node.pingsLeft <= 0) return 0;
  node.pingsLeft--;
  const added = spreadPing(node.machine, node.sector, node.energy, node.machine.rng);
  node.crack = sectorStats(node.machine, node.sector).pct;
  return added;
}

// Plan one ping without applying it: consumes a ping, returns the ordered cells
// it will burn so the UI can reveal them one at a time. Caller applies them.
export function planLob(node) {
  if (node.pingsLeft <= 0) return [];
  node.pingsLeft--;
  return planPing(node.machine, node.sector, node.energy, node.machine.rng);
}

// Advance the trace scan one volley's worth (unless INTERRUPT froze it), reclaiming
// cells row by row. Returns cells reclaimed.
export function advanceScan(node) {
  if (node.freeze) { push(node, `> INTERRUPT: trace scan stalled one beat.`); return 0; }
  node.scanAcc += SCAN_SPEED * node.aggro;                       // aggression = scan speed
  const reclaim = Math.max(1, Math.round(RECLAIM_PER_ROW * node.aggro)); // and bite
  let reclaimed = 0;
  while (node.scanAcc >= 1 && node.scanRow < FIELD_H) {
    reclaimed += reclaimRow(node.machine, node.sector, node.scanRow, reclaim, node.machine.rng);
    node.scanRow++; node.scanAcc -= 1;
  }
  node.crack = sectorStats(node.machine, node.sector).pct;
  return reclaimed;
}

// Tally the volley: coverage, honeypot trace-spike, breach-hold win, trace-complete loss.
export function resolveVolley(node, ev) {
  const { machine, sector } = node;
  const st = sectorStats(machine, sector);
  node.crack = st.pct;

  // HONEYPOT: burning bait speeds your discovery — nudge the scan faster.
  const newHoney = st.honeyBurned - node.honeyHit;
  if (newHoney > 0) {
    node.honeyHit = st.honeyBurned;
    node.scanAcc += newHoney;
    push(node, `> HONEYPOT TRIPPED x${newHoney}! trace accelerates.`);
  }

  push(node, `> volley ${node.tick}: acc ${ev.value} -> energy ${node.energy}, ${node.pings} pings. ${st.pct.toFixed(0)}%/${WIN_COVERAGE}% of ${sector.id}.`);

  if (st.pct >= WIN_COVERAGE) {
    if (node.breachLeft < 0) { node.breachLeft = BREACH_HOLD; push(node, `> ${WIN_COVERAGE}% reached — HOLD for breach (${BREACH_HOLD}).`); }
    else if (node.breachLeft === 0) { node.outcome = 'win'; sector.conquered = true; push(node, `> breach locked. ${sector.id} is yours.`); }
    else { node.breachLeft--; }
  } else if (node.breachLeft >= 0) {
    node.breachLeft = -1;
    push(node, `> fell back under ${WIN_COVERAGE}% — breach lost.`);
  }
  if (!node.outcome && node.scanRow >= FIELD_H) {
    node.outcome = 'lose';
    push(node, `> TRACE COMPLETE. discovered in ${sector.id}.`);
  }
  return ev;
}

// Whole volley in one call (headless / tests). The UI runs the steps animated.
export function runVolley(node, program) {
  const ev = beginVolley(node, program);
  while (node.pingsLeft > 0) lobOne(node);
  advanceScan(node);
  return resolveVolley(node, ev);
}

function push(node, line) {
  node.log.push(line);
  if (node.log.length > 6) node.log.shift();
}
