// Production terrain: one 80x33 memory field split into three sectors
// (KERNEL / IO.SYS / SWAP) by firewalls. Each sector is generated independently
// with a RANDOMIZED profile (no fixed difficulty ramp) as land islands in a sea
// of firewall, bridged by bus links, sheared into a digital look. Fire is
// heat-gated: a cell ignites only when program heat > terrain resistance.

import { mulberry32, randInt } from './rng.js';

export const FIELD_W = 80, FIELD_H = 33;
export const OPEN = 0, HARD = 1, WALL = 2, BUS = 3, VAULT = 4, HONEY = 5;
export const RESIST = [0, 5, 99, -2, 1, 0];
export const idx = (x, y) => y * FIELD_W + x;

export const FIREWALLS = [26, 53];
export const SECTORS = [
  { id: 'KERNEL', x0: 0,  x1: 25, digits: [0, 1] },
  { id: 'IO.SYS', x0: 27, x1: 52, digits: [2, 3, 4] },
  { id: 'SWAP',   x0: 54, x1: 79, digits: [5, 6, 7] },
];

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
    const top = a + (b - a) * fx, bot = c + (d - c) * fx;
    return top + (bot - top) * fy;
  };
  return (x, y) => 0.65 * sample(L1, x, y) + 0.35 * sample(L2, x, y);
}

// shift bands of 1-4 rows horizontally by 1-5 columns (wrapped within the
// sector) — turns smooth noise blobs into stair-stepped, digital shapes.
function shear(t, x0, x1, rng) {
  const w = x1 - x0 + 1;
  for (let y = 0; y < FIELD_H;) {
    const band = 1 + Math.floor(rng() * 4);
    const off = (1 + Math.floor(rng() * 5)) * (rng() < 0.5 ? 1 : -1);
    for (let yy = y; yy < Math.min(FIELD_H, y + band); yy++) {
      const row = [];
      for (let x = x0; x <= x1; x++) row.push(t[idx(x, yy)]);
      for (let i = 0; i < w; i++) t[idx(x0 + (((i + off) % w) + w) % w, yy)] = row[i];
    }
    y += band;
  }
}

function floodFrom(t, start, x0, x1, blockWall = true) {
  const seen = new Uint8Array(FIELD_W * FIELD_H);
  const q = [start]; seen[start] = 1;
  const cells = [];
  for (let h = 0; h < q.length; h++) {
    const c = q[h]; cells.push(c);
    const cx = c % FIELD_W, cy = (c / FIELD_W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < x0 || nx > x1 || ny < 0 || ny >= FIELD_H) continue;
      const n = idx(nx, ny);
      if (seen[n] || (blockWall && t[n] === WALL)) continue;
      seen[n] = 1; q.push(n);
    }
  }
  return { seen, cells };
}

function components(t, x0, x1) {
  const seen = new Uint8Array(FIELD_W * FIELD_H);
  const comps = [];
  for (let y = 0; y < FIELD_H; y++) for (let x = x0; x <= x1; x++) {
    const c = idx(x, y);
    if (t[c] === WALL || seen[c]) continue;
    const f = floodFrom(t, c, x0, x1);
    f.cells.forEach((cc) => (seen[cc] = 1));
    comps.push(f.cells);
  }
  return comps;
}

const cx = (c) => c % FIELD_W, cy = (c) => (c / FIELD_W) | 0;
function carveBus(t, a, b, x0, x1) {
  const ax = cx(a), ay = cy(a), bx = cx(b), by = cy(b);
  for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) if (x >= x0 && x <= x1 && t[idx(x, ay)] === WALL) t[idx(x, ay)] = BUS;
  for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) if (t[idx(bx, y)] === WALL) t[idx(bx, y)] = BUS;
}

