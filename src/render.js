// Compose the whole 80x40 screen as three STATIC panels (they persist across every
// phase; only their contents swap): FIELD (the memory block), GUTTER (run state +
// controls), TRAY (cards). See src/layout.js for the geometry.

import { FIELD_W, FIELD_H, WALL, idx, WIN_COVERAGE, LANCE, NOVA, FREEZE } from './terrain.js';
import { crackPct, REDRAW_COST, rewardMult, draftPicks, AGGRO_REDUCE_COST, AGGRO_BASE, aimColAt, heatAt } from './battle.js';
import { buildChain, beamGutterLines, cardLines, cardLabel, CARDS } from './cards.js';
import {
  COLS, ROWS, FIELD, GUTTER, TRAY, FIELD_OX, FIELD_OY,
  HAND_CARDS, DRAFT_CARDS, BTN_REDRAW, BTN_TEST, BTN_TEST_RESET, BTN_TEST_PLAY,
  BTN_START, BTN_FIRE, BTN_CONTINUE, AUTHOR_SYMS, BTN_AUTHOR_DEL, BTN_AUTHOR_RUN,
  BTN_AGGRO_DOWN, BTN_AGGRO_UP, shopRow, BTN_JACKIN, BTN_TITLE_CONTINUE, BTN_TITLE_NEW, BTN_SKIP, BTN_READY,
} from './layout.js';
import { ESSAY, KIDCODE, STATUS_CIVIL, FILES, QUESTION, REFUSAL, CITIZEN_CORRUPT, MONOLOGUE, CINE } from './intro.js';
export { COLS, ROWS };

const TERRAIN_G = [' ', '▒', '▓', '═', '"', '|', 'o', '*'];   // OPEN HARD WALL BUS HONEY LANCE NOVA FREEZE (device fallbacks)
const RAMP = ['·', ':', '=', '+', '*', '@', '%'];  // cold → hot burn strength
const rampGlyph = (heat) => (heat <= 0 ? RAMP[0] : RAMP[Math.min(RAMP.length - 1, 1 + Math.floor(heat / 3))]);

// Device telegraph: an un-burned device advertises itself before a crawler reaches it —
// a LANCE bar spins, a NOVA / FREEZE mark pulses. Animated off wall-clock `now`; reduced
// motion (or a still frame) falls back to the static glyph. All glyphs are ASCII, inside
// the closed GridMono alphabet the render test enforces.
const SPIN = ['|', '/', '-', '\\'];
function deviceGlyph(type, now, reduce) {
  if (reduce) return type === LANCE ? '|' : type === NOVA ? 'o' : '*';
  if (type === LANCE) return SPIN[Math.floor(now / 120) % 4];
  if (type === NOVA) return (Math.floor(now / 300) % 2) ? 'O' : 'o';
  return (Math.floor(now / 260) % 2) ? '*' : '+';   // FREEZE twinkle
}

// Grid-native fireworks: each detonation records a wall-clock stamp in game.fx, and this
// replays its motion over FX_MS — a LANCE front racing out the drilled bar, a NOVA ring
// blowing outward, a FREEZE frost twinkle. Presentation only; the sim never sees it.
export const FX_MS = 460;
const HDIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];   // == beam.js HEADINGS
function putField(g, x, y, ch) {
  if (x < 0 || x >= FIELD_W || y < 0 || y >= FIELD_H) return;
  g[FIELD_OY + y][FIELD_OX + x] = ch;
}
function drawFx(g, fx, now) {
  for (const f of fx) {
    const p = (now - f.at) / FX_MS;
    if (p < 0 || p >= 1) continue;
    if (f.type === 'LANCE') {
      const front = Math.round(p * f.len);
      for (const h of [f.heading & 7, (f.heading + 4) & 7]) {
        const [dx, dy] = HDIRS[h];
        putField(g, f.x + dx * front, f.y + dy * front, '@');            // bright tip
        if (front - 1 >= 1) putField(g, f.x + dx * (front - 1), f.y + dy * (front - 1), '*');
        if (front - 2 >= 1) putField(g, f.x + dx * (front - 2), f.y + dy * (front - 2), '+');   // cooling trail
      }
    } else if (f.type === 'NOVA') {
      const ri = Math.round(p * (f.r + 0.5));
      for (let a = 0; a < 8; a++) { const [dx, dy] = HDIRS[a]; putField(g, f.x + dx * ri, f.y + dy * ri, (a & 1) ? '+' : '*'); }
    } else {   // FREEZE frost twinkle
      putField(g, f.x, f.y, (Math.floor(now / 80) % 2) ? '*' : '+');
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) putField(g, f.x + dx, f.y + dy, '·');
    }
  }
}

