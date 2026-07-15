// Beam-Card cards (research/ember-model.md §3, §5). Every card is a complete,
// self-contained beam bundling FOUR aspects — shape · direction · probability ·
// growth. Slotting several MERGES them into one beam (order does not matter):
//   probability ADDS   (cap 100%)
//   direction   UNIONS (each heading emits its own ember per firing cell)
//   shape       SUMS   (Fourier superposition of the selected harmonics)
//   growth      ADDS   reproduce % (cap 60%); child spread-reach takes the MAX
// The old ordered-accumulator opcodes (BRUTE/XOR/NOP/GOTO…) are retired.

// GROWTH level → (reproduce chance, child spread-reach). Cards carry a level;
// merging adds reproduce (capped) and maxes spread-reach. Validated headless in
// preview/beam-balance.js: None/Low/Med/High = 0/.10/.20/.40, growth is the
// load-bearing sustained-burn lever (ablation caps a growth-less spray ~56%).
export const GROWTH = {
  None: { r: 0.00, s: 0 },
  Low:  { r: 0.10, s: 4 },
  Med:  { r: 0.20, s: 6 },
  High: { r: 0.40, s: 8 },
};
export const GROWTH_CAP = 0.60;

// Amplitude/frequency are shape-family conventions, not a card aspect: curved
// spines want a visible swing, a pure line ignores amplitude.
const FREQ = 2;
function ampFor(shapes) {
  if (shapes.has('tan')) return 5;
  if (shapes.has('linear') && shapes.size === 1) return 0;   // pencil
  return 6;                                                    // any curved shape
}

// The Tier-1 card pool (ember-model.md §5). Each card is a bundled quad + identity.
// shape ∈ beam SHAPES keys; dirs ⊆ the 8 compass headings; growth ∈ GROWTH keys.
export const CARDS = {
  'SCRIPT.COM': { id: 'SCRIPT.COM', name: 'SCRIPT.COM', shape: 'linear', dirs: ['←'],       prob: 50, growth: 'Med',  desc: 'the starter warez — a left sheet at 50% with a steady reproduce' },
  'FORK.COM':   { id: 'FORK.COM',   name: 'FORK.COM',   shape: 'linear', dirs: ['→'],       prob: 50, growth: 'Low',  desc: 'the cheap mirror — a right sheet at 50%; merge with SCRIPT.COM for a full-width curtain' },
  'SCRIPT.SYS': { id: 'SCRIPT.SYS', name: 'SCRIPT.SYS', shape: 'linear', dirs: ['→'],       prob: 25, growth: 'Low',  desc: 'the mirror — opens a curtain the other way' },
  'BUFFER.OVR': { id: 'BUFFER.OVR', name: 'BUFFER.OVR', shape: 'linear', dirs: ['←', '→'],  prob: 50, growth: 'Med',  desc: 'overflow both ways — the curtain workhorse' },
  'WORM':       { id: 'WORM',       name: 'WORM',       shape: 'sine',   dirs: ['←', '→'],  prob: 25, growth: 'High', desc: 'the Morris spread — low density but self-replicates hard' },
  'HARMONIC':   { id: 'HARMONIC',   name: 'HARMONIC',   shape: 'sine2',  dirs: ['←', '→'],  prob: 25, growth: 'Med',  desc: 'octave up — sums with WORM toward a square wave' },
  'PHREAK':     { id: 'PHREAK',     name: 'PHREAK',     shape: 'sine3',  dirs: ['←'],       prob: 25, growth: 'Low',  desc: '3rd harmonic — squares the waveform' },
  'BLUEBOX':    { id: 'BLUEBOX',    name: 'BLUEBOX',    shape: 'rect',   dirs: ['↑'],       prob: 50, growth: 'Low',  desc: 'jets straight up toward the top objectives' },
  'LOGICBOMB':  { id: 'LOGICBOMB',  name: 'LOGICBOMB',  shape: 'saw',    dirs: ['↓'],       prob: 50, growth: 'Med',  desc: 'drives downward toward the core' },
  'XOR':        { id: 'XOR',        name: 'XOR',        shape: 'linear', dirs: ['↗', '↙'],  prob: 25, growth: 'Low',  desc: 'crossing diagonals — fills the gaps a curtain leaves' },
  'DAEMON':     { id: 'DAEMON',     name: 'DAEMON',     shape: 'linear', dirs: ['←'],       prob: 20, growth: 'High', mask: 5, desc: 'a sparse deterministic comb that keeps spawning — mask + growth' },
  'NOP.SLED':   { id: 'NOP.SLED',   name: 'NOP.SLED',   shape: 'linear', dirs: [],          prob: 50, growth: 'None', desc: 'high density, no direction, no growth — inert alone, a pure enabler' },
  'TANGENT':    { id: 'TANGENT',    name: 'TANGENT',    shape: 'tan',    dirs: ['←', '→'],  prob: 10, growth: 'None', desc: 'asymptote blowout — usually fizzles, sometimes paints half a sector' },
  'ROOTKIT':    { id: 'ROOTKIT',    name: 'ROOTKIT',    shape: 'linear', dirs: ['←', '→'],  prob: 75, growth: 'Med',  desc: 'premium density both ways' },
  'PAYLOAD':    { id: 'PAYLOAD',    name: 'PAYLOAD',    shape: 'sine',   dirs: ['←', '→'],  prob: 50, growth: 'High', desc: 'the rare workhorse — dense and self-spreading' },
  '0DAY':       { id: '0DAY',       name: '0DAY',       shape: 'sine',   dirs: ['←', '→'],  prob: 100, growth: 'High', desc: 'the legendary grail — full density and high growth' },
};

