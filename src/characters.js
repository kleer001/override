// Jack-in characters — chosen at run start. Each defines how you ignite: the
// gnomon sweep speed (period, ms — lower = faster & harder to time) and the
// ember pattern that lands at your locked mark.

export const CHARACTERS = [
  { id: 'wardial',  name: 'WAR-DIALER',  period: 2600, scatter: 0, deep: false, desc: 'slow, precise aim; one clean ember at your mark' },
  { id: 'shotgun',  name: 'SHOTGUNNER',  period: 1100, scatter: 4, deep: false, desc: 'fast aim; 5 embers scattered around the mark' },
  { id: 'catapult', name: 'CATAPULTIST', period: 1700, scatter: 0, deep: true,  desc: 'lobs one ember deep; aim limited to the far half' },
];
