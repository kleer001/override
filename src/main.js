// OVERRIDE — Tier-1 vertical slice (Beam-Card model, research/lsystem-growth.md).
// A run = ONE intrusion on ONE memory block. You pick a jack-in, draw a blind
// loadout, slot cards into an ordered connector chain, aim the turret at a column,
// fire a single packet, and WATCH the L-system strands grow against the descending
// trace. Win or get traced; either way you bank meta, draft/shop, and jack in
// again. The deck grows between runs.

import { mulberry32, shuffle } from './rng.js';
import { DRAFT_POOL, SHOP_CARDS, CARDS, cardFromGrammar, AUTHORED_ID } from './cards.js';
import { SHOP_ITEMS, DECK_CARD, CARD_UNLOCK } from './shop.js';
import { createNode, fire, stepBattle, coverage, aimColAt, REDRAW_COST, SLOTS,
  blankMachine, createTestSim, stepSim, coverageReward, SURVIVAL_REWARD,
  draftPicks, AGGRO_STEP, AGGRO_MIN, AGGRO_MAX, AGGRO_REDUCE_COST } from './battle.js';
import { buildScreen, FX_MS } from './render.js';
import { composeBoard, detonate, setReducedMotion } from './juice.js';
import { createTrauma } from './shake.js';
import { installPointer } from './input.js';
import { HAND_CARDS, DRAFT_CARDS, BTN_REDRAW, BTN_TEST, BTN_TEST_RESET, BTN_TEST_PLAY,
  BTN_START, BTN_FIRE, AUTHOR_SYMS, BTN_AUTHOR_DEL, BTN_AUTHOR_RUN,
  BTN_AGGRO_DOWN, BTN_AGGRO_UP, shopRow, BTN_JACKIN, BTN_TITLE_CONTINUE, BTN_TITLE_NEW, BTN_SKIP, BTN_READY, inRect } from './layout.js';
import { generateMachineUpTo, FIELD_W } from './terrain.js';
import { sfx, resumeAudio } from './audio.js';
import { ESSAY, QUESTION, REFUSAL, MONOLOGUE, VOICE, CINE, blockChars } from './intro.js';

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
const WINS_KEY = 'override.wins';
// Bump when the STARTER deck definition changes so a stale saved deck (e.g. an old
// XOR-laden starter) is wiped and the new starter takes effect on next load.
const DECK_VERSION_KEY = 'override.deckver';
const DECK_VERSION = '2';
if (localStorage.getItem(DECK_VERSION_KEY) !== DECK_VERSION) {
  localStorage.removeItem(DECK_KEY);
  localStorage.setItem(DECK_VERSION_KEY, DECK_VERSION);
}

const game = {
  phase: 'assemble', run: null, node: null,
  program: new Array(SLOTS).fill(null), selection: [], hand: [], draft: [],
  testSim: null, testMachine: null,
  authorGrammar: '', authorPreview: null, authoring: false,
  cine: null, cineSkip: false, cineReady: false,   // cold-open cinematic beat state
  message: '', bannerLines: [], seed: 0, redrawCount: 0,
  fx: [], reduceMotion,                       // device-detonation FX buffer (presentation-only)
};

// Lean start: a fresh player opens with 0 ROOT and authors their first card (no
// handed-out deck). ROOT is banked per run in proportion to coverage.
const loadRoot = () => parseInt(localStorage.getItem(ROOT_KEY) || '0', 10) || 0;
const saveRoot = (v) => localStorage.setItem(ROOT_KEY, String(v));

// --- The authored first card: its grammar persists on its own; the deck stores ids
// (AUTHORED_ID for the authored card) and rehydrates through cardFromGrammar. ---
const AUTHORED_KEY = 'override.authored';       // the player's committed first-card grammar
const isAuthored = () => !!localStorage.getItem(AUTHORED_KEY);
const authoredCard = () => cardFromGrammar(localStorage.getItem(AUTHORED_KEY) || 'F');
const rehydrate = (id) => (id === AUTHORED_ID ? authoredCard() : { ...CARDS[id] });
const loadDeck = () => {
  const raw = localStorage.getItem(DECK_KEY);
  return raw ? JSON.parse(raw).map(rehydrate).filter((c) => c && c.id) : [];
};
const saveDeck = (deck) => localStorage.setItem(DECK_KEY, JSON.stringify(deck.map((c) => c.id)));

