import { test } from 'node:test';
import assert from 'node:assert/strict';

import { composeBoard, detonate, setReducedMotion } from '../src/juice.js';
import { generateMachine, idx } from '../src/terrain.js';
import { FIELD_TOP, COLS, ROWS } from '../src/layout.js';

const BX = 5, BY = 2;   // a KERNEL cell, off the sector-label row (field y=0)

// Build a blank 80x40 screen with one burned frontier cell ('@') and a game
// object the compositor will style. bornAt=0 pins the breathing phase.
function scene(seed) {
  const machine = generateMachine(seed);
  machine.burned[idx(BX, BY)] = 1;
  machine.bornAt[idx(BX, BY)] = 0;
  const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(' '));
  grid[FIELD_TOP + BY][BX] = '@';
  const text = grid.map((r) => r.join('')).join('\n');
  return { machine, text, game: { phase: 'exec', node: {}, run: { machine } } };
}
const burnedRow = (out) => out.split('\n')[FIELD_TOP + BY];

test('a burned cell breathes as brn, with no flash absent a detonation', () => {
  const { text, game } = scene(1);
  const row = burnedRow(composeBoard(text, game, 500));
  assert.match(row, /class="brn"/);
  assert.ok(!row.includes('class="hot"'));
  assert.ok(row.includes('@'));                 // frontier glyph left alone
});

test('detonation flashes the burned mass white-hot and surges the glyph', () => {
  const { text, game } = scene(2);
  composeBoard(text, game, 0);                  // first paint syncs this machine
  detonate(1000, 1);                            // ...then the mult lands
  const row = burnedRow(composeBoard(text, game, 1000)); // sampled inside the flash
  assert.match(row, /class="hot"/);
  assert.ok(row.includes('#'));                 // '@' promoted up the density ramp
  assert.ok(!row.includes('@'));
});

test('the flash is transient — it eases back to the breathing pulse', () => {
  const { text, game } = scene(3);
  composeBoard(text, game, 0);
  detonate(1000, 1);
  const row = burnedRow(composeBoard(text, game, 1000 + 500)); // past the whole window
  assert.ok(!row.includes('class="hot"'));
  assert.match(row, /class="brn"/);
});

test('reduced motion keeps the burn state but drops the detonation flash', () => {
  const { text, game } = scene(4);
  composeBoard(text, game, 0);
  setReducedMotion(true);
  detonate(1000, 1);
  const row = burnedRow(composeBoard(text, game, 1000));
  setReducedMotion(false);                      // restore before asserting
  assert.ok(!row.includes('class="hot"'));      // no white-hot flash
  assert.match(row, /class="brn"/);             // still reads as burned
});
