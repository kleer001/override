// OVERRIDE — Tier-1 vertical slice (Beam-Card model, research/ember-model.md).
// A run = ONE intrusion on ONE memory block. You pick a jack-in, draw a blind
// loadout, slot cards into a merged beam, aim the turret at a column, fire a single
// packet, and WATCH it spread + reproduce against the descending trace. Win or get
// traced; either way you bank meta, draft/shop, and jack in again. The deck grows
// between runs.

import { mulberry32, shuffle } from './rng.js';
import { startingDeck, DRAFT_POOL, SHOP_CARDS, CARDS } from './cards.js';
import { SHOP_ITEMS, DECK_CARD, CARD_UNLOCK } from './shop.js';
import { createNode, fire, stepBattle, coverage, aimColAt, REDRAW_COST, SLOTS,
  rewardMult, draftPicks, AGGRO_BASE, AGGRO_STEP, AGGRO_MIN, AGGRO_MAX, AGGRO_REDUCE_COST } from './battle.js';
import { buildScreen } from './render.js';
import { composeBoard, detonate, setReducedMotion } from './juice.js';
import { createTrauma } from './shake.js';
import { installPointer } from './input.js';
import { HAND_CARDS, DRAFT_CARDS, BTN_REDRAW, BTN_UNDO, BTN_START, BTN_FIRE, BTN_CONTINUE,
  BTN_AGGRO_DOWN, BTN_AGGRO_UP, shopRow, BTN_JACKIN, inRect } from './layout.js';
import { generateMachineUpTo, FIELD_W, WIN_COVERAGE } from './terrain.js';
import { sfx, resumeAudio } from './audio.js';

const screen = document.getElementById('screen');
const crtEl = document.querySelector('.crt');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Watch-phase pace: ms per sim tick (emit → spread → scan). A battle resolves in
// ~45–140 sim ticks, so this maps to a ~6 s blowout … ~18 s nail-biter — the watch
// length self-scales with the drama. Balance is wall-clock-invariant (win/lose is
// decided by per-tick RATIOS), so this only sets duration, never the outcome.
const TICK_MS = 130;

// --- game feel (research/juice-model.md) ---
const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
setReducedMotion(reduceMotion);
const trauma = createTrauma();
const kick = (amount) => { if (!reduceMotion) trauma.add(amount); };
const ROOT_KEY = 'override.root';
const DECK_KEY = 'override.deck';
const PLAYS_KEY = 'override.plays';

const game = {
  phase: 'assemble', run: null, node: null,
  program: new Array(SLOTS).fill(null), selection: [], hand: [], draft: [],
  message: '', bannerLines: [], seed: 0, redrawCount: 0,
};

const loadRoot = () => parseInt(localStorage.getItem(ROOT_KEY) || '120', 10) || 120;
const saveRoot = (v) => localStorage.setItem(ROOT_KEY, String(v));
const loadDeck = () => {
  const raw = localStorage.getItem(DECK_KEY);
  return raw ? JSON.parse(raw).map((id) => ({ ...CARDS[id] })).filter((c) => c.id) : startingDeck();
};
const saveDeck = (deck) => localStorage.setItem(DECK_KEY, JSON.stringify(deck.map((c) => c.id)));
const loadPlays = () => parseInt(localStorage.getItem(PLAYS_KEY) || '0', 10) || 0;
const savePlays = (v) => localStorage.setItem(PLAYS_KEY, String(v));
const clock = () => performance.now();
const paint = (now) => { screen.innerHTML = composeBoard(buildScreen(game, now), game, now); };
const draw = () => paint(clock());

// --- ROOT shop persistence ---
const CARDS_KEY = 'override.cards';
const RETRY_KEY = 'override.retry';
const OC_KEY = 'override.overclock';
const loadJSON = (k, d) => { const r = localStorage.getItem(k); return r ? JSON.parse(r) : d; };
const unlockedCards = () => loadJSON(CARDS_KEY, []);
const loadRetry = () => parseInt(localStorage.getItem(RETRY_KEY) || '0', 10) || 0;
const saveRetry = (v) => localStorage.setItem(RETRY_KEY, String(v));

