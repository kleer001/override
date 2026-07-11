// The living board: a 3-faction cellular automaton on an 80-wide field.
// worm (your intrusion) vs ice (the system) over neutral memory, split into
// three sectors by two firewall columns with a link gap. Crack % = territory.

import { randInt } from './rng.js';

export const FIELD_W = 80;
export const FIELD_H = 33;

export const NONE = 0;
export const WORM = 1;
export const ICE = 2;
export const WALL = 3;

export const WALL_COLS = [26, 53];
export const LINK_ROWS = [15, 16, 17]; // gap in each firewall the worm can flow through

const idx = (x, y) => y * FIELD_W + x;
const inField = (x, y) => x >= 0 && x < FIELD_W && y >= 0 && y < FIELD_H;

export function createBoard(rng) {
  const owner = new Int8Array(FIELD_W * FIELD_H);
  const str = new Int8Array(FIELD_W * FIELD_H);

  // faint neutral texture so the board is never blank
  for (let i = 0; i < owner.length; i++) {
    str[i] = rng() < 0.35 ? 1 : 0;
  }

  // firewalls (with the link gap left passable)
  for (const wx of WALL_COLS) {
    for (let y = 0; y < FIELD_H; y++) {
      if (LINK_ROWS.includes(y)) continue;
      owner[idx(wx, y)] = WALL;
      str[idx(wx, y)] = 0;
    }
  }

  const seedCluster = (cx, cy, radius, side, s) => {
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (!inField(x, y)) continue;
        if (owner[idx(x, y)] === WALL) continue;
        if (Math.abs(x - cx) + Math.abs(y - cy) > radius) continue;
        owner[idx(x, y)] = side;
        str[idx(x, y)] = s;
      }
    }
  };

  // your beachhead in sector 1 (KERNEL)
  seedCluster(5, 16, 2, WORM, 5);
  // ICE strongholds: a picket in S1, cores in S2 (IO.SYS) and S3 (SWAP)
  seedCluster(20, 8, 1, ICE, 6);
  seedCluster(40, 16, 3, ICE, 6);
  seedCluster(66, 16, 3, ICE, 6);

  return { w: FIELD_W, h: FIELD_H, owner, str, rng, frame: 0, linkCut: false };
}

// Raise strength of a faction's frontier cells (cells adjacent to a takeable
// non-wall neighbor). This is the per-pass "pressure" injection.
export function injectFrontier(board, side, amount) {
  const { owner, str, w, h } = board;
  const targets = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (owner[idx(x, y)] !== side) continue;
      let frontier = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!inField(nx, ny)) continue;
        const no = owner[idx(nx, ny)];
        if (no !== side && no !== WALL) { frontier = true; break; }
      }
      if (frontier) targets.push(idx(x, y));
    }
  }
  for (const t of targets) str[t] = Math.min(9, str[t] + amount);
}

// Plant a small worm cluster in whichever S2/S3 sector has the least worm.
export function seedFork(board) {
  const sectorWorm = [0, 0, 0];
  const { owner, w, h } = board;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (owner[idx(x, y)] !== WORM) continue;
      const s = x < WALL_COLS[0] ? 0 : x < WALL_COLS[1] ? 1 : 2;
      sectorWorm[s]++;
    }
  }
  // prefer an un-breached forward sector (1 or 2)
  const target = sectorWorm[1] <= sectorWorm[2] ? 1 : 2;
  const cx = target === 1 ? randInt(board.rng, 30, 50) : randInt(board.rng, 57, 76);
  const cy = randInt(board.rng, 6, 26);
  for (let y = cy - 1; y <= cy + 1; y++) {
    for (let x = cx - 1; x <= cx + 1; x++) {
      if (!inField(x, y)) continue;
      if (board.owner[idx(x, y)] === WALL) continue;
      board.owner[idx(x, y)] = WORM;
      board.str[idx(x, y)] = 4;
    }
  }
}

// One CA step (double-buffered). worm always attacks; ice attacks only if iceOn.
export function tick(board, { iceOn = true } = {}) {
  const { owner, str, w, h, rng } = board;
  const no = owner.slice();
  const ns = str.slice();

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = idx(x, y);
      if (owner[t] === WALL) continue;

      // strongest eligible attacker among orthogonal neighbours
      let bestOwner = NONE, bestStr = -1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!inField(nx, ny)) continue;
        const n = idx(nx, ny);
        const o = owner[n];
        if (o === WALL || o === NONE) continue;
        if (o === ICE && !iceOn) continue;
        const eff = str[n];
        if (eff > bestStr) { bestStr = eff; bestOwner = o; }
      }

      if (bestOwner !== NONE && bestStr > str[t]) {
        no[t] = bestOwner;
        ns[t] = Math.max(1, bestStr - 1);
        continue;
      }

      // no successful attacker: grow if surrounded by friends, decay if isolated
      if (owner[t] !== NONE) {
        let friend = 0, foe = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (!inField(nx, ny)) continue;
          const o = owner[idx(nx, ny)];
          if (o === owner[t]) friend++;
          else if (o === WORM || o === ICE) foe++;
        }
        if (foe === 0 && friend >= 3 && rng() < 0.3) ns[t] = Math.min(9, str[t] + 1);
        else if (friend === 0) {
          ns[t] = str[t] - 1;
          if (ns[t] <= 0) { no[t] = NONE; ns[t] = 0; }
        }
      }
    }
  }

  board.owner = no;
  board.str = ns;
  board.frame++;

  // track whether ice holds all three link gaps (a "cut")
  board.linkCut = WALL_COLS.some((wx) =>
    LINK_ROWS.every((ly) => board.owner[idx(wx, ly)] === ICE)
  );
}

export function stats(board) {
  const { owner } = board;
  let worm = 0, ice = 0, claimable = 0;
  for (let i = 0; i < owner.length; i++) {
    if (owner[i] === WALL) continue;
    claimable++;
    if (owner[i] === WORM) worm++;
    else if (owner[i] === ICE) ice++;
  }
  return { worm, ice, claimable, crackPct: (worm / claimable) * 100 };
}
