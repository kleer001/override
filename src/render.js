// Compose the whole 80x40 screen. Central region is contextual:
//   assemble / draft -> card panels · target -> the machine (aim a turret) ·
//   exec / result    -> the sector burning under the beam.

import { FIELD_W, FIELD_H, WALL, VAULT, idx, WIN_COVERAGE } from './terrain.js';
import { CODE_DIGITS, crackPct, REDRAW_COST, rewardMult, draftPicks, AGGRO_REDUCE_COST, AGGRO_BASE, SLOTS, spineX, coverage } from './battle.js';
import { mergeBeam, beamLabel, cardLabel } from './cards.js';
import { COLS, ROWS, FIELD_TOP, HAND_CARDS, DRAFT_CARDS, BTN_REDRAW, BTN_UNDO, BTN_EXEC, BTN_CONTINUE, BTN_AGGRO_DOWN, BTN_AGGRO_UP, shopRow, BTN_JACKIN } from './layout.js';
import { CHARACTERS } from './characters.js';

export { COLS, ROWS };

const TERRAIN_G = [' ', '▒', '▓', '═', '$', '"']; // OPEN HARD WALL BUS VAULT HONEY
const RAMP = ['·', ':', '=', '+', '*', '@', '%'];  // cold → hot burn strength
const rampGlyph = (heat) => (heat <= 0 ? RAMP[0] : RAMP[Math.min(RAMP.length - 1, 1 + Math.floor(heat / 3))]);

function blank() { return Array.from({ length: ROWS }, () => new Array(COLS).fill(' ')); }
function stamp(g, x, y, s) { if (y < 0 || y >= ROWS) return; for (let i = 0; i < s.length; i++) if (x + i >= 0 && x + i < COLS) g[y][x + i] = s[i]; }
function center(g, y, s) { stamp(g, Math.max(0, Math.floor((COLS - s.length) / 2)), y, s); }
function bar(pct, w) { const f = Math.round((pct / 100) * w); return '[' + '#'.repeat(f) + '.'.repeat(w - f) + ']'; }

function wrap(text, w) {
  const out = []; let cur = '';
  for (const word of text.split(' ')) {
    if ((cur + ' ' + word).trim().length > w) { out.push(cur.trim()); cur = word; }
    else cur = (cur + ' ' + word).trim();
  }
  if (cur) out.push(cur.trim());
  return out;
}

// A card panel showing the bundled quad (shape·dir·prob·growth) + identity.
function drawCard(g, x, y, key, card, spent) {
  const w = 15, h = 8;
  stamp(g, x, y, '┌' + `[${key}]` + '─'.repeat(w - 2 - (key.length + 2)) + '┐');
  for (let r = 1; r < h - 1; r++) stamp(g, x, y + r, '│' + ' '.repeat(w - 2) + '│');
  stamp(g, x, y + h - 1, '└' + '─'.repeat(w - 2) + '┘');
  if (spent) { stamp(g, x + 2, y + 3, 'SPENT'); return; }
  stamp(g, x + 2, y + 1, card.name.slice(0, w - 3));
  if (card.dirs) stamp(g, x + 2, y + 2, cardLabel(card).slice(0, w - 3));      // the quad
  wrap(card.desc, w - 4).slice(0, 3).forEach((ln, i) => stamp(g, x + 2, y + 4 + i, ln));
}

function drawButton(g, r, dim) {
  stamp(g, r.x, r.y, '┌' + '─'.repeat(r.w - 2) + '┐');
  stamp(g, r.x, r.y + 1, '│' + ' '.repeat(r.w - 2) + '│');
  stamp(g, r.x, r.y + 2, '└' + '─'.repeat(r.w - 2) + '┘');
  const t = dim ? r.label.replace('▶', '·') : r.label;
  stamp(g, r.x + Math.max(1, Math.floor((r.w - t.length) / 2)), r.y + 1, t);
}

