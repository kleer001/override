// Battle = conquering one sector (a node). The machine (three sectors) persists
// across the run, so conquered sectors stay burned and the board fills up. Your
// program's accumulator sets the fire's HEAT; terrain decides what it can burn.

import { generateMachine, ignite, burnStep, sectorStats, idx, FIELD_W, FIELD_H, OPEN, WALL, WIN_COVERAGE } from './terrain.js';
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

export function createNode(machine, secIdx, embers) {
  const sector = machine.sectors[secIdx];
  return {
    machine, secIdx, sector,
    embers: embers && embers.length ? embers : [{ x: sector.entry.x, y: sector.entry.y }],
    pass: 0, heat: 0, crack: 0, ignited: false, outcome: null,
    penalty: 0, honeyHit: 0,
    log: [`> jacked into ${sector.id}. terrain: ${sector.difficulty}.`],
  };
}

// settle a point off any WALL onto the nearest passable cell
function settle(t, x, y) {
  for (let r = 0; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && nx < FIELD_W && ny >= 0 && ny < FIELD_H && t[idx(nx, ny)] !== WALL) return { x: nx, y: ny };
  }
  return { x, y };
}

// embers that land from a locked (lx, ly) mark, per the jack-in character
export function jackEmbers(machine, sector, lx, ly, ch) {
  const t = machine.t;
  const clampX = (x) => Math.max(sector.x0, Math.min(sector.x1, x));
  const clampY = (y) => Math.max(0, Math.min(FIELD_H - 1, y));
  const out = [settle(t, clampX(lx), clampY(ly))];
  for (let i = 0; i < (ch.scatter || 0); i++) {
    out.push(settle(t, clampX(out[0].x + randInt(machine.rng, -3, 3)), clampY(out[0].y + randInt(machine.rng, -3, 3))));
  }
  return out;
}

export function crackPct(node) { return Math.min(100, node.crack); }

export function runPass(node, program) {
  const ev = evalProgram(program);
  node.pass++;
  const { machine, sector } = node;
  const heat = heatOf(ev);
  node.heat = heat;

  if (!node.ignited) {
    ignite(machine, sector, node.embers);
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

  // HONEYPOT: burning bait trips the trace — each newly-burned honey costs time
  const newHoney = st.honeyBurned - node.honeyHit;
  if (newHoney > 0) {
    node.honeyHit = st.honeyBurned;
    node.penalty += newHoney * 2;
    push(node, `> HONEYPOT TRIPPED x${newHoney}! trace +${newHoney * 2}.`);
  }
  const effPass = node.pass + node.penalty;

  push(node, `> pass ${node.pass}: acc ${ev.value} -> heat ${heat}. burned ${st.pct.toFixed(0)}% of ${sector.id} (need ${WIN_COVERAGE}%).`);

  if (st.pct >= WIN_COVERAGE) {
    node.outcome = 'win';
    sector.conquered = true;
    push(node, `> ${WIN_COVERAGE}% breached. ${sector.id} is yours.`);
  } else if (effPass >= LOCKDOWN) {
    node.outcome = 'lose';
    push(node, node.heat <= 5
      ? `> LOCKDOWN. your program ran too cold to spread through ${sector.id}.`
      : `> LOCKDOWN. couldn't cover enough of ${sector.id} in time.`);
  }
  return ev;
}

function push(node, line) {
  node.log.push(line);
  if (node.log.length > 6) node.log.shift();
}