const draftPool = () => DRAFT_POOL.concat(unlockedCards().map((id) => SHOP_CARDS[id]).filter(Boolean));

function shopOwned(item) {
  if (item.kind === 'card') return unlockedCards().includes(CARD_UNLOCK[item.id]);
  return false;   // deck-adds / consumables are repeatable
}

// Onboarding ramp: fixed tutorial curve keyed to runs started (not rubber-banding).
function onboardingBase(plays) {
  const EASY = 0.5, REAL = AGGRO_BASE;
  if (plays <= 1) return EASY;
  if (plays >= 6) return REAL;
  return +(EASY + (REAL - EASY) * ((plays - 1) / 5)).toFixed(2);
}

// Terrain difficulty CEILING keyed to runs started — the block generator rerolls
// until it's at most this tier. The opening levels are forced gentle (RNG can't
// hand a new player an unwinnable BRUTAL wall), lifting to fully-random by run 7.
// Same tutorial window as onboardingBase — after that the procedural spread opens up.
function difficultyCeil(plays) {
  if (plays <= 1) return 'EASY';    // first two runs: guaranteed a soft block
  if (plays <= 3) return 'MED';     // then let it climb
  if (plays <= 5) return 'HARD';
  return 'BRUTAL';                  // run 7+: any block the generator rolls
}

function startRun() {
  const plays = loadPlays();
  const machine = generateMachineUpTo((Date.now() ^ 0x9e3779b9) >>> 0, difficultyCeil(plays));
  game.seed = machine.seed;                          // adopt the chosen block's seed for hand/draft RNG
  let baseAggro = onboardingBase(plays);
  const overclock = localStorage.getItem(OC_KEY) === '1';
  if (overclock) { localStorage.removeItem(OC_KEY); baseAggro = Math.min(AGGRO_MAX, +(baseAggro + 0.25).toFixed(2)); }
  game.run = {
    tier: 1, root: loadRoot(), deck: loadDeck(),
    machine,
    aggression: baseAggro, baseAggro, pendingDrafts: 0, plays,
    overclockPool: overclock ? 300 : 0, retry: loadRetry(),
  };
  savePlays(plays + 1);
  trauma.reset();
  game.node = null;
  game.bannerLines = [];
  newAssemble();                                   // straight into the loadout — no character picker
  if (overclock) { game.message = 'OVERCLOCK: bigger REACH, faster trace.'; draw(); }
}

function dealHand() {
  const r = game.run;
  const rng = mulberry32((game.seed ^ (r.plays * 40503) ^ (game.redrawCount * 2246822519)) >>> 0);
  game.hand = shuffle(r.deck, rng).slice(0, 5).map((c) => ({ name: c.name, card: c, used: false }));
  game.program = new Array(SLOTS).fill(null);
  game.selection = [];
}

function newAssemble() {
  game.node = null;
  game.redrawCount = 0;
  dealHand();
  game.message = '';
  game.bannerLines = [];
  game.phase = 'assemble';
  draw();
}

function redraw() {
  if (game.phase !== 'assemble') return;
  const r = game.run;
  if (r.root < REDRAW_COST) { game.message = `need ${REDRAW_COST} ROOT to redraw.`; draw(); return; }
  r.root -= REDRAW_COST; saveRoot(r.root);
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
  game.message = 'the turret sweeps — time your LAUNCH.';
  sfx.ui();
  draw();
}

// LAUNCH: fire at the turret's column at THIS instant (same clock the render uses,
// so the packet leaves from exactly where the turret is drawn).
function launch() {
  if (game.phase !== 'target') return;
  fireAt(aimColAt(clock()));
}

function raiseAggro() {
  if (game.phase !== 'target' || game.run.aggression >= AGGRO_MAX) return;
  game.run.aggression = +(game.run.aggression + AGGRO_STEP).toFixed(2);
  sfx.ui(); draw();
}
function lowerAggro() {
  if (game.phase !== 'target' || game.run.aggression <= AGGRO_MIN) return;
  if (game.run.root < AGGRO_REDUCE_COST) { game.message = `need ${AGGRO_REDUCE_COST} ROOT to de-risk.`; draw(); return; }
  game.run.root -= AGGRO_REDUCE_COST; saveRoot(game.run.root);
  game.run.aggression = +(game.run.aggression - AGGRO_STEP).toFixed(2);
  sfx.ui(); draw();
}

