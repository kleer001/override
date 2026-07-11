// Compose the whole 80x40 screen as one monospace text buffer.
// Monochrome amber: glyph density carries meaning, not colour.
//
// The central region (rows 3-35) is contextual:
//   - assemble / draft -> a card-selection panel (the decision takes the stage)
//   - exec / result    -> the living cellular-automata board (the spectacle)

import { FIELD_W, FIELD_H, WALL_COLS, LINK_ROWS, NONE, WORM, ICE, WALL } from './board.js';
import { LOCKDOWN, CODE_DIGITS, crackPct } from './battle.js';
import { evalProgram } from './cards.js';

export const COLS = 80;
export const ROWS = 40;
const FIELD_TOP = 3;

const WORM_G = ['·', '·', '·', ':', '=', '+', '*', '@', '%', '%'];
const ICE_G  = ['#', '#', '#', '#', 'X', 'X', 'X', '█', '█', '█'];

function blankRows() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(' '));
}

function stamp(g, x, y, text) {
  if (y < 0 || y >= ROWS) return;
  for (let i = 0; i < text.length; i++) {
    const cx = x + i;
    if (cx >= 0 && cx < COLS) g[y][cx] = text[i];
  }
}

function center(g, y, text) {
  stamp(g, Math.max(0, Math.floor((COLS - text.length) / 2)), y, text);
}

function bar(pct, width) {
  const filled = Math.round((pct / 100) * width);
  return '[' + '#'.repeat(filled) + '.'.repeat(width - filled) + ']';
}

function hex(n) { return '0x' + (n & 0xffff).toString(16).toUpperCase().padStart(4, '0'); }

function wrap(text, width) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > width) { lines.push(cur.trim()); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur.trim());
  return lines;
}

// --- a boxed instruction card, 15 wide x 8 tall ---
function drawCard(g, x, y, keyLabel, card, spent) {
  const w = 15, h = 8;
  const top = '┌' + `[${keyLabel}]` + '─'.repeat(w - 2 - (keyLabel.length + 2)) + '┐';
  stamp(g, x, y, top);
  for (let r = 1; r < h - 1; r++) stamp(g, x, y + r, '│' + ' '.repeat(w - 2) + '│');
  stamp(g, x, y + h - 1, '└' + '─'.repeat(w - 2) + '┘');
  if (spent) {
    stamp(g, x + 2, y + 3, 'SPENT');
    return;
  }
  stamp(g, x + 2, y + 1, card.name.slice(0, w - 3));
  const lines = wrap(card.desc, w - 4).slice(0, 3);
  lines.forEach((ln, i) => stamp(g, x + 2, y + 3 + i, ln));
  stamp(g, x + 2, y + h - 2, card.kind.toUpperCase());
}

// live accumulator readout, e.g. "0 +3 +3 x2 = 12"
function accPreview(program) {
  const loaded = program.filter(Boolean);
  if (!loaded.length) return { expr: '(load cards to preview)', value: 0 };
  const tok = loaded.map((c) => {
    if (c.kind === 'add') return `+${c.value}`;
    if (c.kind === 'mult') return `x${c.value}`;
    if (c.kind === 'nop') return '(nop)';
    if (c.kind === 'goto') return '(goto)';
    if (c.kind === 'fork') return '(fork)';
    if (c.kind === 'interrupt') return '(int)';
    return '?';
  });
  return { expr: '0 ' + tok.join(' '), value: evalProgram(loaded).value };
}

function drawAssemble(g, game) {
  center(g, 3, 'ASSEMBLE INTRUSION');
  center(g, 4, 'instructions run left→right on a CPU accumulator — adds early, x late');

  // 5 hand cards across (15 wide each, start x=2)
  game.hand.forEach((h, i) => drawCard(g, 2 + i * 15, 7, String(i + 1), h.card, h.used));

  // program-in-progress
  stamp(g, 6, 17, 'PROGRAM');
  const slots = [0, 1, 2].map((i) => {
    const c = game.program[i];
    return `[ ${(c ? c.name : '......').padEnd(9).slice(0, 9)} ]`;
  });
  stamp(g, 16, 17, slots.join(' → '));

  const p = accPreview(game.program);
  stamp(g, 6, 19, 'ACCUMULATOR');
  stamp(g, 18, 19, `${p.expr}   =  ${p.value}  crack/pass`);

  const n = game.selection.length;
  center(g, 22, n < 3
    ? `slot ${n}/3 — press 1-5 to load, [BACKSPACE] to undo`
    : 'ready — press [ENTER] to EXEC and watch it run');

  // lower third intentionally open for future art / animation
}

