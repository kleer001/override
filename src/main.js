// OVERRIDE — Tier-1 vertical slice.
// A run = conquering the three sectors of THE MACHINE, one at a time. You draw a
// blind loadout, see all three terrains, and choose which to assault.

import { mulberry32, shuffle } from './rng.js';
import { startingDeck, BASE_DRAFT_POOL, SHOP_CARDS, CARDS } from './cards.js';
import { SHOP_ITEMS, CHAR_UNLOCK, CARD_UNLOCK } from './shop.js';
import { generateMachine, newCode, createNode, beginVolley, planVolley, advanceScan, resolveVolley, REDRAW_COST,
  rewardMult, draftPicks, AGGRO_BASE, AGGRO_STEP, AGGRO_MIN, AGGRO_MAX, AGGRO_REDUCE_COST } from './battle.js';
import { buildScreen } from './render.js';
import { composeBoard, detonate, setReducedMotion } from './juice.js';
import { createTrauma } from './shake.js';
import { installPointer } from './input.js';
import { HAND_CARDS, DRAFT_CARDS, BTN_REDRAW, BTN_UNDO, BTN_EXEC, BTN_CONTINUE, SECTOR_RECTS, BTN_AGGRO_DOWN, BTN_AGGRO_UP, shopRow, BTN_JACKIN, inRect } from './layout.js';
import { CHARACTERS } from './characters.js';
import { WIN_COVERAGE, sectorStats, FIELD_W } from './terrain.js';
import { sfx, resumeAudio } from './audio.js';

const screen = document.getElementById('screen');
const crtEl = document.querySelector('.crt');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GROW_MS = 14; // per-cell reveal — an ember lands then grows one cell at a time
const DET_HOLD = 90; // pass-hold: extra ms the frame freezes when a mult detonates

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
  program: [null, null, null], selection: [], hand: [], draft: [],
  playhead: -1, prompt: '', message: '', seed: 0, redrawCount: 0,
  // scanning gnomon: an automated targeting crosshair that sweeps the arena to
  // place each trace-ember (the player watches it aim, they don't drive it).
  // It stays live for the whole EXEC phase, roving between candidate ignition
  // points so the arena always reads as "being scanned"; when a real ember is
  // ready it locks onto that site, blooms, then resumes hunting. Fields:
  //   active  — the reticle is on the board
  //   beams   — the long crosshair lines show (off during a bloom so they don't
  //             cover the ember; on while travelling/locking toward a mark)
  //   locking — an ember placement owns the position (the glide stands down)
  //   tx,ty   — the NEXT precomputed mark it's gliding toward (null = hold)
  gnomon: { x: null, y: null, active: false, beams: false, locking: false, tx: null, ty: null },
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
const draftPool = () => BASE_DRAFT_POOL.concat(unlockedCards().map((id) => SHOP_CARDS[id]).filter(Boolean));

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
    availChars: availChars(), overclockEnergy: overclock ? 2 : 0, retry: loadRetry(),
  };
  savePlays(plays + 1);
  trauma.reset();                     // never carry shake across runs
  game.node = null;
  game.phase = 'charselect';
  game.prompt = overclock ? 'OVERCLOCK ARMED — hotter pings, faster trace this run.' : '';
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
  game.node = createNode(game.run.machine, si, game.run.char, game.run.aggression, game.run.baseAggro, game.run.overclockEnergy);
  game.phase = 'exec';
  startExec();
}

const GNOMON_MS = 22;       // per-step of the gnomon's lock-on sweep
const GNOMON_GLIDE = 0.02;  // cells/ms — travel speed toward the next known mark

// Point the crosshair at the i-th precomputed mark of this volley (or hold in
// place if there's no such mark). The glide (below) and the lock-on sweep both
// home on gn.tx/ty, so setting it here is how the gnomon "knows" its next mark.
function aimGnomonAt(marks, i) {
  const gn = game.gnomon, mk = marks[i];
  if (mk && mk.anchor != null) { gn.tx = mk.anchor % FIELD_W; gn.ty = (mk.anchor / FIELD_W) | 0; }
  else { gn.tx = null; gn.ty = null; }
}
// Between locks — including while the 3-card program is still computing — glide
// the crosshair toward its next mark so it's always deliberately heading to the
// spot the next ember will land, not wandering. Driven per-frame from the anim
// loop so it keeps moving through the awaited beats. Holds once arrived (the
// strike sweep finishes the last fraction and locks).
function stepGnomonScan(dt) {
  const gn = game.gnomon, node = game.node;
  if (!node || game.phase !== 'exec' || !gn.active || gn.locking || gn.x == null) return;
  if (reduceMotion || gn.tx == null) return;                  // no target / reduced motion: hold
  const dx = gn.tx - gn.x, dy = gn.ty - gn.y, dist = Math.hypot(dx, dy);
  if (dist < 0.5) return;                                      // arrived — wait for the strike
  const step = Math.min(dist, GNOMON_GLIDE * dt);
  gn.x += (dx / dist) * step; gn.y += (dy / dist) * step;
}

