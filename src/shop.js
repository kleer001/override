// ROOT shop catalog. Pure data — persistence + application live in main.js.
// Design: research/ROOT-shop-design.md. PERMANENT items are pool expansion (unlock
// options, never raw stats); DECK items drop a basic card straight into your deck
// (a cheap way to thicken the curtain); consumables carry the numeric power. Costs
// are starting points to tune (a run banks ~40-90 ROOT per breach; players open
// with 120).

// name = the item's identity; the shop UI shows kind as a TYPE tag beside it, so
// names stay terse and descriptions carry no redundant "into pool/deck —" prefix.
export const SHOP_ITEMS = [
  // --- DECK: a basic card straight into the deck (repeatable, cheap) ---
  { id: 'deck_FORK',     kind: 'deckcard', cost: 10, name: 'FORK.COM',    desc: 'a forking runner that branches the chain onward' },
  // --- PERMANENT: pool expansion (StS-anchored, persists forever) ---
  { id: 'card_ROOTKIT',  kind: 'card', cost: 100, name: 'ROOTKIT', desc: 'dense forks, branches hard' },
  { id: 'card_PAYLOAD',  kind: 'card', cost: 140, name: 'PAYLOAD', desc: 'dense forks that sprout the chain' },
  { id: 'card_0DAY',     kind: 'card', cost: 200, name: '0DAY',    desc: 'the grail — fast, dense, forking, bushing' },
  // --- CONSUMABLE: numeric power, single-use ---
  { id: 'retry',         kind: 'retry', cost: 100, name: 'RETRY TOKEN', desc: 'survive one lost battle this run' },
];

// item id -> the thing it grants
export const DECK_CARD = { deck_FORK: 'FORK.COM' };
export const CARD_UNLOCK = { card_ROOTKIT: 'ROOTKIT', card_PAYLOAD: 'PAYLOAD', card_0DAY: '0DAY' };
