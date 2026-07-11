// Battle state + resolution. A battle is a race: fill the CRACK meter (all CODE
// digits locked) before LOCKDOWN passes run out or ICE overruns your beachhead.
//
// Design note: the CRACK meter is driven by the accumulator (sequencing IS the
// skill), while the cellular-automata board is the correlated spectacle — worm
// push scales with your accumulator, ICE pushes back, but the board isn't the
// win condition. This keeps the math legible and the screen alive.

import { createBoard, injectFrontier, seedFork, tick, stats, WORM, ICE } from './board.js';
import { evalProgram } from './cards.js';

export const LOCKDOWN = 10;
export const CODE_DIGITS = 8;
export const TARGET = 60; // crack points to breach

export function createBattle(rng, node) {
  const board = createBoard(rng);
  return {
    board,
    rng,
    node,
    pass: 0,
    crack: 0, // crack points, 0..TARGET
    territory: stats(board).crackPct, // board fill %, cosmetic
    code: makeCode(rng),
    codeLocked: 0,
    program: null,
    outcome: null, // null | 'win' | 'lose'
    log: ['> carrier established. beachhead live in KERNEL.'],
  };
}

function makeCode(rng) {
  const digits = [];
  for (let i = 0; i < CODE_DIGITS; i++) digits.push(Math.floor(rng() * 10));
  return digits;
}

export function setProgram(battle, program) {
  battle.program = program;
}

export function crackPct(battle) {
  return Math.min(100, (battle.crack / TARGET) * 100);
}

// Resolve one full pass. Returns the eval result (for the playhead animation).
export function runPass(battle) {
  const ev = evalProgram(battle.program);
  battle.pass++;
  const b = battle.board;

  // --- CRACK METER (the win condition — pure function of the accumulator) ---
  const baseDrain = 3 + Math.floor((battle.pass - 1) / 2); // the lockdown ramp (B clock)
  const iceDrain = ev.flags.interrupt ? Math.ceil(baseDrain / 2) : baseDrain;
  const forkBonus = ev.flags.fork * 5;
  const netCrack = Math.max(0, ev.value + forkBonus - iceDrain);
  battle.crack = Math.min(TARGET, battle.crack + netCrack);

  // lock CODE digits as the meter climbs
  const per = TARGET / CODE_DIGITS;
  const shouldLock = Math.min(CODE_DIGITS, Math.floor(battle.crack / per));
  if (shouldLock > battle.codeLocked) {
    battle.codeLocked = shouldLock;
    pushLog(battle, `> vault yielded. CODE digit ${shouldLock}/${CODE_DIGITS} LOCKED.`);
  }

  // --- BOARD (spectacle — worm push scales with the accumulator) ---
  for (let k = 0; k < ev.flags.fork; k++) {
    seedFork(b);
    pushLog(battle, `> FORK seeded a beachhead. second front open.`);
  }
  const wormBoost = 1 + Math.floor(ev.value / 5);
  injectFrontier(b, WORM, wormBoost);
  const iceOn = !ev.flags.interrupt;
  if (iceOn) injectFrontier(b, ICE, 1 + Math.floor(battle.pass / 4));
  const spread = Math.max(1, ev.flags.spread);
  for (let t = 0; t < 1 + spread; t++) tick(b, { iceOn });
  battle.territory = stats(b).crackPct;

  pushLog(battle,
    `> pass ${battle.pass}: acc ${ev.value}` +
    (forkBonus ? ` +${forkBonus} fork` : '') +
    (ev.flags.interrupt ? ` (ICE slowed)` : '') +
    ` -${iceDrain} drain = +${netCrack} crack. [${battle.crack}/${TARGET}]`);

  if (b.linkCut) pushLog(battle, `> WARNING: ICE holds a firewall link.`);

  // --- win / lose ---
  if (battle.codeLocked >= CODE_DIGITS || battle.crack >= TARGET) {
    battle.outcome = 'win';
    pushLog(battle, `> ROOT. system breached.`);
  } else if (stats(b).worm <= 0) {
    battle.outcome = 'lose';
    pushLog(battle, `> beachhead lost. connection dropped.`);
  } else if (battle.pass >= LOCKDOWN) {
    battle.outcome = 'lose';
    pushLog(battle, `> LOCKDOWN. trace complete.`);
  }

  return ev;
}

function pushLog(battle, line) {
  battle.log.push(line);
  if (battle.log.length > 6) battle.log.shift();
}
