import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CARDS, evalProgram } from '../src/cards.js';
import { generateMachine, createNode, runPass, LOCKDOWN, heatOf } from '../src/battle.js';
import { SECTORS } from '../src/terrain.js';

function conquer(machine, si, program) {
  machine.burned.fill(0);
  machine.sectors[si].conquered = false;
  const node = createNode(machine, si);
  let g = 0;
  while (!node.outcome && g++ < 40) runPass(node, program);
  return node;
}

const COLD = [CARDS.XOR, CARDS.BRUTE, CARDS.BRUTE];   // value 6  -> heat 5
const GOOD = [CARDS.BRUTE, CARDS.BRUTE, CARDS.XOR];   // value 12 -> heat 7
const HOT = [CARDS.ADD5, CARDS.ADD5, CARDS.SHL];      // value 30 -> heat 9

test('accumulator: order matters', () => {
  assert.equal(evalProgram(GOOD).value, 12);
  assert.equal(evalProgram(COLD).value, 6);
});

test('heat scales with the accumulator', () => {
  assert.ok(heatOf(evalProgram(COLD)) < heatOf(evalProgram(HOT)));
});

test('every sector has a vault and is winnable by a hot program (12 seeds)', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const m = generateMachine(seed);
    assert.equal(m.sectors.length, 3);
    for (let si = 0; si < 3; si++) {
      assert.ok(m.sectors[si].vaults.length >= 1, `seed ${seed} ${SECTORS[si].id} has a vault`);
      const node = conquer(m, si, HOT);
      assert.equal(node.outcome, 'win', `seed ${seed} ${SECTORS[si].id} winnable by hot`);
      assert.ok(node.pass <= LOCKDOWN);
    }
  }
});

test('KERNEL yields to any loadout; a hot program conquers faster than cold', () => {
  const m = generateMachine(1);
  const cold = conquer(m, 0, COLD);
  const hot = conquer(m, 0, HOT);
  assert.equal(cold.outcome, 'win');
  assert.equal(hot.outcome, 'win');
  assert.ok(hot.pass <= cold.pass, 'hot conquers KERNEL in fewer-or-equal passes');
});

test('a cold program cannot crack a HARD sector it lacks the heat for', () => {
  // find a HARD sector across seeds and confirm cold loses but hot wins
  let checked = 0;
  for (let seed = 1; seed <= 12 && checked < 3; seed++) {
    const m = generateMachine(seed);
    for (let si = 0; si < 3; si++) {
      if (m.sectors[si].difficulty !== 'HARD') continue;
      assert.equal(conquer(m, si, COLD).outcome, 'lose');
      assert.equal(conquer(m, si, HOT).outcome, 'win');
      checked++;
    }
  }
  assert.ok(checked > 0, 'found at least one HARD sector to test');
});

test('deterministic: same seed => identical terrain and outcome', () => {
  const a = generateMachine(42), b = generateMachine(42);
  assert.deepEqual(Array.from(a.t), Array.from(b.t));
  assert.equal(conquer(a, 2, GOOD).outcome, conquer(b, 2, GOOD).outcome);
});
