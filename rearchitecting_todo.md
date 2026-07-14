# Rearchitecting TODO — the Beam-Card overhaul

Working branch: `claude/peggle-turret-overhaul-xauz7a`. This tracks the pivot from
the card-programmed accumulator to the **Beam-Card Model**. Authoritative design:
[`research/ember-model.md`](research/ember-model.md); reference survey:
[`research/weapon-design-references.md`](research/weapon-design-references.md).

## Where we are (done)

- **Core model settled** — turret fires one packet → beam **spine** (`x(y)=p+Σshape(y)`)
  → embers emit off it (direction) at a probability → they spread and now **reproduce**
  (see below) → trace scan is the clock → reach 50% + hold breach timer to win.
- **Cards = bundled quads** `(shape, direction, probability, growth)`; merging adds
  probability (cap 100), unions direction, sums shape (Fourier), adds growth (cap ~60%,
  child spread-reach maxes). Order retired. *(GROWTH folded into the docs 2026-07-14.)*
- **REACH = shared per-packet pool** split across embers → depth/width trade.
- **Docs reconciled** — `GAME-SHEET.md` + `SPEC-SHEET.md` ported off the accumulator;
  ICE settled as trace-only at Tier 1 (spreading ICE is later-tier).
- **Calibration sandbox** `preview/beam.html` (+ `beam-sim.js` pure/testable, `beam.js`
  DOM) over real terrain, with the five escalation-stack presets. `node --test` 26/26.

## The live design question — DECIDED (2026-07-14)

**GROWTH is a real 4th dimension, and it's not optional.** Calibration proved a single
finite-REACH packet caps ~40–57% coverage and the fire *dies* — so embers **reproduce**
(each burning ember may spawn a child that spreads to a fresh unburned neighbour). Two
params: `spreadReach` (child persistence) + `reproduce` (spawn chance). Coverage then
grows toward an equilibrium vs. the scan (curtain hi-peak 55% → 83% as reproduce rises).

**Resolutions (all folded into `ember-model.md` §3/§4/§5/§6/§8/§11/§12, and into
`GAME-SHEET.md` + `SPEC-SHEET.md`):**

1. **GROWTH is a FULL 4th bundled card aspect** `(shape, dir, prob, growth)`. Cards are
   now quads. Reproduce chance ADDS (cap ~60%), child spread-reach takes the MAX. The
   4-aspect weld is the accepted onboarding cost; grail cards (`WORM`, `0DAY`) are
   drafted *for* their growth. REACH stays a meta-stat (spray budget); GROWTH is the
   card-side sustained-burn lever — two separate knobs.
2. **Reproduction stays generative-but-gated** — unburned-only spawn + `MAX_EMBERS` cap
   + scan erosion. No child re-burns held ground, so it does NOT reopen the free flood.
3. **Tiers restaged** — Tier 1 now ships the four base aspects incl. *undirected* growth
   (needed to breach at all); Tier 3 `FORK` becomes *directed* growth (aimed
   sub-emitters), an escalation of the baseline, not its introduction.
4. **WIN_COVERAGE stays 50%** (Tier-1 "barely crack your own terminal"; GROWTH is what
   makes 50% reachable). Sandbox default unchanged at 50.

## Next steps (in order)

### 1. Fold GROWTH into `ember-model.md` — ✅ DONE (2026-07-14)
- ✅ GROWTH aspect in §3 (quad card model + merge rule) and §4 (spread loop = emit →
  spread → reproduce, with the MAX_EMBERS guard and unburned-neighbour rule + the
  generative-but-gated note).
- ✅ §6 escalation stacks carry merged growth per archetype (GLITCH = high reproduce
  chaos-fill, LANCE = low, HARMONIC/CURTAIN grow, FENCE low).
- ✅ §12 reframed: REACH = initial spray budget, GROWTH = sustained-burn budget — two
  separate levers, both documented. §8 tiers restaged; §11 growth legibility signature.
- ✅ Also propagated to `GAME-SHEET.md` (loop + pillars + card fiction) and
  `SPEC-SHEET.md` (battle model, card table, data schema, MVP build order).

### 2. Decide the breach target (`WIN_COVERAGE`) — ✅ DECIDED: stays 50%
- Kept at 50% (Tier-1 *meant* to be barely winnable — "you barely crack your own
  terminal"; GROWTH is what makes 50% reachable). Sandbox/doc defaults unchanged.

### 3. Proper balance pass in the sandbox — ⏭ NEXT (needs the browser sandbox)
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

### 5. Cosmetic / cleanup — ✅ DONE
- ✅ SPEC-SHEET board mock redrawn to the neutral/scan aesthetic: `#` is now a single
  horizontal scan band (breaking at link channels), `X` is a reclaim flash just above
  it, and the old scattered `#X#` ICE clusters are gone (now density-ramp infection).
- ✅ Live ember-count readout already present in `preview/beam.html` (`embers alive`),
  wired in `beam.js`. (Optional future nice-to-have: a *peak* ember-count readout,
  since reproduction spikes are transient.)

## Files touched by this overhaul
- Design: `research/ember-model.md`, `research/weapon-design-references.md`,
  `GAME-SHEET.md`, `SPEC-SHEET.md`
- Sandbox: `preview/beam.html`, `preview/beam.js`, `preview/beam-sim.js`
- Unchanged/old-model (needs porting): `src/battle.js`, `src/cards.js`, `src/characters.js`
