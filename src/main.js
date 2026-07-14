// OVERRIDE — Tier-1 vertical slice (Beam-Card model, research/ember-model.md).
// A run = conquering the three sectors of THE MACHINE, one at a time. You draw a
// blind loadout, slot cards into a merged beam, aim the turret at a sector column,
// fire ONE packet, and WATCH it spread + reproduce against the descending trace.

import { mulberry32, shuffle } from './rng.js';
import { startingDeck, DRAFT_POOL, SHOP_CARDS, CARDS } from './cards.js';
import { SHOP_ITEMS, CHAR_UNLOCK, CARD_UNLOCK } from './shop.js';
import { generateMachine, newCode, createNode, fire, stepBattle, coverage, REDRAW_COST, SLOTS,
  rewardMult, draftPicks, AGGRO_BASE, AGGRO_STEP, AGGRO_MIN, AGGRO_MAX, AGGRO_REDUCE_COST } from './battle.js';
import { buildScreen } from './render.js';
import { composeBoard, detonate, setReducedMotion } from './juice.js';
import { createTrauma } from './shake.js';
import { installPointer } from './input.js';
import { HAND_CARDS, DRAFT_CARDS, BTN_REDRAW, BTN_UNDO, BTN_EXEC, BTN_CONTINUE, SECTOR_RECTS, BTN_AGGRO_DOWN, BTN_AGGRO_UP, shopRow, BTN_JACKIN, inRect } from './layout.js';
import { CHARACTERS } from './characters.js';
import { WIN_COVERAGE } from './terrain.js';
import { sfx, resumeAudio } from './audio.js';

const screen = document.getElementById('screen');
const crtEl = document.querySelector('.crt');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TICK_MS = 60;   // watch-phase pace: ms per sim tick (emit → spread → scan)

// --- game feel (research/juice-model.md) ---
// One trauma scalar drives the CRT-container shake; reduced-motion drops the shake
// and rapid flashes but keeps the brightness states (accessibility, §6).
const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
setReducedMotion(reduceMotion);
const trauma = createTrauma();
const kick = (amount) => { if (!reduceMotion) trauma.add(amount); };
const ROOT_KEY = 'override.root';
const DECK_KEY = 'override.deck';     // persistent deck: card ids, survives runs
const POINTS_KEY = 'override.points'; // persistent points bank
const PLAYS_KEY = 'override.plays';   // runs started — drives the onboarding ramp

const game = {
  phase: 'assemble', run: null, node: null,
  program: new Array(SLOTS).fill(null), selection: [], hand: [], draft: [],
  prompt: '', message: '', seed: 0, redrawCount: 0,
};

const loadRoot = () => parseInt(localStorage.getItem(ROOT_KEY) || '120', 10) || 120;
const saveRoot = (v) => localStorage.setItem(ROOT_KEY, String(v));
const loadDeck = () => {
  const raw = localStorage.getItem(DECK_KEY);
  return raw ? JSON.parse(raw).map((id) => ({ ...CARDS[id] })).filter((c) => c.id) : startingDeck();
};
const saveDeck = (deck) => localStorage.setItem(DECK_KEY, JSON.stringify(deck.map((c) => c.id)));
const loadPoints = () => parseInt(localStorage.getItem(POINTS_KEY) || '0', 10) || 0;
const savePoints = (v) => localStorage.setItem(POINTS_KEY, String(v));
const loadPlays = () => parseInt(localStorage.getItem(PLAYS_KEY) || '0', 10) || 0;
const savePlays = (v) => localStorage.setItem(PLAYS_KEY, String(v));
const clock = () => performance.now();
const paint = (now) => { screen.innerHTML = composeBoard(buildScreen(game), game, now); };
const draw = () => paint(clock());

