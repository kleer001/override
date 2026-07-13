// Per-cell brightness compositor for the memory field. buildScreen() owns the
// glyphs; this layer wraps burned field cells in brightness spans so a capture
// is felt, not just tallied:
//   - each cluster pulses on a sine, phased to when it first ignited (cells that
//     burn in the same frame share a birth time, so they breathe together);
//   - conquering a sector (KERNEL / IO.SYS / SWAP) fires a one-shot celebration:
//     a single flash, four fast in-unison pulses, then it settles to a steady
//     grid of '#' with the sector's unburned ground gone dark.
// The board is rendered via innerHTML, so every emitted char is HTML-escaped.

import { FIELD_W, FIELD_H, SECTORS, idx } from './terrain.js';
import { FIELD_TOP, COLS } from './layout.js';

const TWO_PI = Math.PI * 2;
const PERIOD = 1400;      // active-burn pulse: one dim->bright->dim cycle (ms)
const DIM = 0.35, FULL = 1, MED = 0.72, DARK = 0.12;
const FLASH_MS = 150;     // the single conquer flash
const FAST_PERIOD = 500;  // celebration pulse, ~2x the active pulse
const FAST_PULSES = 4;
const CELEB_END = FLASH_MS + FAST_PERIOD * FAST_PULSES;

const wave = (dt, p) => 0.5 - 0.5 * Math.cos(TWO_PI * dt / p); // 0 at dt=0, 1 at p/2
const round2 = (v) => Math.round(v * 100) / 100;

// column -> sector index (firewall gaps stay -1)
const SECTOR_OF = new Int8Array(FIELD_W).fill(-1);
SECTORS.forEach((s, i) => { for (let x = s.x0; x <= s.x1; x++) SECTOR_OF[x] = i; });

// visual state lives here, keyed to the machine so a new run resets it. Pulse
// phase reads machine.bornAt (set when a cell burns); this map only tracks each
// conquered sector's celebration start.
let state = { machine: null, celeb: new Map() };
function sync(machine) {
  if (state.machine !== machine) state = { machine, celeb: new Map() };
}

const esc = (ch) => ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '&' ? '&amp;' : ch;
const escLine = (ln) => ln.replace(/[<>&]/g, esc);

// render.js draws the field for the target phase and any node-bearing exec/result
function boardShown(game) {
  return game.phase === 'target' ||
    (game.node && ['exec', 'result', 'tierclear', 'gameover'].includes(game.phase));
}

// mark each conquered sector's celebration start the first frame we see it owned
function markConquered(machine, now) {
  for (const sec of machine.sectors) if (sec.conquered && !state.celeb.has(sec.id)) state.celeb.set(sec.id, now);
}

function cellStyle(row, x, y, machine, now) {
  const ch = row[x] ?? ' ';
  const si = SECTOR_OF[x];
  if (si < 0) return { cls: '', op: 1, ch };                 // firewall gap
  // field row 0 carries the sector labels (buildScreen stamps them there) —
  // leave it unstyled so a burn never dims or clobbers the label text.
  if (y === 0) return { cls: '', op: 1, ch };
  const sec = machine.sectors[si];
  const burned = machine.burned[idx(x, y)] === 1;
  if (sec.conquered) {
    const el = now - (state.celeb.get(sec.id) ?? now);
    if (burned) {
      if (el < FLASH_MS) return { cls: 'hot', op: 1, ch };
      if (el < CELEB_END) return { cls: 'brn', op: round2(DIM + (FULL - DIM) * wave(el - FLASH_MS, FAST_PERIOD)), ch };
      // settled: locked-in grid — pull board glyphs to '#', never touch labels
      return { cls: 'brn', op: MED, ch: (ch === '@' || ch === '$') ? '#' : ch };
    }
    return el < CELEB_END ? { cls: '', op: 1, ch } : { cls: '', op: DARK, ch }; // ground goes dark
  }
  if (burned) {
    const born = machine.bornAt[idx(x, y)] || now;
    return { cls: 'brn', op: round2(DIM + (FULL - DIM) * wave(now - born, PERIOD)), ch };
  }
  return { cls: '', op: 1, ch };
}

function composeRow(row, y, machine, now) {
  let out = '', buf = '', key = null, cls = '', op = 1;
  const flush = () => {
    if (!buf) return;
    if (key === 'RAW') out += buf;
    else out += (cls ? `<span class="${cls}" style="opacity:${op}">` : `<span style="opacity:${op}">`) + buf + '</span>';
    buf = '';
  };
  for (let x = 0; x < COLS; x++) {
    const s = cellStyle(row, x, y, machine, now);
    const k = (s.cls === '' && s.op === 1) ? 'RAW' : `${s.cls}|${s.op}`;
    if (k !== key) { flush(); key = k; cls = s.cls; op = s.op; }
    buf += escLine(s.ch);
  }
  flush();
  return out;
}

export function composeBoard(text, game, now) {
  const lines = text.split('\n');
  const machine = game.run && game.run.machine;
  if (!machine || !boardShown(game)) return lines.map(escLine).join('\n');
  sync(machine);
  markConquered(machine, now);
  for (let i = 0; i < lines.length; i++) {
    lines[i] = (i >= FIELD_TOP && i < FIELD_TOP + FIELD_H)
      ? composeRow(lines[i], i - FIELD_TOP, machine, now)
      : escLine(lines[i]);
  }
  return lines.join('\n');
}
