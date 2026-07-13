// Terrain TEXTURE generators (design exploration for src/terrain.js).
//
// In OVERRIDE the terrain IS the texture: every cell is OPEN / HARD / WALL and
// that layout is both the picture and the cost field a ping pays to burn. So a
// "texture" here is a function that decides, per cell in a sector column-band
// [x0..x1], which type sits there — plus an optional per-cell GLYPH override for
// the cases (10 PRINT, heightmap ramps, circuit pipes) where the shape lives in
// the character itself rather than the block density.
//
// Every generator has the same shape:
//   gen(t, glyph, x0, x1, rng, opts)
//     t     : Uint8Array type field (mutated in place)
//     glyph : Array(FIELD_W*FIELD_H) — set glyph[c] to a char to override the
//             default block glyph for that cell (null = use the type's block)
//     rng   : seeded mulberry32 (so a machine is reproducible)
// This mirrors genSector() in src/terrain.js, so a chosen generator drops
// straight in: swap the noise loop for a gen() call, keep shear/islands/vaults.

import { mulberry32, randInt } from '../src/rng.js';

export const FIELD_W = 80, FIELD_H = 33;
export const OPEN = 0, HARD = 1, WALL = 2, BUS = 3;

const idx = (x, y) => y * FIELD_W + x;

// ---------------------------------------------------------------------------
// value noise (the CURRENT generator) — kept as the baseline to compare against.
// ---------------------------------------------------------------------------
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

function genNoise(t, glyph, x0, x1, rng, opts = {}) {
  const seaN = makeNoise(rng, 11, 6), hardN = makeNoise(rng, 6, 3);
  const seaT = opts.sea ?? (0.30 + rng() * 0.26);
  const hardT = opts.hard ?? (0.34 + rng() * 0.30);
  for (let y = 0; y < FIELD_H; y++) for (let x = x0; x <= x1; x++)
    t[idx(x, y)] = seaN(x, y) < seaT ? WALL : hardN(x, y) < hardT ? HARD : OPEN;
}

// ---------------------------------------------------------------------------
// 1D cellular automata — seed a row, evolve DOWNWARD (y = time). Rule 30 is
// chaotic (and Turing-complete-adjacent; rule 110 is the Turing-complete one),
// rule 90 draws a Sierpinski triangle, rule 150 is XOR. Live cells become HARD
// veins; live cells flanked by live neighbours core into WALL. Width wraps
// toroidally so the band is seamless across reseeds. O(w*h), the cheapest thing
// here after plain lines.
// ---------------------------------------------------------------------------
export const CA_RULES = [
  { n: 30,  name: 'chaos' },      // Wolfram's PRNG rule — noisy, no structure
  { n: 90,  name: 'sierpinski' }, // XOR of neighbours — nested triangles
  { n: 110, name: 'gliders' },    // Turing-complete — drifting complexity
  { n: 150, name: 'xor3' },       // XOR of all three — dense woven lattice
  { n: 126, name: 'coral' },      // filled triangles with texture
  { n: 22,  name: 'sparse' },     // thin fractal dust — very open
  { n: 60,  name: 'left-sierp' }, // one-sided Sierpinski, drifts left
  { n: 45,  name: 'streaks' },    // chaotic diagonal streaks
];

function genAutomata(t, glyph, x0, x1, rng, opts = {}) {
  const w = x1 - x0 + 1;
  const rule = opts.rule ?? 30;
  const seedRandom = opts.seed === 'random';
  let row = new Uint8Array(w);
  if (seedRandom) for (let i = 0; i < w; i++) row[i] = rng() < 0.5 ? 1 : 0;
  else row[w >> 1] = 1;                              // single centred cell
  for (let y = 0; y < FIELD_H; y++) {
    for (let i = 0; i < w; i++) {
      const c = idx(x0 + i, y);
      if (!row[i]) { t[c] = OPEN; continue; }
      const l = row[(i - 1 + w) % w], r = row[(i + 1) % w];
      t[c] = l && r ? WALL : HARD;                   // dense cores harden to WALL
    }
    const next = new Uint8Array(w);
    for (let i = 0; i < w; i++) {
      const l = row[(i - 1 + w) % w], c = row[i], r = row[(i + 1) % w];
      next[i] = (rule >> ((l << 2) | (c << 1) | r)) & 1;
    }
    row = next;
  }
}

