import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CARDS, evalProgram } from '../src/cards.js';
import { generateMachine, createNode, runPass, LOCKDOWN, heatOf } from '../src/battle.js';
import { SECTORS, WIN_COVERAGE, idx, FIELD_H } from '../src/terrain.js';

const COLD = [CARDS.XOR, CARDS.BRUTE, CARDS.BRUTE];   // value 6
const GOOD = [CARDS.BRUTE, CARDS.BRUTE, CARDS.XOR];   // value 12
const HOT = [CARDS.ADD5, CARDS.ADD5, CARDS.SHL];      // value 30

function conquer(machine, si, program) {
  machine.burned.fill(0);
  machine.sectors[si].conquered = false;
  const node = createNode(machine, si);
  let g = 0;
  while (!node.outcome && g++ < 40) runPass(node, program);
  return node;
}

test('accumulator: order matters', () => {
  assert.equal(evalProgram(GOOD).value, 12);
  assert.equal(evalProgram(COLD).value, 6);
});

test('heat scales with the accumulator', () => {
  assert.ok(heatOf(evalProgram(COLD)) < heatOf(evalProgram(HOT)));
});

test('all six terrain types appear in every sector (16 seeds)', () => {
  for (let seed = 1; seed <= 16; seed++) {
    const m = generateMachine(seed);
    for (const s of m.sectors) {
      const cnt = [0, 0, 0, 0, 0, 0];
      for (let y = 0; y < FIELD_H; y++) for (let x = s.x0; x <= s.x1; x++) cnt[m.t[idx(x, y)]]++;
      cnt.forEach((n, i) => assert.ok(n > 0, `seed ${seed} ${s.id} missing terrain type ${i}`));
    }
  }
});

test('win is coverage-based: reaching WIN_COVERAGE breaches the sector', () => {
  // find any winnable sector across seeds and confirm the win fires at >= threshold
  for (let seed = 1; seed <= 20; seed++) {
    const m = generateMachine(seed);
    for (let si = 0; si < 3; si++) {
      const node = conquer(m, si, HOT);
      if (node.outcome === 'win') {
        assert.ok(node.crack >= WIN_COVERAGE);
        assert.ok(node.pass <= LOCKDOWN);
        return;
      }
    }
  }
  assert.fail('expected at least one winnable sector across 20 seeds');
});

test('difficulty varies and is not positional (some non-EASY sectors exist)', () => {
  const tally = {};
  for (let seed = 1; seed <= 20; seed++) {
    for (const s of generateMachine(seed).sectors) tally[s.difficulty] = (tally[s.difficulty] || 0) + 1;
  }
  assert.ok((tally.EASY || 0) > 0, 'some EASY sectors');
  assert.ok((tally.HARD || 0) + (tally.BRUTAL || 0) > 0, 'some hard/brutal sectors');
});

test('deterministic: same seed => identical terrain', () => {
  const a = generateMachine(42), b = generateMachine(42);
  assert.deepEqual(Array.from(a.t), Array.from(b.t));
});
