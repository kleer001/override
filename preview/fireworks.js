// Devices / combo / fireworks calibration sandbox — DOM wiring.
// Unlike preview/beam.js (which hand-rolls its row renderer), this drives the REAL
// pipeline — buildScreen -> composeBoard, render.js device telegraphs + drawFx,
// juice.detonate, the trauma shake and the synth — so what you see and hear is exactly
// what the game produces. The sim stays the canonical src/beam.js. URL: ?seed=1.

import { createSimOn, stepSim, DEFAULT_DEVICE_TUNING, FIELD_W, FIELD_H, WALL, idx } from '../src/beam.js';
import { generateMachine, OPEN, LANCE, NOVA, FREEZE } from '../src/terrain.js';
import { buildScreen, FX_MS } from '../src/render.js';
import { composeBoard, detonate, setReducedMotion } from '../src/juice.js';
import { createTrauma } from '../src/shake.js';
import { sfx, resumeAudio } from '../src/audio.js';
import { buildChain, sanitizeGrammar } from '../src/cards.js';
import { mulberry32, randInt } from '../src/rng.js';

const q = new URLSearchParams(location.search);
let seed = (parseInt(q.get('seed'), 10) || 1) >>> 0;

const $ = (id) => document.getElementById(id);
const screen = $('screen');
const crtEl = document.querySelector('.crt');
const clock = () => performance.now();
const clampCol = (x) => Math.max(0, Math.min(FIELD_W - 1, x | 0));

// The live-mutated tuning object handed to the sim via params.deviceTuning — the combo
// sliders write straight into it, and drainDetonations re-reads it each detonation, so
// changes take effect on the next blast without a rebuild.
const tuning = { ...DEFAULT_DEVICE_TUNING };

// A game-shaped object, same shape main.js paints from (phase 'exec', run.machine,
// node.sim, fx buffer, reduceMotion). node carries the couple of fields the gutter reads.
const game = {
  phase: 'exec', run: { root: 0, deck: [], machine: null }, node: null,
  program: [null, null, null], hand: [], draft: [],
  message: '', bannerLines: [], fx: [], reduceMotion: false,
};
let sim = null, running = false, stepTimer = null;

// --- trauma shake (real src/shake.js), applied to .crt every frame like main.js ---
const trauma = createTrauma();
const kick = (a) => { if (!game.reduceMotion) trauma.add(a); };
let lastFrame = 0;
function applyShake(t) {
  const dt = lastFrame ? t - lastFrame : 16; lastFrame = t;
  trauma.decay(dt);
  if (!crtEl) return;
  if (trauma.value <= 0) { crtEl.style.transform = ''; return; }
  const s = trauma.shake();
  crtEl.style.transform = `translate(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px) rotate(${s.rot.toFixed(3)}deg)`;
}

// --- board salting: clear generator-placed devices, then plant the requested counts ---
const wallAdj = (t, x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
  const nx = x + dx, ny = y + dy;
  return nx >= 0 && nx < FIELD_W && ny >= 0 && ny < FIELD_H && t[idx(nx, ny)] === WALL;
});
function deviceBag() {
  const bag = [];
  for (let i = 0; i < +$('lance').value; i++) bag.push(LANCE);
  for (let i = 0; i < +$('nova').value; i++) bag.push(NOVA);
  for (let i = 0; i < +$('freeze').value; i++) bag.push(FREEZE);
  return bag;
}
function salt(machine, rng) {
  const t = machine.t;
  for (let i = 0; i < t.length; i++) if (t[i] >= LANCE) t[i] = OPEN;   // wipe generator devices
  const bag = deviceBag();
  if ($('lineup').checked) {
    // stack the devices up the trigger column, spaced under a lance's reach, so the first
    // blast drills onto the next → a visible cascade with the combo climbing each link.
    const p = clampCol(+$('p').value);
    let y = FIELD_H - 1; while (y > 0 && t[idx(p, y)] === WALL) y--;
    const spacing = Math.max(2, tuning.lanceBase - 1);
    for (const type of bag) { if (y < 0) break; t[idx(p, y)] = type; y -= spacing; }
    return;
  }
  // scatter: drillers prefer cells hard against firewall (so they open something), a
  // FREEZE just needs open ground.
  const open = [], drill = [];
  for (let yy = 0; yy < FIELD_H; yy++) for (let xx = 0; xx < FIELD_W; xx++) {
    const c = idx(xx, yy); if (t[c] !== OPEN) continue;
    open.push(c); if (wallAdj(t, xx, yy)) drill.push(c);
  }
  const take = (pref) => {
    const src = pref.length ? pref : open; if (!src.length) return null;
    const c = src.splice(randInt(rng, 0, src.length - 1), 1)[0];
    let j = open.indexOf(c); if (j >= 0) open.splice(j, 1);
    j = drill.indexOf(c); if (j >= 0) drill.splice(j, 1);
    return c;
  };
  for (const type of bag) { const c = (type === FREEZE) ? take(open) : take(drill); if (c != null) t[c] = type; }
}