// The automated targeting crosshair travels from its last position to (tx,ty)
// with a smoothstep ease, then locks on — this is the "aim" the player watches
// instead of driving. Cells still come from planLob (random placement); the
// gnomon just makes the placement legible and deliberate. Snaps under reduced
// motion. locking = true parks the idle drift so this owns the position.
async function sweepGnomon(tx, ty) {
  const gn = game.gnomon;
  gn.active = true; gn.beams = true; gn.locking = true;       // beams on while it travels + locks
  if (gn.x == null) { gn.x = tx; gn.y = ty; }                 // first lob: crosshair snaps in
  const sx = gn.x, sy = gn.y;
  const dist = Math.abs(tx - sx) + Math.abs(ty - sy);
  const steps = reduceMotion ? 1 : Math.min(9, Math.max(2, Math.round(dist / 5)));
  for (let s = 1; s <= steps; s++) {
    const e = s / steps, k = e * e * (3 - 2 * e);             // smoothstep
    gn.x = Math.round(sx + (tx - sx) * k);
    gn.y = Math.round(sy + (ty - sy) * k);
    draw();
    await sleep(GNOMON_MS);
  }
  gn.x = tx; gn.y = ty;
  sfx.ping();                                                  // radar lock on the target
  draw();
  await sleep(reduceMotion ? 0 : 60);                          // a beat on the locked crosshair
}

async function startExec() {
  resumeAudio();
  sfx.exec();
  const node = game.node;
  // fresh scan per node: the crosshair jacks in at the sector entry and is live
  // immediately for the whole burn (stepGnomonScan glides it toward each mark).
  game.gnomon = { x: node.sector.entry.x, y: node.sector.entry.y, active: true, beams: true, locking: false, tx: null, ty: null };
  await sleep(220);
  while (!node.outcome) {
    const ev = beginVolley(node, game.program.slice());
    // The program's energy is now known, so every strike this volley is known:
    // precompute all marks and start aiming at the first while the 3 cards are
    // still processing — the gnomon leads the salvo it's about to fire.
    const marks = planVolley(node);
    aimGnomonAt(marks, 0);
    for (let i = 0; i < 3; i++) {
      game.playhead = i;
      const card = game.program[i];
      const k = card.kind;
      if (k === 'mult') {
        // DETONATION (§3 ▅): sound + flash + shake + pass-hold, all on one frame.
        sfx.mult(card.value);
        const power = Math.min(1, node.energy / 120) * (card.value / 2); // ∝ result & multiplier
        kick(0.35 + 0.45 * power);
        if (!reduceMotion) detonate(clock(), 0.6 + power);
        draw();
        await sleep(190 + (reduceMotion ? 0 : DET_HOLD));               // freeze so the hit lands
      } else {
        if (k === 'fork') sfx.fork();
        else if (k === 'interrupt') sfx.ice();
        else sfx.add(i);
        draw();
        await sleep(190);
      }
    }
    game.playhead = -1;
    const before = node.crack;
    const honeyBefore = node.honeyHit;
    for (let m = 0; m < marks.length; m++) { // fire the salvo mark by mark
      const { anchor, cells } = marks[m];
      if (anchor == null || !cells.length) { await sleep(GROW_MS * 3); continue; }
      await sweepGnomon(anchor % FIELD_W, (anchor / FIELD_W) | 0); // finish the glide + lock on
      game.gnomon.beams = false; // drop the long beams; the reticle rides the target through the bloom
      const hit = clock(); // cluster anchor — the whole ember shares this pulse phase
      for (const c of cells) {
        node.machine.burned[c] = 1;
        node.machine.bornAt[c] = hit;
        node.crack = sectorStats(node.machine, node.sector).pct;
        draw();
        await sleep(GROW_MS);
      }
      // ember placed — release the lock and aim at the next mark so the gnomon is
      // already gliding toward the next strike (beams back on).
      game.gnomon.locking = false; game.gnomon.beams = true;
      aimGnomonAt(marks, m + 1);
    }
    advanceScan(node); // the trace scan descends + reclaims (gnomon keeps scanning)
    draw();
    await sleep(140);
    resolveVolley(node, ev);
    if (node.crack > before) sfx.crack();
    if (node.honeyHit > honeyBefore) { sfx.honeypot(); kick(0.5); } // ▄ warning jolt — a bad surprise
    draw();
    await sleep(260);
  }
  game.gnomon.active = false;                                       // burn resolved — scan powers down
  if (node.outcome === 'lose') { sfx.flatline(); kick(0.9); }        // █ trace doom — caught
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
    for (let i = 0; i < SECTOR_RECTS.length; i++) if (inRect(col, row, SECTOR_RECTS[i])) return chooseSector(i);
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
    if (k >= '1' && k <= '3') chooseSector(+k - 1);
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
  stepGnomonScan(dt);   // keep the crosshair roving between entry points every frame
  if (needsAnim() && t - lastPaint >= 33) { lastPaint = t; paint(t); }
  requestAnimationFrame(animLoop);
}
requestAnimationFrame(animLoop);

startRun();
draw();
