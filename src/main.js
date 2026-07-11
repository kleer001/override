// OVERRIDE — Tier-1 vertical slice. Phase state machine + input + render loop.

import { mulberry32, shuffle, randInt } from './rng.js';
import { startingDeck, DRAFT_POOL } from './cards.js';
import { createBattle, setProgram, runPass, LOCKDOWN } from './battle.js';
import { buildScreen } from './render.js';
import { sfx, resumeAudio } from './audio.js';

const screen = document.getElementById('screen');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ROOT_KEY = 'override.root';

const game = {
  phase: 'assemble',      // assemble | exec | result | draft | tierclear | gameover
  run: null,
  battle: null,
  program: [null, null, null],
  selection: [],          // hand indices, in load order
  hand: [],               // { name, card, used }
  draft: [],
  playhead: -1,
  prompt: '',
  message: '',
  seed: 0,
};

function loadRoot() { return parseInt(localStorage.getItem(ROOT_KEY) || '120', 10) || 120; }
function saveRoot(v) { localStorage.setItem(ROOT_KEY, String(v)); }

function draw() { screen.textContent = buildScreen(game); }

function startRun() {
  game.run = { tier: 1, node: 1, root: loadRoot(), deck: startingDeck() };
  game.seed = (Date.now() ^ 0x9e3779b9) >>> 0;
  newAssemble();
}

function newAssemble() {
  const r = game.run;
  const rng = mulberry32((game.seed + r.node * 2654435761) >>> 0);
  game.battle = createBattle(rng, r.node);
  const drawn = shuffle(r.deck, mulberry32((game.seed ^ (r.node * 40503)) >>> 0)).slice(0, 5);
  game.hand = drawn.map((c) => ({ name: c.name, card: c, used: false }));
  game.program = [null, null, null];
  game.selection = [];
  game.playhead = -1;
  game.message = '';
  game.phase = 'assemble';
  game.prompt = `NODE ${r.node}/3 — assemble your intrusion. order is everything.`;
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
  if (game.phase !== 'assemble' || game.selection.length === 0) return;
  const i = game.selection.pop();
  game.hand[i].used = false;
  game.program[game.selection.length] = null;
  sfx.undo();
  draw();
}

async function startExec() {
  if (game.selection.length < 3) return;
  game.phase = 'exec';
  game.prompt = 'EXEC — running…';
  setProgram(game.battle, game.program.slice());
  resumeAudio();
  sfx.exec();
  await sleep(250);

  while (!game.battle.outcome) {
    // sweep the playhead across the three cards (the visible program run)
    for (let i = 0; i < 3; i++) {
      game.playhead = i;
      const k = game.program[i].kind;
      if (k === 'mult') sfx.mult(game.program[i].value);
      else if (k === 'fork') sfx.fork();
      else if (k === 'interrupt') sfx.ice();
      else sfx.add(i);
      draw();
      await sleep(200);
    }
    const before = { crack: game.battle.crack, locked: game.battle.codeLocked };
    runPass(game.battle);
    if (game.battle.crack > before.crack) sfx.crack();
    if (game.battle.codeLocked > before.locked) sfx.lock();
    game.playhead = -1;
    draw();
    await sleep(420);
  }

  showResult();
}

function showResult() {
  game.phase = 'result';
  const b = game.battle;
  if (b.outcome === 'win') {
    const reward = 40 + b.node * 10;
    game.run.root += reward;
    saveRoot(game.run.root);
    sfx.win();
    game.message = `>> BREACH. +${reward} ROOT. [ENTER] to continue.`;
    game.prompt = `NODE ${game.run.node} cracked. codes falling.`;
  } else {
    sfx.lose();
    const kept = Math.floor(game.run.root * 0.5);
    saveRoot(kept);
    game.message = `>> ${failSkin()}  banked ${kept} ROOT. [ENTER] to jack in again.`;
    game.prompt = 'TRACE COMPLETE.';
  }
  draw();
}

function failSkin() {
  return 'FAIL: your terminal burns out.';
}

function advance() {
  const b = game.battle;
  if (b.outcome === 'win') {
    if (game.run.node >= 3) return tierClear();
    startDraft();
  } else {
    startRun(); // fresh run, ROOT already halved+saved
  }
}

function startDraft() {
  const rng = mulberry32((game.seed ^ (game.run.node * 777)) >>> 0);
  game.draft = shuffle(DRAFT_POOL, rng).slice(0, 3);
  game.phase = 'draft';
  game.prompt = 'DRAFT — bank a new instruction into your deck.';
  draw();
}

function pickDraft(i) {
  if (game.phase !== 'draft') return;
  const c = game.draft[i];
  if (!c) return;
  game.run.deck.push({ ...c });
  game.run.node += 1;
  sfx.lock();
  newAssemble();
}

function tierClear() {
  game.phase = 'tierclear';
  game.run.root += 100;
  saveRoot(game.run.root);
  sfx.win();
  game.message = '>> TIER 1 CLEARED. THE MACHINE is yours. +100 ROOT. [ENTER] new run.';
  game.prompt = 'the codes were a front. something deeper is listening…';
  draw();
}

// --- input ---
window.addEventListener('keydown', (e) => {
  resumeAudio();
  const key = e.key;
  if (game.phase === 'assemble') {
    if (key >= '1' && key <= '5') loadSlot(+key - 1);
    else if (key === 'Backspace') { e.preventDefault(); undoSlot(); }
    else if (key === 'Enter') startExec();
  } else if (game.phase === 'draft') {
    if (key >= '1' && key <= '3') pickDraft(+key - 1);
  } else if (game.phase === 'result') {
    if (key === 'Enter') advance();
  } else if (game.phase === 'tierclear' || game.phase === 'gameover') {
    if (key === 'Enter') startRun();
  }
});

// ambient redraw (address drift during exec, cheap)
setInterval(() => { if (game.phase === 'exec') draw(); }, 80);

startRun();
draw();