// --- ROOT shop persistence (permanent unlocks + held consumables) ---
const CHARS_KEY = 'override.chars';   // unlocked jack-in ids
const CARDS_KEY = 'override.cards';   // unlocked draft-card ids
const RETRY_KEY = 'override.retry';   // held retry tokens
const OC_KEY = 'override.overclock';  // overclock armed for next run
const loadJSON = (k, d) => { const r = localStorage.getItem(k); return r ? JSON.parse(r) : d; };
const unlockedChars = () => loadJSON(CHARS_KEY, ['wardial']);      // War-dialer free
const unlockedCards = () => loadJSON(CARDS_KEY, []);
const loadRetry = () => parseInt(localStorage.getItem(RETRY_KEY) || '0', 10) || 0;
const saveRetry = (v) => localStorage.setItem(RETRY_KEY, String(v));

const availChars = () => CHARACTERS.filter((c) => unlockedChars().includes(c.id));
const draftPool = () => DRAFT_POOL.concat(unlockedCards().map((id) => SHOP_CARDS[id]).filter(Boolean));

function shopOwned(item) {
  if (item.kind === 'char') return unlockedChars().includes(CHAR_UNLOCK[item.id]);
  if (item.kind === 'card') return unlockedCards().includes(CARD_UNLOCK[item.id]);
  return false; // consumables are repeatable
}

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
  let baseAggro = onboardingBase(plays);
  const overclock = localStorage.getItem(OC_KEY) === '1';        // armed in the shop
  if (overclock) { localStorage.removeItem(OC_KEY); baseAggro = Math.min(AGGRO_MAX, +(baseAggro + 0.25).toFixed(2)); }
  game.run = {
    tier: 1, node: 1, root: loadRoot(), points: loadPoints(), deck: loadDeck(),
    machine, code: newCode(mulberry32((game.seed ^ 12345) >>> 0)),
    locked: new Array(8).fill(false), conquered: 0, char: null,
    aggression: baseAggro, baseAggro, pendingDrafts: 0, plays,
    availChars: availChars(), overclockPool: overclock ? 300 : 0, retry: loadRetry(),
  };
  savePlays(plays + 1);
  trauma.reset();                     // never carry shake across runs
  game.node = null;
  game.phase = 'charselect';
  game.prompt = overclock ? 'OVERCLOCK ARMED — bigger REACH pool, faster trace this run.' : '';
  draw();
}

function pickChar(i) {
  if (game.phase !== 'charselect' || !game.run.availChars[i]) return;
  game.run.char = game.run.availChars[i];
  sfx.lock();
  newAssemble();
}

// draw five cards off the deck; redrawCount varies the shuffle per redraw
function dealHand() {
  const r = game.run;
  const rng = mulberry32((game.seed ^ (r.node * 40503) ^ (r.conquered * 2654435761) ^ (game.redrawCount * 2246822519)) >>> 0);
  game.hand = shuffle(r.deck, rng).slice(0, 5).map((c) => ({ name: c.name, card: c, used: false }));
  game.program = new Array(SLOTS).fill(null);
  game.selection = [];
}

