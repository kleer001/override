// Compose the whole 80x40 screen as one monospace text buffer.
// Monochrome amber: glyph density carries meaning, not colour.

import { FIELD_W, FIELD_H, WALL_COLS, LINK_ROWS, NONE, WORM, ICE, WALL, stats } from './board.js';
import { LOCKDOWN, CODE_DIGITS, TARGET, crackPct } from './battle.js';

export const COLS = 80;
export const ROWS = 40;
const FIELD_TOP = 3; // screen row where the field begins

const WORM_G = ['·', '·', '·', ':', '=', '+', '*', '@', '%', '%'];
const ICE_G  = ['#', '#', '#', '#', 'X', 'X', 'X', '█', '█', '█'];

function blankRows() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(' '));
}

function stamp(grid, x, y, text) {
  if (y < 0 || y >= ROWS) return;
  for (let i = 0; i < text.length; i++) {
    const cx = x + i;
    if (cx >= 0 && cx < COLS) grid[y][cx] = text[i];
  }
}

function bar(pct, width) {
  const filled = Math.round((pct / 100) * width);
  return '[' + '#'.repeat(filled) + '.'.repeat(width - filled) + ']';
}

function hex(n) {
  return '0x' + (n & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

function glyphFor(owner, s, x, y) {
  if (owner === WALL) return '|';
  if (WALL_COLS.includes(x) && LINK_ROWS.includes(y) && owner === NONE) return '+'; // link gap
  if (owner === WORM) return WORM_G[Math.max(0, Math.min(9, s))];
  if (owner === ICE) return ICE_G[Math.max(0, Math.min(9, s))];
  return s <= 0 ? ' ' : s === 1 ? '·' : ':';
}

export function buildScreen(game) {
  const g = blankRows();
  const { phase, run, battle } = game;

  // --- HUD (rows 0-2) ---
  const lockPct = battle ? (battle.pass / LOCKDOWN) * 100 : 0;
  stamp(g, 0, 0,
    `TIER ${run.tier}: THE MACHINE   NODE ${run.node}/3   ROOT:${run.root}`);
  stamp(g, 54, 0, `LOCKDOWN${bar(lockPct, 8)} ${battle ? battle.pass : 0}/${LOCKDOWN}`);

  // CODE row
  let code = 'CODE  ';
  if (battle) {
    for (let i = 0; i < CODE_DIGITS; i++) {
      code += (i < battle.codeLocked ? String(battle.code[i]) : '_') + ' ';
    }
  } else code += '_ _ _ _ _ _ _ _ ';
  stamp(g, 0, 1, code);
  stamp(g, 0, 2, game.prompt || '');

  // --- FIELD (rows 3..35) ---
  if (battle) {
    const b = battle.board;
    for (let y = 0; y < FIELD_H; y++) {
      for (let x = 0; x < FIELD_W; x++) {
        const i = y * FIELD_W + x;
        g[FIELD_TOP + y][x] = glyphFor(b.owner[i], b.str[i], x, y);
      }
    }
    // island labels + drifting addresses along the top edge of the field
    const d = b.frame >> 3;
    stamp(g, 2, FIELD_TOP, `KERNEL ${hex(0x7f3a + d)}`);
    stamp(g, 30, FIELD_TOP, `IO.SYS ${hex(0x40c1 + d * 2)}`);
    stamp(g, 58, FIELD_TOP, `SWAP ${hex(0xa10c + d)}`);
  }

  // --- PROGRAM TRACK (row 36) ---
  stamp(g, 0, 36, 'PROGRAM  ');
  const slots = [0, 1, 2].map((i) => {
    const card = game.program[i];
    const name = card ? card.name : '......';
    const active = phase === 'exec' && game.playhead === i;
    const cell = ` ${name.padEnd(9).slice(0, 9)} `;
    return active ? `[>${cell.slice(1, -1)}<]` : `[${cell}]`;
  });
  stamp(g, 9, 36, slots.join(''));

  // --- CRACK BAR (row 37) ---
  const cp = battle ? crackPct(battle) : 0;
  const terr = battle ? battle.territory : 0;
  stamp(g, 0, 37,
    `CRACK ${bar(cp, 40)} ${cp.toFixed(0)}%   TERR ${terr.toFixed(0)}%`);

  // --- BOTTOM (rows 38-39): log / hand / draft / message ---
  if (phase === 'assemble') {
    const hand = game.hand
      .map((c, i) => `[${i + 1}]${c.used ? '·'.repeat(c.name.length) : c.name}`)
      .join(' ');
    stamp(g, 0, 38, ('HAND  ' + hand).slice(0, COLS));
    const n = game.program.filter(Boolean).length;
    stamp(g, 0, 39, `SLOT ${n}/3 — 1-5 load · [BKSP] undo · [ENTER] EXEC`);
  } else if (phase === 'draft') {
    const opts = game.draft.map((c, i) => `[${i + 1}]${c.name}`).join('   ');
    stamp(g, 0, 38, ('DRAFT ' + opts).slice(0, COLS));
    stamp(g, 0, 39, 'choose a card to keep — press 1-3');
  } else {
    const log = battle ? battle.log.slice(-2) : [];
    stamp(g, 0, 38, (log[0] || '').slice(0, COLS));
    stamp(g, 0, 39, (log[1] || game.message || '').slice(0, COLS));
  }

  return g.map((row) => row.join('')).join('\n');
}