// Fire the turret at a block column (0..FIELD_W-1). This commits the run's single packet.
function fireAt(blockCol) {
  const r = game.run;
  const triggerCol = Math.max(0, Math.min(FIELD_W - 1, blockCol | 0));
  game.node = createNode(r.machine, 0, r.aggression, r.baseAggro, game.program.slice(),
    { triggerCol, poolBonus: r.overclockPool });
  game.phase = 'exec';
  startExec();
}

async function startExec() {
  resumeAudio();
  sfx.exec();
  const node = game.node;
  game.message = 'WATCH — the beam spreads; hold coverage through the breach.';
  await sleep(200);
  fire(node);
  kick(0.35);
  draw();
  await sleep(200);

  let lastHoney = 0, wasBreaching = false, breached = false;
  while (!node.outcome) {
    const snap = stepBattle(node);
    if (node.sim.honeyBurned > lastHoney) { lastHoney = node.sim.honeyBurned; sfx.honeypot(); kick(0.4); }
    if (snap.breachLeft >= 0 && !wasBreaching) {
      wasBreaching = true;
      if (!breached) { breached = true; sfx.crack(); if (!reduceMotion) detonate(clock(), 0.7); kick(0.5); }
    } else if (snap.breachLeft < 0) wasBreaching = false;
    draw();
    await sleep(TICK_MS);   // pacing is NOT a motion effect — reduced-motion only drops shake/flash (via kick/detonate guards), not the watch itself
  }
  if (node.outcome === 'lose') { sfx.flatline(); kick(0.9); }
  showResult();
}

function showResult() {
  const node = game.node, r = game.run;
  game.phase = 'result';
  node.crack = coverage(node.sim);
  if (node.outcome === 'win') {
    const mult = rewardMult(node.aggro, node.baseAggro);
    const overkill = Math.round(Math.max(0, node.crack - WIN_COVERAGE) * mult);   // coverage past 50% pays extra
    const reward = Math.round(50 * mult) + overkill;
    r.root += reward; saveRoot(r.root);
    r.pendingDrafts = draftPicks(node.aggro, node.baseAggro);
    kick(0.7);
    sfx.lock(); sfx.win();
    game.bannerLines = ['>> THE MACHINE BREACHED <<', `+${reward} ROOT · ${r.pendingDrafts} card draft`];
    game.message = `breached at ${node.crack.toFixed(0)}% (aggro x${node.aggro.toFixed(2)}).`;
  } else if (r.retry > 0) {
    r.retry -= 1; saveRetry(r.retry);
    game.retried = true;
    sfx.ui();
    game.bannerLines = ['>> TRACED — RETRY TOKEN spent <<', `you slip away · ${r.retry} tokens left`];
    game.message = 'close call.';
  } else {
    sfx.lose();
    const kept = Math.floor(r.root * 0.5); saveRoot(kept);
    game.bannerLines = ['>> TRACED — they found you <<', `banked ${kept} ROOT`];
    game.message = 'run over.';
  }
  draw();
}

function advance() {
  if (game.node.outcome === 'win') startDraft();      // bank a card, then the shop
  else if (game.retried) { game.retried = false; newAssemble(); }   // retry: re-run the same block
  else openShop();
}

// --- ROOT shop ---
function refreshShop() {
  if (game.run) game.run.root = loadRoot();
  game.shopData = {
    root: loadRoot(), retry: loadRetry(), overclock: localStorage.getItem(OC_KEY) === '1',
    items: SHOP_ITEMS.map((it) => ({ id: it.id, name: it.name, desc: it.desc, cost: it.cost, kind: it.kind, owned: shopOwned(it) })),
  };
}
function openShop() {
  game.phase = 'shop';
  game.bannerLines = [];
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
  if (root < item.cost) { game.message = `need ${item.cost} ROOT.`; sfx.undo(); draw(); return; }
  saveRoot(root - item.cost);
  if (item.kind === 'deckcard') { game.run.deck.push({ ...CARDS[DECK_CARD[item.id]] }); saveDeck(game.run.deck); }
  else if (item.kind === 'card') { const u = unlockedCards(); u.push(CARD_UNLOCK[item.id]); localStorage.setItem(CARDS_KEY, JSON.stringify(u)); }
  else if (item.kind === 'retry') { saveRetry(loadRetry() + 1); }
  else if (item.kind === 'curse') { localStorage.setItem(OC_KEY, '1'); }
  sfx.lock();
  game.message = `bought ${item.name}.`;
  refreshShop();
  draw();
}

