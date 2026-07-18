import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CARDS, buildChain, CONNECTORS, cardFromGrammar, AUTHORED_ID } from '../src/cards.js';
import { generateMachine, createNode, runBattle, runBattlePeak, rewardMult, draftPicks,
  createTestSim, stepSim, blankMachine, coverageReward } from '../src/battle.js';
import { createSim } from '../src/beam.js';
import { WIN_COVERAGE, idx, FIELD_H, energyTo, COST, OPEN, generateMachineUpTo, tierRank } from '../src/terrain.js';

// A strong chain (dense, fast, forking) and the deliberately weak one-card starter.
// These are the balance anchors (research/lsystem-growth.md §5, §10).
const STRONG = [CARDS['BUFFER.OVR'], CARDS['ROOTKIT'], CARDS['WORM']];
const WEAK = [CARDS['SCRIPT.COM']];

function play(machine, si, program, aggro = 0.75, override) {
  machine.burned.fill(0);
  machine.sectors[si].conquered = false;
  const node = createNode(machine, si, aggro, aggro, program, {});
  if (override) override(node.sim.params);          // ablation hook (before firing)
  return runBattle(node);
}
// build a fresh node on a reset sector (peak helper needs the node, not the outcome)
function nodeFor(machine, si, program, override) {
  machine.burned.fill(0);
  machine.sectors[si].conquered = false;
  const node = createNode(machine, si, 0.75, 0.75, program, {});
  if (override) override(node.sim.params);
  return node;
}

// --- the chain build (research/lsystem-growth.md §7) -------------------------

test('buildChain: the growth programs stay an ordered chain', () => {
  const m = buildChain([CARDS['WORM'], CARDS['HARMONIC']]);
  assert.equal(m.chain.length, 2);
  assert.equal(m.chain[0].grammar, CARDS['WORM'].grammar);      // deck order preserved
  assert.equal(m.chain[1].grammar, CARDS['HARMONIC'].grammar);
});

test('buildChain: each segment carries grammar/pace/connector', () => {
  const seg = buildChain([CARDS['ROOTKIT']]).chain[0];
  assert.equal(seg.grammar, CARDS['ROOTKIT'].grammar);
  assert.equal(seg.pace, CARDS['ROOTKIT'].pace);
  assert.ok(CONNECTORS.includes(seg.connector));
});

test('buildChain: the chain is ORDER-DEPENDENT (unlike the old commutative merge)', () => {
  const a = buildChain([CARDS['SCRIPT.COM'], CARDS['WORM']]).chain.map((s) => s.grammar);
  const b = buildChain([CARDS['WORM'], CARDS['SCRIPT.COM']]).chain.map((s) => s.grammar);
  assert.notDeepEqual(a, b, 'reordering the deck reorders the connector chain');
});

test('buildChain: an invalid/empty grammar is sanitised to a lone F', () => {
  const seg = buildChain([{ grammar: 'xyz', pace: 3, connector: 'SCATTER' }]).chain[0];
  assert.equal(seg.grammar, 'F', 'unknown symbols dropped → falls back to F');
});

test('buildChain: OVERLAY splices the next card into ONE looped program', () => {
  const a = { grammar: 'FFKF', pace: 2, connector: 'OVERLAY' };
  const b = { grammar: 'FFFK', pace: 4, connector: 'SPROUT' };
  const c = { grammar: 'RRF', pace: 3, connector: 'SCATTER' };
  const m = buildChain([a, b, c]);
  assert.equal(m.cards, 3, 'card count survives the fold');
  assert.equal(m.chain.length, 2, 'OVERLAY folds two cards into one segment');
  assert.equal(m.chain[0].grammar, 'FFKFFFFK', 'grammars concatenate');
  assert.equal(m.chain[0].pace, 2, 'the leading card is the engine — its pace holds');
  assert.equal(m.chain[0].connector, 'SPROUT', 'the fold carries the folded card’s connector onward');
  assert.equal(m.chain[1].grammar, 'RRF');
  // consecutive OVERLAYs splice into a single strand
  const mm = buildChain([{ ...a }, { ...b, connector: 'OVERLAY' }, c]);
  assert.equal(mm.chain.length, 1);
  assert.equal(mm.chain[0].grammar, 'FFKFFFFKRRF');
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

// --- the turtle VM (research/lsystem-growth.md §1, §3) -----------------------

test('determinism: same swarm + same field twice → byte-for-byte identical burn', () => {
  const a = generateMachine(9), b = generateMachine(9);
  const na = nodeFor(a, 0, STRONG), nb = nodeFor(b, 0, STRONG);
  runBattlePeak(na); runBattlePeak(nb);
  assert.deepEqual(Array.from(a.burned), Array.from(b.burned), 'the L-system VM is RNG-free — identical result');
});

test('searching reroute never re-treads: no F ever burns an already-burned cell (forky decks, 20 seeds)', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const node = nodeFor(generateMachine(seed), 0, [CARDS['0DAY']]);   // dense forks + branch = heavy VM
    runBattlePeak(node);
    assert.equal(node.sim.reTread, 0, `seed ${seed}: a strand re-trod its own trail`);
  }
});

