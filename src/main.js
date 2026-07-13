// OVERRIDE — Tier-1 vertical slice.
// A run = conquering the three sectors of THE MACHINE, one at a time. You draw a
// blind loadout, see all three terrains, and choose which to assault.

import { mulberry32, shuffle } from './rng.js';
import { startingDeck, DRAFT_POOL, CARDS } from './cards.js';
import { generateMachine, newCode, createNode, beginVolley, lobOne, advanceScan, resolveVolley, REDRAW_COST,
  rewardMult, draftPicks, AGGRO_BASE, AGGRO_STEP, AGGRO_MIN, AGGRO_MAX, AGGRO_REDUCE_COST } from './battle.js';
import { buildScreen } from './render.js';
import { installPointer } from './input.js';
import { HAND_CARDS, DRAFT_CARDS, BTN_REDRAW, BTN_UNDO, BTN_EXEC, BTN_CONTINUE, SECTOR_RECTS, BTN_AGGRO_DOWN, BTN_AGGRO_UP, inRect } from './layout.js';
import { CHARACTERS } from './characters.js';
import { WIN_COVERAGE } from './terrain.js';
import { sfx, resumeAudio } from './audio.js';

const screen = document.getElementById('screen');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BURN_MS = 70; // per burn-step frame — every spread layer is drawn
const ROOT_KEY = 'override.root';
const DECK_KEY = 'override.deck';     // persistent deck: card ids, survives runs
const POINTS_KEY = 'override.points'; // persistent points bank
const PLAYS_KEY = 'override.plays';   // runs started — drives the onboarding ramp

const game = {
  phase: 'assemble', run: null, node: null,
  program: [null, null, null], selection: [], hand: [], draft: [],
  playhead: -1, prompt: '', message: '', seed: 0, redrawCount: 0,
};

const loadRoot = () => parseInt(localStorage.getItem(ROOT_KEY) || '120', 10) || 120;
const saveRoot = (v) => localStorage.setItem(ROOT_KEY, String(v));
const loadDeck = () => {
  const raw = localStorage.getItem(DECK_KEY);
  return raw ? JSON.parse(raw).map((id) => ({ ...CARDS[id] })) : startingDeck();
};
const saveDeck = (deck) => localStorage.setItem(DECK_KEY, JSON.stringify(deck.map((c) => c.id)));
const loadPoints = () => parseInt(localStorage.getItem(POINTS_KEY) || '0', 10) || 0;
const savePoints = (v) => localStorage.setItem(POINTS_KEY, String(v));
const loadPlays = () => parseInt(localStorage.getItem(PLAYS_KEY) || '0', 10) || 0;
const savePlays = (v) => localStorage.setItem(PLAYS_KEY, String(v));
const draw = () => { screen.textContent = buildScreen(game); };

// Onboarding ramp: the first couple of runs are gentle, then ease up to the real
// baseline over a few more. NOT performance-based rubber-banding — a fixed
// tutorial curve keyed to how many runs you've started. The player still owns the
// aggression dial on top of whatever base this returns.
function onboardingBase(plays) {
  const EASY = 0.5, REAL = AGGRO_BASE;
  if (plays <= 1) return EASY;
  if (plays >= 6) return REAL;
  return +(EASY + (REAL - EASY) * ((plays - 1) / 5)).toFixed(2);
}

function startRun() {
  game.seed = (Date.now() ^ 0x9e3779b9) >>> 0;
  const machine = generateMachine(game.seed);
  const plays = loadPlays();
  const baseAggro = onboardingBase(plays);
  game.run = {
    tier: 1, node: 1, root: loadRoot(), points: loadPoints(), deck: loadDeck(),
    machine, code: newCode(mulberry32((game.seed ^ 12345) >>> 0)),
    locked: new Array(8).fill(false), conquered: 0, char: null,
    aggression: baseAggro, baseAggro, pendingDrafts: 0, plays,
  };
  savePlays(plays + 1);
  game.node = null;
  game.phase = 'charselect';
  game.prompt = '';
  draw();
}

function pickChar(i) {
  if (game.phase !== 'charselect' || !CHARACTERS[i]) return;
  game.run.char = CHARACTERS[i];
  sfx.lock();
  newAssemble();
}

// draw five cards off the deck; redrawCount varies the shuffle per redraw
function dealHand() {
  const r = game.run;
  const rng = mulberry32((game.seed ^ (r.node * 40503) ^ (r.conquered * 2654435761) ^ (game.redrawCount * 2246822519)) >>> 0);
  game.hand = shuffle(r.deck, rng).slice(0, 5).map((c) => ({ name: c.name, card: c, used: false }));
  game.program = [null, null, null];
  game.selection = [];
}

