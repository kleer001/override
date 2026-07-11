// Shared screen geometry — imported by BOTH the renderer and the pointer
// hit-tester so clickable regions can never drift from what's drawn.
// All coordinates are in character-grid cells (col, row) on the 80x40 screen.

export const COLS = 80;
export const ROWS = 40;

// assemble: five hand cards across (15 wide x 8 tall), starting at x=2, y=7
export const HAND_CARDS = Array.from({ length: 5 }, (_, i) => ({
  x: 2 + i * 15, y: 7, w: 15, h: 8,
}));

// assemble action buttons
export const BTN_UNDO = { x: 18, y: 24, w: 14, h: 3, label: 'UNDO' };
export const BTN_EXEC = { x: 46, y: 24, w: 16, h: 3, label: 'EXEC ▶' };

// draft: three cards centered (15 wide, 2-col gaps -> pitch 17), y=9
const DRAFT_X0 = Math.floor((COLS - (3 * 15 + 2 * 2)) / 2);
export const DRAFT_CARDS = Array.from({ length: 3 }, (_, i) => ({
  x: DRAFT_X0 + i * 17, y: 9, w: 15, h: 8,
}));

// result / tier-clear / game-over: one continue button
export const BTN_CONTINUE = { x: 31, y: 31, w: 18, h: 3, label: 'CONTINUE ▶' };

export function inRect(col, row, r) {
  return col >= r.x && col < r.x + r.w && row >= r.y && row < r.y + r.h;
}