test('coverage regression: a fixed deck on a fixed board holds its expected band', () => {
  // Guards against silent VM/smolder regressions (research/lsystem-growth.md §9).
  const { peak } = runBattlePeak(nodeFor(generateMachine(7), 0, STRONG));
  assert.ok(peak > 35 && peak < 58, `seed 7 STRONG peaked ${peak.toFixed(1)}% — outside [35,58]`);
});

test('TEST bench: blank block, no scan — the pattern draws until every strand traps', () => {
  const sim = createTestSim(STRONG);
  for (const cell of sim.machine.t) assert.equal(cell, 0, 'bench terrain must be all OPEN');
  let guard = 0;
  while (sim.turtles.length && guard++ < 5000) stepSim(sim);
  assert.ok(guard < 5000, 'bench run must reach quiescence');
  assert.equal(sim.outcome, null, 'nothing ends or wins a bench run');
  assert.equal(sim.scanRow, 0, 'the scan never moves on the bench');
  assert.ok(sim.cov > 10, `the chain should paint the open block (got ${sim.cov.toFixed(1)}%)`);
  assert.equal(sim.reTread, 0);
});

test('collision gate: OFF ⇒ literal Tron turtle crashes on its own trail; ON ⇒ reroutes', () => {
  // A closed square grammar (FFRR-style) re-enters its start cell after one loop.
  // Literal (collision off): that F crashes into the burned trail → the strand dies,
  // so it never re-treads (reTread stays 0 by dying, not by avoiding).
  const litSim = createSim(3, 0, { p: 31, chain: [{ grammar: 'FFRR', pace: 1, connector: 'SCATTER' }],
    scanSpeed: 0, reclaim: 0, breachHold: 0, winCoverage: 101, collision: false });
  let g = 0; while (litSim.turtles.length && g++ < 5000) stepSim(litSim);
  assert.ok(g < 5000, 'the literal turtle must die (crash), not loop forever');
  assert.equal(litSim.reTread, 0, 'a crash never burns a re-tread cell');

  // Same grammar with collision ON reroutes around the trail and keeps drawing longer.
  const onSim = createSim(3, 0, { p: 31, chain: [{ grammar: 'FFRR', pace: 1, connector: 'SCATTER' }],
    scanSpeed: 0, reclaim: 0, breachHold: 0, winCoverage: 101, collision: true });
  let g2 = 0, onTicks = 0; while (onSim.turtles.length && g2++ < 5000) { stepSim(onSim); onTicks++; }
  assert.ok(onTicks > g, 'the rerouting turtle survives longer than the literal one');
  assert.equal(onSim.reTread, 0, 'the reroute never re-treads');
});

test('survival mode: a balanced self-avoiding line outlasts the scan; a straight one crashes', () => {
  // collision OFF (pre-collision): win = a strand alive at scan-bottom having drawn
  // ≥ survivalMinCells. Balanced turns snake and survive; a straight runner or a
  // no-move formula does not (research/lsystem-growth.md: the tutorial recipe).
  const survive = (grammar) => {
    const node = createNode(blankMachine(1, 'YOUR MACHINE'), 0, 0.30, 0.40,
      [cardFromGrammar(grammar)], { collision: false, triggerCol: 31 });
    runBattle(node);
    return node.outcome === 'win';
  };
  assert.ok(survive('FLLFRR'), 'a balanced-turn snake survives');
  assert.ok(survive('FLLLRRR'), 'another balanced recipe survives');
  assert.ok(!survive('FFFFFFFFFF'), 'a straight runner races off the block and crashes');
  assert.ok(!survive('RRRR'), 'a formula that never advances draws nothing and cannot win');
});

