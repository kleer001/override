// Battle = conquering one sector (a node). The machine (three sectors) persists
// across the run, so conquered sectors stay burned and the board fills up. Your
// program's accumulator sets the fire's HEAT; terrain decides what it can burn.

import { generateMachine, ignite, burnStep, sectorStats, idx, FIELD_W, FIELD_H, OPEN, WALL } from './terrain.js';
import { evalProgram } from './cards.js';
import { randInt } from './rng.js';

export { generateMachine };
export const LOCKDOWN = 10;
export const CODE_DIGITS = 8;
export const STEPS_PER_PASS = 3;

export function newCode(rng) {
  return Array.from({ length: CODE_DIGITS }, () => Math.floor(rng() * 10));
}

export function heatOf(ev) {
  return Math.max(4, Math.min(9, 4 + Math.floor(ev.value / 4) + (ev.flags.interrupt ? 1 : 0)));
}

export function createNode(machine, secIdx) {
  const sector = machine.sectors[secIdx];
  return {
    machine, secIdx, sector,
    pass: 0, heat: 0, crack: 0, ignited: false, outcome: null,
    log: [`> jacked into ${sector.id}. terrain: ${sector.difficulty}.`],
  };
}

export function crackPct(node) { return Math.min(100, node.crack); }

// war-dial ignition (single ember at the sector entry). Character-based ember
// patterns (shotgun / catapult) plug in here later.
function embersFor(machine, sector) {
  return [{ x: sector.entry.x, y: sector.entry.y }];
}

export function runPass(node, program) {
  const ev = evalProgram(program);
  node.pass++;
  const { machine, sector } = node;
  const heat = heatOf(ev);
  node.heat = heat;

  if (!node.ignited) {
    ignite(machine, sector, embersFor(machine, sector));
    node.ignited = true;
  }
  // FORK lobs an extra ember deep in the sector (a fresh front)
  for (let k = 0; k < ev.flags.fork; k++) {
    const ex = randInt(machine.rng, sector.x0 + 2, sector.x1 - 2);
    const ey = randInt(machine.rng, 2, FIELD_H - 2);
    if (machine.t[idx(ex, ey)] !== WALL) machine.burned[idx(ex, ey)] = 1;
    push(node, `> FORK: ember lobbed deep into ${sector.id}.`);
  }

  // spread rate scales with the accumulator: a hotter program burns faster,
  // so a bigger number both unlocks harder terrain AND conquers in fewer passes
  const steps = Math.max(1, Math.min(5, 1 + Math.floor(ev.value / 6)));
  for (let s = 0; s < steps; s++) burnStep(machine, sector, heat);

  const st = sectorStats(machine, sector);
  node.crack = st.pct;

  push(node, `> pass ${node.pass}: acc ${ev.value} -> heat ${heat}. burned ${st.pct.toFixed(0)}% of ${sector.id}.`);

  if (st.vaultsBurned) {
    node.outcome = 'win';
    sector.conquered = true;
    push(node, `> VAULT cracked. ${sector.id} is yours.`);
  } else if (node.pass >= LOCKDOWN) {
    node.outcome = 'lose';
    push(node, node.heat <= 5
      ? `> LOCKDOWN. your program ran too cold for ${sector.id}.`
      : `> LOCKDOWN. ran out of time in ${sector.id}.`);
  }
  return ev;
}

function push(node, line) {
  node.log.push(line);
  if (node.log.length > 6) node.log.shift();
}
