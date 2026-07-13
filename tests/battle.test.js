import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CARDS, evalProgram } from '../src/cards.js';
import { generateMachine, createNode, runVolley, rewardMult, draftPicks } from '../src/battle.js';
import { WIN_COVERAGE, idx, FIELD_H, energyTo, COST, OPEN } from '../src/terrain.js';

const COLD = [CARDS.XOR, CARDS.BRUTE, CARDS.BRUTE];   // value 6
const GOOD = [CARDS.BRUTE, CARDS.BRUTE, CARDS.XOR];   // value 12
const HOT = [CARDS.ADD5, CARDS.ADD5, CARDS.SHL];      // value 30

function play(machine, si, program, aggro) {
  machine.burned.fill(0);
  machine.sectors[si].conquered = false;
  const node = createNode(machine, si, undefined, aggro);
  let g = 0;
  while (!node.outcome && g++ < 120) runVolley(node, program);
  return node;
}

test('accumulator: order matters', () => {
  assert.equal(evalProgram(GOOD).value, 12);
  assert.equal(evalProgram(COLD).value, 6);
});

test('energy per ping scales with the accumulator', () => {
  assert.ok(evalProgram(HOT).value > evalProgram(GOOD).value);
  assert.ok(evalProgram(GOOD).value > evalProgram(COLD).value);
});

test('COST replaces the gate: OPEN is cheap, HARD is dear, WALL unaffordable', () => {
  assert.equal(COST[OPEN], 1);
  assert.ok(COST[1] > COST[OPEN]);          // HARD
  assert.equal(COST[2], Infinity);          // WALL
  assert.ok(COST[3] < 0);                    // BUS refunds
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

test('a hot program breaches some sector, holding through the breach timer', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const m = generateMachine(seed);
    for (let si = 0; si < 3; si++) {
      const node = play(m, si, HOT);
      if (node.outcome === 'win') {
        assert.ok(node.crack >= WIN_COVERAGE, 'win fires at/above coverage threshold');
        assert.ok(node.scanRow <= FIELD_H, 'won before the trace fully descended');
        return;
      }
    }
  }
  assert.fail('expected at least one breachable sector across 20 seeds');
});

test('a cold program loses far more often than a hot one', () => {
  let coldWins = 0, hotWins = 0;
  for (let seed = 1; seed <= 20; seed++) {
    for (let si = 0; si < 3; si++) {
      if (play(generateMachine(seed), si, COLD).outcome === 'win') coldWins++;
      if (play(generateMachine(seed), si, HOT).outcome === 'win') hotWins++;
    }
  }
  assert.ok(hotWins > coldWins, `hot (${hotWins}) should beat cold (${coldWins})`);
});

test('difficulty varies and is derived from energy-to-cover', () => {
  const tally = {};
  for (let seed = 1; seed <= 24; seed++) {
    for (const s of generateMachine(seed).sectors) tally[s.difficulty] = (tally[s.difficulty] || 0) + 1;
  }
  assert.ok((tally.EASY || 0) > 0, 'some EASY sectors');
  assert.ok((tally.MED || 0) + (tally.HARD || 0) + (tally.BRUTAL || 0) > 0, 'some harder sectors');
  // energyTo is monotonic in coverage
  const m = generateMachine(7);
  assert.ok(energyTo(m, m.sectors[0], 80).energy >= energyTo(m, m.sectors[0], 40).energy);
});

test('aggression is a difficulty dial: higher aggression wins less', () => {
  let low = 0, high = 0;
  for (let seed = 1; seed <= 20; seed++) {
    for (let si = 0; si < 3; si++) {
      if (play(generateMachine(seed), si, HOT, 1.0).outcome === 'win') low++;
      if (play(generateMachine(seed), si, HOT, 2.5).outcome === 'win') high++;
    }
  }
  assert.ok(low > high, `aggression 1.0 wins (${low}) should exceed aggression 2.5 wins (${high})`);
});

test('aggression pays: reward multiplier and draft picks rise with it', () => {
  assert.ok(rewardMult(2.0) > rewardMult(1.0));
  assert.equal(draftPicks(1.0), 1);
  assert.equal(draftPicks(1.5), 2);
  assert.equal(draftPicks(2.5), 4);
  assert.equal(draftPicks(0.5), 1);   // lowering never drops below one pick
});

test('deterministic: same seed => identical terrain', () => {
  const a = generateMachine(42), b = generateMachine(42);
  assert.deepEqual(Array.from(a.t), Array.from(b.t));
});