// carve an OPEN corridor from entry to a goal (HARD -> OPEN along the path),
// making the goal reachable at low heat (an EASY sector).
function openPath(t, start, goal, x0, x1) {
  const parent = new Int32Array(FIELD_W * FIELD_H).fill(-2);
  parent[start] = -1; const q = [start];
  for (let h = 0; h < q.length; h++) {
    const c = q[h]; if (c === goal) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx(c) + dx, ny = cy(c) + dy;
      if (nx < x0 || nx > x1 || ny < 0 || ny >= FIELD_H) continue;
      const n = idx(nx, ny);
      if (parent[n] !== -2 || t[n] === WALL) continue;
      parent[n] = c; q.push(n);
    }
  }
  if (parent[goal] === -2) return false;
  let c = parent[goal];
  while (c !== -1) { if (t[c] === HARD) t[c] = OPEN; c = parent[c]; }
  return true;
}

function bfs(t, start, x0, x1) {
  const dist = new Int16Array(FIELD_W * FIELD_H).fill(-1);
  dist[start] = 0; const q = [start];
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx(c) + dx, ny = cy(c) + dy;
      if (nx < x0 || nx > x1 || ny < 0 || ny >= FIELD_H) continue;
      const n = idx(nx, ny);
      if (dist[n] !== -1 || t[n] === WALL) continue;
      dist[n] = dist[c] + 1; q.push(n);
    }
  }
  return dist;
}

function genSector(t, s, rng, noise) {
  const { x0, x1 } = s;
  // randomized profile — NO fixed difficulty. sea level sets island size/count;
  // shore band sets how much hard terrain gates the interiors.
  const sea = 0.28 + rng() * 0.20;      // 0.28..0.48
  const shore = 0.10 + rng() * 0.12;    // hard shoreline width
  for (let y = 0; y < FIELD_H; y++) for (let x = x0; x <= x1; x++) {
    const n = noise(x, y);
    t[idx(x, y)] = n < sea ? WALL : n < sea + shore ? HARD : OPEN;
  }
  shear(t, x0, x1, rng);

  // entry pocket (guaranteed land)
  const entry = { x: x0 + 1, y: FIELD_H >> 1 };
  for (let dy = -1; dy <= 1; dy++) for (let dx = 0; dx <= 2; dx++) {
    const yy = entry.y + dy, xx = entry.x + dx;
    if (xx <= x1 && yy >= 0 && yy < FIELD_H) t[idx(xx, yy)] = OPEN;
  }

  // islands & links: bridge other big islands to the entry island with bus lines
  const entryComp = floodFrom(t, idx(entry.x, entry.y), x0, x1);
  const connected = new Uint8Array(FIELD_W * FIELD_H);
  entryComp.cells.forEach((c) => (connected[c] = 1));
  let connectedCells = entryComp.cells.slice();
  const comps = components(t, x0, x1).filter((c) => c.length >= 8 && !connected[c[0]]);
  comps.sort((a, b) => b.length - a.length);
  let links = 0;
  for (const comp of comps.slice(0, 4)) {
    let best = null, bestD = 1e9;
    const sa = connectedCells.filter((_, i) => i % 5 === 0);
    const sb = comp.filter((_, i) => i % 5 === 0);
    for (const a of sa) for (const b of sb) {
      const d = Math.abs(cx(a) - cx(b)) + Math.abs(cy(a) - cy(b));
      if (d < bestD) { bestD = d; best = [a, b]; }
    }
    if (best) { carveBus(t, best[0], best[1], x0, x1); comp.forEach((c) => (connected[c] = 1)); connectedCells = connectedCells.concat(comp); links++; }
  }
  if (links === 0) { const ly = randInt(rng, 3, FIELD_H - 3); for (let x = x0; x <= x1; x++) if (t[idx(x, ly)] === WALL) t[idx(x, ly)] = BUS; }

  // vault at a target depth (guaranteed reachable, never trivial)
  const dist = bfs(t, idx(entry.x, entry.y), x0, x1);
  const target = 12 + Math.floor(rng() * 10);
  let vault = -1, vBest = Infinity;
  for (let y = 0; y < FIELD_H; y++) for (let x = x0; x <= x1; x++) {
    const c = idx(x, y);
    if (dist[c] < 4 || (t[c] !== OPEN && t[c] !== HARD)) continue;
    const score = Math.abs(dist[c] - target);
    if (score < vBest) { vBest = score; vault = c; }
  }
  if (vault < 0) for (let i = 0; i < t.length; i++) if (dist[i] >= 4 && (t[i] === OPEN || t[i] === HARD)) { vault = i; break; }
  if (vault >= 0) t[vault] = VAULT;

  // per-sector difficulty is RANDOM, not positional: ~45% of sectors get an
  // open corridor to the vault (EASY), the rest stay gated by hard terrain.
  if (vault >= 0 && rng() < 0.45) openPath(t, idx(entry.x, entry.y), vault, x0, x1);

  // honeypots (bait) — guarantee at least one so all six types appear
  let honey = 0;
  const wantHoney = 1 + Math.floor(rng() * 2);
  const cand = [];
  for (let y = 0; y < FIELD_H; y++) for (let x = x0; x <= x1; x++) {
    const c = idx(x, y);
    if (dist[c] >= 6 && t[c] === OPEN && c !== vault) cand.push(c);
  }
  for (let k = 0; k < wantHoney && cand.length; k++) {
    const c = cand[randInt(rng, 0, cand.length - 1)];
    t[c] = HONEY; honey++;
  }
  if (honey === 0 && cand.length === 0) { // fallback: force one near entry
    const c = idx(Math.min(x1, entry.x + 3), entry.y);
    if (t[c] !== VAULT) t[c] = HONEY;
  }

  // guarantee at least one BUS link exists (islands that touched carve none)
  let busN = 0;
  for (let y = 0; y < FIELD_H; y++) for (let x = x0; x <= x1; x++) if (t[idx(x, y)] === BUS) busN++;
  if (busN === 0) {
    const bx = randInt(rng, x0 + 1, x1 - 1), by = randInt(rng, 2, FIELD_H - 8);
    for (let y = by; y < by + 6 && y < FIELD_H; y++) { const c = idx(bx, y); if (t[c] !== VAULT) t[c] = BUS; }
  }

  return { ...s, entry, vaults: vault >= 0 ? [vault] : [], difficulty: null };
}

