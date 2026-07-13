// Trauma-based screen shake — Squirrel Eiserloh, "Juicing Your Cameras with
// Math" (GDC 2016). A single decaying `trauma` scalar in [0,1] drives the shake;
// the offset is trauma-SQUARED (never linear), so a whisper barely nudges and a
// detonation slams, matching the §3 proportionality ladder in research/juice-model.md.
// Events ADD trauma proportional to their weight; every frame it DECAYS toward 0.
//
// Pure math + state: main.js owns one instance, samples shake() each frame and
// writes a CSS transform on the .crt container. Deterministic for tests — decay
// takes an explicit dt and shake() takes an injectable rand().

export function createTrauma({
  decayPerSec = 1.8,   // trauma bled off per second (a 0.9 hit settles in ~0.5s)
  maxOffset = 6,       // px of translate at full trauma
  maxRot = 0.6,        // deg of rotation at full trauma
} = {}) {
  let trauma = 0;
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  return {
    // current trauma (mostly for tests / debugging)
    get value() { return trauma; },

    // stack trauma from an event; multiple events in a frame accumulate.
    add(amount) { trauma = clamp01(trauma + amount); return trauma; },

    // hard reset — call when a new run/machine starts so shake never carries over.
    reset() { trauma = 0; },

    // bleed trauma toward 0. dtMs is the frame delta in ms.
    decay(dtMs) { trauma = clamp01(trauma - decayPerSec * (dtMs / 1000)); return trauma; },

    // the shake offset for this frame. shake ∝ trauma² (Eiserloh); each axis is
    // independently jittered in [-max, max]. rand() must return [0,1).
    shake(rand = Math.random) {
      const s = trauma * trauma;
      return {
        x: maxOffset * s * (rand() * 2 - 1),
        y: maxOffset * s * (rand() * 2 - 1),
        rot: maxRot * s * (rand() * 2 - 1),
      };
    },
  };
}
