// Shared screen geometry — imported by BOTH the renderer and the pointer
// hit-tester so clickable regions can never drift from what's drawn.
// All coordinates are in character-grid cells (col, row) on the 80x40 screen.
//
// The play screen is ONE window of three STATIC panels (they persist across every
// phase; only their contents swap as play modulates):
//   FIELD   cols 0-63, rows 0-29  — the memory block (drawn at a 1-cell inset)
//   GUTTER  cols 64-79, rows 0-29 — run state + phase controls
//   TRAY    cols 0-79,  rows 30-39 — cards (hand / draft / jack-ins)

import { REDRAW_COST } from './battle.js';

export const COLS = 80;
export const ROWS = 40;

// --- the three panels ---
export const FIELD = { x: 0, y: 0, w: 64, h: 30 };
export const GUTTER = { x: 64, y: 0, w: 16, h: 30 };
export const TRAY = { x: 0, y: 30, w: 80, h: 10 };

// the memory block draws at a 1-cell inset inside FIELD (border on all sides)
export const FIELD_OX = 1, FIELD_OY = 1;
// FIELD_TOP kept for any legacy reference: the block's first screen row
export const FIELD_TOP = FIELD_OY;

// during AIM the whole block interior is the fire target (tap a column to fire)
export const FIELD_FIRE = { x: FIELD_OX, y: FIELD_OY, w: 62, h: 28 };

// tray: five hand cards, 15 wide x 8 tall, inset one row into the tray
export const HAND_CARDS = Array.from({ length: 5 }, (_, i) => ({ x: 2 + i * 15, y: 31, w: 15, h: 8 }));

// draft / char-select: three cards centered in the tray (pitch 17)
const DRAFT_X0 = Math.floor((COLS - (3 * 15 + 2 * 2)) / 2);
export const DRAFT_CARDS = Array.from({ length: 3 }, (_, i) => ({ x: DRAFT_X0 + i * 17, y: 31, w: 15, h: 8 }));

// gutter control stack — assemble and aim reuse the same three slots
const GBTN = (row) => ({ x: 65, y: row, w: 14, h: 3 });
export const BTN_REDRAW = { ...GBTN(20), label: `REDRAW -${REDRAW_COST}` };
export const BTN_UNDO = { ...GBTN(23), label: 'UNDO' };
export const BTN_AIM = { ...GBTN(26), label: 'AIM ▶' };
export const BTN_AGGRO_DOWN = { ...GBTN(20), label: '◀ SAFER' };
export const BTN_AGGRO_UP = { ...GBTN(23), label: 'HARDER ▶' };

// result / shop overlays (centered banners on the field)
export const BTN_CONTINUE = { x: 23, y: 21, w: 18, h: 3, label: 'CONTINUE ▶' };
export const BTN_JACKIN = { x: 23, y: 26, w: 18, h: 3, label: 'JACK IN ▶' };

// shop: one tappable row per item inside the field area
export const shopRow = (i) => ({ x: 2, y: 7 + i, w: 60, h: 1 });

export function inRect(col, row, r) {
  return col >= r.x && col < r.x + r.w && row >= r.y && row < r.y + r.h;
}
