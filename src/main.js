// OVERRIDE — Tier-1 vertical slice.
// A run = conquering the three sectors of THE MACHINE, one at a time. You draw a
// blind loadout, see all three terrains, and choose which to assault.

import { mulberry32, shuffle } from './rng.js';
import { startingDeck, DRAFT_POOL, CARDS } from './cards.js';
import { generateMachine, newCode, createNode, beginPass, endPass, burnMore, jackEmbers, REDRAW_COST } from './battle.js';
import { buildScreen } from './render.js';
import { installPointer } from './input.js';
import { HAND_CARDS, DRAFT_CARDS, BTN_REDRAW, BTN_UNDO, BTN_EXEC, BTN_CONTINUE, SECTOR_RECTS, inRect } from './layout.js';
import { CHARACTERS } from './characters.js';
import { FIELD_H, WIN_COVERAGE } from './terrain.js';
import { sfx, resumeAudio } from './audio.js';

const screen = document.getElementById('screen');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BURN_MS = 70; // per burn-step frame — every spread layer is drawn
const ROOT_KEY = 'override.root';
const DECK_KEY = 'override.deck';     // persistent deck: card ids, survives runs
const POINTS_KEY = 'override.points'; // persistent points bank

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
const draw = () => { screen.textContent = buildScreen(game); };

function startRun() {
  game.seed = (Date.now() ^ 0x9e3779b9) >>> 0;
  const machine = generateMachine(game.seed);
  game.run = {
    tier: 1, node: 1, root: loadRoot(), points: loadPoints(), deck: loadDeck(),
    machine, code: newCode(mulberry32((game.seed ^ 12345) >>> 0)),
    locked: new Array(8).fill(false), conquered: 0, char: null,
  };
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
  game.prompt = 'CHOOSE TARGET — match your heat to the terrain';
  sfx.ui();
  draw();
}

function chooseSector(si) {
  const s = game.run.machine.sectors[si];
  if (!s || s.conquered) return;
  game.node = createNode(game.run.machine, si);
  startJackin();
}

// --- jack-in targeting: oscillating gnomons, lock X then Y ---
let jackRAF = null;
function startJackin() {
  game.phase = 'jackin';
  game.jack = { step: 'x', pos: 0, col: null, row: null, lockedX: null };
  game.jackStart = performance.now();
  resumeAudio();
  sfx.exec();
  loopJackin();
}
function loopJackin() {
  if (game.phase !== 'jackin') return;
  const j = game.jack, s = game.node.sector, ch = game.run.char;
  const phase = ((performance.now() - game.jackStart) / ch.period) % 1;
  const tri = phase < 0.5 ? phase * 2 : 2 - phase * 2; // 0..1..0 ping-pong
  if (j.step === 'x') {
    const lo = ch.deep ? s.x0 + Math.floor((s.x1 - s.x0) * 0.45) : s.x0;
    j.col = lo + Math.round(tri * (s.x1 - lo));
  } else {
    j.row = Math.round(tri * (FIELD_H - 1));
  }
  draw();
  jackRAF = requestAnimationFrame(loopJackin);
}
function lockJackin() {
  if (game.phase !== 'jackin') return;
  const j = game.jack;
  if (j.step === 'x') {
    j.lockedX = j.col;
    j.step = 'y';
    game.jackStart = performance.now();
    sfx.load();
  } else {
    if (jackRAF) cancelAnimationFrame(jackRAF);
    sfx.lock();
    game.node.embers = jackEmbers(game.run.machine, game.node.sector, j.lockedX, j.row, game.run.char);
    game.phase = 'exec';
    startExec();
  }
}

async function startExec() {
  resumeAudio();
  sfx.exec();
  await sleep(220);
  const node = game.node;
  while (!node.outcome) {
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
    const ev = beginPass(node, game.program.slice());
    for (let s = 0; s < node.steps; s++) { // draw every spread layer
      const added = burnMore(node);
      draw();
      await sleep(BURN_MS);
      if (added === 0) break;
    }
    endPass(node, ev);
    if (node.crack > before) sfx.crack();
    draw();
    await sleep(260);
  }
  if (node.outcome === 'win') await burnToCompletion(node);
  showResult();
}

// Win is already secured; keep spreading the fire to its natural limit so
// coverage past WIN_COVERAGE can bank as points. Lockdown no longer applies.
async function burnToCompletion(node) {
  game.prompt = `${node.sector.id} BREACHED — burning to completion for bonus…`;
  for (let guard = 0; guard < 300; guard++) {
    const added = burnMore(node);
    draw();
    await sleep(BURN_MS);
    if (added === 0) break;
  }
}

function showResult() {
  const node = game.node, r = game.run;
  game.phase = 'result';
  if (node.outcome === 'win') {
    r.conquered++;
    for (const d of node.sector.digits) r.locked[d] = true;
    const reward = 40 + r.conquered * 10;
    r.root += reward; saveRoot(r.root);
    const bonus = Math.max(0, Math.round(node.crack - WIN_COVERAGE));
    r.points += bonus; savePoints(r.points);
    sfx.lock(); sfx.win();
    game.message = `>> ${node.sector.id} BREACHED. +${reward} ROOT, +${bonus} PTS (${node.crack.toFixed(0)}% burned). [ENTER] to continue.`;
    game.prompt = `${node.sector.id} cracked — its codes fall.`;
  } else {
    sfx.lose();
    const kept = Math.floor(r.root * 0.5); saveRoot(kept);
    game.message = `>> FAIL: your terminal burns out. banked ${kept} ROOT. [ENTER] to jack in again.`;
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
  const rng = mulberry32((game.seed ^ (game.run.node * 777) ^ (game.run.conquered * 99991)) >>> 0);
  game.draft = shuffle(DRAFT_POOL, rng).slice(0, 3);
  game.phase = 'draft';
  game.prompt = '';
  draw();
}
function pickDraft(i) {
  if (game.phase !== 'draft' || !game.draft[i]) return;
  game.run.deck.push({ ...game.draft[i] });
  saveDeck(game.run.deck);
  game.run.node += 1;
  sfx.lock();
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
  } else if (game.phase === 'jackin') {
    return lockJackin(); // any tap locks the moving gnomon (timing skill)
  } else if (game.phase === 'assemble') {
    for (let i = 0; i < HAND_CARDS.length; i++) if (inRect(col, row, HAND_CARDS[i])) return loadSlot(i);
    if (inRect(col, row, BTN_REDRAW)) return redraw();
    if (inRect(col, row, BTN_UNDO)) return undoSlot();
    if (inRect(col, row, BTN_EXEC)) return gotoTarget();
  } else if (game.phase === 'target') {
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
  } else if (game.phase === 'jackin') {
    if (k === ' ' || k === 'Enter') { e.preventDefault(); lockJackin(); }
  } else if (game.phase === 'assemble') {
    if (k >= '1' && k <= '5') loadSlot(+k - 1);
    else if (k === 'r' || k === 'R') redraw();
    else if (k === 'Backspace') { e.preventDefault(); undoSlot(); }
    else if (k === 'Enter') gotoTarget();
  } else if (game.phase === 'target') {
    if (k >= '1' && k <= '3') chooseSector(+k - 1);
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