function startDraft() {
  const rng = mulberry32((game.seed ^ (game.run.plays * 777) ^ (game.run.pendingDrafts * 131071)) >>> 0);
  game.draft = shuffle(draftPool(), rng).slice(0, 3);
  game.phase = 'draft';
  game.bannerLines = [];
  game.message = game.run.pendingDrafts > 1 ? `${game.run.pendingDrafts} picks left (aggression bonus)` : '';
  draw();
}
function pickDraft(i) {
  if (game.phase !== 'draft' || !game.draft[i]) return;
  game.run.deck.push({ ...game.draft[i] });
  saveDeck(game.run.deck);
  sfx.lock();
  game.run.pendingDrafts -= 1;
  if (game.run.pendingDrafts > 0) { startDraft(); return; }
  openShop();                                          // draft done → the shop → jack in again
}

// --- pointer input (mouse + touch) ---
function onTapCell(col, row) {
  resumeAudio();
  if (game.phase === 'assemble') {
    for (let i = 0; i < HAND_CARDS.length; i++) if (inRect(col, row, HAND_CARDS[i])) return loadSlot(i);
    if (inRect(col, row, BTN_REDRAW)) return redraw();
    if (inRect(col, row, BTN_UNDO)) return undoSlot();
    if (inRect(col, row, BTN_START)) return gotoTarget();
  } else if (game.phase === 'target') {
    if (inRect(col, row, BTN_AGGRO_DOWN)) return lowerAggro();
    if (inRect(col, row, BTN_AGGRO_UP)) return raiseAggro();
    if (inRect(col, row, BTN_FIRE)) return launch();   // LAUNCH at the swinging turret
  } else if (game.phase === 'draft') {
    for (let i = 0; i < DRAFT_CARDS.length; i++) if (inRect(col, row, DRAFT_CARDS[i])) return pickDraft(i);
  } else if (game.phase === 'shop') {
    for (let i = 0; i < SHOP_ITEMS.length; i++) if (inRect(col, row, shopRow(i))) return buyShop(SHOP_ITEMS[i].id);
    if (inRect(col, row, BTN_JACKIN)) return startRun();
  } else if (game.phase === 'result') {
    if (inRect(col, row, BTN_CONTINUE)) return advance();
  }
}
installPointer(screen, onTapCell);

// --- keyboard (desktop) ---
window.addEventListener('keydown', (e) => {
  resumeAudio();
  const k = e.key;
  if (game.phase === 'assemble') {
    if (k >= '1' && k <= '5') loadSlot(+k - 1);
    else if (k === 'r' || k === 'R') redraw();
    else if (k === 'Backspace') { e.preventDefault(); undoSlot(); }
    else if (k === 'Enter') gotoTarget();
  } else if (game.phase === 'target') {
    if (k === 'Enter' || k === ' ') launch();          // LAUNCH at the swinging turret
    else if (k === '+' || k === '=') raiseAggro();
    else if (k === '-' || k === '_') lowerAggro();
  } else if (game.phase === 'draft') {
    if (k >= '1' && k <= '3') pickDraft(+k - 1);
  } else if (game.phase === 'shop') {
    if (k >= '1' && k <= '9') { const i = +k - 1; if (SHOP_ITEMS[i]) buyShop(SHOP_ITEMS[i].id); }
    else if (k === 'Enter') startRun();
  } else if (game.phase === 'result') {
    if (k === 'Enter') advance();
  }
});

// pulse loop: repaint while the field is live so captures breathe; shake every frame.
// repaint continuously during AIM (the turret pulses) and the live watch
const needsAnim = () => game.phase === 'target' || (game.node && (game.phase === 'exec' || game.phase === 'result'));
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
