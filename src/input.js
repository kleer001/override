// Unified pointer input — mirrors finding_numbers' approach: a single
// pointerdown listener covers mouse AND touch, and clientX/Y is mapped to a
// character-grid cell via the screen element's bounding rect.

import { COLS, ROWS } from './layout.js';

export function installPointer(el, onTapCell) {
  const toCell = (e) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const col = Math.floor(((e.clientX - rect.left) / rect.width) * COLS);
    const row = Math.floor(((e.clientY - rect.top) / rect.height) * ROWS);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    return { col, row };
  };

  // pointerdown handles mouse + touch + pen in one path (no double-firing)
  window.addEventListener('pointerdown', (e) => {
    const c = toCell(e);
    if (!c) return; // tap landed outside the grid (caption, margins)
    e.preventDefault();
    onTapCell(c.col, c.row);
  }, { passive: false });
}