function drawDraft(g, game) {
  center(g, 3, 'DRAFT — bank an instruction into your deck');
  const startX = Math.floor((COLS - (3 * 15 + 2 * 2)) / 2);
  game.draft.forEach((c, i) => drawCard(g, startX + i * 17, 9, String(i + 1), c, false));
  center(g, 19, 'press 1-3 to keep a card');
}

function glyphFor(owner, s, x, y) {
  if (owner === WALL) return '|';
  if (WALL_COLS.includes(x) && LINK_ROWS.includes(y) && owner === NONE) return '+';
  if (owner === WORM) return WORM_G[Math.max(0, Math.min(9, s))];
  if (owner === ICE) return ICE_G[Math.max(0, Math.min(9, s))];
  return s <= 0 ? ' ' : s === 1 ? '·' : ':';
}

function drawBoard(g, game) {
  const b = game.battle.board;
  for (let y = 0; y < FIELD_H; y++) {
    for (let x = 0; x < FIELD_W; x++) {
      const i = y * FIELD_W + x;
      g[FIELD_TOP + y][x] = glyphFor(b.owner[i], b.str[i], x, y);
    }
  }
  const d = b.frame >> 3;
  stamp(g, 2, FIELD_TOP, `KERNEL ${hex(0x7f3a + d)}`);
  stamp(g, 30, FIELD_TOP, `IO.SYS ${hex(0x40c1 + d * 2)}`);
  stamp(g, 58, FIELD_TOP, `SWAP ${hex(0xa10c + d)}`);

  // program track + crack bar + log live under the board during exec/result
  stamp(g, 0, 36, 'PROGRAM  ');
  const slots = [0, 1, 2].map((i) => {
    const card = game.program[i];
    const name = (card ? card.name : '......').padEnd(9).slice(0, 9);
    const active = game.phase === 'exec' && game.playhead === i;
    return active ? `[>${name}<]` : `[ ${name} ]`;
  });
  stamp(g, 9, 36, slots.join(''));

  const cp = crackPct(game.battle);
  stamp(g, 0, 37, `CRACK ${bar(cp, 40)} ${cp.toFixed(0)}%   TERR ${game.battle.territory.toFixed(0)}%`);

  const log = game.battle.log.slice(-2);
  stamp(g, 0, 38, (log[0] || '').slice(0, COLS));
  stamp(g, 0, 39, (log[1] || game.message || '').slice(0, COLS));
}

export function buildScreen(game) {
  const g = blankRows();
  const { phase, run, battle } = game;

  // HUD (rows 0-2), always present
  const lockPct = battle ? (battle.pass / LOCKDOWN) * 100 : 0;
  stamp(g, 0, 0, `TIER ${run.tier}: THE MACHINE   NODE ${run.node}/3   ROOT:${run.root}`);
  stamp(g, 54, 0, `LOCKDOWN${bar(lockPct, 8)} ${battle ? battle.pass : 0}/${LOCKDOWN}`);

  let code = 'CODE  ';
  for (let i = 0; i < CODE_DIGITS; i++) {
    code += (battle && i < battle.codeLocked ? String(battle.code[i]) : '_') + ' ';
  }
  stamp(g, 0, 1, code);
  stamp(g, 0, 2, game.prompt || '');

  if (phase === 'assemble') drawAssemble(g, game);
  else if (phase === 'draft') drawDraft(g, game);
  else if (battle) drawBoard(g, game);

  // result / end messages get the bottom line even over a panel
  if (phase === 'result' || phase === 'tierclear' || phase === 'gameover') {
    stamp(g, 0, 39, (game.message || '').slice(0, COLS));
  }

  return g.map((row) => row.join('')).join('\n');
}
