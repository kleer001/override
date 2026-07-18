import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildScreen } from '../src/render.js';
import { generateMachine, createNode, fire, stepBattle, createTestSim, stepSim, blankMachine } from '../src/battle.js';
import { CARDS, cardFromGrammar } from '../src/cards.js';
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
  // an explicit multi-card deck (independent of the starter tuning) so the hand +
  // slots exercise the widest glyph set — arrows, mask, all the aspect lines.
  const deck = ['SCRIPT.COM', 'SCRIPT.SYS', 'BUFFER.OVR', 'WORM', 'DAEMON'].map((id) => ({ ...CARDS[id] }));
  const hand = shuffle(deck, mulberry32(7)).slice(0, 5).map((c) => ({ name: c.name, card: c, used: false }));
  const run = { tier: 1, root: 120, deck, machine, aggression: 0.75, baseAggro: 0.75, pendingDrafts: 0 };
  return { phase: 'assemble', run, node: null, program: [deck[0], deck[1], null], selection: [0, 1], hand, draft: [], message: 'need 10 PTS to redraw.', bannerLines: [] };
}
function execGame() {
  const g = assembleGame();
  g.program = [g.run.deck[0], g.run.deck[1], g.run.deck[2]];
  g.node = createNode(g.run.machine, 0, 0.75, 0.75, g.program, {});
  fire(g.node);
  for (let i = 0; i < 25; i++) stepBattle(g.node);
  g.phase = 'exec';
  g.message = 'WATCH — the beam spreads.';
  return g;
}
function testGame() {
  const g = assembleGame();
  g.phase = 'test';
  g.testSim = createTestSim(g.program);
  for (let i = 0; i < 25; i++) stepSim(g.testSim);
  return g;
}
function authorGame() {
  const preview = createTestSim([cardFromGrammar('FLLFRR')], false);
  for (let i = 0; i < 40; i++) stepSim(preview);
  return { phase: 'author', run: { root: 0, deck: [], machine: blankMachine(1, 'YOUR MACHINE') }, node: null,
    authorGrammar: 'FLLFRR', authorPreview: preview, program: [null, null, null], hand: [], draft: [], message: 'add turns', bannerLines: [] };
}

test('font embed: grid-font.css declares GridMono and styles.css uses it as the primary grid font', () => {
  const font = readFileSync(new URL('../grid-font.css', import.meta.url), 'utf8');
  assert.match(font, /@font-face/);
  assert.match(font, /font-family:\s*'GridMono'/);
  assert.match(font, /src:\s*url\(data:font\/ttf;base64,/, 'font must be embedded as a self-contained data URI');
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(styles, /font-family:\s*'GridMono'/, '#screen must use GridMono');
});

test('slotting the authored card renders (its desc feeds the gutter explainer)', () => {
  // Regression: cardFromGrammar must carry a `desc`, or the gutter's just-slotted
  // explainer wraps undefined and the whole draw throws when PROG.COM is last-slotted.
  const auth = cardFromGrammar('FLLFRR');
  const game = { phase: 'assemble', run: { root: 100, deck: [auth, CARDS['FORK.COM']], machine: blankMachine(1, 'YOUR MACHINE') },
    node: null, program: [auth, null, null], selection: [0],
    hand: [{ name: auth.name, card: auth, used: true }], draft: [], message: '', bannerLines: [] };
  assert.doesNotThrow(() => buildScreen(game, 0));
});

test('closed glyph alphabet: the renderer only emits glyphs the embedded font covers', () => {
  const titleGame = { phase: 'title', titleWins: 3, run: null, node: null };
  for (const [name, game] of [['title', titleGame], ['author', authorGame()], ['assemble', assembleGame()], ['target', { ...assembleGame(), phase: 'target' }], ['exec', execGame()], ['test', testGame()]]) {
    const bad = offenders(buildScreen(game, 1000));
    assert.deepEqual(bad, [], `phase ${name} emitted glyphs outside GridMono: ${bad.map((c) => 'U+' + c.codePointAt(0).toString(16)).join(' ')}`);
  }
});
