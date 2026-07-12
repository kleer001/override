// Production terrain: one 80x33 memory field split into three sectors
// (KERNEL / IO.SYS / SWAP), each generated with its own archetype and density.
// The three sectors are the three nodes of the machine — you conquer one at a
// time, choosing which fits your blind loadout. Fire is heat-gated: a cell
// ignites only when the program's heat exceeds its terrain resistance.

import { mulberry32, randInt } from './rng.js';

export const FIELD_W = 80, FIELD_H = 33;
export const OPEN = 0, HARD = 1, WALL = 2, BUS = 3, VAULT = 4, HONEY = 5;
export const RESIST = [0, 5, 99, -2, 1, 0];
export const idx = (x, y) => y * FIELD_W + x;
const inb = (x, y) => x >= 0 && x < FIELD_W && y >= 0 && y < FIELD_H;

export const FIREWALLS = [26, 53];
export const SECTORS = [
  { id: 'KERNEL', x0: 0,  x1: 25, arch: 'heap',     digits: [0, 1] },
  { id: 'IO.SYS', x0: 27, x1: 52, arch: 'corridor', digits: [2, 3, 4] },
  { id: 'SWAP',   x0: 54, x1: 79, arch: 'fortress', digits: [5, 6, 7] },
];

const ARCH = {
  heap:     { hard: 0.82, wall: 0.94, walls: 1, buses: 1 },
  corridor: { hard: 0.50, wall: 0.72, walls: 3, buses: 1 },
  fortress: { hard: 0.40, wall: 0.60, walls: 5, buses: 1 },
};

function fractalNoise(rng) {
  const lattice = (step) => {
    const gw = Math.ceil(FIELD_W / step) + 2, gh = Math.ceil(FIELD_H / step) + 2;
    const v = new Float32Array(gw * gh);
    for (let i = 0; i < v.length; i++) v[i] = rng();
    return { v, gw, step };
  };
  const L1 = lattice(9), L2 = lattice(4);
  const sample = (L, x, y) => {
    const gx = x / L.step, gy = y / L.step;
    const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const a = L.v[y0 * L.gw + x0], b = L.v[y0 * L.gw + x0 + 1];
    const c = L.v[(y0 + 1) * L.gw + x0], d = L.v[(y0 + 1) * L.gw + x0 + 1];
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
  };
  return (x, y) => 0.65 * sample(L1, x, y) + 0.35 * sample(L2, x, y);
}

function bfsSector(t, entry, x0, x1) {
  const dist = new Int16Array(FIELD_W * FIELD_H).fill(-1);
  const start = idx(entry.x, entry.y);
  dist[start] = 0;
  const q = [start];
  for (let h = 0; h < q.length; h++) {
    const c = q[h], cx = c % FIELD_W, cy = (c / FIELD_W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < x0 || nx > x1 || ny < 0 || ny >= FIELD_H) continue;
      const n = idx(nx, ny);
      if (dist[n] !== -1 || t[n] === WALL) continue;
      dist[n] = dist[c] + 1;
      q.push(n);
    }
  }
  return dist;
}

