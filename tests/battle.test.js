import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CARDS, mergeBeam, GROWTH_CAP } from '../src/cards.js';
import { generateMachine, createNode, runBattle, runBattlePeak, rewardMult, draftPicks } from '../src/battle.js';
import { WIN_COVERAGE, idx, FIELD_H, energyTo, COST, OPEN } from '../src/terrain.js';

// A strong coverage deck (curtain-ish: dense, both directions, high growth) and a
// deliberately weak starter (one thin card). These are the balance anchors.
const STRONG = [CARDS['BUFFER.OVR'], CARDS['BUFFER.OVR'], CARDS['WORM']];
const WEAK = [CARDS['SCRIPT.COM']];

function play(machine, si, program, aggro = 0.75, override) {
  machine.burned.fill(0);
  machine.sectors[si].conquered = false;
  const node = createNode(machine, si, null, aggro, aggro, program, {});
  if (override) override(node.sim.params);          // ablation hook (before firing)
  return runBattle(node);
}

test('merge: probability ADDS and caps at 100%', () => {
  assert.equal(mergeBeam([CARDS['SCRIPT.SYS'], CARDS['SCRIPT.SYS']]).prob, 50);   // 25+25
  assert.equal(mergeBeam([CARDS['ROOTKIT'], CARDS['ROOTKIT']]).prob, 100);        // 75+75 -> cap
});

test('merge: direction UNIONS across cards', () => {
  const m = mergeBeam([CARDS['SCRIPT.COM'], CARDS['SCRIPT.SYS']]);   // ← + →
  assert.deepEqual([...m.dirs].sort(), ['←', '→']);
});

test('merge: growth ADDS (cap) and child spread-reach MAXes', () => {
  const m = mergeBeam([CARDS['WORM'], CARDS['WORM'], CARDS['WORM']]);   // 0.40 x3 = 1.2
  assert.equal(m.reproduce, GROWTH_CAP);                                 // capped at 0.60
  assert.equal(m.spreadReach, 8);                                        // High spread-reach (max)
  // MAX not SUM: a High + a Low card keeps the High spread-reach
  assert.equal(mergeBeam([CARDS['WORM'], CARDS['SCRIPT.COM']]).spreadReach, 8);
});

test('merge: order does not matter (all four merges commute)', () => {
  const a = mergeBeam([CARDS['SCRIPT.COM'], CARDS['WORM'], CARDS['BUFFER.OVR']]);
  const b = mergeBeam([CARDS['BUFFER.OVR'], CARDS['SCRIPT.COM'], CARDS['WORM']]);
  assert.equal(a.prob, b.prob);
  assert.equal(a.reproduce, b.reproduce);
  assert.deepEqual([...a.dirs].sort(), [...b.dirs].sort());
});

test('merge: a mask card (DAEMON) switches probability to deterministic comb', () => {
  const m = mergeBeam([CARDS['DAEMON']]);
  assert.equal(m.probMode, 'mask');
  assert.equal(m.maskN, 5);
});

test('COST table: OPEN cheap, HARD dear, WALL unaffordable, BUS refunds', () => {
  assert.equal(COST[OPEN], 1);
  assert.ok(COST[1] > COST[OPEN]);          // HARD
  assert.equal(COST[2], Infinity);          // WALL
  assert.ok(COST[3] < 0);                    // BUS refunds
});

test('all five terrain types appear in every sector (16 seeds)', () => {
  for (let seed = 1; seed <= 16; seed++) {
    const m = generateMachine(seed);
    for (const s of m.sectors) {
      const cnt = [0, 0, 0, 0, 0];   // OPEN HARD WALL BUS HONEY
      for (let y = 0; y < FIELD_H; y++) for (let x = s.x0; x <= s.x1; x++) cnt[m.t[idx(x, y)]]++;
      cnt.forEach((n, i) => assert.ok(n > 0, `seed ${seed} ${s.id} missing terrain type ${i}`));
    }
  }
});

test('a strong beam breaches the block, holding through the breach timer', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const node = play(generateMachine(seed), 0, STRONG);
    if (node.outcome === 'win') {
      assert.ok(node.crack >= WIN_COVERAGE, 'win fires at/above coverage threshold');
      assert.ok(node.sim.scanRow <= FIELD_H, 'won before the trace fully descended');
      return;
    }
  }
  assert.fail('expected at least one breachable block across 40 seeds');
});

test('a weak beam loses far more often than a strong one', () => {
  let weakWins = 0, strongWins = 0;
  for (let seed = 1; seed <= 40; seed++) {
    if (play(generateMachine(seed), 0, WEAK).outcome === 'win') weakWins++;
    if (play(generateMachine(seed), 0, STRONG).outcome === 'win') strongWins++;
  }
  assert.ok(strongWins > weakWins, `strong (${strongWins}) should beat weak (${weakWins})`);
  assert.equal(weakWins, 0, 'the one-card starter should never breach the block');
});

test('GROWTH is load-bearing: stripping reproduce collapses coverage', () => {
  let withGrowth = 0, without = 0;
  for (let seed = 1; seed <= 30; seed++) {
    withGrowth += runBattlePeak(nodeFor(generateMachine(seed), 0, STRONG)).peak;
    without += runBattlePeak(nodeFor(generateMachine(seed), 0, STRONG, (p) => { p.reproduce = 0; })).peak;
  }
  assert.ok(withGrowth > without * 1.3, `growth should lift total peak coverage (${withGrowth.toFixed(0)} vs ${without.toFixed(0)})`);
});

test('aggression is a difficulty dial: higher aggression wins less', () => {
  let low = 0, high = 0;
  for (let seed = 1; seed <= 40; seed++) {
    if (play(generateMachine(seed), 0, STRONG, 0.5).outcome === 'win') low++;
    if (play(generateMachine(seed), 0, STRONG, 2.5).outcome === 'win') high++;
  }
  assert.ok(low > high, `aggression 0.5 wins (${low}) should exceed aggression 2.5 wins (${high})`);
});

test('aggression pays: reward multiplier and draft picks rise with it', () => {
  assert.ok(rewardMult(2.0) > rewardMult(1.0));
  assert.equal(draftPicks(1.0), 1);
  assert.equal(draftPicks(1.5), 2);
  assert.equal(draftPicks(2.5), 4);
  assert.equal(draftPicks(0.5), 1);   // lowering never drops below one pick
});

test('difficulty varies and is derived from energy-to-cover', () => {
  const tally = {};
  for (let seed = 1; seed <= 24; seed++) {
    for (const s of generateMachine(seed).sectors) tally[s.difficulty] = (tally[s.difficulty] || 0) + 1;
  }
  assert.ok((tally.EASY || 0) > 0, 'some EASY sectors');
  assert.ok((tally.MED || 0) + (tally.HARD || 0) + (tally.BRUTAL || 0) > 0, 'some harder sectors');
  const m = generateMachine(7);
  assert.ok(energyTo(m, m.sectors[0], 80).energy >= energyTo(m, m.sectors[0], 40).energy);
});

test('deterministic: same seed => identical terrain and battle outcome', () => {
  const a = generateMachine(42), b = generateMachine(42);
  assert.deepEqual(Array.from(a.t), Array.from(b.t));
  assert.equal(play(a, 0, STRONG).outcome, play(b, 0, STRONG).outcome);
});

// build a fresh node on a reset sector (peak helper needs the node, not the outcome)
function nodeFor(machine, si, program, override) {
  machine.burned.fill(0);
  machine.sectors[si].conquered = false;
  const node = createNode(machine, si, null, 0.75, 0.75, program, {});
  if (override) override(node.sim.params);
  return node;
}