function newAssemble() {
  game.node = null;
  game.redrawCount = 0;
  dealHand();
  game.playhead = -1;
  game.message = '';
  game.prompt = '';
  game.phase = 'assemble';
  draw();
}

function redraw() {
  if (game.phase !== 'assemble') return;
  const r = game.run;
  if (r.points < REDRAW_COST) { game.message = `need ${REDRAW_COST} PTS to redraw (have ${r.points}).`; draw(); return; }
  r.points -= REDRAW_COST; savePoints(r.points);
  game.redrawCount++;
  dealHand();
  game.message = '';
  sfx.ui();
  draw();
}

function loadSlot(i) {
  if (game.phase !== 'assemble') return;
  const h = game.hand[i];
  if (!h || h.used || game.selection.length >= 3) return;
  h.used = true;
  game.program[game.selection.length] = h.card;
  game.selection.push(i);
  sfx.load();
  draw();
}
function undoSlot() {
  if (game.phase !== 'assemble' || !game.selection.length) return;
  const i = game.selection.pop();
  game.hand[i].used = false;
  game.program[game.selection.length] = null;
  sfx.undo();
  draw();
}

function gotoTarget() {
  if (game.selection.length < 3) return;
  game.phase = 'target';
  game.prompt = 'CHOOSE TARGET — match your energy to the terrain';
  sfx.ui();
  draw();
}

// aggression = the difficulty dial (target phase). Raise is free (harder scan,
// bigger reward); lower spends PTS (buy safety).
function raiseAggro() {
  if (game.phase !== 'target' || game.run.aggression >= AGGRO_MAX) return;
  game.run.aggression = +(game.run.aggression + AGGRO_STEP).toFixed(2);
  sfx.ui(); draw();
}
function lowerAggro() {
  if (game.phase !== 'target' || game.run.aggression <= AGGRO_MIN) return;
  if (game.run.points < AGGRO_REDUCE_COST) { game.message = `need ${AGGRO_REDUCE_COST} PTS to de-risk.`; draw(); return; }
  game.run.points -= AGGRO_REDUCE_COST; savePoints(game.run.points);
  game.run.aggression = +(game.run.aggression - AGGRO_STEP).toFixed(2);
  sfx.ui(); draw();
}

function chooseSector(si) {
  const s = game.run.machine.sectors[si];
  if (!s || s.conquered) return;
  game.node = createNode(game.run.machine, si, game.run.char, game.run.aggression, game.run.baseAggro);
  game.phase = 'exec';
  startExec();
}

async function startExec() {
  resumeAudio();
  sfx.exec();
  await sleep(220);
  const node = game.node;
  while (!node.outcome) {
    const ev = beginVolley(node, game.program.slice());
    for (let i = 0; i < 3; i++) {
      game.playhead = i;
      const k = game.program[i].kind;
      if (k === 'mult') sfx.mult(game.program[i].value);
      else if (k === 'fork') sfx.fork();
      else if (k === 'interrupt') sfx.ice();
      else sfx.add(i);
      draw();
      await sleep(190);
    }
    game.playhead = -1;
    const before = node.crack;
    while (node.pingsLeft > 0) { // lob each finite ping, animate its spread
      lobOne(node);
      draw();
      await sleep(BURN_MS);
    }
    advanceScan(node); // the trace scan descends + reclaims
    draw();
    await sleep(140);
    resolveVolley(node, ev);
    if (node.crack > before) sfx.crack();
    draw();
    await sleep(260);
  }
  showResult();
}

function showResult() {
  const node = game.node, r = game.run;
  game.phase = 'result';
  if (node.outcome === 'win') {
    r.conquered++;
    for (const d of node.sector.digits) r.locked[d] = true;
    const mult = rewardMult(node.aggro, node.baseAggro);
    const reward = Math.round((40 + r.conquered * 10) * mult);
    r.root += reward; saveRoot(r.root);
    const bonus = Math.round(Math.max(0, node.crack - WIN_COVERAGE) * mult);
    r.points += bonus; savePoints(r.points);
    r.pendingDrafts = draftPicks(node.aggro, node.baseAggro);
    sfx.lock(); sfx.win();
    game.message = `>> ${node.sector.id} BREACHED (aggro x${node.aggro.toFixed(2)}). +${reward} ROOT, +${bonus} PTS, ${r.pendingDrafts} draft. [ENTER].`;
    game.prompt = `${node.sector.id} cracked — its codes fall.`;
  } else {
    sfx.lose();
    const kept = Math.floor(r.root * 0.5); saveRoot(kept);
    game.message = `>> TRACED: they found you in ${node.sector.id}. banked ${kept} ROOT. [ENTER] to jack in again.`;
    game.prompt = 'TRACE COMPLETE.';
  }
  draw();
}

