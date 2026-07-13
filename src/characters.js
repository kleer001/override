// Jack-in characters — chosen at run start, defining how your pings hit. In the
// base game pings land at RANDOM cells (precise aiming is a future power-up), so
// characters differ in the shape of their volley: more pings vs. hotter pings.
//   pingBonus   — extra pings per volley (more fronts, more surface area)
//   energyBonus — extra energy per ping (each front burns deeper / through HARD)

export const CHARACTERS = [
  { id: 'wardial',  name: 'WAR-DIALER',  pingBonus: 0, energyBonus: 3, desc: 'focused: fewer pings, each carries more energy' },
  { id: 'shotgun',  name: 'SHOTGUNNER',  pingBonus: 2, energyBonus: 0, desc: 'scatter: +2 pings per volley, more fronts at once' },
  { id: 'catapult', name: 'CATAPULTIST', pingBonus: 0, energyBonus: 5, desc: 'deep payload: big energy per ping, punches through HARD' },
];
