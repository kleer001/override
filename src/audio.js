// Tiny procedural chiptune synth — no samples, no licensing. Oscillators + gain
// envelopes. All SFX are generated live; see AUDIO-APPENDIX.md for the plan.

let ctx = null;
let enabled = true;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function resumeAudio() { ac(); }
export function toggleAudio() { enabled = !enabled; return enabled; }

function blip(freq, dur, type = 'square', vol = 0.18, slideTo = null) {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.12) {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  const gain = c.createGain();
  src.buffer = buf;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(gain).connect(c.destination);
  src.start(t);
}

export const sfx = {
  ui: () => blip(560, 0.05, 'triangle', 0.14),
  load: () => blip(420, 0.06, 'square', 0.14),
  undo: () => blip(300, 0.05, 'sawtooth', 0.12, 200),
  add: (n = 0) => blip(500 + n * 40, 0.06, 'square', 0.16),
  mult: (m = 2) => { // rising arpeggio scaled by the multiplier
    for (let i = 0; i < 3 + m; i++) setTimeout(() => blip(500 + i * 120, 0.05, 'square', 0.13), i * 45);
  },
  crack: () => blip(820, 0.04, 'square', 0.1),
  lock: () => blip(1040, 0.09, 'triangle', 0.16),
  fork: () => { blip(360, 0.05, 'square', 0.14); setTimeout(() => blip(540, 0.05, 'square', 0.14), 60); },
  ice: () => noise(0.09, 0.1),
  exec: () => blip(2600, 0.12, 'sine', 0.08), // the phreak tone, briefly
  win: () => [0, 1, 2, 3].forEach((i) => setTimeout(() => blip(523 * Math.pow(2, i / 12 * 4), 0.12, 'square', 0.16), i * 90)),
  lose: () => [0, 1, 2, 3].forEach((i) => setTimeout(() => blip(400 - i * 60, 0.16, 'sawtooth', 0.16, 200 - i * 40), i * 120)),
};
