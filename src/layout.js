// Shared screen geometry — imported by BOTH the renderer and the pointer
// hit-tester so clickable regions can never drift from what's drawn.
// All coordinates are in character-grid cells (col, row) on the 80x40 screen.

import { SECTORS } from './terrain.js';
import { REDRAW_COST } from './battle.js';

export const COLS = 80;
export const ROWS = 40;
export const FIELD_TOP = 3;

// tappable sector columns (target-select phase)
export const SECTOR_RECTS = SECTORS.map((s) => ({
  x: s.x0, y: FIELD_TOP, w: s.x1 - s.x0 + 1, h: 33, id: s.id,
}));

// assemble: five hand cards across (15 wide x 8 tall), starting at x=2, y=7
export const HAND_CARDS = Array.from({ length: 5 }, (_, i) => ({
  x: 2 + i * 15, y: 7, w: 15, h: 8,
}));

// assemble action buttons
export const BTN_REDRAW = { x: 2, y: 24, w: 14, h: 3, label: `REDRAW -${REDRAW_COST}` };
export const BTN_UNDO = { x: 18, y: 24, w: 14, h: 3, label: 'UNDO' };
export const BTN_EXEC = { x: 46, y: 24, w: 16, h: 3, label: 'AIM ▶' };

// draft: three cards centered (15 wide, 2-col gaps -> pitch 17), y=9
const DRAFT_X0 = Math.floor((COLS - (3 * 15 + 2 * 2)) / 2);
export const DRAFT_CARDS = Array.from({ length: 3 }, (_, i) => ({
  x: DRAFT_X0 + i * 17, y: 9, w: 15, h: 8,
}));

// target phase: adjust aggression (risk/reward) before committing to a sector
export const BTN_AGGRO_DOWN = { x: 2, y: 36, w: 22, h: 3, label: 'SAFER ◀' };
export const BTN_AGGRO_UP = { x: 56, y: 36, w: 22, h: 3, label: '▶ HARDER' };

// ROOT shop: one tappable row per item, then a jack-in button
export const shopRow = (i) => ({ x: 4, y: 7 + i, w: 72, h: 1 });
export const BTN_JACKIN = { x: 31, y: 34, w: 18, h: 3, label: 'JACK IN ▶' };

// result / tier-clear / game-over: one continue button
export const BTN_CONTINUE = { x: 31, y: 31, w: 18, h: 3, label: 'CONTINUE ▶' };

export function inRect(col, row, r) {
  return col >= r.x && col < r.x + r.w && row >= r.y && row < r.y + r.h;
}
