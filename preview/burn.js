// Resist-based burn. The fire's "heat" is the accumulator in the real game.
// A cell ignites when the front's heat exceeds its terrain resistance:
//   OPEN 0 · VAULT 1 · BUS -2 (accelerant) · HARD 5 (needs a hot program) ·
//   WALL 99 (firebreak, never). A little jitter keeps fronts ragged, not round.

import { mulberry32 } from '../src/rng.js';
import { W, H, WALL, BUS, RESIST, idx } from './terrain.js';

export class Burn {
  constructor(terrain, embers, heat, seed) {
    this.t = terrain.t;
    this.heat = heat;             // program temperature
    this.rng = mulberry32((seed ^ 0x5eed) >>> 0);
    this.burned = new Uint8Array(W * H);
    for (const e of embers) if (this.t[idx(e.x, e.y)] !== WALL) this.burned[idx(e.x, e.y)] = 1;
  }

  // one ring of spread; the frontier is implicitly reheated to program heat
  step() {
    const add = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = idx(x, y);
      if (this.burned[c] || this.t[c] === WALL) continue;
      let lit = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        if (!this.burned[idx(nx, ny)]) continue;
        const jitter = this.rng() < 0.28 ? 1 : 0;
        if (this.heat > RESIST[this.t[c]] + jitter) { lit = true; break; }
      }
      if (lit) add.push(c);
    }
    for (const c of add) this.burned[c] = 1;
    // buses carry fire fast: flood any bus segment touching the burn
    let changed = add.length > 0;
    let busSpread = true;
    while (busSpread) {
      busSpread = false;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const c = idx(x, y);
        if (this.burned[c] || this.t[c] !== BUS) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          if (this.burned[idx(nx, ny)]) { this.burned[c] = 1; busSpread = true; changed = true; break; }
        }
      }
    }
    return changed;
  }

  count() { let n = 0; for (let i = 0; i < this.burned.length; i++) n += this.burned[i]; return n; }

  // max reachable burn for this heat (clone to completion) — the fill denominator
  static maxBurn(terrain, embers, heat, seed) {
    const b = new Burn(terrain, embers, heat, seed);
    let g = 0;
    while (b.step() && g++ < 400) {}
    return b.count();
  }
}
