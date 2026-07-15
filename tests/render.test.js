import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildScreen } from '../src/render.js';
import { generateMachine, createNode, fire, stepBattle } from '../src/battle.js';
import { startingDeck } from '../src/cards.js';
import { mulberry32, shuffle } from '../src/rng.js';

// The embedded GridMono subset (grid-font.css) covers exactly these codepoint
// ranges, all at one uniform advance. The renderer must never emit a glyph outside
// them, or that glyph would fall back to a device font of a different width and
// shear the grid. Keep this in lockstep with the --unicodes in grid-font.css.
const RANGES = [[0x20, 0x7e], [0xa6, 0xa6], [0xb7, 0xb7], [0x2014, 0x2014],
  [0x2190, 0x2199], [0x25b2, 0x25b3], [0x25b6, 0x25b6], [0x25c0, 0x25c0],
  [0x2500, 0x257f], [0x2580, 0x259f]];
const inAlphabet = (cp) => cp === 0x0a || RANGES.some(([a, b]) => cp >= a && cp <= b);

function offenders(screen) {
  const bad = new Set();
  for (const ch of screen) if (!inAlphabet(ch.codePointAt(0))) bad.add(ch);
  return [...bad];
}

// Build a plausible game at a given phase so buildScreen exercises real glyphs.
function assembleGame() {
  const machine = generateMachine(1);
  const deck = startingDeck();
  const hand = shuffle(deck, mulberry32(7)).slice(0, 5).map((c) => ({ name: c.name, card: c, used: false }));
  const run = { tier: 1, root: 120, points: 0, deck, machine, aggression: 0.75, baseAggro: 0.75, pendingDrafts: 0 };
  return { phase: 'assemble', run, node: null, program: [deck[0], deck[1], null], selection: [0, 1], hand, draft: [], message: 'need 10 PTS to redraw.', bannerLines: [] };
}
function execGame() {
  const g = assembleGame();
  g.program = [g.run.deck[0], g.run.deck[1], g.run.deck[2]];
  g.node = createNode(g.run.machine, 0, null, 0.75, 0.75, g.program, {});
  fire(g.node);
  for (let i = 0; i < 25; i++) stepBattle(g.node);
  g.phase = 'exec';
  g.message = 'WATCH — the beam spreads.';
  return g;
}

test('font embed: grid-font.css declares GridMono and styles.css uses it as the primary grid font', () => {
  const font = readFileSync(new URL('../grid-font.css', import.meta.url), 'utf8');
  assert.match(font, /@font-face/);
  assert.match(font, /font-family:\s*'GridMono'/);
  assert.match(font, /src:\s*url\(data:font\/ttf;base64,/, 'font must be embedded as a self-contained data URI');
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(styles, /font-family:\s*'GridMono'/, '#screen must use GridMono');
});

test('closed glyph alphabet: the renderer only emits glyphs the embedded font covers', () => {
  for (const [name, game] of [['assemble', assembleGame()], ['target', { ...assembleGame(), phase: 'target' }], ['exec', execGame()]]) {
    const bad = offenders(buildScreen(game, 1000));
    assert.deepEqual(bad, [], `phase ${name} emitted glyphs outside GridMono: ${bad.map((c) => 'U+' + c.codePointAt(0).toString(16)).join(' ')}`);
  }
});
