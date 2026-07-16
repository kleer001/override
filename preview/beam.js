// L-system growth calibration sandbox — DOM wiring (research/lsystem-growth.md).
// Pure sim lives in src/beam.js; this file only reads controls, drives ticks off
// the rate timer, and renders the field. URL params:
//   ?seed=1&sector=0   seed = uint, sector index (single-block build ⇒ 0)

import {
  createSim, stepSim, coverage, spineX, shapeOffset, defaultParams, heatAt,
  FIELD_W, FIELD_H, SECTORS, WALL, idx, SHAPE_KEYS,
} from '../src/beam.js';
import { OPEN, HARD, BUS, HONEY } from '../src/terrain.js';
import { CARDS, buildChain, sanitizeGrammar } from '../src/cards.js';

const q = new URLSearchParams(location.search);
let seed = (parseInt(q.get('seed'), 10) || 1) >>> 0;
let sectorIndex = Math.max(0, Math.min(SECTORS.length - 1, parseInt(q.get('sector'), 10) || 0));

// terrain glyphs + burned-strength density ramp (juice-model)
const TERR_GLYPH = { [OPEN]: ' ', [HARD]: '▒', [WALL]: '█', [BUS]: '═', [HONEY]: '!' };
const RAMP = ['·', ':', '=', '+', '*', '@', '%'];   // cold → hot burn
const rampGlyph = (heat) => (heat <= 0 ? RAMP[0] : RAMP[Math.min(RAMP.length - 1, 1 + Math.floor(heat / 3))]);

const $ = (id) => document.getElementById(id);
let P = defaultParams();
let sim, running = false, timer = null;

// --- presets: the roster archetypes, built from real cards through buildChain, so
// tuned numbers port straight to the game. Each is an ordered connector chain (§7).
const PRESETS = {
  STARTER:  ['SCRIPT.COM', 'FORK.COM'],
  CURTAIN:  ['BUFFER.OVR', 'ROOTKIT', 'WORM'],
  HARMONIC: ['WORM', 'HARMONIC', 'PAYLOAD'],
  FENCE:    ['BLUEBOX', 'BLUEBOX', 'LOGICBOMB'],
  GLITCH:   ['TANGENT', 'TANGENT', 'WORM'],
  '0DAY':   ['0DAY'],
};

function applyPreset(name) {
  const merged = buildChain(PRESETS[name].map((n) => CARDS[n]));
  for (const k of SHAPE_KEYS) P.shapes[k] = !!merged.shapes[k];
  P.amp = merged.amp; P.freq = merged.freq;
  P.chain = merged.chain.map((s) => ({ ...s }));
  // reflect the first segment's growth on the manual controls
  const s0 = P.chain[0];
  P.grammar = s0.grammar; P.pace = s0.pace; P.seeds = s0.seeds; P.connector = s0.connector;
  syncControlsFromP();
  build();
}

// Manual controls edit a SINGLE-segment chain; presets load multi-card chains.
// Grammar is validated through the game's own sanitizeGrammar so the sandbox and the
// shipping card path can't drift.
function singleChain() {
  return [{ grammar: sanitizeGrammar($('grammar').value), pace: +$('pace').value, seeds: +$('seeds').value, connector: $('connector').value }];
}

// --- build / reset ---
function build() {
  P.p = clampCol(P.p);
  sim = createSim(seed, sectorIndex, P);
  stop();
  $('secid').textContent = sim.sector.id;
  $('diff').textContent = sim.sector.difficulty;
  $('seedval').textContent = seed;
  $('chainlen').textContent = P.chain.length;
  render();
}
function clampCol(x) { return Math.max(0, Math.min(FIELD_W - 1, x | 0)); }

// --- timer driven by the display rate (ms) ---
function start() {
  if (timer) return;
  running = true;
  timer = setInterval(() => { if (running && !sim.outcome) { stepSim(sim); render(); } }, +$('rate').value);
}
function stop() { running = false; if (timer) { clearInterval(timer); timer = null; } }
function restartTimer() { if (running) { stop(); start(); } }

// --- render the field ---
function render() {
  const rows = [];
  for (let y = 0; y < FIELD_H; y++) {
    let line = '';
    for (let x = 0; x < FIELD_W; x++) {
      const c = idx(x, y);
      let ch;
      if (y === sim.scanRow && sim.scanRow < FIELD_H) ch = '#';           // scan line
      else if (sim.reclaimed.has(c)) ch = 'X';                            // reclaim flash
      else if (sim.machine.burned[c]) ch = rampGlyph(heatAt(sim, c));     // burned brightness
      else ch = TERR_GLYPH[sim.machine.t[c]] ?? ' ';                      // terrain
      line += ch;
    }
    rows.push(line);
  }
  $('screen').textContent = rows.join('\n');

  $('cov').textContent = coverage(sim).toFixed(1);
  $('covneed').textContent = `/ ${P.winCoverage}%`;
  $('strands').textContent = sim.turtles.length;
  $('scanrow').textContent = `${sim.scanRow} / ${FIELD_H}`;
  $('breach').textContent = sim.breachLeft < 0 ? '—' : `${sim.breachLeft} ticks`;
  $('tickval').textContent = sim.tick;
  $('retread').textContent = sim.reTread;
  const st = $('status');
  st.className = 'stat big' + (sim.outcome === 'win' ? ' win' : sim.outcome === 'traced' ? ' lose' : '');
  st.textContent = sim.outcome === 'win' ? '>> BREACHED.' :
    sim.outcome === 'traced' ? '>> TRACED. run ends.' : running ? 'running…' : 'paused.';
  renderWave();
}