export function generateMachine(seed) {
  const rng = mulberry32(seed >>> 0);
  const noise = fractalNoise(rng);
  const t = new Uint8Array(FIELD_W * FIELD_H);
  for (const wx of FIREWALLS) for (let y = 0; y < FIELD_H; y++) t[idx(wx, y)] = WALL;
  const sectors = SECTORS.map((s) => genSector(t, s, rng, noise));
  const machine = { t, sectors, burned: new Uint8Array(FIELD_W * FIELD_H), rng };
  for (const s of machine.sectors) s.difficulty = difficultyOf(machine, s);
  // fairness: always leave at least one EASY way in (which sector is random)
  if (!machine.sectors.some((s) => s.difficulty === 'EASY')) {
    const s = machine.sectors[Math.floor(rng() * 3)];
    if (s.vaults.length) openPath(t, idx(s.entry.x, s.entry.y), s.vaults[0], s.x0, s.x1);
    for (const sec of machine.sectors) sec.difficulty = difficultyOf(machine, sec);
  }
  return machine;
}

export function heatToClear(machine, s) {
  for (let heat = 4; heat <= 9; heat++) if (reachesVaults(machine, s, heat)) return heat;
  return 99;
}
function difficultyOf(machine, s) {
  const h = heatToClear(machine, s);
  return h <= 4 ? 'EASY' : h === 5 ? 'MED' : 'HARD';
}
function reachesVaults(machine, s, heat) {
  const { t } = machine;
  const seen = new Uint8Array(FIELD_W * FIELD_H);
  const start = idx(s.entry.x, s.entry.y); seen[start] = 1;
  const q = [start];
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx(c) + dx, ny = cy(c) + dy;
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
    claim++; if (burned[c]) burn++;
  }
  return { claim, burn, pct: claim ? (burn / claim) * 100 : 0, vaultsBurned: s.vaults.every((v) => burned[v]) };
}
