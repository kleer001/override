// Compose the whole 80x40 screen as three STATIC panels (they persist across every
// phase; only their contents swap): FIELD (the memory block), GUTTER (run state +
// controls), TRAY (cards). See src/layout.js for the geometry.

import { FIELD_W, FIELD_H, WALL, idx, WIN_COVERAGE } from './terrain.js';
import { crackPct, REDRAW_COST, rewardMult, draftPicks, AGGRO_REDUCE_COST, AGGRO_BASE, SLOTS, spineX, aimColAt } from './battle.js';
import { mergeBeam, beamGutterLines, cardLabel } from './cards.js';
import {
  COLS, ROWS, FIELD, GUTTER, TRAY, FIELD_OX, FIELD_OY,
  HAND_CARDS, DRAFT_CARDS, BTN_REDRAW, BTN_UNDO, BTN_START, BTN_FIRE, BTN_CONTINUE,
  BTN_AGGRO_DOWN, BTN_AGGRO_UP, shopRow, BTN_JACKIN,
} from './layout.js';
export { COLS, ROWS };

const TERRAIN_G = [' ', '▒', '▓', '═', '"'];       // OPEN HARD WALL BUS HONEY
const RAMP = ['·', ':', '=', '+', '*', '@', '%'];  // cold → hot burn strength
const rampGlyph = (heat) => (heat <= 0 ? RAMP[0] : RAMP[Math.min(RAMP.length - 1, 1 + Math.floor(heat / 3))]);

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

// a card panel (default 15 wide): name, compact aspect line, wrapped identity
function drawCard(g, x, y, key, card, spent, w = 15) {
  frame(g, x, y, w, 8);
  stamp(g, x, y, '┌' + `[${key}]` + '─'.repeat(w - 2 - (key.length + 2)) + '┐');   // key in the top edge
  if (spent) { stamp(g, x + 2, y + 3, 'SLOTTED'); return; }
  stamp(g, x + 2, y + 1, card.name.slice(0, w - 3));
  if (card.dirs) stamp(g, x + 2, y + 2, cardLabel(card).slice(0, w - 3));
  wrap(card.desc, w - 4).slice(0, 3).forEach((ln, i) => stamp(g, x + 2, y + 4 + i, ln));
}

// --- FIELD: the memory block (idle terrain, or live burn), or the shop list ---
function drawBlockCells(g, machine, sim) {
  const params = sim ? sim.params : null;
  for (let y = 0; y < FIELD_H; y++) {
    const sx = (sim && y <= sim.spineRow) ? spineX(params, y) : -1;   // pending-spine col (per row, not per cell)
    for (let x = 0; x < FIELD_W; x++) {
      const c = idx(x, y);
      let ch;
      if (sim && y === sim.scanRow && sim.scanRow < FIELD_H) ch = '#';                 // scan line
      else if (sim && sim.reclaimed && sim.reclaimed.has(c)) ch = 'X';                 // reclaim flash
      else if (machine.burned[c]) ch = sim ? rampGlyph(sim.heat[c]) : '#';
      else if (x === sx) ch = '|';                                                     // pending spine
      else ch = TERRAIN_G[machine.t[c]];
      g[FIELD_OY + y][FIELD_OX + x] = ch;
    }
  }
  if (sim) g[FIELD_OY + FIELD_H - 1][FIELD_OX + params.p] = '▲';                        // turret
}

function drawShop(g, game) {
  const d = game.shopData || { root: 0, retry: 0, overclock: false, items: [] };
  stamp(g, 2, 2, 'ROOT SHOP — spend ROOT, then JACK IN');
  stamp(g, 2, 4, `ROOT: ${d.root}   retry: ${d.retry}${d.overclock ? '   OVERCLOCK ARMED' : ''}`);
  d.items.forEach((it, i) => {
    const r = shopRow(i);
    const tag = it.owned ? 'OWNED' : `${it.cost}R`;
    stamp(g, r.x, r.y, `[${i + 1}] ${it.name.padEnd(22)}${tag.padStart(7)} ${it.desc}`.slice(0, r.w));
  });
  drawButton(g, BTN_JACKIN, false);
}

