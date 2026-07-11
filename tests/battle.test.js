import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mulberry32 } from '../src/rng.js';
import { CARDS, evalProgram } from '../src/cards.js';
import { createBattle, setProgram, runPass, LOCKDOWN, TARGET } from '../src/battle.js';
import { createBoard, tick, stats } from '../src/board.js';

function playToEnd(program, seed) {
  const b = createBattle(mulberry32(seed), 1);
  setProgram(b, program);
  let guard = 0;
  while (!b.outcome && guard++ < 100) runPass(b);
  return b;
}

test('accumulator: order matters (adds early, mult late)', () => {
  const good = evalProgram([CARDS.BRUTE, CARDS.BRUTE, CARDS.XOR]); // (0+3+3)*2
  const bad = evalProgram([CARDS.XOR, CARDS.BRUTE, CARDS.BRUTE]);  // (0*2)+3+3
  assert.equal(good.value, 12);
  assert.equal(bad.value, 6);
});

test('NOP sled doubles the next card', () => {
  const ev = evalProgram([CARDS.NOP, CARDS.NOP, CARDS.BRUTE]); // sled primes, +3 -> +6
  assert.equal(ev.value, 6);
});

test('GOTO re-applies the previous numeric card', () => {
  const ev = evalProgram([CARDS.BRUTE, CARDS.GOTO, CARDS.XOR]); // (3 +3) *2
  assert.equal(ev.value, 12);
});

test('a well-ordered program breaches within lockdown', () => {
  const b = playToEnd([CARDS.BRUTE, CARDS.BRUTE, CARDS.XOR], 1);
  assert.equal(b.outcome, 'win');
  assert.ok(b.pass <= LOCKDOWN);
  assert.equal(b.crack, TARGET);
});

test('a misordered program times out', () => {
  const b = playToEnd([CARDS.XOR, CARDS.BRUTE, CARDS.BRUTE], 1);
  assert.equal(b.outcome, 'lose');
  assert.ok(b.crack < TARGET);
});

test('deterministic: same seed => same outcome', () => {
  const a = playToEnd([CARDS.BRUTE, CARDS.BRUTE, CARDS.XOR], 42);
  const c = playToEnd([CARDS.BRUTE, CARDS.BRUTE, CARDS.XOR], 42);
  assert.equal(a.outcome, c.outcome);
  assert.equal(a.pass, c.pass);
  assert.equal(a.crack, c.crack);
});

test('board CA stays well-formed under many ticks', () => {
  const board = createBoard(mulberry32(7));
  for (let i = 0; i < 50; i++) tick(board, { iceOn: true });
  const s = stats(board);
  assert.ok(s.crackPct >= 0 && s.crackPct <= 100);
  assert.ok(s.claimable > 0);
  // strengths stay in [0,9]
  for (const v of board.str) assert.ok(v >= 0 && v <= 9);
});