function blank() { return Array.from({ length: ROWS }, () => new Array(COLS).fill(' ')); }
function stamp(g, x, y, s) { if (y < 0 || y >= ROWS) return; for (let i = 0; i < s.length; i++) if (x + i >= 0 && x + i < COLS) g[y][x + i] = s[i]; }
function bar(pct, w) { const f = Math.max(0, Math.min(w, Math.round((pct / 100) * w))); return '[' + '#'.repeat(f) + '.'.repeat(w - f) + ']'; }

function wrap(text, w) {
  const out = []; let cur = '';
  for (const word of text.split(' ')) {
    if ((cur + ' ' + word).trim().length > w) { out.push(cur.trim()); cur = word; }
    else cur = (cur + ' ' + word).trim();
  }
  if (cur) out.push(cur.trim());
  return out;
}

// the shared box frame: top/side/bottom borders with a blank interior. All three
// framed things (panels, buttons, cards) draw through this, then overlay content.
function frame(g, x, y, w, h) {
  const y1 = y + h - 1;
  stamp(g, x, y, '┌' + '─'.repeat(w - 2) + '┐');
  for (let r = y + 1; r < y1; r++) stamp(g, x, r, '│' + ' '.repeat(w - 2) + '│');
  stamp(g, x, y1, '└' + '─'.repeat(w - 2) + '┘');
}

// a panel box with an optional inset title in the top edge
function panelBox(g, p, title) {
  frame(g, p.x, p.y, p.w, p.h);
  if (title) stamp(g, p.x + 2, p.y, '┤ ' + title.slice(0, p.w - 6) + ' ├');
}

function drawButton(g, r, dim) {
  const h = r.h || 3;
  frame(g, r.x, r.y, r.w, h);
  const t = (dim ? r.label.replace('▶', '·') : r.label).slice(0, r.w - 2);
  stamp(g, r.x + Math.max(1, Math.floor((r.w - t.length) / 2)), r.y + Math.floor(h / 2), t);   // vertically centred
}

// a card panel (default 15 wide): name + its aspect stats (stats only, no
// flavor — grammar, then pace, then connector via cardLines).
function drawCard(g, x, y, key, card, spent, w = 15) {
  frame(g, x, y, w, 8);
  stamp(g, x, y, '┌' + `[${key}]` + '─'.repeat(w - 2 - (key.length + 2)) + '┐');   // key in the top edge
  if (spent) { stamp(g, x + 2, y + 3, 'SLOTTED'); return; }
  stamp(g, x + 2, y + 1, card.name.slice(0, w - 3));
  cardLines(card).forEach((ln, i) => stamp(g, x + 2, y + 3 + i, ln.slice(0, w - 3)));
}

// --- FIELD: the memory block (idle terrain, or live burn), or the shop list ---
function drawBlockCells(g, machine, sim, now = 0, reduce = false) {
  const params = sim ? sim.params : null;
  for (let y = 0; y < FIELD_H; y++) {
    for (let x = 0; x < FIELD_W; x++) {
      const c = idx(x, y);
      const terr = machine.t[c];
      let ch;
      if (sim && sim.params.scanSpeed > 0 && y === sim.scanRow && sim.scanRow < FIELD_H) ch = '#';   // scan line (none on the scanless test bench)
      else if (sim && sim.reclaimed && sim.reclaimed.has(c)) ch = 'X';                 // reclaim flash
      else if (machine.burned[c]) ch = sim ? rampGlyph(heatAt(sim, c)) : '#';
      else if (terr >= LANCE) ch = deviceGlyph(terr, now, reduce);                     // un-burned device telegraph
      else ch = TERRAIN_G[terr];
      g[FIELD_OY + y][FIELD_OX + x] = ch;
    }
  }
  if (sim) g[FIELD_OY + FIELD_H - 1][FIELD_OX + params.p] = '▲';                        // turret
}

const SHOP_TYPE = { deckcard: 'DECK', card: 'UNLOCK', retry: '1-USE', upgrade: 'UPGRADE' };

