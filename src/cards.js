// Beam-Card cards (research/lsystem-growth.md). Every card is a complete,
// self-contained beam. GROWTH is no longer an isotropic reproduce% — it is a
// deterministic L-system turtle (research/lsystem-growth.md §2–§4). A card bundles:
//   - grammar   — an F/L/R/K program the turtle runs on a loop (shape + launch aim)
//   - pace      — ticks per turtle step (the tempo knob; §4)
//   - connector — how the NEXT card in the chain couples to this one (§7)
//
// Slotting several cards reads the deck TOP-TO-BOTTOM as an ordered CONNECTOR CHAIN
// (§7): the growth programs run in deck order, and each card's connector governs its
// junction to the card after it. There is no arithmetic to merge — no reproduce to
// add, no reach to max.

// The four turtle symbols (research/lsystem-growth.md §2). Direction lives in the
// grammar: a launch aim is just a prefix of turns (e.g. 'RRFF' points east, climbs).
export const SYMBOLS = 'FLRK';

// Connector vocabulary (§7) — how the next card couples to this one. These are the
// three algebraically independent composition primitives (research/lsystem-growth.md
// §7): a disjoint union, a string concatenation, and a tree graft — nothing else
// adds expressiveness (the old BRANCH was a fixed-arity special case of the graft).
//   SCATTER — no handoff; the next card seeds fresh from the spine (parallel union)
//   SPROUT  — on self-trap, the next card grafts off the dead tip, leaping to the
//             first open cell past it (the chain relays deeper — a rooted-tree graft)
//   OVERLAY — the next card's program is APPENDED to this card's: ONE strand runs
//             both grammars as a single loop, at this card's pace (grammar splice —
//             resolved at chain build, so the sim never sees an OVERLAY junction)
export const CONNECTORS = ['SCATTER', 'SPROUT', 'OVERLAY'];

// The Tier-1 card pool (research/lsystem-growth.md §10 turtle-type roster). Each
// card is a bundled beam + identity. grammar ⊆ F/L/R/K;
// connector ∈ CONNECTORS. Constants are un-tuned starting points (§10).
// Coverage is EARNED by the strands' branching skeleton — fork (`K`) density is the
// area lever (research/lsystem-growth.md §6). Runners (no forks) stay thin and weak;
// forkers bush out and fill. Pace is the tempo/power knob (2 = fast/strong, 3–4 =
// slow/weak). Grammars run on a base-10 loop, so a card's turn/fork pattern gets room
// to draw before it repeats. These are a first tuning pass (§10 roster still open).
export const CARDS = {
  'SCRIPT.COM': { id: 'SCRIPT.COM', name: 'SCRIPT.COM', grammar: 'FFFFFFFFFF', pace: 3, connector: 'SCATTER', desc: 'the starter warez — a thin forkless runner; barely rakes the block alone' },
  'FORK.COM':   { id: 'FORK.COM',   name: 'FORK.COM',   grammar: 'FFFFKFFFFF', pace: 2, connector: 'SPROUT',  desc: 'a fast runner that forks once a loop — sprouts the next card where it traps' },
  'SCRIPT.SYS': { id: 'SCRIPT.SYS', name: 'SCRIPT.SYS', grammar: 'RRFFFFFFKF', pace: 3, connector: 'SCATTER', desc: 'the mirror — a turn-prefix aims it east, then it runs long and forks late' },
  'BUFFER.OVR': { id: 'BUFFER.OVR', name: 'BUFFER.OVR', grammar: 'FLFKFRFKLF', pace: 2, connector: 'SCATTER', desc: 'overflow — a fast wide forking zig-zag; the curtain workhorse' },
  'WORM':       { id: 'WORM',       name: 'WORM',       grammar: 'FFKFFKFFKF', pace: 2, connector: 'SPROUT',  desc: 'the Morris spread — forks hard and sprouts the chain onward' },
  'HARMONIC':   { id: 'HARMONIC',   name: 'HARMONIC',   grammar: 'FFKFRKFFRK', pace: 2, connector: 'OVERLAY', desc: 'octave up — a forking coiler that splices the next card’s program onto its own' },
  'PHREAK':     { id: 'PHREAK',     name: 'PHREAK',     grammar: 'FFRFKFFRFK', pace: 3, connector: 'SCATTER', desc: '3rd harmonic — a tight coiler that curls and forks into the gaps' },
  'BLUEBOX':    { id: 'BLUEBOX',    name: 'BLUEBOX',    grammar: 'FFFFFFFFKF', pace: 2, connector: 'SCATTER', desc: 'fast vertical jets that fork late — climbs toward the top objectives' },
  'LOGICBOMB':  { id: 'LOGICBOMB',  name: 'LOGICBOMB',  grammar: 'RRRRFFFFKF', pace: 3, connector: 'SCATTER', desc: 'turns to face down, then drills and forks toward the core' },
  'XOR':        { id: 'XOR',        name: 'XOR',        grammar: 'RFLFKRFLFK', pace: 3, connector: 'SCATTER', desc: 'crossing diagonals — a forking wanderer that fills a curtain’s gaps' },
  'DAEMON':     { id: 'DAEMON',     name: 'DAEMON',     grammar: 'FFKFKFFKFK', pace: 4, connector: 'SPROUT',  desc: 'a slow but heavily forking spawner that keeps sprouting where it traps' },
  'NOP.SLED':   { id: 'NOP.SLED',   name: 'NOP.SLED',   grammar: 'F',          pace: 3, connector: 'SPROUT',  desc: 'a plain forkless sled — weak alone, but the next card rides its trapped tips' },
  'TANGENT':    { id: 'TANGENT',    name: 'TANGENT',    grammar: 'FRFFFFFFFF', pace: 2, connector: 'SCATTER', desc: 'a fast forkless blowout runner — usually fizzles, sometimes paints half a block' },
  'ROOTKIT':    { id: 'ROOTKIT',    name: 'ROOTKIT',    grammar: 'FFKFKFKFKF', pace: 2, connector: 'SPROUT',  desc: 'dense forks — and it sprouts the chain onward from every trapped tip' },
  'PAYLOAD':    { id: 'PAYLOAD',    name: 'PAYLOAD',    grammar: 'FFKFKFKFFK', pace: 2, connector: 'SPROUT',  desc: 'the rare workhorse — dense forks that sprout the chain onward' },
  '0DAY':       { id: '0DAY',       name: '0DAY',       grammar: 'FKFKFKFKFK', pace: 2, connector: 'SPROUT',  desc: 'the legendary grail — fast, dense, maximal forks that sprout the chain onward' },
};

