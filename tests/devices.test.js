import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createSimOn, createSim, stepSim } from '../src/beam.js';
import { FIELD_W, FIELD_H, idx, OPEN, WALL, LANCE, NOVA, FREEZE } from '../src/terrain.js';
import { mulberry32 } from '../src/rng.js';

// A bare one-sector block, all OPEN, that we salt with a device + walls. Devices fire
// the instant a crawler burns them, and the FIRST launching strand always anchors on
// the bottom-most open cell of the trigger column — so a device placed there detonates
// on tick 1, which lets us test each blast in isolation, deterministically.
function block() {
  return {
    seed: 1,
    t: new Uint8Array(FIELD_W * FIELD_H),                 // all OPEN
    sectors: [{ id: 'T', x0: 0, x1: FIELD_W - 1, difficulty: 'OPEN' }],
    burned: new Uint8Array(FIELD_W * FIELD_H),
  };
}
const params = (over = {}) => ({
  p: 30,
  chain: [{ grammar: 'FF', pace: 1, connector: 'SCATTER' }],
  collision: true,
  scanSpeed: 0, reclaim: 0,          // scan frozen unless a test turns it on
  breachHold: 999, winCoverage: 101, // never resolve, so we can keep stepping
  survivalMinCells: 10,
  ...over,
});
const P = 30, BOT = FIELD_H - 1;     // trigger column + the seed anchor row

test('LANCE burn drills a bar of firewall open, growing the claimable field', () => {
  const m = block();
  m.t[idx(P, BOT)] = LANCE;
  const walls = [];
  for (let d = 1; d <= 6; d++) { const y = BOT - d; m.t[idx(P, y)] = WALL; walls.push([P, y]); }   // firewall straight up
  const sim = createSimOn(m, 0, params(), mulberry32(1));
  const claimBefore = sim.claim;

  const snap = stepSim(sim);

  assert.equal(snap.detonations.length, 1);
  const d = snap.detonations[0];
  assert.equal(d.type, 'LANCE');
  assert.equal(d.combo, 1);
  assert.equal(d.len, 6);                                 // solo hit = base length
  for (const [x, y] of walls) {
    assert.equal(m.t[idx(x, y)], OPEN, `wall at ${x},${y} drilled to OPEN`);
    assert.equal(m.burned[idx(x, y)], 1, `drilled cell ${x},${y} burned`);
  }
  assert.equal(sim.claim, claimBefore + 6);               // denominator grew with the numerator
});

test('NOVA burn blasts a circle of firewall open', () => {
  const m = block();
  m.t[idx(P, BOT)] = NOVA;
  // firewall cells all within radius 2 of the device (dx^2+dy^2 <= 4)
  const walls = [[P, BOT - 1], [P, BOT - 2], [P - 1, BOT], [P + 1, BOT], [P - 2, BOT], [P + 2, BOT]];
  for (const [x, y] of walls) m.t[idx(x, y)] = WALL;
  const sim = createSimOn(m, 0, params(), mulberry32(1));
  const claimBefore = sim.claim;

  const snap = stepSim(sim);

  assert.equal(snap.detonations[0].type, 'NOVA');
  assert.equal(snap.detonations[0].r, 2);
  for (const [x, y] of walls) {
    assert.equal(m.t[idx(x, y)], OPEN);
    assert.equal(m.burned[idx(x, y)], 1);
  }
  assert.equal(sim.claim, claimBefore + walls.length);
});

test('FREEZE burn halts the trace scan for its duration, then it resumes', () => {
  const m = block();
  m.t[idx(P, BOT)] = FREEZE;
  const sim = createSimOn(m, 0, params({ scanSpeed: 1 }), mulberry32(1));

  const snap = stepSim(sim);                              // tick 1: FREEZE fires
  assert.equal(snap.detonations[0].type, 'FREEZE');
  assert.equal(snap.detonations[0].dur, 8);              // base freeze
  assert.equal(sim.scanRow, 0);

  for (let i = 0; i < 7; i++) stepSim(sim);               // ride out the frozen window
  assert.equal(sim.scanRow, 0, 'scan stays pinned while frozen');
  stepSim(sim); stepSim(sim);                             // freeze lapses → scan moves again
  assert.ok(sim.scanRow > 0, 'scan resumes after the freeze expires');
});

test('chained detonations raise the combo and scale the next device up', () => {
  const m = block();
  m.t[idx(P, BOT)] = LANCE;       // first launch anchor (bottom)
  m.t[idx(P, 0)] = LANCE;         // second launch anchor (top) — a 2nd SCATTER card
  const sim = createSimOn(m, 0, params({
    chain: [
      { grammar: 'F', pace: 1, connector: 'SCATTER' },
      { grammar: 'F', pace: 1, connector: 'SCATTER' },
    ],
  }), mulberry32(1));

  const snap = stepSim(sim);

  assert.equal(snap.detonations.length, 2);
  assert.equal(snap.detonations[0].combo, 1);
  assert.equal(snap.detonations[0].len, 6);              // base
  assert.equal(snap.detonations[1].combo, 2);
  assert.equal(snap.detonations[1].len, 8);              // +1 combo → +LANCE_STEP
  assert.equal(sim.combo, 2);
});

test('the combo cools after its window with no fresh detonation', () => {
  const m = block();
  m.t[idx(P, BOT)] = FREEZE;
  const sim = createSimOn(m, 0, params(), mulberry32(1));
  stepSim(sim);
  assert.equal(sim.combo, 1);
  for (let i = 0; i < 31; i++) stepSim(sim);              // COMBO_WINDOW (30) elapses with no new blast
  assert.equal(sim.combo, 0);
});

test('devices keep the sim deterministic: same seed replays identically', () => {
  const run = () => {
    const sim = createSim(7, 0, params({ scanSpeed: 0.4, reclaim: 6, winCoverage: 50, breachHold: 15 }));
    for (let i = 0; i < 60; i++) stepSim(sim);
    return { burned: Array.from(sim.machine.burned), cov: sim.cov, combo: sim.combo, claim: sim.claim };
  };
  assert.deepEqual(run(), run());
});