// --- COLLISION DETECTION: the base upgrade that flips survival play into coverage
// play (see stepSim / beamParams / difficulty gating). Persisted once bought. ---
const CD_KEY = 'override.collision';
const hasCollision = () => localStorage.getItem(CD_KEY) === '1';
const loadPlays = () => parseInt(localStorage.getItem(PLAYS_KEY) || '0', 10) || 0;
const savePlays = (v) => localStorage.setItem(PLAYS_KEY, String(v));
const loadWins = () => parseInt(localStorage.getItem(WINS_KEY) || '0', 10) || 0;
const saveWins = (v) => localStorage.setItem(WINS_KEY, String(v));
const clock = () => performance.now();
const paint = (now) => {
  if (game.fx.length) game.fx = game.fx.filter((f) => now - f.at < FX_MS);   // drop spent detonation motion
  screen.innerHTML = composeBoard(buildScreen(game, now), game, now);
};
const draw = () => paint(clock());

// --- ROOT shop persistence ---
const CARDS_KEY = 'override.cards';
const RETRY_KEY = 'override.retry';
const loadJSON = (k, d) => { const r = localStorage.getItem(k); return r ? JSON.parse(r) : d; };
const unlockedCards = () => loadJSON(CARDS_KEY, []);
const loadRetry = () => parseInt(localStorage.getItem(RETRY_KEY) || '0', 10) || 0;
const saveRetry = (v) => localStorage.setItem(RETRY_KEY, String(v));

const draftPool = () => DRAFT_POOL.concat(unlockedCards().map((id) => SHOP_CARDS[id]).filter(Boolean));

function shopOwned(item) {
  if (item.kind === 'card') return unlockedCards().includes(CARD_UNLOCK[item.id]);
  if (item.kind === 'upgrade') return item.id === 'collision' && hasCollision();
  return false;   // deck-adds / consumables are repeatable
}

// --- Dynamic difficulty (DDA): the trace-scan baseline adapts to the player. ---
// We don't trust a fixed win% guess — the baseline aggression nudges UP a little on
// a breach and DOWN a little on a loss, converging on the win rate implied by the
// step ratio: p·UP = (1−p)·DOWN → p = DOWN/(UP+DOWN). With 0.04/0.03 that's ~43%
// ("about half, not more"). Kept as the BASELINE the player still dials from, and
// clamped to a band so it can't run away. Persisted across runs.
const AGGRO_KEY = 'override.aggro';
const DDA_START = 0.30, DDA_UP = 0.04, DDA_DOWN = 0.03, DDA_MIN = 0.20, DDA_MAX = 0.65;
const clampDDA = (v) => Math.max(DDA_MIN, Math.min(DDA_MAX, v));
const loadAggro = () => clampDDA(parseFloat(localStorage.getItem(AGGRO_KEY)) || DDA_START);
const saveAggro = (v) => localStorage.setItem(AGGRO_KEY, clampDDA(v).toFixed(2));
// nudge the persisted baseline after an outcome (applies to the NEXT run).
const adaptAggro = (won) => saveAggro(loadAggro() + (won ? DDA_UP : -DDA_DOWN));

// Terrain difficulty CEILING keyed to CONQUERS (coverage wins only — survival wins
// don't count, so buying collision detection drops you onto a fresh EASY *walled*
// block, not a BRUTAL one). The block generator rerolls until it's at most this tier,
// so RNG can't hand you an unwinnable wall before you're ready.
function difficultyCeil(conquers) {
  if (conquers <= 0) return 'EASY';    // just got collision: a soft walled block to learn on
  if (conquers === 1) return 'MED';
  if (conquers === 2) return 'HARD';
  return 'BRUTAL';                      // 3+ conquers: any block the generator rolls
}