function newAssemble() {
  game.node = null;
  game.redrawCount = 0;
  dealHand();
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
  if (!h || h.used || game.selection.length >= SLOTS) return;
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
  if (!game.program.some(Boolean)) return;
  game.phase = 'target';
  game.prompt = 'AIM — tap a sector column to fire the turret there';
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

// Commit: fire the turret at sector `si` from trigger column `col` (the tapped
// column; defaults to sector centre on keyboard select).
function chooseSector(si, col) {
  const r = game.run, s = r.machine.sectors[si];
  if (!s || s.conquered) return;
  const triggerCol = col == null ? undefined : col;
  game.node = createNode(r.machine, si, r.char, r.aggression, r.baseAggro, game.program.slice(),
    { triggerCol, poolBonus: r.overclockPool });
  game.phase = 'exec';
  startExec();
}

// The watch: fire one packet, then tick the sim (emit → spread → reproduce → scan)
// on a fixed cadence, drawing each tick, until the battle resolves. Fully idle —
// no input once the packet is away.
async function startExec() {
  resumeAudio();
  sfx.exec();
  const node = game.node;
  game.prompt = `WATCH — the beam spreads across ${node.sector.id}; hold coverage through the breach.`;
  await sleep(200);
  fire(node);
  kick(0.35);
  draw();
  await sleep(200);

  let lastHoney = 0, wasBreaching = false, wasBreachedThisRun = false;
  while (!node.outcome) {
    const snap = stepBattle(node);
    // honeypot tripped → the trace lurches; a bad-surprise jolt (§9)
    if (node.sim.honeyBurned > lastHoney) { lastHoney = node.sim.honeyBurned; sfx.honeypot(); kick(0.4); }
    // crossing into the breach hold — you hit coverage, now survive the timer
    if (snap.breachLeft >= 0 && !wasBreaching) {
      wasBreaching = true;
      if (!wasBreachedThisRun) { wasBreachedThisRun = true; sfx.crack(); if (!reduceMotion) detonate(clock(), 0.7); kick(0.5); }
    } else if (snap.breachLeft < 0) wasBreaching = false;
    draw();
    await sleep(reduceMotion ? 0 : TICK_MS);
  }
  if (node.outcome === 'lose') { sfx.flatline(); kick(0.9); }
  showResult();
}

function showResult() {
  const node = game.node, r = game.run;
  game.phase = 'result';
  node.crack = coverage(node.sim);
  if (node.outcome === 'win') {
    r.conquered++;
    for (const d of node.sector.digits) r.locked[d] = true;
    const mult = rewardMult(node.aggro, node.baseAggro);
    const reward = Math.round((40 + r.conquered * 10) * mult);
    r.root += reward; saveRoot(r.root);
    const bonus = Math.round(Math.max(0, node.crack - WIN_COVERAGE) * mult);
    r.points += bonus; savePoints(r.points);
    r.pendingDrafts = draftPicks(node.aggro, node.baseAggro);
    kick(0.7);                        // ▆ breach — the sector falls, celebrate it
    sfx.lock(); sfx.win();
    game.message = `>> ${node.sector.id} BREACHED (aggro x${node.aggro.toFixed(2)}). +${reward} ROOT, +${bonus} PTS, ${r.pendingDrafts} draft. [ENTER].`;
    game.prompt = `${node.sector.id} cracked — its codes fall.`;
  } else if (r.retry > 0) {
    r.retry -= 1; saveRetry(r.retry);
    game.retried = true;
    sfx.ui();
    game.message = `>> TRACED in ${node.sector.id} — RETRY TOKEN spent, you slip away. [ENTER] to reassemble.`;
    game.prompt = `close call. retry tokens left: ${r.retry}.`;
  } else {
    sfx.lose();
    const kept = Math.floor(r.root * 0.5); saveRoot(kept);
    game.message = `>> TRACED: they found you in ${node.sector.id}. banked ${kept} ROOT. [ENTER] for the shop.`;
    game.prompt = 'TRACE COMPLETE.';
  }
  draw();
}

function advance() {
  if (game.node.outcome === 'win') {
    if (game.run.conquered >= 3) return tierClear();
    startDraft();
  } else if (game.retried) {
    game.retried = false; newAssemble();     // retry token spent — same run continues
  } else openShop();                          // run ended by the trace — shop before next run
}

// --- ROOT shop ---
function refreshShop() {
  if (game.run) game.run.root = loadRoot();   // keep the header in sync with purchases
  game.shopData = {
    root: loadRoot(), retry: loadRetry(), overclock: localStorage.getItem(OC_KEY) === '1',
    items: SHOP_ITEMS.map((it) => ({ id: it.id, name: it.name, desc: it.desc, cost: it.cost, kind: it.kind, owned: shopOwned(it) })),
  };
}
function openShop() {
  game.phase = 'shop';
  game.prompt = 'ROOT SHOP — permanent unlocks stick forever; consumables are single-use.';
  game.message = '';
  refreshShop();
  draw();
}
function buyShop(id) {
  if (game.phase !== 'shop') return;
  const item = SHOP_ITEMS.find((s) => s.id === id);
  if (!item) return;
  if (shopOwned(item)) { game.message = 'already unlocked.'; draw(); return; }
  const root = loadRoot();
  if (root < item.cost) { game.message = `need ${item.cost} ROOT (have ${root}).`; sfx.undo(); draw(); return; }
  saveRoot(root - item.cost);
  if (item.kind === 'char') { const u = unlockedChars(); u.push(CHAR_UNLOCK[item.id]); localStorage.setItem(CHARS_KEY, JSON.stringify(u)); }
  else if (item.kind === 'card') { const u = unlockedCards(); u.push(CARD_UNLOCK[item.id]); localStorage.setItem(CARDS_KEY, JSON.stringify(u)); }
  else if (item.kind === 'retry') { saveRetry(loadRetry() + 1); }
  else if (item.kind === 'curse') { localStorage.setItem(OC_KEY, '1'); }
  sfx.lock();
  game.message = `bought ${item.name}.  ROOT left: ${loadRoot()}.`;
  refreshShop();
  draw();
}

function startDraft() {
  const rng = mulberry32((game.seed ^ (game.run.node * 777) ^ (game.run.conquered * 99991) ^ (game.run.pendingDrafts * 131071)) >>> 0);
  game.draft = shuffle(draftPool(), rng).slice(0, 3);
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
  game.message = '>> THE MACHINE IS YOURS. +100 ROOT. [ENTER] for the shop.';
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
    for (let i = 0; i < SECTOR_RECTS.length; i++) if (inRect(col, row, SECTOR_RECTS[i])) return chooseSector(i, col);
  } else if (game.phase === 'draft') {
    for (let i = 0; i < DRAFT_CARDS.length; i++) if (inRect(col, row, DRAFT_CARDS[i])) return pickDraft(i);
  } else if (game.phase === 'shop') {
    for (let i = 0; i < SHOP_ITEMS.length; i++) if (inRect(col, row, shopRow(i))) return buyShop(SHOP_ITEMS[i].id);
    if (inRect(col, row, BTN_JACKIN)) return startRun();
  } else if (game.phase === 'result') {
    if (inRect(col, row, BTN_CONTINUE)) return advance();
  } else if (game.phase === 'tierclear' || game.phase === 'gameover') {
    if (inRect(col, row, BTN_CONTINUE)) return openShop();
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
    if (k >= '1' && k <= '3') chooseSector(+k - 1);           // keyboard = fire from sector centre
    else if (k === '+' || k === '=') raiseAggro();
    else if (k === '-' || k === '_') lowerAggro();
  } else if (game.phase === 'draft') {
    if (k >= '1' && k <= '3') pickDraft(+k - 1);
  } else if (game.phase === 'shop') {
    if (k >= '1' && k <= '9') { const i = +k - 1; if (SHOP_ITEMS[i]) buyShop(SHOP_ITEMS[i].id); }
    else if (k === 'Enter') startRun();
  } else if (game.phase === 'result') {
    if (k === 'Enter') advance();
  } else if (game.phase === 'tierclear' || game.phase === 'gameover') {
    if (k === 'Enter') openShop();
  }
});

// pulse loop: repaint (~30fps) while the field is live so captures breathe and
// the conquer celebration plays. Other screens repaint on demand via draw().
// The shake runs every frame (60fps) so a jolt settles smoothly even between
// paints and even on static screens (breach/doom fire outside the exec loop).
const needsAnim = () => game.node && (game.phase === 'exec' || game.phase === 'result');
let lastPaint = 0, lastFrame = 0, shaking = false;
function applyShake(dt) {
  trauma.decay(dt);
  if (!crtEl) return;
  if (trauma.value <= 0) { if (shaking) { crtEl.style.transform = ''; shaking = false; } return; }
  shaking = true;
  const s = trauma.shake();
  crtEl.style.transform = `translate(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px) rotate(${s.rot.toFixed(3)}deg)`;
}
function animLoop(t) {
  const dt = lastFrame ? t - lastFrame : 16;
  lastFrame = t;
  applyShake(dt);
  if (needsAnim() && t - lastPaint >= 33) { lastPaint = t; paint(t); }
  requestAnimationFrame(animLoop);
}
requestAnimationFrame(animLoop);

startRun();
draw();