test('createTestSim([]) is an empty, clean board — the author preview never shows a stale trail', () => {
  // Empty grammar (all DELed) must build a fresh blank sim with no strands and no
  // burns, so the author field never falls back to a prior attempt's trail.
  const sim = createTestSim([], false);
  assert.equal(sim.turtles.length, 0, 'no strands');
  assert.equal(sim.cellsBurned, 0, 'nothing drawn');
  assert.ok(!sim.machine.burned.some((b) => b), 'board is unburned');
});

test('cardFromGrammar: an authored card carries its grammar under the stable authored id', () => {
  const c = cardFromGrammar('FL9R xRF');   // sanitised to valid symbols
  assert.equal(c.id, AUTHORED_ID);
  assert.equal(c.grammar, 'FLRRF', 'unknown symbols dropped, F/L/R kept');
  assert.equal(c.pace, 1);
});

test('coverageReward: pays crack% × mult always — a scratch pays little, a breach pays full', () => {
  assert.equal(coverageReward(0, 0.40, 0.40), 0);
  assert.equal(coverageReward(15, 0.40, 0.40), 15);   // survival scratch
  assert.equal(coverageReward(50, 0.40, 0.40), 50);   // a bare breach
  assert.ok(coverageReward(50, 0.60, 0.40) > 50, 'cranking aggression above baseline pays more');
});

// --- balance (research/lsystem-growth.md §5, §10) ---------------------------

test('a strong chain breaches the block, holding through the breach timer', () => {
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

test('a weak chain loses far more often than a strong one; the one-card starter never breaches', () => {
  let weakWins = 0, strongWins = 0;
  for (let seed = 1; seed <= 40; seed++) {
    if (play(generateMachine(seed), 0, WEAK).outcome === 'win') weakWins++;
    if (play(generateMachine(seed), 0, STRONG).outcome === 'win') strongWins++;
  }
  assert.ok(strongWins > weakWins, `strong (${strongWins}) should beat weak (${weakWins})`);
  assert.equal(weakWins, 0, 'the one-card starter should never breach the block at standard aggression');
});

test('forking is load-bearing: the branching skeleton is the area engine (§6)', () => {
  // Coverage is earned by fork density, not a smolder flood. Strip every K (forks →
  // plain advances) and the same deck collapses toward thin forkless runners.
  const stripForks = (p) => { p.chain = p.chain.map((s) => ({ ...s, grammar: s.grammar.replace(/K/g, 'F') })); };
  let withForks = 0, without = 0;
  for (let seed = 1; seed <= 30; seed++) {
    withForks += runBattlePeak(nodeFor(generateMachine(seed), 0, STRONG)).peak;
    without += runBattlePeak(nodeFor(generateMachine(seed), 0, STRONG, stripForks)).peak;
  }
  assert.ok(withForks > without * 1.4, `forking should lift coverage well above forkless (${withForks.toFixed(0)} vs ${without.toFixed(0)})`);
});

test('aggression is a difficulty dial: higher aggression wins less', () => {
  let low = 0, high = 0;
  for (let seed = 1; seed <= 40; seed++) {
    if (play(generateMachine(seed), 0, STRONG, 0.25).outcome === 'win') low++;
    if (play(generateMachine(seed), 0, STRONG, 0.65).outcome === 'win') high++;
  }
  assert.ok(low > high, `aggression 0.25 wins (${low}) should exceed aggression 0.65 wins (${high})`);
});

test('aggression pays: reward multiplier and draft picks rise with it', () => {
  assert.ok(rewardMult(0.60) > rewardMult(0.40));
  assert.equal(draftPicks(0.40), 1);   // at baseline: one pick
  assert.equal(draftPicks(0.55), 2);   // +1 step (~0.15) over baseline: two picks
  assert.equal(draftPicks(0.65), 2);   // top of the band
  assert.equal(draftPicks(0.20), 1);   // lowering never drops below one pick
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

test('difficulty ceiling: forced-EASY opener never hands out a harder block', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const easy = generateMachineUpTo(seed, 'EASY');
    assert.equal(easy.sectors[0].difficulty, 'EASY', `seed ${seed} failed to force EASY`);
    const med = generateMachineUpTo(seed, 'MED');
    assert.ok(tierRank(med.sectors[0].difficulty) <= tierRank('MED'), `seed ${seed} exceeded MED cap`);
  }
  assert.ok(generateMachineUpTo(12345, 'BRUTAL').sectors[0].difficulty);
});

test('deterministic: same seed => identical terrain and battle outcome', () => {
  const a = generateMachine(42), b = generateMachine(42);
  assert.deepEqual(Array.from(a.t), Array.from(b.t));
  assert.equal(play(a, 0, STRONG).outcome, play(b, 0, STRONG).outcome);
});
