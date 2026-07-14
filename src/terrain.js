// Production terrain: one 80x33 memory field split into three sectors by
// firewalls. Each sector is generated independently:
//   - THREE independent noise fields (different seeds & frequencies) place WALL,
//     HARD and OPEN so the types decorrelate;
//   - land islands in a sea of firewall, bridged by bus links;
//   - a strong horizontal shear for the digital, stair-stepped look.
// Win is COVERAGE-based (burn >= WIN_COVERAGE% of a sector). Runs are NOT
// guaranteed winnable — some machines are brutal. Fire is heat-gated.

import { mulberry32, randInt } from './rng.js';

// The play field is ONE memory block (a run = one block). Its dimensions fit the
// 64-wide field panel beside the status gutter (see src/layout.js): 62×28 interior.
export const FIELD_W = 62, FIELD_H = 28;
export const OPEN = 0, HARD = 1, WALL = 2, BUS = 3, HONEY = 4;
// REACH a beam ember SPENDS to infect each cell (ember-model.md §4). WALL is
// unaffordable; BUS refunds (accelerant). OPEN must cost >=1 or the free flood
// returns.
export const COST = [1, 6, Infinity, -1, 1];
export const idx = (x, y) => y * FIELD_W + x;
export const WIN_COVERAGE = 50; // % of a sector's claimable cells to breach it

// One block spanning the whole field — no inter-sector firewalls (WALL still
// arises from the noise). SECTORS stays an array of one so the sim/renderer that
// iterate sectors keep working unchanged.
export const SECTORS = [
  { id: 'THE MACHINE', x0: 0, x1: FIELD_W - 1 },
];

const cx = (c) => c % FIELD_W, cy = (c) => (c / FIELD_W) | 0;