function drawShop(g, game) {
  const d = game.shopData || { root: 0, retry: 0, items: [] };
  // balance plate — the "how much have I got" anchor, boxed so it reads first
  frame(g, 3, 1, 24, 3);
  stamp(g, 5, 2, `ROOT BALANCE  ${d.root}`);
  stamp(g, 30, 2, `retry:${d.retry}`);
  stamp(g, 3, 5, '═'.repeat(57));
  // column captions, aligned to the item rows below
  stamp(g, 3, 6, 'BUY  ITEM'); stamp(g, 34, 6, 'TYPE'); stamp(g, 52, 6, 'COST');
  let anyLocked = false;
  d.items.forEach((it, i) => {
    const r = shopRow(i);
    const locked = !it.owned && d.root < it.cost;
    anyLocked = anyLocked || locked;
    stamp(g, r.x, r.y, `[${i + 1}] ${it.name.slice(0, 26).padEnd(27)}`);
    stamp(g, 34, r.y, (SHOP_TYPE[it.kind] || '').padEnd(8));
    const price = it.owned ? 'OWNED' : `${it.cost} ROOT`;
    const tag = (locked ? '* ' : '') + price;                 // '*' flags can't-afford
    stamp(g, 60 - tag.length, r.y, tag);
    // card items lead with their beam aspect line (grammar·pace·connector);
    // the prose sits in parens to set it apart from the stats.
    const card = CARDS[it.name];
    const dot = card ? `${cardLabel(card)}  ` : '';
    stamp(g, r.x + 4, r.y + 1, `${dot}(${it.desc})`.slice(0, 55));
  });
  // feedback / legend line above the button
  const foot = game.message ? game.message : anyLocked ? '* = not enough ROOT yet' : '';
  stamp(g, 3, 24, foot.slice(0, 57));
  drawButton(g, BTN_JACKIN, false);
}

// AIM overlay: the turret oscillates across the base of the block (aimColAt drives
// its column from wall-clock `now`) and a straight dotted preview column sweeps
// with it, showing the trigger column. The player times LAUNCH to this sweep.
function drawAim(g, now) {
  const col = aimColAt(now);
  for (let y = 0; y < FIELD_H; y += 2) g[FIELD_OY + y][FIELD_OX + col] = '¦';   // dotted preview column
  g[FIELD_OY + FIELD_H - 1][FIELD_OX + col] = '▲';               // the sweeping turret
}

function drawField(g, game, now) {
  const { phase, run, node } = game;
  const reduce = !!game.reduceMotion;
  if (phase === 'shop') { drawShop(g, game); return; }
  if (phase === 'test') {   // the bench: blank block while charging, then the live burn
    drawBlockCells(g, game.testSim ? game.testSim.machine : game.testMachine, game.testSim, now, reduce);
    return;
  }
  if (phase === 'author') {   // the tutorial: the literal turtle's drawn path (static preview)
    drawBlockCells(g, game.authorPreview ? game.authorPreview.machine : run.machine, game.authorPreview, now, reduce);
    return;
  }
  const sim = node && node.sim;
  drawBlockCells(g, run.machine, sim, now, reduce);
  if (game.fx && game.fx.length) drawFx(g, game.fx, now);   // detonation motion over the live burn
  if (phase === 'target') drawAim(g, now);
  // result banner over the block
  if (phase === 'result') {
    const msg = (game.bannerLines || []);
    const bx = FIELD.x + 3, bw = FIELD.w - 6;
    for (let i = 0; i < msg.length; i++) {
      const t = msg[i].slice(0, bw);
      stamp(g, bx + Math.max(0, Math.floor((bw - t.length) / 2)), 17 + i, t);
    }
    drawButton(g, BTN_CONTINUE, false);
  }
}

// The grammar key, shown while the player reads card programs (assemble). Each
// line fits the ~13-col gutter.
function legend(L) {
  L('GRAMMAR KEY');
  L('F step+burn');
  L('L/R turn 45');
  L('K fork child');
}

