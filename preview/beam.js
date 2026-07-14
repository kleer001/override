// Beam-Card Model calibration sandbox — DOM wiring (research/ember-model.md §13).
// Pure sim lives in beam-sim.js; this file only reads controls, drives ticks off
// the emission-rate timer, and renders the 80×33 grid. URL params:
//   ?seed=1&sector=0   seed = uint, sector = 0..2 (KERNEL / IO.SYS / SWAP)

import {
  createSim, stepSim, coverage, spineX, shapeOffset, defaultParams,
  FIELD_W, FIELD_H, SECTORS, WALL, idx, DIR_KEYS, SHAPE_KEYS,
} from './beam-sim.js';
import { OPEN, HARD, BUS, VAULT, HONEY } from '../src/terrain.js';

const q = new URLSearchParams(location.search);
let seed = (parseInt(q.get('seed'), 10) || 1) >>> 0;
let sectorIndex = Math.max(0, Math.min(2, parseInt(q.get('sector'), 10) || 0));

// terrain glyphs + burned-strength density ramp (task spec / juice-model)
const TERR_GLYPH = { [OPEN]: ' ', [HARD]: '▒', [WALL]: '█', [BUS]: '═', [VAULT]: '$', [HONEY]: '!' };
const RAMP = ['·', ':', '=', '+', '*', '@', '%'];   // cold → hot burn
const rampGlyph = (heat) => {
  if (heat <= 0) return RAMP[0];
  const i = Math.min(RAMP.length - 1, 1 + Math.floor(heat / 2));
  return RAMP[i];
};

const $ = (id) => document.getElementById(id);
let P = defaultParams();
let sim, running = false, timer = null;

// --- presets: the five escalation stacks, end-states (ember-model.md §6) ---
// These mirror the merged card-decks validated headless in beam-balance.js: one
// SHARED REACH pool + per-ember cap (pool is a terminal meta-stat, §4), and each
// stack's growth (reproduce / spreadReach) comes from its cards' GROWTH aspect
// (§3). The depth/width trade falls out of ember count (dirs × prob): CURTAIN
// spreads the shared pool thin over many embers, LANCE concentrates it deep.
// Calibrated (16 seeds × 3 sectors): CURTAIN/HARMONIC ~80% (strong ~5/6), the
// weak starter 0%, growth-off ablation caps ~56% — growth is load-bearing.
const POOL = 800, REACHCAP = 20;   // shared terminal REACH stat for all stacks
const PRESETS = {
  CURTAIN: { shapes: ['linear'], amp: 0, freq: 2, dirs: ['←', '→'], probMode: 'prob', prob: 100, pool: POOL, reachCap: REACHCAP, reproduce: 0.60, spreadReach: 6 },
  LANCE:   { shapes: ['linear'], amp: 0, freq: 2, dirs: ['→'], probMode: 'prob', prob: 50, pool: POOL, reachCap: REACHCAP, reproduce: 0.20, spreadReach: 4 },
  HARMONIC:{ shapes: ['sine', 'sine2', 'sine3'], amp: 6, freq: 2, dirs: ['←', '→'], probMode: 'prob', prob: 100, pool: POOL, reachCap: REACHCAP, reproduce: 0.60, spreadReach: 8 },
  FENCE:   { shapes: ['rect', 'saw'], amp: 5, freq: 3, dirs: ['↑', '↓'], probMode: 'prob', prob: 100, pool: POOL, reachCap: REACHCAP, reproduce: 0.40, spreadReach: 6 },
  GLITCH:  { shapes: ['tan', 'sine'], amp: 5, freq: 2, dirs: ['←', '→'], probMode: 'prob', prob: 45, pool: POOL, reachCap: REACHCAP, reproduce: 0.40, spreadReach: 8 },
};

function applyPreset(name) {
  const pr = PRESETS[name];
  for (const k of SHAPE_KEYS) P.shapes[k] = pr.shapes.includes(k);
  P.amp = pr.amp; P.freq = pr.freq;
  P.dirs = new Set(pr.dirs);
  P.probMode = pr.probMode; P.prob = pr.prob;
  P.pool = pr.pool; P.reachCap = pr.reachCap;
  P.reproduce = pr.reproduce; P.spreadReach = pr.spreadReach;
  syncControlsFromP();
  build();
}

