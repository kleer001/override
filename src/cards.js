// Beam-Card cards (research/lsystem-growth.md). Every card is a complete,
// self-contained beam. GROWTH is no longer an isotropic reproduce% — it is a
// deterministic L-system turtle (research/lsystem-growth.md §2–§4). A card bundles:
//   - shape     — the spine curve shape(y) (Fourier superposition when merged)
//   - grammar   — an F/L/R/K program the turtle runs on a loop (shape + launch aim)
//   - pace      — ticks per turtle step (the tempo knob; §4)
//   - seeds     — strands raked off the beam spine (the coverage multiplier; §7)
//   - connector — how the NEXT card in the chain couples to this one (§7)
//
// Slotting several cards reads the deck TOP-TO-BOTTOM as an ordered CONNECTOR CHAIN
// (§7): shape still SUMS (order-independent Fourier), but the growth programs run in
// deck order, and each card's connector governs its junction to the card after it.
// There is no arithmetic to merge — no reproduce to add, no reach to max.

// The four turtle symbols (research/lsystem-growth.md §2). Direction lives in the
// grammar: a launch aim is just a prefix of turns (e.g. 'RRFF' points east, climbs).
export const SYMBOLS = 'FLRK';

// Connector vocabulary (§7) — how the next card couples to this one:
//   SCATTER — no handoff; the next card seeds fresh from the spine (order-blind swarm)
//   SPROUT  — the next card continues from this card's frontier tips (chain grows)
//   BRANCH  — the next card fans out as children off the tips (chain bushes)
//   OVERLAY — the next card runs concurrently from the same seed points
export const CONNECTORS = ['SCATTER', 'SPROUT', 'BRANCH', 'OVERLAY'];

// Amplitude/frequency are shape-family conventions, not a card aspect: curved
// spines want a visible swing, a pure line ignores amplitude.
const FREQ = 2;
function ampFor(shapes) {
  if (shapes.has('tan')) return 5;
  if (shapes.has('linear') && shapes.size === 1) return 0;   // pencil
  return 6;                                                    // any curved shape
}

// The Tier-1 card pool (research/lsystem-growth.md §10 turtle-type roster). Each
// card is a bundled beam + identity. shape ∈ beam SHAPES keys; grammar ⊆ F/L/R/K;
// connector ∈ CONNECTORS. Constants are un-tuned starting points (§10).
// Coverage is EARNED by the strands' branching skeleton — fork (`K`) density is the
// area lever (research/lsystem-growth.md §6). Runners (no forks) stay thin and weak;
// forkers bush out and fill. Pace is the tempo/power knob (2 = fast/strong, 3–4 =
// slow/weak). These are a first tuning pass (§10 roster still open).
export const CARDS = {
  'SCRIPT.COM': { id: 'SCRIPT.COM', name: 'SCRIPT.COM', shape: 'linear', grammar: 'FFFFF',     pace: 3, seeds: 8,  connector: 'SCATTER', desc: 'the starter warez — a thin forkless runner; barely rakes the block alone' },
  'FORK.COM':   { id: 'FORK.COM',   name: 'FORK.COM',   shape: 'linear', grammar: 'FFKFK',     pace: 2, seeds: 10, connector: 'BRANCH',  desc: 'a fast forker — bushes out and branches the next card off its tips' },
  'SCRIPT.SYS': { id: 'SCRIPT.SYS', name: 'SCRIPT.SYS', shape: 'linear', grammar: 'RRFFFK',    pace: 3, seeds: 8,  connector: 'SCATTER', desc: 'the mirror — a turn-prefix aims it east, then it runs and forks once' },
  'BUFFER.OVR': { id: 'BUFFER.OVR', name: 'BUFFER.OVR', shape: 'linear', grammar: 'FLFKFRFK',  pace: 2, seeds: 16, connector: 'SCATTER', desc: 'overflow — a fast wide forking zig-zag; the curtain workhorse' },
  'WORM':       { id: 'WORM',       name: 'WORM',       shape: 'sine',   grammar: 'FFKFFK',    pace: 2, seeds: 10, connector: 'SPROUT',  desc: 'the Morris spread — forks hard and sprouts the chain onward' },
  'HARMONIC':   { id: 'HARMONIC',   name: 'HARMONIC',   shape: 'sine2',  grammar: 'FFKFRK',    pace: 2, seeds: 12, connector: 'OVERLAY', desc: 'octave up — a forking coiler that overlays the next card on its seeds' },
  'PHREAK':     { id: 'PHREAK',     name: 'PHREAK',     shape: 'sine3',  grammar: 'FFRFK',     pace: 3, seeds: 8,  connector: 'SCATTER', desc: '3rd harmonic — a tight coiler that curls and forks into the gaps' },
  'BLUEBOX':    { id: 'BLUEBOX',    name: 'BLUEBOX',    shape: 'rect',   grammar: 'FFFFFFK',   pace: 2, seeds: 10, connector: 'SCATTER', desc: 'fast vertical jets that fork late — climbs toward the top objectives' },
  'LOGICBOMB':  { id: 'LOGICBOMB',  name: 'LOGICBOMB',  shape: 'saw',    grammar: 'RRRRFFFK',  pace: 3, seeds: 8,  connector: 'SCATTER', desc: 'turns to face down, then drills and forks toward the core' },
  'XOR':        { id: 'XOR',        name: 'XOR',        shape: 'linear', grammar: 'RFLFK',     pace: 3, seeds: 8,  connector: 'SCATTER', desc: 'crossing diagonals — a forking wanderer that fills a curtain’s gaps' },
  'DAEMON':     { id: 'DAEMON',     name: 'DAEMON',     shape: 'linear', grammar: 'FFKFK',     pace: 4, seeds: 6,  connector: 'SPROUT',  desc: 'a slow, sparse but heavily forking spawner that keeps sprouting where it traps' },
  'NOP.SLED':   { id: 'NOP.SLED',   name: 'NOP.SLED',   shape: 'linear', grammar: 'F',         pace: 3, seeds: 12, connector: 'SPROUT',  desc: 'a plain forkless sled — weak alone, but the next card rides its trapped tips' },
  'TANGENT':    { id: 'TANGENT',    name: 'TANGENT',    shape: 'tan',    grammar: 'FFFFFFFFF', pace: 2, seeds: 4,  connector: 'SCATTER', desc: 'a few fast forkless blowout runners — usually fizzles, sometimes paints half a block' },
  'ROOTKIT':    { id: 'ROOTKIT',    name: 'ROOTKIT',    shape: 'linear', grammar: 'FFKFKFK',   pace: 2, seeds: 16, connector: 'BRANCH',  desc: 'premium seed count — forks and branches hard off every trapped tip' },
  'PAYLOAD':    { id: 'PAYLOAD',    name: 'PAYLOAD',    shape: 'sine',   grammar: 'FFKFKFK',   pace: 2, seeds: 14, connector: 'SPROUT',  desc: 'the rare workhorse — dense forks that sprout the chain onward' },
  '0DAY':       { id: '0DAY',       name: '0DAY',       shape: 'sine',   grammar: 'FKFKFKFK',  pace: 2, seeds: 18, connector: 'BRANCH',  desc: 'the legendary grail — fast, dense, maximal forks, and it bushes the chain' },
};