// --- GUTTER: run state + phase controls. Lines FLOW from a cursor rather than
// hand-picked row numbers, so adding a readout can't collide with the ones below.
// The gutter buttons sit at fixed layout rows (20+); stats always end above them.
function drawGutter(g, game) {
  const { phase, run, node } = game;
  let r = 0;
  const L = (s = '') => stamp(g, GUTTER.x + 2, 1 + r++, String(s).slice(0, GUTTER.w - 3));
  const gap = () => { r++; };

  L(`ROOT ${run.root}`); L(`DECK ${run.deck.length}`); gap();

  if (node && (phase === 'exec' || phase === 'result')) {
    const sim = node.sim, cp = crackPct(node);
    L('TRACE'); L(bar((sim.scanRow / FIELD_H) * 100, 10)); L(`${sim.scanRow}/${FIELD_H}`); gap();
    if (sim.collision) {   // coverage regime: fill the block, hold the breach
      L('COVERAGE'); L(bar(cp, 10)); L(`${cp.toFixed(0)}% /${WIN_COVERAGE}%`);
      L(sim.breachLeft > 0 ? `HOLD ${sim.breachLeft}` : sim.breachLeft === 0 ? 'BREACH!' : '');
    } else {               // survival regime: just stay alive to the bottom
      L('DRAWN'); L(bar(cp, 10)); L(`${cp.toFixed(0)}%`);
      L(sim.turtles.length ? 'THREAD ALIVE' : 'CRASHED');
    }
    gap();
    L(`STRANDS ${sim.turtles.length}`); gap();
    L('BEAM'); node.beamLines.forEach(L);                       // cached at fire — no per-frame merge
    gap();
    L(`AGGRO x${node.aggro.toFixed(2)}`);
  } else if (phase === 'test') {
    const sim = game.testSim;
    L('TEST BENCH'); gap();
    if (sim) {
      L('COVERAGE'); L(bar(sim.cov, 10)); L(`${sim.cov.toFixed(0)}%`); gap();
      L(`STRANDS ${sim.turtles.length}`);
      L(`TICK ${sim.tick}`);
    } else L('charging...');
    drawButton(g, BTN_TEST_RESET, !sim);
    drawButton(g, BTN_TEST_PLAY, false);
  } else if (phase === 'assemble') {
    L('BEAM');
    if (game.program.some(Boolean)) beamGutterLines(buildChain(game.program.filter(Boolean))).forEach(L);
    else L('(slot cards)');
    gap();
    // the just-slotted card explains itself here — name + flavor text, wrapped;
    // before anything is slotted, the grammar key primes the card-reading instead
    const last = game.selection.length ? game.program[game.selection.length - 1] : null;
    if (last) { L(last.name); wrap(last.desc, GUTTER.w - 3).forEach(L); }
    else legend(L);
    drawButton(g, BTN_REDRAW, run.root < REDRAW_COST);
    drawButton(g, BTN_TEST, !game.program.some(Boolean));
    // START lives in the tray next to the cards (drawn by drawTray)
  } else if (phase === 'target') {
    const a = run.aggression, base = run.baseAggro;
    L('BEAM'); beamGutterLines(buildChain(game.program.filter(Boolean))).forEach(L);
    gap();
    L(`AGGRO x${a.toFixed(2)}`); L(`reward x${rewardMult(a, base).toFixed(2)}`); L(`${draftPicks(a, base)} draft`);
    if (base < AGGRO_BASE) L('TRAINING');
    drawButton(g, BTN_AGGRO_DOWN, run.root < AGGRO_REDUCE_COST);
    drawButton(g, BTN_AGGRO_UP, false);
  } else if (phase === 'author') {
    // all copy kept <=13 cols so the narrow gutter never clips a word mid-instruction.
    L('WRITE A LINE'); gap();
    L('GRAMMAR'); L((game.authorGrammar || '—').slice(0, GUTTER.w - 3)); gap();
    L('GOAL'); L('stay alive to'); L('trace-bottom.'); gap();
    L('tip: 3+ turns'); L('balance L/R.'); gap();
    L('KEYS'); L('F step+burn'); L('L/R turn 45');   // author has only F/L/R — no K
  }

  // transient feedback flows right below the stats (above the fixed buttons).
  if (game.message) { gap(); wrap(game.message, GUTTER.w - 3).slice(0, 3).forEach((ln) => L(ln)); }
}

// --- TRAY: hand / draft / loadout / author ---
function drawTray(g, game) {
  const { phase } = game;
  if (phase === 'author') {
    for (const b of AUTHOR_SYMS) drawButton(g, b, false);
    drawButton(g, BTN_AUTHOR_DEL, !game.authorGrammar);
    drawButton(g, BTN_AUTHOR_RUN, !game.authorGrammar.includes('F'));
    return;
  }
  if (phase === 'draft') {
    game.draft.forEach((c, i) => drawCard(g, DRAFT_CARDS[i].x, DRAFT_CARDS[i].y, String(i + 1), c, false));
  } else if (phase === 'assemble') {
    game.hand.forEach((h, i) => {
      const n = game.run.deck.filter((c) => c.id === h.card.id).length;
      drawCard(g, HAND_CARDS[i].x, HAND_CARDS[i].y, `x${n}`, h.card, h.used, HAND_CARDS[i].w);
    });
    drawButton(g, BTN_START, !game.program.some(Boolean));   // the primary go control, beside the cards
  } else {
    // target / exec / result: show the slotted loadout so you see what fired
    const slotted = game.program.filter(Boolean);
    if (slotted.length) slotted.forEach((c, i) => drawCard(g, HAND_CARDS[i].x, HAND_CARDS[i].y, `S${i + 1}`, c, false, HAND_CARDS[i].w));
    if (game.phase === 'target') drawButton(g, BTN_FIRE, false);   // FIRE, beside the loadout
  }
}