// --- build / reset ---
function build() {
  P.p = clampCol(P.p);
  sim = createSim(seed, sectorIndex, P);
  stop();
  $('secid').textContent = sim.sector.id;
  $('diff').textContent = sim.sector.difficulty;
  $('seedval').textContent = seed;
  render();
}
function clampCol(x) { return Math.max(0, Math.min(FIELD_W - 1, x | 0)); }

// --- timer driven by emission rate (ms) ---
function start() {
  if (timer) return;
  running = true;
  timer = setInterval(() => { if (running && !sim.outcome) { stepSim(sim); render(); } }, +$('rate').value);
}
function stop() { running = false; if (timer) { clearInterval(timer); timer = null; } }
function restartTimer() { if (running) { stop(); start(); } }

// --- render the 80×33 grid ---
function render() {
  const rows = [];
  for (let y = 0; y < FIELD_H; y++) {
    const pendSpine = y <= sim.spineRow ? spineX(P, y) : -1;   // not-yet-emitted beam column
    let line = '';
    for (let x = 0; x < FIELD_W; x++) {
      const c = idx(x, y);
      let ch;
      if (y === sim.scanRow && sim.scanRow < FIELD_H) ch = '#';           // scan line
      else if (sim.reclaimed.has(c)) ch = 'X';                            // reclaim flash
      else if (sim.machine.burned[c]) ch = rampGlyph(sim.heat[c]);        // burned strength
      else if (x === pendSpine) ch = '|';                                 // pending spine
      else ch = TERR_GLYPH[sim.machine.t[c]] ?? ' ';                      // terrain
      line += ch;
    }
    rows.push(line);
  }
  $('screen').textContent = rows.join('\n');

  const cov = coverage(sim);
  $('cov').textContent = cov.toFixed(1);
  $('covneed').textContent = `/ ${P.winCoverage}%`;
  $('embers').textContent = sim.embers.length;
  $('scanrow').textContent = `${sim.scanRow} / ${FIELD_H}`;
  $('breach').textContent = sim.breachLeft < 0 ? '—' : `${sim.breachLeft} ticks`;
  $('tickval').textContent = sim.tick;
  const st = $('status');
  st.className = 'stat big' + (sim.outcome === 'win' ? ' win' : sim.outcome === 'traced' ? ' lose' : '');
  st.textContent = sim.outcome === 'win' ? '>> BREACHED.' :
    sim.outcome === 'traced' ? '>> TRACED. run ends.' : running ? 'running…' : 'paused.';
  renderWave();
}

// --- live ASCII preview of the summed waveform (Fourier sum) ---
function renderWave() {
  const W = 21, mid = W >> 1, rows = [];
  for (let y = 0; y < FIELD_H; y++) {
    let col = Math.round(shapeOffset(P, y));
    const cl = Math.max(-mid, Math.min(mid, col));
    const line = Array(W).fill(' ');
    line[mid] = '·';                                     // centre (trigger column)
    line[mid + cl] = Math.abs(col) > mid ? '!' : '*';    // '!' = clipped off-board
    rows.push(line.join(''));
  }
  $('wave').textContent = rows.join('\n');
}

// --- control wiring ---
const RANGE_KEYS = ['p', 'amp', 'freq', 'prob', 'maskN', 'pool', 'reachCap', 'spreadReach', 'reproduce', 'rate', 'scanSpeed', 'reclaim', 'breachHold', 'winCoverage'];