export function generateMachine(seed) {
  const rng = mulberry32(seed >>> 0);
  const noise = fractalNoise(rng);
  const t = new Uint8Array(FIELD_W * FIELD_H);

  for (const wx of FIREWALLS) for (let y = 0; y < FIELD_H; y++) t[idx(wx, y)] = WALL;

  const sectors = SECTORS.map((s) => {
    const p = ARCH[s.arch];
    for (let y = 0; y < FIELD_H; y++) for (let x = s.x0; x <= s.x1; x++) {
      if (FIREWALLS.includes(x)) continue;
      const n = noise(x, y);
      t[idx(x, y)] = n < p.hard ? OPEN : n < p.wall ? HARD : WALL;
    }
    // partition walls with a gap (chokepoints / dead-ends)
    for (let i = 0; i < p.walls; i++) {
      const cx = randInt(rng, s.x0 + 4, s.x1 - 4);
      const y0 = randInt(rng, 0, FIELD_H - 10), len = randInt(rng, 8, FIELD_H);
      const gap = randInt(rng, y0 + 1, y0 + len - 2);
      for (let y = y0; y < Math.min(FIELD_H, y0 + len); y++) {
        if (Math.abs(y - gap) > 1 && !FIREWALLS.includes(cx)) t[idx(cx, y)] = WALL;
      }
    }
    // bus lanes (fast)
    for (let i = 0; i < p.buses; i++) {
      const cy = randInt(rng, 2, FIELD_H - 2);
      for (let x = s.x0; x <= s.x1; x++) if (!FIREWALLS.includes(x)) t[idx(x, cy)] = BUS;
    }
    const entry = { x: s.x0 + 1, y: FIELD_H >> 1 };
    t[idx(entry.x, entry.y)] = OPEN;
    // guaranteed trunk from entry across the sector: convert blocking WALLs to
    // HARD so the sector is always connected & winnable, but keep its heat gate
    // (fortress trunk = HARD -> needs a hot program; heap trunk stays open).
    const my = FIELD_H >> 1;
    for (let x = s.x0 + 1; x <= s.x1 - 1; x++) {
      if (FIREWALLS.includes(x)) continue;
      const c = idx(x, my);
      if (t[c] === WALL) t[c] = HARD;
    }
    for (let k = 0; k < 3; k++) {
      const sx = randInt(rng, s.x0 + 2, s.x1 - 2);
      const dir = rng() < 0.5 ? 1 : -1, len = randInt(rng, 3, 11);
      for (let j = 0; j < len; j++) {
        const yy = my + dir * j;
        if (yy < 0 || yy >= FIELD_H || FIREWALLS.includes(sx)) break;
        if (t[idx(sx, yy)] === WALL) t[idx(sx, yy)] = HARD;
      }
    }
    // vault (holds this sector's CODE digits) placed at a TARGET depth from
    // entry — guaranteed reachable in time, never trivial. Difficulty then
    // comes from the terrain the path crosses, not from luck.
    const TARGET_DEPTH = { heap: 10, corridor: 16, fortress: 22 };
    const dist = bfsSector(t, entry, s.x0, s.x1);
    const target = TARGET_DEPTH[s.arch];
    let best = -1, bestScore = Infinity;
    for (let y = 0; y < FIELD_H; y++) for (let x = s.x0; x <= s.x1; x++) {
      const c = idx(x, y);
      if (dist[c] < 4 || t[c] === WALL || t[c] === BUS) continue;
      const score = Math.abs(dist[c] - target);
      if (score < bestScore) { bestScore = score; best = c; }
    }
    if (best >= 0) t[best] = VAULT;
    const vaults = best >= 0 ? [best] : [];

    return { ...s, entry, vaults, conquered: false, difficulty: null };
  });

  const machine = { t, sectors, burned: new Uint8Array(FIELD_W * FIELD_H), rng };
  for (const s of machine.sectors) s.difficulty = difficultyOf(machine, s);
  return machine;
}

// smallest heat that reaches every vault in the sector (for the target-select label)
export function heatToClear(machine, s) {
  for (let heat = 4; heat <= 9; heat++) {
    if (reachesVaults(machine, s, heat)) return heat;
  }
  return 99;
}
function difficultyOf(machine, s) {
  const h = heatToClear(machine, s);
  return h <= 4 ? 'EASY' : h === 5 ? 'MED' : 'HARD';
}
function reachesVaults(machine, s, heat) {
  const { t } = machine;
  const seen = new Uint8Array(FIELD_W * FIELD_H);
  const start = idx(s.entry.x, s.entry.y);
  seen[start] = 1;
  const q = [start];
  for (let h = 0; h < q.length; h++) {
    const c = q[h], cx = c % FIELD_W, cy = (c / FIELD_W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < s.x0 || nx > s.x1 || ny < 0 || ny >= FIELD_H) continue;
      const n = idx(nx, ny);
      if (seen[n]) continue;
      if (heat > RESIST[t[n]]) { seen[n] = 1; q.push(n); }
    }
  }
  return s.vaults.every((v) => seen[v]);
}

// --- burn ---
export function ignite(machine, s, embers) {
  for (const e of embers) if (machine.t[idx(e.x, e.y)] !== WALL) machine.burned[idx(e.x, e.y)] = 1;
}

export function burnStep(machine, s, heat) {
  const { t, burned, rng } = machine;
  const add = [];
  for (let y = 0; y < FIELD_H; y++) for (let x = s.x0; x <= s.x1; x++) {
    const c = idx(x, y);
    if (burned[c] || t[c] === WALL) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < s.x0 || nx > s.x1 || ny < 0 || ny >= FIELD_H) continue;
      if (!burned[idx(nx, ny)]) continue;
      const jitter = rng() < 0.28 ? 1 : 0;
      if (heat > RESIST[t[c]] + jitter) { add.push(c); break; }
    }
  }
  for (const c of add) burned[c] = 1;
  // bus flood within sector
  let go = true;
  while (go) {
    go = false;
    for (let y = 0; y < FIELD_H; y++) for (let x = s.x0; x <= s.x1; x++) {
      const c = idx(x, y);
      if (burned[c] || t[c] !== BUS) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < s.x0 || nx > s.x1 || ny < 0 || ny >= FIELD_H) continue;
        if (burned[idx(nx, ny)]) { burned[c] = 1; go = true; break; }
      }
    }
  }
  return add.length;
}

export function sectorStats(machine, s) {
  const { t, burned } = machine;
  let claim = 0, burn = 0;
  for (let y = 0; y < FIELD_H; y++) for (let x = s.x0; x <= s.x1; x++) {
    const c = idx(x, y);
    if (t[c] === WALL) continue;
    claim++;
    if (burned[c]) burn++;
  }
  const vaultsBurned = s.vaults.every((v) => burned[v]);
  return { claim, burn, pct: claim ? (burn / claim) * 100 : 0, vaultsBurned };
}
