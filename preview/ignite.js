// Ignition patterns — where the embers land. Entry method = risk identity.
// (In the game these become selectable characters with upgrade trees:
//  more embers, wider spread, deeper lob, etc.)

import { mulberry32, randInt } from '../src/rng.js';
import { W, H, WALL, ENTRY, idx } from './terrain.js';

// nudge an ember off a wall onto the nearest passable cell
function settle(t, x, y) {
  for (let r = 0; r < 6; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < W && ny >= 0 && ny < H && t[idx(nx, ny)] !== WALL) return { x: nx, y: ny };
    }
  }
  return { x: ENTRY.x, y: ENTRY.y };
}

export function embers(method, t, seed, opts = {}) {
  const rng = mulberry32((seed ^ 0xabcdef) >>> 0);
  const out = [];
  if (method === 'wardial') {
    out.push({ x: ENTRY.x, y: ENTRY.y }); // one precise edge point
  } else if (method === 'shotgun') {
    const count = opts.count || 5;         // scattered cone from the edge
    for (let i = 0; i < count; i++) {
      const x = randInt(rng, 2, 16);
      const y = Math.floor(H / 2) + randInt(rng, -Math.floor(H / 2) + 2, Math.floor(H / 2) - 2);
      out.push(settle(t, x, y));
    }
  } else if (method === 'catapult') {
    const count = opts.count || 1;         // lob deep — gamble for depth
    for (let i = 0; i < count; i++) {
      const x = randInt(rng, Math.floor(W * 0.5), Math.floor(W * 0.9));
      const y = randInt(rng, 3, H - 3);
      out.push(settle(t, x, y));
    }
  }
  return out;
}
