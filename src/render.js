// Compose the whole 80x40 screen as three STATIC panels (they persist across every
// phase; only their contents swap): FIELD (the memory block), GUTTER (run state +
// controls), TRAY (cards). See src/layout.js for the geometry.

import { FIELD_W, FIELD_H, WALL, idx, WIN_COVERAGE } from './terrain.js';
import { crackPct, REDRAW_COST, rewardMult, draftPicks, AGGRO_REDUCE_COST, AGGRO_BASE, SLOTS, spineX } from './battle.js';
import { mergeBeam, beamGutterLines, cardLabel } from './cards.js';
import {
  COLS, ROWS, FIELD, GUTTER, TRAY, FIELD_OX, FIELD_OY,
  HAND_CARDS, DRAFT_CARDS, BTN_REDRAW, BTN_UNDO, BTN_AIM, BTN_CONTINUE,
  BTN_AGGRO_DOWN, BTN_AGGRO_UP, shopRow, BTN_JACKIN,
} from './layout.js';
import { CHARACTERS } from './characters.js';

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

// draw a panel box with an optional inset title in the top edge
function panelBox(g, p, title) {
  const { x, y, w, h } = p, x1 = x + w - 1, y1 = y + h - 1;
  stamp(g, x, y, '┌' + '─'.repeat(w - 2) + '┐');
  stamp(g, x, y1, '└' + '─'.repeat(w - 2) + '┘');
  for (let r = y + 1; r < y1; r++) { g[r][x] = '│'; g[r][x1] = '│'; }
  if (title) stamp(g, x + 2, y, '┤ ' + title.slice(0, w - 6) + ' ├');
}

function drawButton(g, r, dim) {
  stamp(g, r.x, r.y, '┌' + '─'.repeat(r.w - 2) + '┐');
  stamp(g, r.x, r.y + 1, '│' + ' '.repeat(r.w - 2) + '│');
  stamp(g, r.x, r.y + 2, '└' + '─'.repeat(r.w - 2) + '┘');
  const t = (dim ? r.label.replace('▶', '·') : r.label).slice(0, r.w - 2);
  stamp(g, r.x + Math.max(1, Math.floor((r.w - t.length) / 2)), r.y + 1, t);
}

// a 15x8 card panel: name, compact aspect line, wrapped identity
function drawCard(g, x, y, key, card, spent) {
  const w = 15, h = 8;
  stamp(g, x, y, '┌' + `[${key}]` + '─'.repeat(w - 2 - (key.length + 2)) + '┐');
  for (let r = 1; r < h - 1; r++) stamp(g, x, y + r, '│' + ' '.repeat(w - 2) + '│');
  stamp(g, x, y + h - 1, '└' + '─'.repeat(w - 2) + '┘');
  if (spent) { stamp(g, x + 2, y + 3, 'SLOTTED'); return; }
  stamp(g, x + 2, y + 1, card.name.slice(0, w - 3));
  if (card.dirs) stamp(g, x + 2, y + 2, cardLabel(card).slice(0, w - 3));
  wrap(card.desc, w - 4).slice(0, 3).forEach((ln, i) => stamp(g, x + 2, y + 4 + i, ln));
}

