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
import { FIELD_OY, FIELD_OX, COLS } from './layout.js';

const TWO_PI = Math.PI * 2;
const PERIOD = 1400;      // active-burn pulse: one dim->bright->dim cycle (ms)
const DIM = 0.35, FULL = 1, MED = 0.72, DARK = 0.12;
const FLASH_MS = 150;     // the single conquer flash
const FAST_PERIOD = 500;  // celebration pulse, ~2x the active pulse
const FAST_PULSES = 4;
const CELEB_END = FLASH_MS + FAST_PERIOD * FAST_PULSES;

// Detonation (the ×N payoff, §3 ▅): the burned mass surges white-hot and solid
// for DET_FLASH, then eases back to its breathing pulse over DET_GLOW. Fired from
// main.js the frame a mult card lands, in sync with the pass-hold + trauma shake.
const DET_FLASH = 150;
const DET_GLOW = 320;
const DET_TOTAL = DET_FLASH + DET_GLOW;

// prefers-reduced-motion path: keep the brightness STATES (a burn still reads as
// bright, a conquer still settles to a locked grid) but drop the rapid flashes and
// slow the breathing pulse — the photosensitivity concern from juice-model §6.
let reduced = false;
export function setReducedMotion(v) { reduced = !!v; }
const pulsePeriod = () => (reduced ? PERIOD * 2 : PERIOD);

const wave = (dt, p) => 0.5 - 0.5 * Math.cos(TWO_PI * dt / p); // 0 at dt=0, 1 at p/2
const round2 = (v) => Math.round(v * 100) / 100;

// BLOCK column -> sector index (single block => all 0; any gap stays -1)
const SECTOR_OF = new Int8Array(FIELD_W).fill(-1);
SECTORS.forEach((s, i) => { for (let x = s.x0; x <= s.x1; x++) SECTOR_OF[x] = i; });

// visual state lives here, keyed to the machine so a new run resets it. Pulse
// phase reads machine.bornAt (set when a cell burns); this map only tracks each
// conquered sector's celebration start.
let state = { machine: null, celeb: new Map(), det: { at: -1e9, strength: 0 } };
function sync(machine) {
  if (state.machine !== machine) state = { machine, celeb: new Map(), det: { at: -1e9, strength: 0 } };
}

// main.js calls this the frame a mult card detonates (now = performance.now()).
// strength (roughly 0..1.5) rides the resulting energy so a bigger boom glows
// harder; the flash timing itself is fixed so the beat reads consistently.
export function detonate(now, strength = 1) {
  state.det = { at: now, strength: Math.max(0, Math.min(1.5, strength)) };
}

const esc = (ch) => ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '&' ? '&amp;' : ch;
const escLine = (ln) => ln.replace(/[<>&]/g, esc);

// the memory block is drawn in the FIELD panel for every phase except the shop
// (which fills the field area with the item list instead)
function boardShown(game) {
  return !!(game.run && game.run.machine) && game.phase !== 'shop';
}

// mark each conquered sector's celebration start the first frame we see it owned
function markConquered(machine, now) {
  for (const sec of machine.sectors) if (sec.conquered && !state.celeb.has(sec.id)) state.celeb.set(sec.id, now);
}

// x,y are BLOCK coordinates (0..FIELD_W-1, 0..FIELD_H-1); ch is the glyph there.
function cellStyle(ch, x, y, machine, now) {
  const si = SECTOR_OF[x];
  if (si < 0) return { cls: '', op: 1, ch };
  const sec = machine.sectors[si];
  const burned = machine.burned[idx(x, y)] === 1;
  if (sec.conquered) {
    const el = now - (state.celeb.get(sec.id) ?? now);
    if (burned) {
      // reduced motion: skip the flash + fast pulses, go straight to the settled grid.
      if (!reduced) {
        if (el < FLASH_MS) return { cls: 'hot', op: 1, ch };
        if (el < CELEB_END) return { cls: 'brn', op: round2(DIM + (FULL - DIM) * wave(el - FLASH_MS, FAST_PERIOD)), ch };
      }
      // settled: locked-in grid — pull board glyphs to '#', never touch labels
      return { cls: 'brn', op: MED, ch: (ch === '@') ? '#' : ch };
    }
    return (!reduced && el < CELEB_END) ? { cls: '', op: 1, ch } : { cls: '', op: DARK, ch }; // ground goes dark
  }
  if (burned) {
    const born = machine.bornAt[idx(x, y)] || now;
    const pulse = round2(DIM + (FULL - DIM) * wave(now - born, pulsePeriod()));
    const det = now - state.det.at;
    if (!reduced && det >= 0 && det < DET_TOTAL) {
      // the detonation surge: solid white-hot mass, then ease back to the pulse.
      if (det < DET_FLASH) return { cls: 'hot', op: 1, ch: ch === '@' ? '#' : ch };
      // afterglow floor rides strength — a bigger boom cools down from brighter.
      const k = (1 - (det - DET_FLASH) / DET_GLOW) * Math.min(1, state.det.strength);
      return { cls: 'brn', op: round2(Math.max(pulse, DIM + (FULL - DIM) * k)), ch };
    }
    return { cls: 'brn', op: pulse, ch };
  }
  return { cls: '', op: 1, ch };
}

// `line` is the full 80-wide screen row; `y` is the block row. Only screen columns
// that fall inside the block (offset by FIELD_OX) get brightness spans; the field
// borders, the gutter, and everything else pass through raw.
function composeRow(line, y, machine, now) {
  let out = '', buf = '', key = null, cls = '', op = 1;
  const flush = () => {
    if (!buf) return;
    if (key === 'RAW') out += buf;
    else out += (cls ? `<span class="${cls}" style="opacity:${op}">` : `<span style="opacity:${op}">`) + buf + '</span>';
    buf = '';
  };
  for (let sx = 0; sx < COLS; sx++) {
    const ch = line[sx] ?? ' ';
    const bx = sx - FIELD_OX;
    const s = (bx < 0 || bx >= FIELD_W) ? { cls: '', op: 1, ch } : cellStyle(ch, bx, y, machine, now);
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
    lines[i] = (i >= FIELD_OY && i < FIELD_OY + FIELD_H)
      ? composeRow(lines[i], i - FIELD_OY, machine, now)
      : escLine(lines[i]);
  }
  return lines.join('\n');
}