// --- live ASCII preview of the summed waveform (Fourier sum of the spine) ---
function renderWave() {
  const W = 21, mid = W >> 1, rows = [];
  for (let y = 0; y < FIELD_H; y++) {
    const col = Math.round(shapeOffset(P, y));
    const cl = Math.max(-mid, Math.min(mid, col));
    const line = Array(W).fill(' ');
    line[mid] = '·';
    line[mid + cl] = Math.abs(col) > mid ? '!' : '*';
    rows.push(line.join(''));
  }
  $('wave').textContent = rows.join('\n');
}

// --- control wiring ---
// Scalars are safe to mutate on the LIVE sim (sim.params === P); the CHAIN is not —
// changing its length mid-run would orphan the turtles' segment indices, so chain
// edits rebuild a fresh sim instead.
const RANGE_KEYS = ['p', 'amp', 'freq', 'pace', 'seeds', 'seedFan', 'rate', 'scanSpeed', 'reclaim', 'breachHold', 'winCoverage'];
// pace/seeds reshape the chain (rebuild); everything else is a live-safe scalar.
const CHAIN_RANGE = ['pace', 'seeds'];
const SCALAR_KEYS = RANGE_KEYS.filter((k) => !CHAIN_RANGE.includes(k));

function readScalarsIntoP() {
  P.p = clampCol(+$('p').value);
  P.amp = +$('amp').value; P.freq = +$('freq').value;
  P.seedFan = +$('seedFan').value;
  P.scanSpeed = +$('scanSpeed').value; P.reclaim = +$('reclaim').value;
  P.breachHold = +$('breachHold').value; P.winCoverage = +$('winCoverage').value;
  for (const k of SHAPE_KEYS) P.shapes[k] = $('sh_' + k).checked;
}
// Manual chain edits replace the (possibly multi-segment preset) chain with the
// single segment the controls describe, then rebuild.
function applyChainAndBuild() {
  readScalarsIntoP();
  P.chain = singleChain();
  build();
}

function syncControlsFromP() {
  $('p').value = P.p; $('amp').value = P.amp; $('freq').value = P.freq;
  $('grammar').value = P.grammar || 'FFFFF';
  $('pace').value = P.pace || 3; $('seeds').value = P.seeds || 10;
  $('connector').value = P.connector || 'SCATTER';
  $('seedFan').value = P.seedFan;
  $('scanSpeed').value = P.scanSpeed; $('reclaim').value = P.reclaim;
  $('breachHold').value = P.breachHold; $('winCoverage').value = P.winCoverage;
  for (const k of SHAPE_KEYS) $('sh_' + k).checked = P.shapes[k];
  updateOutputs();
}

function updateOutputs() {
  for (const k of RANGE_KEYS) { const o = $(k + '_o'); if (o) o.textContent = $(k).value; }
}

function wireControls() {
  for (const k of SCALAR_KEYS) {
    $(k).addEventListener('input', () => { readScalarsIntoP(); updateOutputs(); if (k === 'rate') restartTimer(); render(); });
  }
  // chain-shaping controls rebuild a fresh sim (chain length must not change live)
  for (const k of CHAIN_RANGE) $(k).addEventListener('input', () => { updateOutputs(); applyChainAndBuild(); });
  $('grammar').addEventListener('input', applyChainAndBuild);
  $('connector').addEventListener('change', applyChainAndBuild);
  for (const k of SHAPE_KEYS) $('sh_' + k).addEventListener('change', () => { readScalarsIntoP(); render(); });

  $('play').onclick = () => { readScalarsIntoP(); if (sim.outcome) build(); start(); render(); };
  $('pause').onclick = () => { stop(); render(); };
  $('step').onclick = () => { stop(); readScalarsIntoP(); if (!sim.outcome) stepSim(sim); render(); };
  $('reset').onclick = () => applyChainAndBuild();
  $('reseed').onclick = () => { seed = (Math.imul(seed, 48271) + 1) >>> 0; build(); };
  $('sector').addEventListener('change', () => { sectorIndex = +$('sector').value; P.p = (SECTORS[sectorIndex].x0 + SECTORS[sectorIndex].x1) >> 1; syncControlsFromP(); build(); });
  for (const name of Object.keys(PRESETS)) $('pre_' + name).onclick = () => applyPreset(name);
}

// --- boot: build the dynamic control fragments then wire ---
function boot() {
  const SHAPE_LABEL = { linear: 'Linear', sine: 'Sine', sine2: 'Sine2', sine3: 'Sine3', rect: 'Rect-sin', tan: 'Tan', saw: 'Saw' };
  $('shapes').innerHTML = SHAPE_KEYS.map((k) =>
    `<label class="cb"><input type="checkbox" id="sh_${k}"> ${SHAPE_LABEL[k]}</label>`).join('');
  $('sector').innerHTML = SECTORS.map((s, i) => `<option value="${i}">${s.id}</option>`).join('');
  $('sector').value = sectorIndex;
  $('presets').innerHTML = Object.keys(PRESETS).map((n) => `<button id="pre_${n}">${n}</button>`).join('');

  P.p = (SECTORS[sectorIndex].x0 + SECTORS[sectorIndex].x1) >> 1;
  const s0 = P.chain[0];
  P.grammar = s0.grammar; P.pace = s0.pace; P.seeds = s0.seeds; P.connector = s0.connector;
  syncControlsFromP();
  wireControls();
  build();
}

boot();