function startRun() {
  const plays = loadPlays(), wins = loadWins();
  // Pre-collision runs (incl. the tutorial) are on a blank block — literal turtles
  // can't navigate walls yet, so there are none. Post-collision, terrain returns.
  const seed = (Date.now() ^ 0x9e3779b9) >>> 0;
  const machine = hasCollision() ? generateMachineUpTo(seed, difficultyCeil(wins)) : blankMachine(seed, 'YOUR MACHINE');
  game.seed = machine.seed;                          // adopt the chosen block's seed for hand/draft RNG
  const baseAggro = loadAggro();                      // adaptive baseline (DDA), tuned by past outcomes
  game.run = {
    tier: 1, root: loadRoot(), deck: loadDeck(),
    machine,
    aggression: baseAggro, baseAggro, pendingDrafts: 0, plays, wins,
    retry: loadRetry(),
  };
  savePlays(plays + 1);
  trauma.reset();
  game.node = null;
  game.bannerLines = [];
  if (isAuthored()) newAssemble();                 // returning player → the loadout
  else playColdOpen();                             // first ever run → the recruitment cinematic → author
}

// --- COLD OPEN (research/intro-script.md): the fresh-save-only recruitment cinematic.
// Sequences the beats with sleeps; each beat's on-screen text reveals itself from the
// wall clock (drawColdOpen), so the anim loop drives the typewriter. A deliberate SKIP
// (button / Esc / Enter) aborts the chain and drops straight into the author tutorial.
async function playColdOpen() {
  game.node = null;
  game.cineSkip = false; game.cineReady = false;
  game.message = ''; game.bannerLines = [];
  resumeAudio();
  const rm = game.reduceMotion;
  const typeDur = (lines, ms) => (rm ? 600 : blockChars(lines) * ms);
  sfx.ui();
  if (!await cineBeat('citizen', typeDur(ESSAY, CINE.essayMs) + (rm ? 400 : CINE.holdShort))) return;
  sfx.flatline();
  if (!await cineBeat('blackout', (rm ? 500 : CINE.powerMs) + CINE.holdBlack)) return;
  sfx.ui();
  if (!await cineBeat('question', typeDur(QUESTION, CINE.qMs) + CINE.qHold)) return;
  sfx.crack();
  if (!await cineBeat('refusal', (rm ? 400 : REFUSAL.length * CINE.noMs) + CINE.holdBlack)) return;
  sfx.exec();
  if (!await cineBeat('contact', typeDur(MONOLOGUE, CINE.monoMs) + (rm ? 300 : 500))) return;
  game.cineReady = true;                         // contact done — the player reads, then taps I'M READY
  sfx.ui();
  draw();
}
// Hold on one beat for durMs, bailing early if the player skipped. The anim loop
// repaints (needsAnim covers 'coldopen'); we only pace and watch for the skip.
async function cineBeat(beat, durMs) {
  game.phase = 'coldopen';
  game.cine = { beat, startedAt: clock() };
  draw();
  const end = clock() + durMs;
  while (clock() < end) {
    if (game.cineSkip) return false;
    await sleep(60);
  }
  return true;
}
function relightToAuthor() {
  game.cine = null; game.cineReady = false;
  newAuthor();
  game.message = VOICE.V1;   // the contact's parting line greets the author screen
  draw();
}
function skipColdOpen() {
  if (game.phase !== 'coldopen' || game.cineSkip) return;
  game.cineSkip = true;
  sfx.ui();
  relightToAuthor();
}