// ---------------------------------------------------------------------------
// 10 PRINT — the two-line C64 maze: 10 PRINT CHR$(205.5+RND(1));: GOTO 10.
// Each cell is independently ╱ or ╲; the maze is an optical illusion of the two
// PETSCII diagonals meeting. Here the diagonals are HARD veins with a glyph
// override, on OPEN floor. density<1 keeps it playable (full density is all
// HARD); rare stacked same-slope pairs core to WALL knots.
// ---------------------------------------------------------------------------
function genTenPrint(t, glyph, x0, x1, rng, opts = {}) {
  const density = opts.density ?? 0.62;
  let prev = new Int8Array(x1 - x0 + 1).fill(-1);
  for (let y = 0; y < FIELD_H; y++) {
    const cur = new Int8Array(x1 - x0 + 1).fill(-1);
    for (let x = x0; x <= x1; x++) {
      const c = idx(x, y);
      if (rng() >= density) { t[c] = OPEN; continue; }
      const slope = rng() < 0.5 ? 0 : 1;             // 0 = ╱, 1 = ╲
      cur[x - x0] = slope;
      const knot = prev[x - x0] === slope;           // same slope stacked
      t[c] = knot ? WALL : HARD;
      glyph[c] = knot ? '█' : slope ? '╲' : '╱';
    }
    prev = cur;
  }
}

// ---------------------------------------------------------------------------
// random shapes — scatter filled/outlined boxes, discs and thick line segments.
// Reads as motherboard architecture: chips, pads, traces. Cheap: O(shapes*area).
// ---------------------------------------------------------------------------
function genShapes(t, glyph, x0, x1, rng, opts = {}) {
  for (let y = 0; y < FIELD_H; y++) for (let x = x0; x <= x1; x++) t[idx(x, y)] = OPEN;
  const w = x1 - x0 + 1;
  const count = opts.count ?? (8 + Math.floor(rng() * 6));
  const put = (x, y, ty) => { if (x >= x0 && x <= x1 && y >= 0 && y < FIELD_H) t[idx(x, y)] = ty; };
  for (let k = 0; k < count; k++) {
    const ty = rng() < 0.45 ? WALL : HARD;
    const kind = rng();
    if (kind < 0.4) {                                // box (filled or outlined)
      const bw = 3 + randInt(rng, 0, 6), bh = 2 + randInt(rng, 0, 5);
      const bx = randInt(rng, x0, x1 - 1), by = randInt(rng, 0, FIELD_H - 2);
      const outline = rng() < 0.5;
      for (let yy = by; yy < by + bh; yy++) for (let xx = bx; xx < bx + bw; xx++) {
        const edge = xx === bx || xx === bx + bw - 1 || yy === by || yy === by + bh - 1;
        if (!outline || edge) put(xx, yy, ty);
      }
    } else if (kind < 0.7) {                         // disc
      const r = 2 + randInt(rng, 0, 3);
      const cxp = randInt(rng, x0, x1), cyp = randInt(rng, 0, FIELD_H - 1);
      for (let yy = cyp - r; yy <= cyp + r; yy++) for (let xx = cxp - r; xx <= cxp + r; xx++)
        if ((xx - cxp) ** 2 + (yy - cyp) ** 2 <= r * r) put(xx, yy, ty);
    } else {                                         // thick line segment
      const horiz = rng() < 0.5, len = 5 + randInt(rng, 0, w - 5), th = 1 + (rng() < 0.4 ? 1 : 0);
      const sx = randInt(rng, x0, x1), sy = randInt(rng, 0, FIELD_H - 1);
      for (let i = 0; i < len; i++) for (let d = 0; d < th; d++)
        horiz ? put(sx + i, sy + d, ty) : put(sx + d, sy + i, ty);
    }
  }
}

