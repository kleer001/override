# Rearchitecting TODO — the Beam-Card overhaul

Working branch: `claude/peggle-turret-overhaul-xauz7a`. This tracks the pivot from
the card-programmed accumulator to the **Beam-Card Model**. Authoritative design:
[`research/ember-model.md`](research/ember-model.md); reference survey:
[`research/weapon-design-references.md`](research/weapon-design-references.md).

## Where we are (done)

- **Core model settled** — turret fires one packet → beam **spine** (`x(y)=p+Σshape(y)`)
  → embers emit off it (direction) at a probability → they spread and now **reproduce**
  (see below) → trace scan is the clock → reach 50% + hold breach timer to win.
- **Cards = bundled triples** `(shape, direction, probability)`; merging adds
  probability (cap 100), unions direction, sums shape (Fourier). Order retired.
- **REACH = shared per-packet pool** split across embers → depth/width trade.
- **Docs reconciled** — `GAME-SHEET.md` + `SPEC-SHEET.md` ported off the accumulator;
  ICE settled as trace-only at Tier 1 (spreading ICE is later-tier).
- **Calibration sandbox** `preview/beam.html` (+ `beam-sim.js` pure/testable, `beam.js`
  DOM) over real terrain, with the five escalation-stack presets. `node --test` 26/26.

## The live design question (decide first — everything hangs off it)

**GROWTH is a real 4th dimension, and it's not optional.** Calibration proved a single
finite-REACH packet caps ~40–57% coverage and the fire *dies* — so the sandbox now has
embers **reproduce** (each burning ember may spawn a child that spreads to a fresh
unburned neighbour). Two params: `spreadReach` (child persistence) + `reproduce`
(spawn chance). With it, coverage grows toward an equilibrium vs. the scan (curtain
hi-peak 55% → 83% as reproduce rises). **This is only in the sandbox sim; the doc's
card model is still a triple.** Decisions needed:

1. **Is GROWTH a 4th bundled card aspect** `(shape, dir, prob, growth)`, a **terminal
   meta-stat** (like REACH), or split (reach = meta, reproduce = card)? The original
   message-1 pitch had reproduction as a *card* knob ("frequency they reproduce"),
   which argues for a card aspect. But 4 welded aspects per card is a lot — revisit the
   MTG-bundle discipline against onboarding.
2. **Does reproduction stay generative (grows until scan/terrain bound it) or conserved?**
   Sandbox is generative-but-gated (unburned-only spawn + MAX_EMBERS cap + scan erosion).
   Confirm this doesn't reopen the "free flood" the model explicitly killed.
3. **Restage the tiers** — `ember-model.md` §8 put branch/`FORK` at Tier 3. If GROWTH is
   core (needed to breach at all), Tier 1 must include at least a baseline reproduce.
   Rework the "one aspect per tier" ladder.

## Next steps (in order)

### 1. Fold GROWTH into `ember-model.md` (after deciding above)
- Add the GROWTH aspect to §3 (card model) and §4 (spread loop = emit → spread →
  reproduce, with the MAX_EMBERS guard and unburned-neighbour rule).
- Update §6 escalation stacks with reproduce/spreadReach per archetype (GLITCH = high
  reproduce chaos-fill, LANCE = low, etc. — mirror the sandbox presets).
- Re-examine §12 "resolved" REACH note — pool is now the *initial* spray budget; GROWTH
  is the sustained-burn budget. Two separate levers; document both.

### 2. Decide the breach target (`WIN_COVERAGE`)
- Single packet + moderate reproduce reaches ~50% only on good boards (median ~40%).
  Either keep 50% (Tier-1 is *meant* to be barely winnable — "you barely crack your own
  terminal") **or** lower to ~35–40%, **or** lean on GROWTH/multi-packet to make 50%
  routine. This is a feel call — watch the sandbox.

### 3. Proper balance pass in the sandbox
- Tune `{pool, reachCap, spreadReach, reproduce, scanSpeed, reclaim, breachHold}` to the
  §13 target: a strong deck wins ~5/6, a weak deck 0/6, terrain still gates (~1/8 BRUTAL).
  Current preset/default numbers are **provisional starting points, not balance.**
- Still-open dials from `ember-model.md` §12: default **emission rate**, **slot curve**
  (start 1, +1/breach, cap ~3 T1), **card-rarity** weights.

### 4. Port the sim into the real game (`src/`)
- `preview/beam-sim.js` is the reference implementation; the live game (`src/battle.js`
  et al.) still runs the retired accumulator model. Build the Tier-1 vertical slice on
  the new sim (SPEC-SHEET §"MVP build order" is updated for this).
- Author the ~25–30 card pool (`ember-model.md` §5) as real card data.

### 5. Cosmetic / cleanup
- SPEC-SHEET board-mock ASCII still shows `#X#` ICE-style clusters; redraw to the
  neutral/scan aesthetic (legend already updated).
- Consider a `preview/beam.html` readout of live ember count (reproduction can spike it).

## Files touched by this overhaul
- Design: `research/ember-model.md`, `research/weapon-design-references.md`,
  `GAME-SHEET.md`, `SPEC-SHEET.md`
- Sandbox: `preview/beam.html`, `preview/beam.js`, `preview/beam-sim.js`
- Unchanged/old-model (needs porting): `src/battle.js`, `src/cards.js`, `src/characters.js`
