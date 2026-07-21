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

// the memory block draws at a 1-cell inset inside FIELD (border on all sides).
// FIELD_OX/FIELD_OY are the single source of truth for the block→screen offset —
// both the renderer and the juice compositor map through them.
export const FIELD_OX = 1, FIELD_OY = 1;

// during AIM the whole block interior is the fire target (tap a column to fire)
export const FIELD_FIRE = { x: FIELD_OX, y: FIELD_OY, w: 62, h: 28 };

// tray: five hand cards (14 wide x 8 tall) with a big START button to their right
export const HAND_CARDS = Array.from({ length: 5 }, (_, i) => ({ x: 2 + i * 14, y: 31, w: 14, h: 8 }));
// the primary "go" control — a tall, thumb-sized button right beside the cards.
// In assemble it reads START (enters AIM); in the AIM phase the same button reads
// LAUNCH (fires at the oscillating turret's current column).
export const BTN_START = { x: 72, y: 31, w: 7, h: 8, label: 'START' };
export const BTN_FIRE = { x: 72, y: 31, w: 7, h: 8, label: 'LAUNCH' };

// draft / char-select: three cards centered in the tray (pitch 17)
const DRAFT_X0 = Math.floor((COLS - (3 * 15 + 2 * 2)) / 2);
export const DRAFT_CARDS = Array.from({ length: 3 }, (_, i) => ({ x: DRAFT_X0 + i * 17, y: 31, w: 15, h: 8 }));

// author (tutorial): the three symbol keys + delete build a grammar; RUN fires the
// survival test. Big thumb-sized buttons across the tray, RUN beside them like FIRE.
export const AUTHOR_SYMS = [
  { sym: 'F', x: 3, y: 31, w: 11, h: 8, label: 'F' },
  { sym: 'L', x: 16, y: 31, w: 11, h: 8, label: 'L' },
  { sym: 'R', x: 29, y: 31, w: 11, h: 8, label: 'R' },
];
export const BTN_AUTHOR_DEL = { x: 42, y: 31, w: 11, h: 8, label: 'DEL' };
export const BTN_AUTHOR_RUN = { x: 72, y: 31, w: 7, h: 8, label: 'RUN' };

// gutter control stack — REDRAW/TEST in assemble (low, so the slotted card's
// text above has room), RESET/PLAY on the test bench, aggression in aim.
// (Unloading a slotted card is done by tapping the card again — no button.)
const GBTN = (row) => ({ x: 65, y: row, w: 14, h: 3 });
export const BTN_REDRAW = { ...GBTN(23), label: `REDRAW -${REDRAW_COST}` };
export const BTN_TEST = { ...GBTN(26), label: 'TEST' };
export const BTN_TEST_RESET = { ...GBTN(23), label: 'RESET' };
export const BTN_TEST_PLAY = { ...GBTN(26), label: 'PLAY ▶' };
export const BTN_AGGRO_DOWN = { ...GBTN(20), label: '◀ SAFER' };
export const BTN_AGGRO_UP = { ...GBTN(23), label: 'HARDER ▶' };

// result / shop overlays (centered banners on the field). CONTINUE is drawn extra
// large (2 cells past a snug box on every edge) so it reads unmistakably — though on
// the result screen a tap ANYWHERE advances, since there's nothing else to do.
export const BTN_CONTINUE = { x: 21, y: 19, w: 22, h: 7, label: 'CONTINUE ▶' };
export const BTN_JACKIN = { x: 23, y: 26, w: 18, h: 3, label: 'JACK IN ▶' };

// cold-open cinematic: a small persistent SKIP, live through every beat (Esc/Enter also
// skips). Low-right, over empty space so it never clobbers the civilian STATUS panel.
export const BTN_SKIP = { x: 66, y: 26, w: 13, h: 3, label: 'SKIP ▶' };
// after the contact finishes, a chunky centered gate to read at your own pace before
// the tutorial (Enter/Space/tap also advance).
export const BTN_READY = { x: 27, y: 24, w: 26, h: 5, label: "I'M READY ▶" };

// title / boot screen (a full-screen takeover): CONTINUE resumes saved progress,
// NEW wipes the save and starts fresh. Chunky, thumb-sized buttons.
export const BTN_TITLE_CONTINUE = { x: 14, y: 24, w: 24, h: 5, label: '[C]ONTINUE' };
export const BTN_TITLE_NEW = { x: 42, y: 24, w: 24, h: 5, label: '[N]EW' };

// shop: each item is a 2-row slot inside the field area — the name+type+price
// line and the description below it, with a blank row between items (pitch 3).
export const shopRow = (i) => ({ x: 3, y: 7 + i * 3, w: 57, h: 2 });

export function inRect(col, row, r) {
  return col >= r.x && col < r.x + r.w && row >= r.y && row < r.y + r.h;
}