// value noise at a chosen frequency; each call consumes rng => a different seed
function makeNoise(rng, step1, step2) {
  const lattice = (step) => {
    const gw = Math.ceil(FIELD_W / step) + 2, gh = Math.ceil(FIELD_H / step) + 2;
    const v = new Float32Array(gw * gh);
    for (let i = 0; i < v.length; i++) v[i] = rng();
    return { v, gw, step };
  };
  const L1 = lattice(step1), L2 = lattice(step2);
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

// shift thin bands of 1-2 rows horizontally by a big 4-18 columns (wrapped in
// the sector) — aggressive, frequent displacement for a hard digital tear.
function shear(t, x0, x1, rng) {
  const w = x1 - x0 + 1;
  for (let y = 0; y < FIELD_H;) {
    const band = 1 + Math.floor(rng() * 2);
    const off = (4 + Math.floor(rng() * 15)) * (rng() < 0.5 ? 1 : -1);
    for (let yy = y; yy < Math.min(FIELD_H, y + band); yy++) {
      const row = [];
      for (let x = x0; x <= x1; x++) row.push(t[idx(x, yy)]);
      for (let i = 0; i < w; i++) t[idx(x0 + (((i + off) % w) + w) % w, yy)] = row[i];
    }
    y += band;
  }
}

function floodFrom(t, start, x0, x1) {
  const seen = new Uint8Array(FIELD_W * FIELD_H);
  const q = [start]; seen[start] = 1; const cells = [];
  for (let h = 0; h < q.length; h++) {
    const c = q[h]; cells.push(c);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx(c) + dx, ny = cy(c) + dy;
      if (nx < x0 || nx > x1 || ny < 0 || ny >= FIELD_H) continue;
      const n = idx(nx, ny);
      if (seen[n] || t[n] === WALL) continue;
      seen[n] = 1; q.push(n);
    }
  }
  return { seen, cells };
}
function componentsIn(t, x0, x1) {
  const seen = new Uint8Array(FIELD_W * FIELD_H), comps = [];
  for (let y = 0; y < FIELD_H; y++) for (let x = x0; x <= x1; x++) {
    const c = idx(x, y);
    if (t[c] === WALL || seen[c]) continue;
    const f = floodFrom(t, c, x0, x1);
    f.cells.forEach((cc) => (seen[cc] = 1));
    comps.push(f.cells);
  }
  return comps;
}
function carveBus(t, a, b, x0, x1) {
  const ax = cx(a), ay = cy(a), bx = cx(b), by = cy(b);
  for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) if (x >= x0 && x <= x1 && t[idx(x, ay)] === WALL) t[idx(x, ay)] = BUS;
  for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) if (t[idx(bx, y)] === WALL) t[idx(bx, y)] = BUS;
}
function ensureType(t, s, type, minN, rng) {
  let n = 0; const opens = [];
  for (let y = 0; y < FIELD_H; y++) for (let x = s.x0; x <= s.x1; x++) {
    const c = idx(x, y);
    if (t[c] === type) n++; else if (t[c] === OPEN) opens.push(c);
  }
  while (n < minN && opens.length) { t[opens.splice(randInt(rng, 0, opens.length - 1), 1)[0]] = type; n++; }
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

function genSector(t, s, rng) {
  const { x0, x1 } = s;
  // three independent noise fields, different seeds & frequencies
  const seaN = makeNoise(rng, 11, 6);   // WALL: big low-frequency masses
  const hardN = makeNoise(rng, 6, 3);   // HARD: finer veins, different seed
  const seaT = 0.30 + rng() * 0.26;     // how much sea (higher => more fragmented)
  const hardT = 0.34 + rng() * 0.30;    // how much of the land is hard
  for (let y = 0; y < FIELD_H; y++) for (let x = x0; x <= x1; x++) {
    t[idx(x, y)] = seaN(x, y) < seaT ? WALL : hardN(x, y) < hardT ? HARD : OPEN;
  }
  shear(t, x0, x1, rng);
  // guarantee WALL and HARD exist (value noise can miss the extremes)
  ensureType(t, s, WALL, 5, rng);
  ensureType(t, s, HARD, 8, rng);

  const entry = { x: x0 + 1, y: FIELD_H >> 1 };
  for (let dy = -1; dy <= 1; dy++) for (let dx = 0; dx <= 2; dx++) {
    const yy = entry.y + dy, xx = entry.x + dx;
    if (xx <= x1 && yy >= 0 && yy < FIELD_H) t[idx(xx, yy)] = OPEN;
  }

  // islands & links: bridge big islands to the entry island with bus lines
  const entryComp = floodFrom(t, idx(entry.x, entry.y), x0, x1);
  const connected = new Uint8Array(FIELD_W * FIELD_H);
  entryComp.cells.forEach((c) => (connected[c] = 1));
  let connectedCells = entryComp.cells.slice();
  const comps = componentsIn(t, x0, x1).filter((c) => c.length >= 8 && !connected[c[0]]).sort((a, b) => b.length - a.length);
  // link only a couple of nearby islands — distant islands stay stranded, so
  // some sectors are only partly reachable (and can be impossible to breach).
  let links = 0;
  for (const comp of comps.slice(0, 2)) {
    let best = null, bestD = 1e9;
    for (const a of connectedCells.filter((_, i) => i % 5 === 0)) for (const b of comp.filter((_, i) => i % 5 === 0)) {
      const d = Math.abs(cx(a) - cx(b)) + Math.abs(cy(a) - cy(b));
      if (d < bestD) { bestD = d; best = [a, b]; }
    }
    if (best && bestD <= 10) { carveBus(t, best[0], best[1], x0, x1); comp.forEach((c) => (connected[c] = 1)); connectedCells = connectedCells.concat(comp); links++; }
  }
  let busN = 0;
  for (let y = 0; y < FIELD_H; y++) for (let x = x0; x <= x1; x++) if (t[idx(x, y)] === BUS) busN++;
  if (busN === 0) { const bx = randInt(rng, x0 + 1, x1 - 1), by = randInt(rng, 2, FIELD_H - 8); for (let y = by; y < by + 6 && y < FIELD_H; y++) t[idx(bx, y)] = BUS; }

  // honeypots (bait) — placed deep in the sector; guarantee at least one so all
  // five terrain types appear.
  const dist = bfs(t, idx(entry.x, entry.y), x0, x1);
  const cand = [];
  for (let y = 0; y < FIELD_H; y++) for (let x = x0; x <= x1; x++) {
    const c = idx(x, y);
    if (dist[c] >= 6 && t[c] === OPEN) cand.push(c);
  }
  const wantHoney = 1 + Math.floor(rng() * 2);
  let honey = 0;
  for (let k = 0; k < wantHoney && cand.length; k++) { t[cand[randInt(rng, 0, cand.length - 1)]] = HONEY; honey++; }
  if (honey === 0) { const c = idx(Math.min(x1, entry.x + 3), entry.y); t[c] = HONEY; }

  return { ...s, entry, difficulty: null };
}

export function generateMachine(seed) {
  const rng = mulberry32(seed >>> 0);
  const t = new Uint8Array(FIELD_W * FIELD_H);
  const sectors = SECTORS.map((s) => genSector(t, s, rng));
  const machine = { seed: seed >>> 0, t, sectors, burned: new Uint8Array(FIELD_W * FIELD_H), bornAt: new Float64Array(FIELD_W * FIELD_H), rng };
  for (const s of machine.sectors) s.difficulty = difficultyOf(machine, s);
  return machine;
}

// Energy to claim the cheapest `pct`% of a sector's claimable cells. Random ping
// placement means connectivity no longer gates (a ping can land on any island),
// so difficulty is: how much of the cheap half is unavoidably HARD.
export function energyTo(machine, s, pct) {
  const costs = [];
  for (let y = 0; y < FIELD_H; y++) for (let x = s.x0; x <= s.x1; x++) {
    const c = idx(x, y);
    if (machine.t[c] === WALL) continue;
    costs.push(Math.max(0, COST[machine.t[c]]));
  }
  costs.sort((a, b) => a - b);
  const n = Math.ceil(costs.length * pct / 100);
  let energy = 0; for (let i = 0; i < n; i++) energy += costs[i];
  return { energy, cells: n, perCell: n ? energy / n : 0 };
}
function difficultyOf(machine, s) {
  const { perCell } = energyTo(machine, s, WIN_COVERAGE);
  return perCell < 1.4 ? 'EASY' : perCell < 2.2 ? 'MED' : perCell < 3.5 ? 'HARD' : 'BRUTAL';
}

// The trace scan crossing one row: reclaim up to `budget` burned cells back to
// neutral (ember-model.md §5). Returns how many were reclaimed.
export function reclaimRow(machine, s, y, budget, rng) {
  const { burned } = machine;
  const cells = [];
  for (let x = s.x0; x <= s.x1; x++) if (burned[idx(x, y)]) cells.push(idx(x, y));
  let n = 0;
  for (let k = 0; k < budget && cells.length; k++) {
    burned[cells.splice(randInt(rng, 0, cells.length - 1), 1)[0]] = 0; n++;
  }
  return n;
}

export function sectorStats(machine, s) {
  const { t, burned } = machine;
  let claim = 0, burn = 0, honeyBurned = 0;
  for (let y = 0; y < FIELD_H; y++) for (let x = s.x0; x <= s.x1; x++) {
    const c = idx(x, y);
    if (t[c] === WALL) continue;
    claim++;
    if (burned[c]) { burn++; if (t[c] === HONEY) honeyBurned++; }
  }
  return { claim, burn, honeyBurned, pct: claim ? (burn / claim) * 100 : 0 };
}