// ---------------------------------------------------------------------------
// vertical / horizontal bands — circuit-board bus bars. Regular spacing with a
// little jitter; each band may carry a gap (a via). 'both' overlays them into a
// PCB grid. The cheapest generator; instantly reads as 1983 hardware.
// ---------------------------------------------------------------------------
function genLines(t, glyph, x0, x1, rng, opts = {}) {
  for (let y = 0; y < FIELD_H; y++) for (let x = x0; x <= x1; x++) t[idx(x, y)] = OPEN;
  const orient = opts.orient ?? 'both';
  const spacing = opts.spacing ?? 4;
  const band = (cells, along, place) => {
    for (let p = randInt(rng, 1, spacing); p < along; p += spacing + randInt(rng, -1, 1)) {
      const ty = rng() < 0.35 ? WALL : HARD;
      const gap = rng() < 0.6 ? randInt(rng, 0, cells - 1) : -1;
      for (let q = 0; q < cells; q++) if (Math.abs(q - gap) > 1) place(p, q, ty);
    }
  };
  if (orient !== 'horiz')                            // vertical columns
    band(FIELD_H, x1 - x0 + 1, (p, q, ty) => { t[idx(x0 + p, q)] = ty; });
  if (orient !== 'vert')                             // horizontal rows
    band(x1 - x0 + 1, FIELD_H, (p, q, ty) => { t[idx(x0 + q, p)] = ty; });
}

// ---------------------------------------------------------------------------
// heightmap ramp — the classic ASCII terrain renderer. Noise -> elevation ->
// a glyph ramp (' .:-=+*#%@' style), so the picture reads as contours instead
// of binary blocks. Low ground OPEN, mid HARD, peaks WALL. Emoji ramps LOOK
// great but are double-width and shear the 80-col grid (see research doc), so
// the default ramp is single-width ASCII; emoji is offered with a warning.
// ---------------------------------------------------------------------------
export const RAMPS = {
  ascii:  ' .:-=+*#%@',
  blocks: ' ·░▒▓█',
  relief: ' .,~=≈#▓█',
  // emoji ramp DEMO — double-width, will misalign columns. Here to show why.
  emoji:  '  🟫🟫🟩🟩🌲⛰❄',
};

function genHeightmap(t, glyph, x0, x1, rng, opts = {}) {
  const noise = makeNoise(rng, 12, 5);
  const ramp = RAMPS[opts.ramp] || RAMPS.ascii;
  const bands = ramp.length;
  // two thresholds carve the ramp into OPEN / HARD / WALL by elevation
  const t1 = opts.t1 ?? 0.45, t2 = opts.t2 ?? 0.78;
  for (let y = 0; y < FIELD_H; y++) for (let x = x0; x <= x1; x++) {
    const n = Math.min(0.999, Math.max(0, noise(x, y)));
    const c = idx(x, y);
    t[c] = n < t1 ? OPEN : n < t2 ? HARD : WALL;
    const g = ramp[Math.min(bands - 1, Math.floor(n * bands))];
    if (g && g !== ' ') glyph[c] = g;                // ramp char carries elevation
  }
}

// ---------------------------------------------------------------------------
// voronoi crack — scatter seeds, tile to nearest seed, HARD the region borders.
// Reads as cracked glass / cell membranes / a die-shot. Whole regions can vitrify
// to WALL. O(w*h*seeds) but seeds are few, so still cheap at this size.
// ---------------------------------------------------------------------------
function genVoronoi(t, glyph, x0, x1, rng, opts = {}) {
  const w = x1 - x0 + 1;
  const k = opts.seeds ?? (6 + Math.floor(rng() * 5));
  const seeds = [];
  for (let i = 0; i < k; i++)
    seeds.push({ x: randInt(rng, x0, x1), y: randInt(rng, 0, FIELD_H - 1), wall: rng() < 0.22 });
  const owner = new Int16Array(FIELD_W * FIELD_H).fill(-1);
  for (let y = 0; y < FIELD_H; y++) for (let x = x0; x <= x1; x++) {
    let best = 0, bd = 1e9;
    for (let i = 0; i < k; i++) {
      const d = (x - seeds[i].x) ** 2 + (y - seeds[i].y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    owner[idx(x, y)] = best;
    t[idx(x, y)] = seeds[best].wall ? WALL : OPEN;
  }
  for (let y = 0; y < FIELD_H; y++) for (let x = x0; x <= x1; x++) {
    const c = idx(x, y);
    if (t[c] === WALL) continue;
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx > x1 || ny >= FIELD_H) continue;
      if (owner[idx(nx, ny)] !== owner[c]) { t[c] = HARD; break; } // membrane
    }
  }
  void w;
}