// The boot / title screen. CONTINUE resumes saved progress; NEW wipes it.
function showTitle() {
  game.phase = 'title';
  game.titleWins = loadWins();
  game.run = null; game.node = null; game.bannerLines = []; game.message = '';
  draw();
}
// Wipe every persisted key so NEW truly starts from zero (no deck — you re-author your
// first card, ROOT to 0, no collision detection). Keep the deck-version stamp current
// so the migration guard doesn't re-wipe on the next load.
function resetSave() {
  for (const k of [ROOT_KEY, DECK_KEY, PLAYS_KEY, WINS_KEY, AGGRO_KEY, CARDS_KEY, RETRY_KEY, AUTHORED_KEY, CD_KEY]) localStorage.removeItem(k);
  localStorage.setItem(DECK_VERSION_KEY, DECK_VERSION);
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

// Tap an unused hand card to slot it; tap a slotted card again to unload it
// (later slots compact up to keep the chain contiguous).
function toggleSlot(i) {
  if (game.phase !== 'assemble') return;
  const h = game.hand[i];
  if (!h) return;
  if (h.used) {
    const k = game.selection.indexOf(i);
    if (k < 0) return;
    game.selection.splice(k, 1);
    h.used = false;
    game.program = new Array(SLOTS).fill(null);
    game.selection.forEach((hi, j) => { game.program[j] = game.hand[hi].card; });
    sfx.undo();
  } else {
    if (game.selection.length >= SLOTS) return;
    game.program[game.selection.length] = h.card;
    game.selection.push(i);
    h.used = true;
    sfx.load();
  }
  draw();
}

// --- TEST bench: preview the slotted chain on a blank block (no scan) ---
async function startTest() {
  if (game.phase !== 'assemble' || !game.program.some(Boolean)) return;
  game.phase = 'test';
  game.testMachine = blankMachine();     // shown blank while the packet charges
  game.testSim = null;
  game.message = '';
  sfx.ui();
  draw();
  await sleep(500);
  if (game.phase !== 'test') return;     // player backed out during the charge
  fireTest();
}
function fireTest() {
  game.testSim = createTestSim(game.program);
  sfx.exec();
  testLoop(game.testSim);
}
async function testLoop(sim) {
  while (game.phase === 'test' && game.testSim === sim) {
    stepSim(sim);
    draw();
    if (!sim.turtles.length) break;      // every strand trapped — hold the picture
    await sleep(TICK_MS);
  }
}
function resetTest() {
  if (game.phase !== 'test' || !game.testSim) return;
  fireTest();                            // fresh blank block, no charge wait
}
function exitTest() {
  if (game.phase !== 'test') return;
  game.testSim = null;
  game.testMachine = null;
  game.phase = 'assemble';
  sfx.ui();
  draw();
}

// --- AUTHOR phase (first run only): type an F/L/R grammar, watch the literal turtle
// draw it, then RUN a survival battle. Win by keeping the self-avoiding thread alive
// to the scan-bottom. On win the card is kept (persisted); on a crash, revise and
// retry. This is where the player learns what the symbols do.
const GRAMMAR_MAX = 12;
function newAuthor() {
  game.phase = 'author';
  game.node = null;
  game.authoring = true;
  game.authorGrammar = '';           // always a blank slate — never carry the last recipe
  refreshAuthorPreview();
  game.message = '';
  game.bannerLines = [];
  draw();
}
// Draw the literal turtle to completion on a FRESH blank block so the field previews
// the exact self-avoiding (or self-crossing) shape the current grammar makes. Always
// builds its own sim (empty grammar → a clean empty board), so it never falls back to
// the run's machine and never shows a stale trail from a prior attempt.
function refreshAuthorPreview() {
  const g = game.authorGrammar;
  const sim = createTestSim(g ? [cardFromGrammar(g)] : [], false);   // literal (collision off)
  if (g) { let guard = 0; while (sim.turtles.length && guard++ < 3000) stepSim(sim); }
  game.authorPreview = sim;
}
function addAuthorSym(s) {
  if (game.phase !== 'author' || game.authorGrammar.length >= GRAMMAR_MAX) return;
  game.authorGrammar += s;
  refreshAuthorPreview();
  sfx.load();
  draw();
}
function delAuthorSym() {
  if (game.phase !== 'author' || !game.authorGrammar) return;
  game.authorGrammar = game.authorGrammar.slice(0, -1);
  refreshAuthorPreview();
  sfx.undo();
  draw();
}
function authorRun() {
  if (game.phase !== 'author') return;
  if (!game.authorGrammar.includes('F')) { game.message = 'add at least one F — the program has to move.'; draw(); return; }
  const card = cardFromGrammar(game.authorGrammar);
  game.run.deck = [card];                       // the card you're about to keep
  game.program = [card, null, null];
  game.run.machine.burned.fill(0);              // fresh board each attempt — no leftover trail to crash into
  fireAt((FIELD_W - 1) >> 1);                    // fire from centre — no aiming in the tutorial
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

// Fire the turret at a block column (0..FIELD_W-1). This commits the run's single
// packet. Collision state picks the whole regime (turtle / scan / win mode).
function fireAt(blockCol) {
  const r = game.run;
  const triggerCol = Math.max(0, Math.min(FIELD_W - 1, blockCol | 0));
  game.node = createNode(r.machine, 0, r.aggression, r.baseAggro, game.program.slice(), { triggerCol, collision: hasCollision() });
  game.phase = 'exec';
  startExec();
}

async function startExec() {
  resumeAudio();
  sfx.exec();
  const node = game.node;
  game.message = hasCollision()
    ? 'WATCH — the strands grow; hold coverage through the breach.'
    : 'WATCH — keep your thread alive until the trace hits bottom.';
  game.fx = [];
  await sleep(200);
  fire(node);
  kick(0.35);
  draw();
  await sleep(200);

  let lastHoney = 0, wasBreaching = false, breached = false;
  while (!node.outcome) {
    const snap = stepBattle(node);
    // device detonations: the combo/fireworks payload. Each blast records grid-native
    // motion (FX), a trauma kick and brightness surge scaled by the running combo, and
    // fires its sound — the unused mult() arpeggio for a driller, an ice noise for FREEZE.
    if (snap.detonations && snap.detonations.length) {
      for (const d of snap.detonations) {
        const combo = d.combo || 1;
        if (!reduceMotion) {
          game.fx.push({ ...d, at: clock() });
          detonate(clock(), Math.min(1.5, 0.6 + combo * 0.15));
        }
        kick(Math.min(1, 0.35 + combo * 0.12));
        if (d.type === 'FREEZE') sfx.ice(); else sfx.mult(Math.max(2, combo + 1));
      }
    }
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
  const won = node.outcome === 'win';
  const conquered = won && hasCollision();            // a real 50% breach (post-collision)
  // Coverage regime pays the high-water mark (area burned); survival regime pays a
  // flat bounty for staying alive (a thin line covers almost nothing).
  const reward = hasCollision()
    ? coverageReward(node.sim.peakCov, node.aggro, node.baseAggro)
    : (won ? SURVIVAL_REWARD : 0);
  r.root += reward; saveRoot(r.root);                 // ALWAYS bank ROOT — win or loss, no penalty
  adaptAggro(won);                                    // DDA: nudge the baseline for the NEXT run
  if (won) {
    if (game.authoring) { localStorage.setItem(AUTHORED_KEY, game.authorGrammar); saveDeck(r.deck); }   // keep the card
    kick(0.7); sfx.lock(); sfx.win();
    if (conquered) {
      r.wins += 1; saveWins(r.wins);                  // a breach lifts the terrain ceiling next run
      r.pendingDrafts = draftPicks(node.aggro, node.baseAggro);
      game.bannerLines = ['>> THE MACHINE BREACHED <<', `+${reward} ROOT · ${r.pendingDrafts} card draft`];
      game.message = `breached at ${node.crack.toFixed(0)}% (aggro x${node.aggro.toFixed(2)}).`;
    } else {
      game.bannerLines = ['>> YOUR THREAD SURVIVED <<', `+${reward} ROOT · program held`];
      game.message = 'alive when the trace hit bottom. buy COLLISION DETECTION to start conquering.';
    }
  } else if (r.retry > 0) {
    r.retry -= 1; saveRetry(r.retry);
    game.retried = true;
    sfx.ui();
    game.bannerLines = ['>> TRACED — RETRY TOKEN spent <<', `you slip away · ${r.retry} tokens left`];
    game.message = 'close call.';
  } else {
    sfx.lose();
    game.bannerLines = game.authoring
      ? ['>> THREAD CRASHED <<', 'try again — a fresh slate']
      : ['>> TRACED — they found you <<', `+${reward} ROOT banked`];
    game.message = game.authoring ? 'it crossed itself or ran off the block — try 3+ balanced turns.' : 'run over.';
  }
  draw();
}

function advance() {
  const won = game.node.outcome === 'win';
  if (game.authoring && !won) { newAuthor(); game.message = VOICE.Vc; draw(); return; }   // crashed mid-tutorial → the contact talks you back into the editor
  game.authoring = false;
  if (won && hasCollision()) startDraft();               // a real breach → bank a card, then the shop
  else if (game.retried) { game.retried = false; newAssemble(); }   // retry token: re-run the block
  else openShop();                                       // survival win / loss → straight to the shop
}

// --- ROOT shop ---
function refreshShop() {
  if (game.run) game.run.root = loadRoot();
  game.shopData = {
    root: loadRoot(), retry: loadRetry(),
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
  else if (item.kind === 'upgrade') { localStorage.setItem(CD_KEY, '1'); }
  sfx.lock();
  game.message = item.id === 'collision' ? 'COLLISION DETECTION online — jack in to conquer.' : `bought ${item.name}.`;
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
  if (game.phase === 'title') {
    if (inRect(col, row, BTN_TITLE_CONTINUE)) return startRun();
    if (inRect(col, row, BTN_TITLE_NEW)) { resetSave(); return startRun(); }
  } else if (game.phase === 'coldopen') {
    if (game.cineReady) return relightToAuthor();          // the I'M READY gate — tap to fight
    if (inRect(col, row, BTN_SKIP)) return skipColdOpen();
  } else if (game.phase === 'assemble') {
    for (let i = 0; i < HAND_CARDS.length; i++) if (inRect(col, row, HAND_CARDS[i])) return toggleSlot(i);
    if (inRect(col, row, BTN_REDRAW)) return redraw();
    if (inRect(col, row, BTN_TEST)) return startTest();
    if (inRect(col, row, BTN_START)) return gotoTarget();
  } else if (game.phase === 'test') {
    if (inRect(col, row, BTN_TEST_RESET)) return resetTest();
    if (inRect(col, row, BTN_TEST_PLAY)) return exitTest();
  } else if (game.phase === 'author') {
    for (const b of AUTHOR_SYMS) if (inRect(col, row, b)) return addAuthorSym(b.sym);
    if (inRect(col, row, BTN_AUTHOR_DEL)) return delAuthorSym();
    if (inRect(col, row, BTN_AUTHOR_RUN)) return authorRun();
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
    return advance();   // whole screen is the button — there's nothing else to do here
  }
}
installPointer(screen, onTapCell);

// --- keyboard (desktop) ---
window.addEventListener('keydown', (e) => {
  resumeAudio();
  const k = e.key;
  if (game.phase === 'title') {
    if (k === 'Enter' || k === 'c' || k === 'C') startRun();
    else if (k === 'n' || k === 'N') { resetSave(); startRun(); }
  } else if (game.phase === 'coldopen') {
    if (game.cineReady && (k === 'Enter' || k === ' ')) relightToAuthor();
    else if (k === 'Escape' || k === 'Enter' || k === ' ' || k === 's' || k === 'S') skipColdOpen();
  } else if (game.phase === 'assemble') {
    if (k >= '1' && k <= '5') toggleSlot(+k - 1);          // press again to unload
    else if (k === 'r' || k === 'R') redraw();
    else if (k === 't' || k === 'T') startTest();
    else if (k === 'Enter') gotoTarget();
  } else if (game.phase === 'test') {
    if (k === 'r' || k === 'R') resetTest();
    else if (k === 'Enter') exitTest();
  } else if (game.phase === 'author') {
    const u = k.toUpperCase();
    if (u === 'F' || u === 'L' || u === 'R') addAuthorSym(u);
    else if (k === 'Backspace') { e.preventDefault(); delAuthorSym(); }
    else if (k === 'Enter') authorRun();
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
const needsAnim = () => game.phase === 'coldopen' || game.phase === 'target' || game.phase === 'test' || (game.node && (game.phase === 'exec' || game.phase === 'result'));
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

showTitle();   // boot into the title screen — CONTINUE / NEW gate the first run