function advance() {
  if (game.node.outcome === 'win') {
    if (game.run.conquered >= 3) return tierClear();
    startDraft();
  } else startRun();
}

function startDraft() {
  const rng = mulberry32((game.seed ^ (game.run.node * 777) ^ (game.run.conquered * 99991) ^ (game.run.pendingDrafts * 131071)) >>> 0);
  game.draft = shuffle(DRAFT_POOL, rng).slice(0, 3);
  game.phase = 'draft';
  game.prompt = game.run.pendingDrafts > 1 ? `DRAFT — ${game.run.pendingDrafts} picks left (aggression bonus)` : '';
  draw();
}
function pickDraft(i) {
  if (game.phase !== 'draft' || !game.draft[i]) return;
  game.run.deck.push({ ...game.draft[i] });
  saveDeck(game.run.deck);
  sfx.lock();
  game.run.pendingDrafts -= 1;
  if (game.run.pendingDrafts > 0) { startDraft(); return; } // extra picks from cranked aggression
  game.run.node += 1;
  newAssemble();
}

function tierClear() {
  game.phase = 'tierclear';
  game.run.root += 100; saveRoot(game.run.root);
  sfx.win();
  game.message = '>> THE MACHINE IS YOURS. +100 ROOT. [ENTER] for a new run.';
  game.prompt = 'the codes were a front. something deeper is listening…';
  draw();
}

// --- pointer input (mouse + touch) ---
function onTapCell(col, row) {
  resumeAudio();
  if (game.phase === 'charselect') {
    for (let i = 0; i < CHARACTERS.length; i++) if (inRect(col, row, DRAFT_CARDS[i])) return pickChar(i);
  } else if (game.phase === 'assemble') {
    for (let i = 0; i < HAND_CARDS.length; i++) if (inRect(col, row, HAND_CARDS[i])) return loadSlot(i);
    if (inRect(col, row, BTN_REDRAW)) return redraw();
    if (inRect(col, row, BTN_UNDO)) return undoSlot();
    if (inRect(col, row, BTN_EXEC)) return gotoTarget();
  } else if (game.phase === 'target') {
    if (inRect(col, row, BTN_AGGRO_DOWN)) return lowerAggro();
    if (inRect(col, row, BTN_AGGRO_UP)) return raiseAggro();
    for (let i = 0; i < SECTOR_RECTS.length; i++) if (inRect(col, row, SECTOR_RECTS[i])) return chooseSector(i);
  } else if (game.phase === 'draft') {
    for (let i = 0; i < DRAFT_CARDS.length; i++) if (inRect(col, row, DRAFT_CARDS[i])) return pickDraft(i);
  } else if (game.phase === 'result') {
    if (inRect(col, row, BTN_CONTINUE)) return advance();
  } else if (game.phase === 'tierclear' || game.phase === 'gameover') {
    if (inRect(col, row, BTN_CONTINUE)) return startRun();
  }
}
installPointer(screen, onTapCell);

// --- keyboard (desktop) ---
window.addEventListener('keydown', (e) => {
  resumeAudio();
  const k = e.key;
  if (game.phase === 'charselect') {
    if (k >= '1' && k <= '3') pickChar(+k - 1);
  } else if (game.phase === 'assemble') {
    if (k >= '1' && k <= '5') loadSlot(+k - 1);
    else if (k === 'r' || k === 'R') redraw();
    else if (k === 'Backspace') { e.preventDefault(); undoSlot(); }
    else if (k === 'Enter') gotoTarget();
  } else if (game.phase === 'target') {
    if (k >= '1' && k <= '3') chooseSector(+k - 1);
    else if (k === '+' || k === '=') raiseAggro();
    else if (k === '-' || k === '_') lowerAggro();
  } else if (game.phase === 'draft') {
    if (k >= '1' && k <= '3') pickDraft(+k - 1);
  } else if (game.phase === 'result') {
    if (k === 'Enter') advance();
  } else if (game.phase === 'tierclear' || game.phase === 'gameover') {
    if (k === 'Enter') startRun();
  }
});

setInterval(() => { if (game.phase === 'exec') draw(); }, 80);

startRun();
draw();