// Build the merged beam a chain of cards produces (research/lsystem-growth.md §7):
// an ORDERED chain of segments in deck order, carrying grammar/pace and the
// connector governing the junction to the NEXT segment. An OVERLAY junction folds
// the following card INTO the segment — grammars concatenate into one looped
// program (pace stays the leading card's; the fold carries the folded card's
// connector onward), so consecutive OVERLAYs splice into a single strand.
// `cards` on the result is the slotted-card count (segments may be fewer).
export function buildChain(cards) {
  const chain = [];
  let count = 0;
  for (const c of cards) {
    if (!c) continue;
    count++;
    const grammar = sanitizeGrammar(c.grammar);
    const prev = chain[chain.length - 1];
    if (prev && prev.connector === 'OVERLAY') {
      prev.grammar += grammar;
      prev.connector = c.connector;
    } else {
      chain.push({ grammar, pace: Math.max(1, c.pace | 0), connector: c.connector });
    }
  }
  return { chain, cards: count };
}

// Keep only valid turtle symbols; an empty program falls back to a lone 'F' so a
// seed at least burns forward rather than sitting inert. Exported so the preview
// sandbox validates typed grammars through the same rule the game uses.
export function sanitizeGrammar(g) {
  const clean = String(g || '').split('').filter((ch) => SYMBOLS.includes(ch)).join('');
  return clean || 'F';
}

// A compact aspect line for a single card — fits the wider shop row.
export function cardLabel(card) {
  return `${card.grammar}·p${card.pace}·${card.connector}`;
}

// The card's aspects as short lines for the tall card panel (a 13-col interior):
// grammar, then pace, then the connector spelled out on its own line.
export function cardLines(card) {
  return [card.grammar.slice(0, 13), `pace ${card.pace}`, card.connector];
}

// A short one-line readout of a merged chain for the assemble UI, sized generously.
export function beamLabel(merged) {
  return `${merged.cards} card chain`;
}

// Short lines describing a merged chain, sized for the ~13-col status gutter.
export function beamGutterLines(merged) {
  return [`${merged.cards} card chain`];
}

// Reference two-card deck (SCRIPT.COM + FORK.COM) for the balance harness and tests.
// The GAME no longer hands this out — a new player authors their own first card
// (cardFromGrammar) in the tutorial; see main.js.
export function startingDeck() {
  return ['SCRIPT.COM', 'FORK.COM'].map((id) => ({ ...CARDS[id] }));
}

// The player's hand-authored first card. Its id is constant (AUTHORED_ID) so the deck
// still persists as ids; the grammar rides alongside in localStorage and rehydrates
// through here. Pace 1 to match the survival-mode tuning; SCATTER so it composes
// cleanly once other cards are drafted in.
export const AUTHORED_ID = 'PROG.COM';
export function cardFromGrammar(grammar) {
  return { id: AUTHORED_ID, name: AUTHORED_ID, grammar: sanitizeGrammar(grammar), pace: 1, connector: 'SCATTER',
    desc: 'the program you wrote by hand — a self-avoiding line' };
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