function drawAssemble(g, game) {
  center(g, 3, 'ASSEMBLE THE BEAM');
  center(g, 4, 'slotted cards MERGE into one beam — order does not matter, which cards do');
  stamp(g, 2, 5, `DECK: ${game.run.deck.length} cards    PTS: ${game.run.points}`);
  // badge shows how many copies of this card the deck holds
  game.hand.forEach((h, i) => {
    const n = game.run.deck.filter((c) => c.id === h.card.id).length;
    drawCard(g, HAND_CARDS[i].x, HAND_CARDS[i].y, `x${n}`, h.card, h.used);
  });
  stamp(g, 6, 17, 'SLOTS');
  stamp(g, 16, 17, Array.from({ length: SLOTS }, (_, i) =>
    `[ ${(game.program[i] ? game.program[i].name : '......').padEnd(10).slice(0, 10)} ]`).join(' + '));
  const merged = mergeBeam(game.program.filter(Boolean));
  stamp(g, 6, 19, 'BEAM');
  stamp(g, 16, 19, game.program.some(Boolean) ? beamLabel(merged) : '(slot cards to compose a beam)');
  center(g, 22, 'tap a card to slot it · then AIM the turret at a sector');
  drawButton(g, BTN_REDRAW, game.run.points < REDRAW_COST);
  drawButton(g, BTN_UNDO, false);
  drawButton(g, BTN_EXEC, !game.program.some(Boolean));
}

function drawDraft(g, game) {
  center(g, 3, 'DRAFT — warez off the breached machine; bank one into your deck');
  game.draft.forEach((c, i) => drawCard(g, DRAFT_CARDS[i].x, DRAFT_CARDS[i].y, String(i + 1), c, false));
  center(g, 19, 'tap a card to keep it');
}

function drawCharSelect(g, game) {
  center(g, 3, 'SELECT YOUR JACK-IN');
  center(g, 4, 'how you break in — your turret style for this whole run');
  const chars = (game.run && game.run.availChars) || CHARACTERS;
  chars.slice(0, 3).forEach((ch, i) => drawCard(g, DRAFT_CARDS[i].x, DRAFT_CARDS[i].y, String(i + 1),
    { name: ch.name, desc: ch.desc }, false));
  center(g, 19, chars.length < CHARACTERS.length ? 'tap a jack-in · unlock more in the ROOT shop' : 'tap a jack-in to begin');
}

function drawShop(g, game) {
  const d = game.shopData || { root: 0, retry: 0, overclock: false, items: [] };
  center(g, 3, 'ROOT SHOP');
  stamp(g, 4, 5, `ROOT: ${d.root}    retry tokens held: ${d.retry}${d.overclock ? '    OVERCLOCK ARMED' : ''}`);
  d.items.forEach((it, i) => {
    const r = shopRow(i);
    const tag = it.owned ? 'OWNED' : `${it.cost} ROOT`;
    const line = `[${i + 1}] ${it.name.padEnd(23)}${tag.padStart(9)}  ${it.desc}`;
    stamp(g, r.x, r.y, line.slice(0, r.w));
  });
  drawButton(g, BTN_JACKIN, false);
  stamp(g, 4, 32, (game.message || '').slice(0, COLS - 4));
  center(g, 38, 'tap an item to buy · number keys buy · [ENTER] / JACK IN starts the next run');
}

// The board: terrain, plus (during exec) the beam's burn heat, pending spine, the
// descending trace scan, and reclaim flashes. `sim` present => a battle is live.
function drawBoard(g, machine, sim, sector) {
  const params = sim ? sim.params : null;
  for (let y = 0; y < FIELD_H; y++) {
    const spineCol = (sim && sector && y <= sim.spineRow) ? spineX(params, y) : -1;   // not-yet-emitted beam
    for (let x = 0; x < FIELD_W; x++) {
      const c = idx(x, y);
      let ch;
      if (sim && sector && y === sim.scanRow && sim.scanRow < FIELD_H && x >= sector.x0 && x <= sector.x1) ch = '#';  // scan line
      else if (sim && sim.reclaimed && sim.reclaimed.has(c)) ch = 'X';                // reclaim flash
      else if (machine.burned[c]) ch = machine.t[c] === VAULT ? '$' : sim ? rampGlyph(sim.heat[c]) : '#';
      else if (x === spineCol) ch = '|';                                              // pending spine
      else ch = TERRAIN_G[machine.t[c]];
      g[FIELD_TOP + y][x] = ch;
    }
  }
}