// AIM overlay: the turret oscillates across the base of the block (aimColAt drives
// its column from wall-clock `now`) and a dotted preview spine sweeps with it,
// showing where the packet will draw. The player times LAUNCH to this sweep.
function drawAim(g, game, now) {
  const merged = mergeBeam(game.program.filter(Boolean));
  const col = aimColAt(now);
  const preview = { p: col, shapes: merged.shapes, amp: merged.amp, freq: merged.freq };
  for (let y = 0; y < FIELD_H; y++) {
    const sx = spineX(preview, y);
    if (y % 2 === 0) g[FIELD_OY + y][FIELD_OX + sx] = '¦';        // dotted preview spine
  }
  g[FIELD_OY + FIELD_H - 1][FIELD_OX + col] = '▲';               // the sweeping turret
}

function drawField(g, game, now) {
  const { phase, run, node } = game;
  if (phase === 'shop') { drawShop(g, game); return; }
  const sim = node && node.sim;
  drawBlockCells(g, run.machine, sim);
  if (phase === 'target') drawAim(g, game, now);
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
    L('COVERAGE'); L(bar(cp, 10)); L(`${cp.toFixed(0)}% /${WIN_COVERAGE}%`);
    L(sim.breachLeft > 0 ? `HOLD ${sim.breachLeft}` : sim.breachLeft === 0 ? 'BREACH!' : ''); gap();
    L(`EMBERS ${sim.embers.length}`); gap();
    const [bl1, bl2] = node.beamLines;                          // cached at fire — no per-frame merge
    L('BEAM'); L(bl1); L(bl2); gap();
    L(`AGGRO x${node.aggro.toFixed(2)}`);
  } else if (phase === 'assemble') {
    L('BEAM');
    if (game.program.some(Boolean)) { const [l1, l2] = beamGutterLines(mergeBeam(game.program.filter(Boolean))); L(l1); L(l2); }
    else L('(slot cards)');
    gap(); L(`SLOTS ${game.program.filter(Boolean).length}/${SLOTS}`);
    drawButton(g, BTN_REDRAW, run.root < REDRAW_COST);
    drawButton(g, BTN_UNDO, !game.selection.length);
    // START lives in the tray next to the cards (drawn by drawTray)
  } else if (phase === 'target') {
    const a = run.aggression, base = run.baseAggro;
    const [l1, l2] = beamGutterLines(mergeBeam(game.program.filter(Boolean)));
    L('BEAM'); L(l1); L(l2); gap();
    L(`AGGRO x${a.toFixed(2)}`); L(`reward x${rewardMult(a, base).toFixed(2)}`); L(`${draftPicks(a, base)} draft`);
    if (base < AGGRO_BASE) L('TRAINING');
    drawButton(g, BTN_AGGRO_DOWN, run.root < AGGRO_REDUCE_COST);
    drawButton(g, BTN_AGGRO_UP, false);
  }

  // transient feedback flows right below the stats (above the fixed buttons).
  if (game.message) { gap(); wrap(game.message, GUTTER.w - 3).slice(0, 3).forEach((ln) => L(ln)); }
}

// --- TRAY: hand / draft / loadout ---
function drawTray(g, game) {
  const { phase } = game;
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
    : phase === 'assemble' ? 'LOADOUT — slot cards, then ▶ START'
      : phase === 'target' ? 'AIM — the turret sweeps · time your LAUNCH'
        : 'LOADOUT — the beam you fired';
  const field = phase === 'shop' ? 'ROOT SHOP' : 'THE MACHINE — one memory block';
  return { field, tray };
}

export function buildScreen(game, now = 0) {
  const g = blank();
  const { phase } = game;
  const t = titles(phase);
  panelBox(g, FIELD, t.field);
  panelBox(g, GUTTER, 'STATUS');
  panelBox(g, TRAY, t.tray);

  drawField(g, game, now);
  drawGutter(g, game);
  drawTray(g, game);

  return g.map((r) => r.join('')).join('\n');
}
