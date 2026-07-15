import { test } from 'node:test';
import assert from 'node:assert/strict';

import { composeBoard, detonate, setReducedMotion } from '../src/juice.js';
import { generateMachine, idx } from '../src/terrain.js';
import { FIELD_OY, FIELD_OX, COLS, ROWS } from '../src/layout.js';

const BX = 5, BY = 2;   // a block cell (block coords)

// Build a blank 80x40 screen with one burned frontier cell ('@') and a game
// object the compositor will style. The compositor stamps the cell's birth time on
// the first frame it sees it burned. The block draws at a FIELD_OX/FIELD_OY inset,
// so the glyph lands at the offset screen cell.
function scene(seed) {
  const machine = generateMachine(seed);
  machine.burned[idx(BX, BY)] = 1;
  const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(' '));
  grid[FIELD_OY + BY][FIELD_OX + BX] = '@';
  const text = grid.map((r) => r.join('')).join('\n');
  return { machine, text, game: { phase: 'exec', node: {}, run: { machine } } };
}
const burnedRow = (out) => out.split('\n')[FIELD_OY + BY];
const opacityOf = (out) => { const m = burnedRow(out).match(/opacity:([\d.]+)/); return m ? +m[1] : null; };

test('a burned cell breathes as brn, with no flash absent a detonation', () => {
  const { text, game } = scene(1);
  const row = burnedRow(composeBoard(text, game, 500));
  assert.match(row, /class="brn"/);
  assert.ok(!row.includes('class="hot"'));
  assert.ok(row.includes('@'));                 // frontier glyph left alone
});

test('a burned cell breathes: opacity rises from birth (trough) toward the pulse peak', () => {
  const { text, game } = scene(5);
  const trough = opacityOf(composeBoard(text, game, 1000));       // birth stamped here → pulse min
  const peak = opacityOf(composeBoard(text, game, 1000 + 700));   // half a 1400ms pulse later → max
  assert.ok(trough != null && peak != null, 'burned cell carries an opacity span');
  assert.ok(peak > trough, `pulse should brighten from ${trough} to ${peak}`);
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
