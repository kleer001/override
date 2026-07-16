// ROOT shop catalog. Pure data — persistence + application live in main.js.
// Design: research/ROOT-shop-design.md. PERMANENT items are pool expansion (unlock
// options, never raw stats); DECK items drop a basic card straight into your deck
// (a cheap way to thicken the curtain); consumables carry the numeric power and a
// single blessing/curse. Costs are starting points to tune (a run banks ~40-90 ROOT
// per breach; players open with 120).

// name = the item's identity; the shop UI shows kind as a TYPE tag beside it, so
// names stay terse and descriptions carry no redundant "into pool/deck —" prefix.
export const SHOP_ITEMS = [
  // --- DECK: a basic card straight into the deck (repeatable, cheap) ---
  { id: 'deck_FORK',     kind: 'deckcard', cost: 10, name: 'FORK.COM',    desc: 'a right-sheet card, 50% + reproduce' },
  // --- PERMANENT: pool expansion (StS-anchored, persists forever) ---
  { id: 'card_ROOTKIT',  kind: 'card', cost: 100, name: 'ROOTKIT', desc: 'premium density, fires both ways' },
  { id: 'card_PAYLOAD',  kind: 'card', cost: 140, name: 'PAYLOAD', desc: 'dense and self-spreading' },
  { id: 'card_0DAY',     kind: 'card', cost: 200, name: '0DAY',    desc: 'the grail — full density, high growth' },
  // --- CONSUMABLE: numeric power, single-use ---
  { id: 'retry',         kind: 'retry', cost: 100, name: 'RETRY TOKEN', desc: 'survive one lost battle this run' },
  // --- CURSE / BLESSING (~1-in-3 of the consumable shelf) ---
  { id: 'overclock',     kind: 'curse', cost: 70,  name: 'OVERCLOCK', desc: 'more reach all run, but +0.25 trace' },
];

// item id -> the thing it grants
export const DECK_CARD = { deck_FORK: 'FORK.COM' };
export const CARD_UNLOCK = { card_ROOTKIT: 'ROOTKIT', card_PAYLOAD: 'PAYLOAD', card_0DAY: '0DAY' };