// panel titles change with the phase; the panels themselves never move
function titles(phase) {
  const tray = phase === 'draft' ? 'DRAFT — bank a card into your deck'
    : phase === 'author' ? 'WRITE — F/L/R build your program · ▶ RUN'
      : phase === 'assemble' ? 'LOADOUT — slot cards, then ▶ START'
        : phase === 'target' ? 'AIM — the turret sweeps · time your LAUNCH'
          : phase === 'test' ? 'LOADOUT — the beam under test'
            : 'LOADOUT — the beam you fired';
  const field = phase === 'shop' ? 'ROOT SHOP'
    : phase === 'test' ? 'TEST BENCH — a blank block'
      : phase === 'author' ? 'YOUR MACHINE — draw a self-avoiding line'
        : 'THE MACHINE — one memory block';
  return { field, tray };
}

// A 5×5 block-letter font (built from █, which the embedded GridMono covers) — the
// "2× font" for the boot/title banner. Only the glyphs the title "OVERRIDE 1983" needs.
const GLYPH5 = {
  O: ['█████', '█   █', '█   █', '█   █', '█████'],
  V: ['█   █', '█   █', '█   █', ' █ █ ', '  █  '],
  E: ['█████', '█    ', '████ ', '█    ', '█████'],
  R: ['████ ', '█   █', '████ ', '█  █ ', '█   █'],
  I: ['█████', '  █  ', '  █  ', '  █  ', '█████'],
  D: ['████ ', '█   █', '█   █', '█   █', '████ '],
  1: ['  ██ ', ' █ █ ', '   █ ', '   █ ', '█████'],
  9: ['█████', '█   █', '█████', '    █', '█████'],
  8: ['█████', '█   █', '█████', '█   █', '█████'],
  3: ['█████', '    █', ' ████', '    █', '█████'],
};
// width of `text` in columns when stamped by drawBig (5-wide glyphs + 1-col gaps).
function bigWidth(text) {
  let w = 0;
  for (const chr of text.toUpperCase()) w += GLYPH5[chr] ? 6 : 3;
  return Math.max(0, w - 1);   // drop the trailing gap
}
// stamp `text` as 5-tall block letters from (x,y); letters are 5 wide + a 1-col gap.
function drawBig(g, x, y, text) {
  let cx = x;
  for (const chr of text.toUpperCase()) {
    const glyph = GLYPH5[chr];
    if (glyph) { for (let r = 0; r < 5; r++) stamp(g, cx, y + r, glyph[r]); cx += 6; }
    else cx += 3;   // unknown/space
  }
}
// centre a big-font line horizontally on the screen.
const drawBigCenter = (g, y, text) => drawBig(g, Math.max(1, Math.floor((COLS - bigWidth(text)) / 2)), y, text);
const center = (g, y, s) => stamp(g, Math.max(0, Math.floor((COLS - s.length) / 2)), y, s);

// The boot / title screen — a full-screen takeover (no three-panel layout). NEW
// wipes the save; CONTINUE resumes. game.titleWins carries the saved breach count.
function drawTitle(g, game) {
  frame(g, 0, 0, COLS, ROWS);
  drawBigCenter(g, 9, 'OVERRIDE 1983');
  const wins = game.titleWins || 0;
  if (wins > 0) center(g, 18, `${wins} breach${wins === 1 ? '' : 'es'} logged`);
  drawButton(g, BTN_TITLE_CONTINUE, false);
  drawButton(g, BTN_TITLE_NEW, false);
}