// ---------------------------------------------------------------------------
// circuit traces — box-drawing pipes wandering the band as HARD conduits on
// OPEN floor. A greedy walker lays connected runs, glyph-overriding each step
// with the matching ┌┐└┘│─ elbow. Distinct from 10 PRINT: continuous routes,
// not a diagonal weave.
// ---------------------------------------------------------------------------
function genCircuit(t, glyph, x0, x1, rng, opts = {}) {
  for (let y = 0; y < FIELD_H; y++) for (let x = x0; x <= x1; x++) t[idx(x, y)] = OPEN;
  const traces = opts.traces ?? (5 + Math.floor(rng() * 4));
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const elbow = (px, py, nx, ny) => {
    const dxIn = px, dyIn = py, dxOut = nx, dyOut = ny;
    if (dyIn === 0 && dyOut === 0) return '─';
    if (dxIn === 0 && dxOut === 0) return '│';
    const goingRight = dxOut > 0 || dxIn < 0, goingDown = dyOut > 0 || dyIn < 0;
    return goingRight ? (goingDown ? '┌' : '└') : (goingDown ? '┐' : '┘');
  };
  for (let k = 0; k < traces; k++) {
    let x = randInt(rng, x0, x1), y = randInt(rng, 0, FIELD_H - 1);
    let dir = DIRS[randInt(rng, 0, 3)], px = dir[0], py = dir[1];
    const steps = 8 + randInt(rng, 0, 22);
    for (let s = 0; s < steps; s++) {
      if (rng() < 0.3) dir = DIRS[randInt(rng, 0, 3)];   // occasional turn
      const nx = x + dir[0], ny = y + dir[1];
      if (nx < x0 || nx > x1 || ny < 0 || ny >= FIELD_H) { dir = DIRS[randInt(rng, 0, 3)]; continue; }
      const c = idx(x, y);
      t[c] = rng() < 0.15 ? WALL : HARD;
      glyph[c] = elbow(px, py, dir[0], dir[1]);
      px = dir[0]; py = dir[1]; x = nx; y = ny;
    }
  }
}

// ---------------------------------------------------------------------------
export const GENERATORS = {
  noise:     { fn: genNoise,     label: 'value noise (current)' },
  automata:  { fn: genAutomata,  label: '1D cellular automata' },
  tenprint:  { fn: genTenPrint,  label: '10 PRINT maze' },
  shapes:    { fn: genShapes,    label: 'random shapes' },
  lines:     { fn: genLines,     label: 'bus bars' },
  heightmap: { fn: genHeightmap, label: 'ASCII heightmap' },
  voronoi:   { fn: genVoronoi,   label: 'voronoi crack' },
  circuit:   { fn: genCircuit,   label: 'circuit traces' },
};
export const GEN_ORDER = ['noise', 'automata', 'tenprint', 'shapes', 'lines', 'heightmap', 'voronoi', 'circuit'];

// Build a full 80x33 field. `pick(sectorIndex)` chooses {gen, opts} per sector
// so callers can show one texture everywhere or a triptych of three at once.
export function buildField(seed, pick) {
  const rng = mulberry32(seed >>> 0);
  const t = new Uint8Array(FIELD_W * FIELD_H);
  const glyph = new Array(FIELD_W * FIELD_H).fill(null);
  const FIREWALLS = [26, 53];
  const bands = [[0, 25], [27, 52], [54, 79]];
  for (const wx of FIREWALLS) for (let y = 0; y < FIELD_H; y++) t[idx(wx, y)] = WALL;
  bands.forEach(([x0, x1], i) => {
    const { gen, opts } = pick(i);
    (GENERATORS[gen] || GENERATORS.noise).fn(t, glyph, x0, x1, rng, opts || {});
  });
  return { t, glyph };
}

export { idx };