// --- build a fresh sim over a freshly salted board ---
function makeParams() {
  return {
    p: clampCol(+$('p').value),
    chain: buildChain([{ grammar: sanitizeGrammar($('grammar').value), pace: +$('pace').value, connector: 'SCATTER' }]).chain,
    collision: true,
    scanSpeed: +$('scanSpeed').value,
    reclaim: 6, breachHold: 15, winCoverage: 50, survivalMinCells: 10,
    deviceTuning: tuning,
  };
}
function build() {
  stop();
  const machine = generateMachine(seed);
  salt(machine, mulberry32((seed ^ 0x1234abcd) >>> 0));
  sim = createSimOn(machine, 0, makeParams(), mulberry32((seed ^ 0x9e3779b9) >>> 0));
  game.run.machine = machine;
  game.node = { sim, beamLines: [], aggro: 1 };
  game.fx = [];
  $('seedval').textContent = seed;
  $('diff').textContent = machine.sectors[0].difficulty;
  updateOutputs();
  paint(clock());
}

// --- one sim tick: mirror main.js › startExec detonation handling ---
function stepOnce() {
  if (!sim || sim.outcome) { stop(); return; }
  const snap = stepSim(sim);
  if (snap.detonations && snap.detonations.length) {
    for (const d of snap.detonations) {
      const combo = d.combo || 1;
      if (!game.reduceMotion) {
        game.fx.push({ ...d, at: clock() });
        detonate(clock(), Math.min(1.5, 0.6 + combo * 0.15));
      }
      kick(Math.min(1, 0.35 + combo * 0.12));
      if (d.type === 'FREEZE') sfx.ice(); else sfx.mult(Math.max(2, combo + 1));
    }
  }
}

// --- step timer (rate slider) + continuous rAF paint (wall-clock, so telegraphs spin
// and FX animate between ticks, exactly like the game's anim loop) ---
function start() { if (stepTimer) return; running = true; stepTimer = setInterval(stepOnce, +$('rate').value); }
function stop() { running = false; if (stepTimer) { clearInterval(stepTimer); stepTimer = null; } }
function restartTimer() { if (running) { stop(); start(); } }

function paint(now) {
  if (game.fx.length) game.fx = game.fx.filter((f) => now - f.at < FX_MS);   // drop spent motion
  screen.innerHTML = composeBoard(buildScreen(game, now), game, now);
  let devLeft = 0;
  for (let i = 0; i < sim.machine.t.length; i++) if (sim.machine.t[i] >= LANCE && !sim.machine.burned[i]) devLeft++;
  $('cov').textContent = sim.cov.toFixed(1);
  $('combo').textContent = sim.combo;
  $('strands').textContent = sim.turtles.length;
  $('scanrow').textContent = `${sim.scanRow} / ${FIELD_H}`;
  $('fxcount').textContent = game.fx.length;
  $('tickval').textContent = sim.tick;
  $('devleft').textContent = devLeft;
  const st = $('status');
  st.className = 'stat big' + (sim.outcome === 'win' ? ' win' : sim.outcome === 'traced' ? ' lose' : '');
  st.textContent = sim.outcome === 'win' ? '>> BREACHED.' : sim.outcome === 'traced' ? '>> TRACED. run ends.'
    : running ? 'running…' : 'paused.';
}
function loop(t) { applyShake(t); if (sim) paint(t); requestAnimationFrame(loop); }

// --- controls ---
const OUT_KEYS = ['p', 'pace', 'lance', 'nova', 'freeze', 'scanSpeed', 'rate',
  'comboWindow', 'comboMax', 'lanceBase', 'lanceStep', 'lanceMax', 'novaBase', 'novaMax', 'freezeBase', 'freezeMax'];
const REBUILD = ['p', 'grammar', 'pace', 'lance', 'nova', 'freeze', 'scanSpeed'];
const TUNE = ['comboWindow', 'comboMax', 'lanceBase', 'lanceStep', 'lanceMax', 'novaBase', 'novaMax', 'freezeBase', 'freezeMax'];
const updateOutputs = () => { for (const k of OUT_KEYS) { const o = $(k + '_o'); if (o) o.textContent = $(k).value; } };
const readTuning = () => { for (const k of TUNE) tuning[k] = +$(k).value; };

function wire() {
  for (const k of REBUILD) $(k).addEventListener('input', () => { updateOutputs(); build(); });
  $('lineup').addEventListener('change', build);
  for (const k of TUNE) $(k).addEventListener('input', () => { readTuning(); updateOutputs(); });
  $('rate').addEventListener('input', () => { updateOutputs(); restartTimer(); });
  $('reduce').addEventListener('change', () => { game.reduceMotion = $('reduce').checked; setReducedMotion(game.reduceMotion); });
  $('play').onclick = () => { if (sim.outcome) build(); start(); };
  $('pause').onclick = () => { stop(); };
  $('step').onclick = () => { stop(); stepOnce(); };
  $('reset').onclick = () => build();
  $('reseed').onclick = () => { seed = (Math.imul(seed, 48271) + 1) >>> 0; build(); };
  window.addEventListener('pointerdown', resumeAudio, { once: true });
  window.addEventListener('keydown', resumeAudio, { once: true });
}

// --- boot ---
readTuning();
updateOutputs();
build();
wire();
requestAnimationFrame(loop);
