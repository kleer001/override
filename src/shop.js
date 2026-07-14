// ROOT shop catalog. Pure data — persistence + application live in main.js.
// Design: research/ROOT-shop-design.md. Permanent items are POOL EXPANSION
// (unlock options, never raw stats); consumables carry the numeric power and a
// single blessing/curse. Costs are starting points to tune (a run banks ~40-90
// ROOT per breach; players open with 120).

export const SHOP_ITEMS = [
  // --- PERMANENT: pool expansion (StS-anchored, persists forever) ---
  { id: 'char_shotgun',  kind: 'char', cost: 120, name: 'UNLOCK: SHOTGUNNER',   desc: 'jack-in — fires a second packet (a second spine)' },
  { id: 'char_catapult', kind: 'char', cost: 200, name: 'UNLOCK: CATAPULTIST',  desc: 'jack-in — higher per-ember reach cap (punch HARD)' },
  { id: 'card_ROOTKIT',  kind: 'card', cost: 100, name: 'UNLOCK CARD: ROOTKIT', desc: 'into draft pool — premium density, both ways' },
  { id: 'card_PAYLOAD',  kind: 'card', cost: 140, name: 'UNLOCK CARD: PAYLOAD', desc: 'into draft pool — dense and self-spreading' },
  { id: 'card_0DAY',     kind: 'card', cost: 200, name: 'UNLOCK CARD: 0DAY',    desc: 'into draft pool — the legendary grail beam' },
  // --- CONSUMABLE: numeric power, single-use ---
  { id: 'retry',         kind: 'retry', cost: 100, name: 'RETRY TOKEN',         desc: 'survive one lost battle — holds until used' },
  // --- CURSE / BLESSING (~1-in-3 of the consumable shelf) ---
  { id: 'overclock',     kind: 'curse', cost: 70,  name: 'OVERCLOCK (next run)', desc: '+REACH pool all run, BUT trace +0.25 aggression' },
];

// item id -> the thing it unlocks
export const CHAR_UNLOCK = { char_shotgun: 'shotgun', char_catapult: 'catapult' };
export const CARD_UNLOCK = { card_ROOTKIT: 'ROOTKIT', card_PAYLOAD: 'PAYLOAD', card_0DAY: '0DAY' };
