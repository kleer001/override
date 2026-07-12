// Layered terrain generator (design prototype).
// base fractal value-noise  ->  BSP-ish walls + bus corridors  ->  objective
// placement (BFS-deepest)  ->  connectivity flood-fill guarantee.
// Each technique does the one thing it is good at.

import { mulberry32, randInt } from '../src/rng.js';

export const W = 78, H = 34;

export const OPEN = 0, HARD = 1, WALL = 2, BUS = 3, VAULT = 4, HONEY = 5;
export const RESIST = [0, 5, 99, -2, 1, 0]; // by type; WALL impassable, BUS accelerant
export const idx = (x, y) => y * W + x;
const inb = (x, y) => x >= 0 && x < W && y >= 0 && y < H;

// --- fractal value noise: coarse random lattice, bilinear, 2 octaves ---
function fractalNoise(rng) {
  const lattice = (step) => {
    const gw = Math.ceil(W / step) + 2, gh = Math.ceil(H / step) + 2;
    const v = new Float32Array(gw * gh);
    for (let i = 0; i < v.length; i++) v[i] = rng();
    return { v, gw, step };
  };
  const L1 = lattice(9), L2 = lattice(4);
  const sample = (L, x, y) => {
    const gx = x / L.step, gy = y / L.step;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = gx - x0, fy = gy - y0;
    const a = L.v[y0 * L.gw + x0], b = L.v[y0 * L.gw + x0 + 1];
    const c = L.v[(y0 + 1) * L.gw + x0], d = L.v[(y0 + 1) * L.gw + x0 + 1];
    const top = a + (b - a) * fx, bot = c + (d - c) * fx;
    return top + (bot - top) * fy;
  };
  return (x, y) => 0.65 * sample(L1, x, y) + 0.35 * sample(L2, x, y);
}

const ARCH = {
  heap:     { hard: 0.74, wall: 0.9,  walls: 1, buses: 1, vaults: 2, honey: 0 },
  fortress: { hard: 0.5,  wall: 0.66, walls: 5, buses: 1, vaults: 1, honey: 1 },
  corridor: { hard: 0.6,  wall: 0.72, walls: 8, buses: 3, vaults: 2, honey: 0 },
  honeypot: { hard: 0.66, wall: 0.86, walls: 3, buses: 1, vaults: 1, honey: 3 },
};

export const ENTRY = { x: 2, y: Math.floor(H / 2) };

export function generate(seed, archetype = 'heap') {
  const rng = mulberry32(seed >>> 0);
  const p = ARCH[archetype] || ARCH.heap;
  const noise = fractalNoise(rng);
  const t = new Uint8Array(W * H);

  // 1. base fuel from noise
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = noise(x, y);
    t[idx(x, y)] = n < p.hard ? OPEN : n < p.wall ? HARD : WALL;
  }

  // 2a. partition walls (each with a gap -> chokepoints & dead-ends)
  for (let i = 0; i < p.walls; i++) {
    const vertical = rng() < 0.5;
    if (vertical) {
      const cx = randInt(rng, 12, W - 12), y0 = randInt(rng, 0, H - 10), len = randInt(rng, 8, H);
      const gap = randInt(rng, y0 + 1, y0 + len - 2);
      for (let y = y0; y < Math.min(H, y0 + len); y++) if (Math.abs(y - gap) > 1) t[idx(cx, y)] = WALL;
    } else {
      const cy = randInt(rng, 4, H - 4), x0 = randInt(rng, 6, W - 20), len = randInt(rng, 14, W);
      const gap = randInt(rng, x0 + 1, x0 + len - 2);
      for (let x = x0; x < Math.min(W, x0 + len); x++) if (Math.abs(x - gap) > 1) t[idx(x, cy)] = WALL;
    }
  }
  // 2b. bus corridors (straight fast lanes; clear whatever they cross)
  for (let i = 0; i < p.buses; i++) {
    if (rng() < 0.5) { const cy = randInt(rng, 3, H - 3); for (let x = 0; x < W; x++) t[idx(x, cy)] = BUS; }
    else { const cx = randInt(rng, 8, W - 8); for (let y = 0; y < H; y++) t[idx(cx, y)] = BUS; }
  }
  // keep the entry cell open
  t[idx(ENTRY.x, ENTRY.y)] = OPEN;

  // 2c. honeypot pockets: small open bait ringed by wall with one gap
  for (let i = 0; i < p.honey; i++) {
    const cx = randInt(rng, 20, W - 6), cy = randInt(rng, 4, H - 4);
    for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) {
      if (!inb(x, y)) continue;
      const edge = Math.abs(x - cx) === 2 || Math.abs(y - cy) === 2;
      t[idx(x, y)] = edge ? WALL : HONEY;
    }
    t[idx(cx - 2, cy)] = OPEN; // the one gap
  }

  // 3 + 4. objectives at BFS-deepest reachable cells, with a reachability guard
  const dist = bfs(t, ENTRY);
  const order = [];
  for (let i = 0; i < t.length; i++) if (dist[i] >= 0 && t[i] !== WALL && t[i] !== BUS) order.push(i);
  order.sort((a, b) => dist[b] - dist[a]);
  for (let k = 0; k < p.vaults && k < order.length; k++) t[order[k]] = VAULT;

  return { t, W, H, archetype, seed };
}

// BFS over passable terrain (WALL blocks). Returns distance array (-1 unreached).
export function bfs(t, start) {
  const dist = new Int16Array(W * H).fill(-1);
  const q = [idx(start.x, start.y)];
  dist[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const c = q[h], cx = c % W, cy = (c / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (!inb(nx, ny)) continue;
      const n = idx(nx, ny);
      if (dist[n] !== -1 || t[n] === WALL) continue;
      dist[n] = dist[c] + 1;
      q.push(n);
    }
  }
  return dist;
}
