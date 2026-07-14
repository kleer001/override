// Jack-in characters — chosen at run start, defining how your beam packet hits.
// The turret fires ONE packet at a trigger column (ember-model.md §2); characters
// tune the shared terminal meta-stats it draws from, not the card aspects:
//   poolBonus      — extra REACH pool for the packet (embers throw further)
//   reachCapBonus  — raises the per-ember REACH cap (a lance drives deeper)
//   packetBonus    — extra packets / spines fired (FORK — a second front)

export const CHARACTERS = [
  { id: 'wardial',  name: 'WAR-DIALER',  poolBonus: 300, reachCapBonus: 0,  packetBonus: 0, desc: 'deep reach: a bigger REACH pool, embers throw further' },
  { id: 'shotgun',  name: 'SHOTGUNNER',  poolBonus: 0,   reachCapBonus: 0,  packetBonus: 1, desc: 'scatter: fires a second packet — a second spine, more fronts' },
  { id: 'catapult', name: 'CATAPULTIST', poolBonus: 0,   reachCapBonus: 12, packetBonus: 0, desc: 'deep payload: raises the per-ember reach cap, drives through HARD' },
];
