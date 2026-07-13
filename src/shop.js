// ROOT shop catalog. Pure data — persistence + application live in main.js.
// Design: research/ROOT-shop-design.md. Permanent items are POOL EXPANSION
// (unlock options, never raw stats); consumables carry the numeric power and a
// single blessing/curse. Costs are starting points to tune (a run banks ~40-90
// ROOT per breach; players open with 120).

export const SHOP_ITEMS = [
  // --- PERMANENT: pool expansion (StS-anchored, persists forever) ---
  { id: 'char_shotgun',  kind: 'char', cost: 120, name: 'UNLOCK: SHOTGUNNER',   desc: 'jack-in — +2 pings per volley (more fronts)' },
  { id: 'char_catapult', kind: 'char', cost: 200, name: 'UNLOCK: CATAPULTIST',  desc: 'jack-in — big energy per ping (punch HARD)' },
  { id: 'card_SHL',      kind: 'card', cost: 100, name: 'UNLOCK CARD: SHL x3',  desc: 'into draft pool — x3 multiplier' },
  { id: 'card_GOTO',     kind: 'card', cost: 90,  name: 'UNLOCK CARD: GOTO',    desc: 'into draft pool — re-run the previous card' },
  { id: 'card_PUNCH',    kind: 'card', cost: 140, name: 'UNLOCK CARD: PUNCHCARD',desc: 'into draft pool — +12 heavy payload' },
  // --- CONSUMABLE: numeric power, single-use ---
  { id: 'retry',         kind: 'retry', cost: 100, name: 'RETRY TOKEN',         desc: 'survive one lost battle — holds until used' },
  // --- CURSE / BLESSING (~1-in-3 of the consumable shelf) ---
  { id: 'overclock',     kind: 'curse', cost: 70,  name: 'OVERCLOCK (next run)', desc: '+2 energy/ping all run, BUT trace +0.25 aggression' },
];

// item id -> the thing it unlocks
export const CHAR_UNLOCK = { char_shotgun: 'shotgun', char_catapult: 'catapult' };
export const CARD_UNLOCK = { card_SHL: 'SHL', card_GOTO: 'GOTO', card_PUNCH: 'PUNCH' };