// Build the merged beam a chain of cards produces (research/lsystem-growth.md §7).
// Shape SUMS (Fourier, order-independent); the growth programs stay an ORDERED
// chain of segments — one per card, in deck order — carrying grammar/pace/seeds and
// the connector governing the junction to the NEXT segment.
export function buildChain(cards) {
  const shapes = { linear: false, sine: false, sine2: false, sine3: false, rect: false, tan: false, saw: false };
  const shapeSet = new Set();
  const chain = [];
  for (const c of cards) {
    if (!c) continue;
    shapes[c.shape] = true; shapeSet.add(c.shape);
    chain.push({ grammar: sanitizeGrammar(c.grammar), pace: Math.max(1, c.pace | 0), seeds: Math.max(0, c.seeds | 0), connector: c.connector });
  }
  return { shapes, amp: ampFor(shapeSet), freq: FREQ, chain };
}

// Keep only valid turtle symbols; an empty program falls back to a lone 'F' so a
// seed at least burns forward rather than sitting inert.
function sanitizeGrammar(g) {
  const clean = String(g || '').split('').filter((ch) => SYMBOLS.includes(ch)).join('');
  return clean || 'F';
}

// Total strands a chain rakes off the spine (the coverage headline) — every segment
// contributes its seeds (deferred SPROUT/BRANCH segments seed off tips, not spine).
export function chainSeedTotal(chain) {
  return chain.reduce((n, seg) => n + seg.seeds, 0);
}

const SHAPE_ABBR = { linear: 'Lin', sine: 'Sin', sine2: 'Sin2', sine3: 'Sin3', rect: 'Rect', tan: 'Tan', saw: 'Saw' };
const CONN_ABBR = { SCATTER: 'SCT', SPROUT: 'SPR', BRANCH: 'BRN', OVERLAY: 'OVL' };

// A compact aspect line for a single card — fits the wider shop row.
export function cardLabel(card) {
  return `${card.grammar}·p${card.pace}·x${card.seeds}·${CONN_ABBR[card.connector]}`;
}

// The card's aspects as two short lines for the tall card panel (a 13-col interior):
// line 1 = the grammar program, line 2 = pace · seeds · connector.
export function cardLines(card) {
  return [card.grammar.slice(0, 13), `p${card.pace} x${card.seeds} ${CONN_ABBR[card.connector]}`];
}

// A short one-line readout of a merged chain for the assemble UI (first segment +
// chain length), sized generously.
export function beamLabel(merged) {
  const sh = Object.keys(merged.shapes).filter((k) => merged.shapes[k]).map((k) => SHAPE_ABBR[k]).join('+') || '—';
  const total = chainSeedTotal(merged.chain);
  return `${sh} · ${merged.chain.length} card · x${total} seeds`;
}

// Two short lines describing a merged chain, sized for the ~13-col status gutter:
// line 1 = shapes + card count, line 2 = seed total.
export function beamGutterLines(merged) {
  const sh = Object.keys(merged.shapes).filter((k) => merged.shapes[k]).map((k) => SHAPE_ABBR[k]).join('+') || '—';
  const total = chainSeedTotal(merged.chain);
  return [`${sh} ${merged.chain.length}c`, `x${total} seeds`];
}

// Tier-1 starting deck — the SCRIPT.COM + FORK.COM pair. Merged they seed a runner
// swarm that branches off its tips — enough to crack an EASY block about half the
// time; the deck grows from there.
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