function readControlsIntoP() {
  P.p = clampCol(+$('p').value);
  P.amp = +$('amp').value;
  P.freq = +$('freq').value;
  P.prob = +$('prob').value;
  P.maskN = +$('maskN').value;
  P.pool = +$('pool').value;
  P.reachCap = +$('reachCap').value;
  P.spreadReach = +$('spreadReach').value;
  P.reproduce = +$('reproduce').value;
  P.scanSpeed = +$('scanSpeed').value;
  P.reclaim = +$('reclaim').value;
  P.breachHold = +$('breachHold').value;
  P.winCoverage = +$('winCoverage').value;
  P.probMode = $('probMode').value;
  for (const k of SHAPE_KEYS) P.shapes[k] = $('sh_' + k).checked;
  P.dirs = new Set(DIR_KEYS.filter((d) => $('dir_' + DIR_KEYS.indexOf(d)).checked));
}

function syncControlsFromP() {
  $('p').value = P.p; $('amp').value = P.amp; $('freq').value = P.freq;
  $('prob').value = P.prob; $('maskN').value = P.maskN;
  $('pool').value = P.pool; $('reachCap').value = P.reachCap;
  $('spreadReach').value = P.spreadReach; $('reproduce').value = P.reproduce;
  $('scanSpeed').value = P.scanSpeed; $('reclaim').value = P.reclaim;
  $('breachHold').value = P.breachHold; $('winCoverage').value = P.winCoverage;
  $('probMode').value = P.probMode;
  for (const k of SHAPE_KEYS) $('sh_' + k).checked = P.shapes[k];
  DIR_KEYS.forEach((d, i) => { $('dir_' + i).checked = P.dirs.has(d); });
  updateOutputs();
}

function updateOutputs() {
  for (const k of RANGE_KEYS) { const o = $(k + '_o'); if (o) o.textContent = $(k).value; }
}

function wireControls() {
  for (const k of RANGE_KEYS) {
    $(k).addEventListener('input', () => { readControlsIntoP(); updateOutputs(); if (k === 'rate') restartTimer(); render(); });
  }
  $('probMode').addEventListener('change', () => { readControlsIntoP(); render(); });
  for (const k of SHAPE_KEYS) $('sh_' + k).addEventListener('change', () => { readControlsIntoP(); render(); });
  DIR_KEYS.forEach((d, i) => $('dir_' + i).addEventListener('change', () => { readControlsIntoP(); render(); }));

  $('play').onclick = () => { readControlsIntoP(); if (sim.outcome) build(); start(); render(); };
  $('pause').onclick = () => { stop(); render(); };
  $('step').onclick = () => { stop(); readControlsIntoP(); if (!sim.outcome) stepSim(sim); render(); };
  $('reset').onclick = () => { readControlsIntoP(); build(); };
  $('reseed').onclick = () => { seed = (Math.imul(seed, 48271) + 1) >>> 0; build(); };
  $('sector').addEventListener('change', () => { sectorIndex = +$('sector').value; P.p = (SECTORS[sectorIndex].x0 + SECTORS[sectorIndex].x1) >> 1; syncControlsFromP(); build(); });
  for (const name of Object.keys(PRESETS)) $('pre_' + name).onclick = () => applyPreset(name);
}

// --- boot: build the dynamic control fragments then wire ---
function boot() {
  // shape checkboxes
  const SHAPE_LABEL = { linear: 'Linear', sine: 'Sine', sine2: 'Sine2', sine3: 'Sine3', rect: 'Rect-sin', tan: 'Tan', saw: 'Saw' };
  $('shapes').innerHTML = SHAPE_KEYS.map((k) =>
    `<label class="cb"><input type="checkbox" id="sh_${k}"> ${SHAPE_LABEL[k]}</label>`).join('');
  // direction checkboxes
  $('dirs').innerHTML = DIR_KEYS.map((d, i) =>
    `<label class="cb"><input type="checkbox" id="dir_${i}"> ${d}</label>`).join('');
  // sector picker
  $('sector').innerHTML = SECTORS.map((s, i) => `<option value="${i}">${s.id}</option>`).join('');
  $('sector').value = sectorIndex;
  // presets
  $('presets').innerHTML = Object.keys(PRESETS).map((n) => `<button id="pre_${n}">${n}</button>`).join('');

  P.p = (SECTORS[sectorIndex].x0 + SECTORS[sectorIndex].x1) >> 1;
  syncControlsFromP();
  wireControls();
  build();
}

boot();