// --- COLD OPEN (research/intro-script.md) ---
// Typewriter: reveal `budget` pacing-chars across `lines` from (x,y). A blinking `_`
// cursor rides the reveal head. Reduced motion (budget === Infinity) shows it all.
// `xOf` maps a line to its left column (centering); defaults to a fixed x.
function typeLines(g, lines, y, budget, blinkOn, xOf) {
  let rem = budget;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i], x = xOf(i, ln);
    if (rem >= ln.length) { stamp(g, x, y + i, ln); rem -= ln.length + 1; }   // +1 tick per line break
    else { stamp(g, x, y + i, ln.slice(0, Math.max(0, rem)) + (blinkOn ? '_' : ' ')); return; }
  }
  if (blinkOn) { const last = lines[lines.length - 1] || ''; stamp(g, xOf(lines.length - 1, last) + last.length, y + lines.length - 1, '_'); }
}
const leftAt = (x) => () => x;
const centerAt = () => (_i, ln) => Math.max(0, Math.floor((COLS - ln.length) / 2));

// BEAT 1: the civilian machine wearing the play-screen's own three panels.
function drawCivilian(g, budget, blinkOn) {
  panelBox(g, FIELD, 'CIVICS.TXT');
  panelBox(g, GUTTER, 'STATUS');
  panelBox(g, TRAY, 'FILES');
  typeLines(g, ESSAY, 3, budget, blinkOn, leftAt(3));
  frame(g, 38, 15, 24, 4);                                  // the half-covered back window
  KIDCODE.forEach((ln, i) => stamp(g, 40, 16 + i, ln));
  STATUS_CIVIL.forEach((ln, i) => stamp(g, GUTTER.x + 2, 2 + i, ln.slice(0, GUTTER.w - 3)));
  FILES.forEach((ln, i) => stamp(g, 4, 32 + i, ln));
}

// BEAT 2: power-down sweep top->bottom, then true black. `front` is how far the
// darkness has fallen; STATUS reads SIGNAL LOST for the last stretch before it goes.
function drawBlackout(g, front) {
  drawCivilian(g, Infinity, false);
  for (let y = 0; y < ROWS; y++) if (y < front) for (let x = 0; x < COLS; x++) g[y][x] = ' ';
  if (front > 2 && front < ROWS) stamp(g, GUTTER.x + 2, Math.max(front, 1), 'SIGNAL LOST');
}

export function buildScreen(game, now = 0) {
  const g = blank();
  const { phase } = game;
  if (phase === 'title') { drawTitle(g, game); return g.map((r) => r.join('')).join('\n'); }
  if (phase === 'coldopen') { drawColdOpen(g, game, now); return g.map((r) => r.join('')).join('\n'); }
  const t = titles(phase);
  panelBox(g, FIELD, t.field);
  panelBox(g, GUTTER, 'STATUS');
  panelBox(g, TRAY, t.tray);

  drawField(g, game, now);
  drawGutter(g, game);
  drawTray(g, game);

  return g.map((r) => r.join('')).join('\n');
}

// Dispatch a cold-open beat off game.cine {beat, startedAt}. Text reveal is a pure
// function of elapsed wall-clock, so the anim loop drives the typewriter with no timers.
function drawColdOpen(g, game, now) {
  const c = game.cine || { beat: 'citizen', startedAt: now };
  const elapsed = Math.max(0, now - c.startedAt);
  const blink = Math.floor(now / 400) % 2 === 0;
  const reveal = (msPerChar) => (game.reduceMotion ? Infinity : Math.floor(elapsed / msPerChar));
  if (c.beat === 'citizen') {
    drawCivilian(g, reveal(CINE.essayMs), blink);
  } else if (c.beat === 'blackout') {
    const front = Math.min(ROWS, Math.ceil((elapsed / CINE.powerMs) * ROWS));
    drawBlackout(g, front);
  } else if (c.beat === 'question') {
    typeLines(g, QUESTION, 17, reveal(CINE.qMs), blink, centerAt());
  } else if (c.beat === 'refusal') {
    typeLines(g, QUESTION, 14, Infinity, false, centerAt());              // question stays up
    typeLines(g, [REFUSAL], 19, reveal(CINE.noMs), blink, centerAt());
    if (reveal(CINE.noMs) >= REFUSAL.length) center(g, 22, CITIZEN_CORRUPT);   // compliance corrupts
  } else if (c.beat === 'contact') {
    typeLines(g, MONOLOGUE, 8, reveal(CINE.monoMs), blink, leftAt(8));
  }
  if (game.cineReady) drawButton(g, BTN_READY, false);        // contact done — read, then advance
  else if (c.beat !== 'refusal') drawButton(g, BTN_SKIP, false);   // SKIP live through the cinematic
}