// The turret marker: a ▲ on the bottom field row under the trigger column.
function drawTurret(g, col) {
  if (col == null || col < 0 || col >= FIELD_W) return;
  g[FIELD_TOP + FIELD_H - 1][col] = '▲';
}

function drawTarget(g, game) {
  const { machine } = game.run;
  drawBoard(g, machine, null, null);
  machine.sectors.forEach((s) => {
    const label = s.conquered ? `${s.id} ·OWNED·` : `${s.id} ${s.difficulty}`;
    stamp(g, s.x0 + 1, FIELD_TOP, label.slice(0, s.x1 - s.x0));
  });
  const merged = mergeBeam(game.program.filter(Boolean));
  const a = game.run.aggression, base = game.run.baseAggro;
  drawButton(g, BTN_AGGRO_DOWN, game.run.points < AGGRO_REDUCE_COST);
  drawButton(g, BTN_AGGRO_UP, false);
  stamp(g, 24, 36, `BEAM ${beamLabel(merged)}`.slice(0, COLS - 24));
  stamp(g, 24, 37, `AGGRO x${a.toFixed(2)}  ·  reward x${rewardMult(a, base).toFixed(2)}  ·  ${draftPicks(a, base)} draft`);
  if (base < AGGRO_BASE) stamp(g, 24, 38, 'TRAINING RUN — trace runs slow');
  center(g, 39, `tap a sector column to fire the turret there · HARDER free · SAFER -${AGGRO_REDUCE_COST} PTS`);
}

function drawBurning(g, game) {
  const node = game.node, sim = node.sim;
  drawBoard(g, node.machine, sim, node.sector);
  drawTurret(g, sim.params.p);
  node.machine.sectors.forEach((s) => {
    const tag = s.conquered ? `${s.id} ·OWNED·` : s === node.sector ? `${s.id} «BURNING»` : s.id;
    stamp(g, s.x0 + 1, FIELD_TOP, tag.slice(0, s.x1 - s.x0));
  });
  stamp(g, 0, 36, `EMBERS ${String(sim.embers.length).padStart(4)}   BEAM ${beamLabel(mergeBeam(node.program.filter(Boolean)))}`.slice(0, COLS));
  const cp = crackPct(node);
  const breach = sim.breachLeft > 0 ? ` HOLD ${sim.breachLeft}` : sim.breachLeft === 0 ? ' BREACH!' : '';
  stamp(g, 0, 37, `COVERAGE ${bar(cp, 28)} ${cp.toFixed(0)}%/${WIN_COVERAGE}%${breach}`);
  const log = node.log.slice(-2);
  stamp(g, 0, 38, (log[0] || '').slice(0, COLS));
  stamp(g, 0, 39, (log[1] || game.message || '').slice(0, COLS));
}

export function buildScreen(game) {
  const g = blank();
  const { phase, run, node } = game;

  const tracePct = node ? (node.sim.scanRow / FIELD_H) * 100 : 0;
  stamp(g, 0, 0, `TIER ${run.tier}: THE MACHINE   CONQUERED ${run.conquered}/3   ROOT:${run.root}`);
  if (node) stamp(g, 54, 0, `TRACE${bar(tracePct, 8)} ${node.sim.scanRow}/${FIELD_H}`);

  let code = 'CODE  ';
  for (let i = 0; i < CODE_DIGITS; i++) code += (run.locked[i] ? String(run.code[i]) : '_') + ' ';
  stamp(g, 0, 1, code);
  stamp(g, 0, 2, game.prompt || '');

  if (phase === 'charselect') drawCharSelect(g, game);
  else if (phase === 'assemble') drawAssemble(g, game);
  else if (phase === 'draft') drawDraft(g, game);
  else if (phase === 'target') drawTarget(g, game);
  else if (phase === 'shop') drawShop(g, game);
  else if (node) drawBurning(g, game);

  if (phase === 'result' || phase === 'tierclear' || phase === 'gameover') {
    drawButton(g, BTN_CONTINUE, false);
    stamp(g, 0, 39, (game.message || '').slice(0, COLS));
  }
  return g.map((r) => r.join('')).join('\n');
}