// Merge a list of cards into one beam's aspect block (ember-model.md §3). Returns
// the params the beam sim consumes: {shapes, amp, freq, dirs, probMode, prob,
// maskN, reproduce, spreadReach}. Order-independent (all four merges commute).
export function mergeBeam(cards) {
  const shapes = { linear: false, sine: false, sine2: false, sine3: false, rect: false, tan: false, saw: false };
  const shapeSet = new Set();
  const dirs = new Set();
  let prob = 0, repro = 0, spread = 0, mask = 0, hasMask = false;
  for (const c of cards) {
    if (!c) continue;
    shapes[c.shape] = true; shapeSet.add(c.shape);
    for (const d of c.dirs) dirs.add(d);
    prob += c.prob;                                       // ADDS
    repro += GROWTH[c.growth].r;                          // ADDS
    spread = Math.max(spread, GROWTH[c.growth].s);        // MAX
    if (c.mask) { hasMask = true; mask = mask ? Math.min(mask, c.mask) : c.mask; }
  }
  return {
    shapes, amp: ampFor(shapeSet), freq: FREQ,
    dirs,
    probMode: hasMask ? 'mask' : 'prob',
    prob: Math.min(100, prob),
    maskN: mask || 5,
    reproduce: Math.min(GROWTH_CAP, repro),
    spreadReach: spread,
  };
}

const SHAPE_ABBR = { linear: 'Lin', sine: 'Sin', sine2: 'Sin2', sine3: 'Sin3', rect: 'Rect', tan: 'Tan', saw: 'Saw' };
const GROWTH_ABBR = { None: 'N', Low: 'L', Med: 'M', High: 'H' };

// A compact aspect line for a single card — fits a 13-col card interior (growth
// compresses to a 1-letter code N/L/M/H).
export function cardLabel(card) {
  const dir = card.dirs.length ? card.dirs.join('') : '—';
  const density = card.mask ? `1/${card.mask}` : `${card.prob}%`;
  return `${SHAPE_ABBR[card.shape]}·${dir}·${density}·${GROWTH_ABBR[card.growth]}`;
}

// A short one-line readout of a merged beam for the assemble UI.
export function beamLabel(merged) {
  const sh = Object.keys(merged.shapes).filter((k) => merged.shapes[k])
    .map((k) => SHAPE_ABBR[k]).join('+') || '—';
  const dir = [...merged.dirs].join('') || '—';
  const density = merged.probMode === 'mask' ? `1/${merged.maskN}` : `${merged.prob}%`;
  const gr = merged.reproduce <= 0 ? 'gr—' : `gr${Math.round(merged.reproduce * 100)}%`;
  return `${sh} · ${dir} · ${density} · ${gr}`;
}

// Two short lines describing a merged beam, sized for the ~13-col status gutter:
// line 1 = shapes + direction, line 2 = density + growth.
export function beamGutterLines(merged) {
  const sh = Object.keys(merged.shapes).filter((k) => merged.shapes[k]).map((k) => SHAPE_ABBR[k]).join('+') || '—';
  const dir = [...merged.dirs].join('') || '—';
  const density = merged.probMode === 'mask' ? `1/${merged.maskN}` : `${merged.prob}%`;
  const gr = merged.reproduce <= 0 ? 'gr—' : `gr${Math.round(merged.reproduce * 100)}%`;
  return [`${sh} ${dir}`, `${density} ${gr}`];
}

// Tier-1 starting deck — the SCRIPT.COM + FORK.COM pair. Merged they make a
// left+right curtain (lin·←→·100%·gr0.30) that cracks an EASY block about half the
// time; the deck grows from there. (Tune by eye: add ids/copies here.)
export function startingDeck() {
  return ['SCRIPT.COM', 'FORK.COM'].map((id) => ({ ...CARDS[id] }));
}

// Cards always available in the draft-between-nodes pool (warez looted off breached
// machines). Card ids contain dots, so index CARDS with bracket notation.
export const DRAFT_POOL = [
  CARDS['SCRIPT.SYS'], CARDS['BUFFER.OVR'], CARDS['WORM'], CARDS['HARMONIC'],
  CARDS['PHREAK'], CARDS['BLUEBOX'], CARDS['LOGICBOMB'], CARDS['XOR'], CARDS['DAEMON'],
];

// Cards that start LOCKED and enter the draft pool once bought in the ROOT shop.
export const SHOP_CARDS = {
  ROOTKIT: CARDS['ROOTKIT'], PAYLOAD: CARDS['PAYLOAD'], '0DAY': CARDS['0DAY'], TANGENT: CARDS['TANGENT'],
};
