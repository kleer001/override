// Terrain/burn preview harness. URL params:
//   ?arch=heap|fortress|corridor|honeypot  ?ign=wardial|shotgun|catapult
//   ?seed=N  ?heat=5..9 (program temperature)  ?fill=0..1  ?steps=N  ?count=N

import { generate, W, H, WALL, VAULT, idx } from './terrain.js';
import { embers as makeEmbers } from './ignite.js';
import { Burn } from './burn.js';

const COLS = 80, ROWS = 40, FIELD_TOP = 3;
const P = new URLSearchParams(location.search);
const arch = P.get('arch') || 'heap';
const ign = P.get('ign') || 'wardial';
const seed = parseInt(P.get('seed') || '7', 10);
const heat = parseInt(P.get('heat') || '8', 10);
const fill = parseFloat(P.get('fill') || '0.6');
const count = P.get('count') ? +P.get('count') : undefined;
const steps = P.get('steps');

const terrain = generate(seed, arch);
const emb = makeEmbers(ign, terrain.t, seed, { count });
const burn = new Burn(terrain, emb, heat, seed);
const maxB = Burn.maxBurn(terrain, emb, heat, seed);

if (steps !== null && steps !== undefined) { for (let i = 0; i < +steps; i++) burn.step(); }
else { let g = 0; while (burn.count() < fill * maxB && burn.step() && g++ < 400) {} }

const TERRAIN_G = [' ', '▒', '▓', '═', '$', '"']; // OPEN HARD WALL BUS VAULT HONEY

function isFrontier(x, y) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
    const n = idx(nx, ny);
    if (!burn.burned[n] && terrain.t[n] !== WALL) return true;
  }
  return false;
}

function stamp(g, x, y, s) { for (let i = 0; i < s.length; i++) if (x + i < COLS) g[y][x + i] = s[i]; }

function render() {
  const g = Array.from({ length: ROWS }, () => new Array(COLS).fill(' '));
  stamp(g, 0, 0, `NODE PREVIEW · ${arch.toUpperCase()} · ignite:${ign} · heat:${heat} · seed:${seed}`);
  stamp(g, 0, 1, `@ fire  # burned  ▒ encrypted  ▓ firewall  ═ bus  $ vault  " honeypot`);

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = idx(x, y);
    let ch;
    if (burn.burned[c]) ch = terrain.t[c] === VAULT ? '$' : isFrontier(x, y) ? '@' : '#';
    else ch = TERRAIN_G[terrain.t[c]];
    g[FIELD_TOP + y][1 + x] = ch;
  }

  const pct = maxB ? Math.round((burn.count() / maxB) * 100) : 0;
  stamp(g, 0, 38, `burned ${burn.count()}/${maxB} (${pct}% of reachable)   embers:${emb.length}   ` +
    `— fire stalls at ▓ and (when cold) ▒; races along ═`);
  document.getElementById('screen').textContent = g.map((r) => r.join('')).join('\n');
}

render();