// --- FIELD: the memory block (idle terrain, or live burn), or the shop list ---
function drawBlockCells(g, machine, sim) {
  const params = sim ? sim.params : null;
  for (let y = 0; y < FIELD_H; y++) {
    for (let x = 0; x < FIELD_W; x++) {
      const c = idx(x, y);
      let ch;
      if (sim && y === sim.scanRow && sim.scanRow < FIELD_H) ch = '#';                 // scan line
      else if (sim && sim.reclaimed && sim.reclaimed.has(c)) ch = 'X';                 // reclaim flash
      else if (machine.burned[c]) ch = sim ? rampGlyph(sim.heat[c]) : '#';
      else if (sim && y <= sim.spineRow && x === spineX(params, y)) ch = '|';          // pending spine
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

function drawField(g, game) {
  const { phase, run, node } = game;
  if (phase === 'shop') { drawShop(g, game); return; }
  const sim = node && node.sim;
  drawBlockCells(g, run.machine, sim);
  // result / tier banner over the block
  if (phase === 'result' || phase === 'tierclear' || phase === 'gameover') {
    const msg = (game.bannerLines || []);
    const bx = FIELD.x + 3, bw = FIELD.w - 6;
    for (let i = 0; i < msg.length; i++) {
      const t = msg[i].slice(0, bw);
      stamp(g, bx + Math.max(0, Math.floor((bw - t.length) / 2)), 17 + i, t);
    }
    drawButton(g, BTN_CONTINUE, false);
  }
}

// --- GUTTER: run state + phase controls ---
function gline(g, i, s) { stamp(g, GUTTER.x + 2, 1 + i, String(s).slice(0, GUTTER.w - 3)); }

function drawGutter(g, game) {
  const { phase, run, node } = game;
  gline(g, 0, `ROOT ${run.root}`);
  gline(g, 1, `PTS  ${run.points}`);
  gline(g, 2, `DECK ${run.deck.length}`);

  if (node && (phase === 'exec' || phase === 'result')) {
    const sim = node.sim, cp = crackPct(node);
    gline(g, 4, 'TRACE');
    gline(g, 5, bar((sim.scanRow / FIELD_H) * 100, 10));
    gline(g, 6, `${sim.scanRow}/${FIELD_H}`);
    gline(g, 8, 'COVERAGE');
    gline(g, 9, bar(cp, 10));
    gline(g, 10, `${cp.toFixed(0)}% /${WIN_COVERAGE}%`);
    const br = sim.breachLeft > 0 ? `HOLD ${sim.breachLeft}` : sim.breachLeft === 0 ? 'BREACH!' : '';
    gline(g, 11, br);
    gline(g, 13, `EMBERS ${sim.embers.length}`);
    const [bl1, bl2] = beamGutterLines(mergeBeam(node.program.filter(Boolean)));
    gline(g, 15, 'BEAM'); gline(g, 16, bl1); gline(g, 17, bl2);
    gline(g, 19, `AGGRO x${node.aggro.toFixed(2)}`);
    return;
  }

  if (phase === 'assemble') {
    const merged = mergeBeam(game.program.filter(Boolean));
    gline(g, 5, 'BEAM');
    if (game.program.some(Boolean)) { const [l1, l2] = beamGutterLines(merged); gline(g, 6, l1); gline(g, 7, l2); }
    else gline(g, 6, '(slot cards)');
    gline(g, 9, `SLOTS ${game.program.filter(Boolean).length}/${SLOTS}`);
    drawButton(g, BTN_REDRAW, run.points < REDRAW_COST);
    drawButton(g, BTN_UNDO, !game.selection.length);
    drawButton(g, BTN_AIM, !game.program.some(Boolean));
  } else if (phase === 'target') {
    const merged = mergeBeam(game.program.filter(Boolean));
    const a = run.aggression, base = run.baseAggro;
    const [l1, l2] = beamGutterLines(merged);
    gline(g, 5, 'BEAM'); gline(g, 6, l1); gline(g, 7, l2);
    gline(g, 9, `AGGRO x${a.toFixed(2)}`);
    gline(g, 10, `reward x${rewardMult(a, base).toFixed(2)}`);
    gline(g, 11, `${draftPicks(a, base)} draft`);
    if (base < AGGRO_BASE) gline(g, 12, 'TRAINING');
    drawButton(g, BTN_AGGRO_DOWN, run.points < AGGRO_REDUCE_COST);
    drawButton(g, BTN_AGGRO_UP, false);
  }
}

// --- TRAY: hand / draft / jack-ins / loadout ---
function drawTray(g, game) {
  const { phase } = game;
  if (phase === 'charselect') {
    const chars = (game.run && game.run.availChars) || CHARACTERS;
    chars.slice(0, 3).forEach((ch, i) => drawCard(g, DRAFT_CARDS[i].x, DRAFT_CARDS[i].y, String(i + 1), { name: ch.name, desc: ch.desc }, false));
  } else if (phase === 'draft') {
    game.draft.forEach((c, i) => drawCard(g, DRAFT_CARDS[i].x, DRAFT_CARDS[i].y, String(i + 1), c, false));
  } else if (phase === 'assemble') {
    game.hand.forEach((h, i) => {
      const n = game.run.deck.filter((c) => c.id === h.card.id).length;
      drawCard(g, HAND_CARDS[i].x, HAND_CARDS[i].y, `x${n}`, h.card, h.used);
    });
  } else {
    // target / exec / result: show the slotted loadout so you see what fired
    const slotted = game.program.filter(Boolean);
    if (slotted.length) slotted.forEach((c, i) => drawCard(g, HAND_CARDS[i].x, HAND_CARDS[i].y, `S${i + 1}`, c, false));
  }
}

// panel titles change with the phase; the panels themselves never move
function titles(phase) {
  const tray = phase === 'charselect' ? 'SELECT YOUR JACK-IN'
    : phase === 'draft' ? 'DRAFT — bank a card into your deck'
      : phase === 'assemble' ? 'LOADOUT — tap a card to slot the beam'
        : 'LOADOUT — the beam you fired';
  const field = phase === 'shop' ? 'ROOT SHOP' : 'THE MACHINE — one memory block';
  return { field, tray };
}

export function buildScreen(game) {
  const g = blank();
  const { phase } = game;
  const t = titles(phase);
  panelBox(g, FIELD, t.field);
  panelBox(g, GUTTER, 'STATUS');
  panelBox(g, TRAY, t.tray);

  drawField(g, game);
  drawGutter(g, game);
  drawTray(g, game);

  // transient feedback (redraw cost, de-risk cost, breach/traced line) sits at the
  // foot of the gutter so it never collides with the block or the cards.
  if (game.message) wrap(game.message, GUTTER.w - 3).slice(0, 3).forEach((ln, i) => gline(g, 25 + i, ln));

  return g.map((r) => r.join('')).join('\n');
}
