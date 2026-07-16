# L-System Growth — design doc

*Replaces the GROWTH aspect of OVERRIDE. In [`ember-model.md`](ember-model.md)
the beam still fires a spine and emits strands, but a strand is no longer an
isotropic `reproduce%`-into-a-random-neighbour ember with a `spreadReach`. It is a
**deterministic L-system turtle** drawn at a per-card **pace**, racing the trace
scan. No budget, no reproduce level. Everything else in ember-model — turret, beam
spine, probability→seed count, terrain cost, trace scan, WIN_COVERAGE 50% — stands
(direction is no longer a separate aspect; it folds into the grammar, §2). Status:
prototype-validated 2026-07-16 (`scratchpad/pace*.mjs`, `order2.mjs`); constants
un-tuned; not yet in `src/`.*

Terminology: a growing ember is a **turtle**; its trail is the **skeleton**; the
fill behind it is **smolder**.

---

## 0. Why (the flat-diamond diagnosis)

The shipped growth reproduces a burning ember into a **random orthogonal
neighbour**. Isotropic growth on a grid always relaxes to a diamond (an L¹ ball)
because no ember has a *heading* — and the `N/L/M/H` reproduce levels only ever
said *more vs. less*, so the axis read as one flat knob where "only H does
anything." Structure has to come from a committed heading plus a rule for changing
it. That is a turtle running a grammar.

North stars for "structured but NOT smart, searching": **Langton's ant** (a 2-rule
turn machine → emergent highway), **diffusion-limited aggregation / Lichtenberg
breakdown** (the branching-blaze look from a dumb local rule), and **bounded
L-systems** (turtle graphics). None plan; all *look* like they search.

---

## 1. Deterministic weapon, variable field

The grammar has **no RNG**. Same grammar + same board ⇒ byte-for-byte identical
result. A player must trust the tool; every bit of variation comes from the
**field** — terrain, walls, and where other turtles have already burned. This
constraint governs the rest.

---

## 2. The symbol set (quaternary)

Four symbols, one read per turtle per step:

| sym | meaning |
|-----|---------|
| `F` | advance one cell in the heading and **burn** it |
| `L` | turn **left** 45° |
| `R` | turn **right** 45° |
| `K` | **fork**: spawn a child turtle here, heading turned |

Two turn symbols (not one "rotate") is the minimum that lets grammars express
zig-zags and worms rather than one-handed curls. Headings are the existing 8
compass directions; `L`/`R` step ±1 around them.

**Direction lives in the grammar.** Every turtle seeds from a fixed canonical
heading (up, away from the turret); a strand's launch direction is just a prefix of
turns — `RRFFF` climbs, then the `RR` points it east before running. So there is no
separate `dir` channel: the grammar carries shape *and* aim, and a strand can even
change course mid-draw, which a static field never could.

---

## 3. The turtle

State: `{x, y, heading, pc}`. The program string is read on a **loop**
(`pc mod len`), so a 4-symbol grammar like `FFRF` run past its length becomes a
spiral — large emergent form from a tiny grammar.

**Searching reroute (the "not smart" rule).** On `F`, probe headings in the fixed
order `0, +1, −1, +2, −2, +3, −3, +4` and take the **first** cell that is
on-board, non-wall, and unburned. If none, the turtle dies. This makes the blaze
hug walls and thread gaps with zero pathfinding — reactive, deterministic, and it
never re-treads its own trail.

**Fork.** `K` spawns a child at the current cell with heading turned `+2` (parent
`−1`), sharing nothing — there is no budget to split (§4). Child count is bounded
by `MAX_EMBERS`; grammars near `d ≈ 0.33` `K`-density stay cheap.

A turtle draws until it self-traps, leaves the board, or is reclaimed by the scan.

---

## 4. Pace, not budget

A strand has no total-cells cap. It carries a **pace** — a period, *ticks per
step* — and advances on its own clock: `F` every `period` ticks. Fast strands
(low period) draw quickly; slow strands (high period) crawl. That is the only
"how much" knob, and it is a *rate*, not a quantity — so there is nothing to sum
or average when cards merge (§7).

The bound on a strand is not a number; it is **time × space**: self-trapping caps
its footprint, and the descending scan caps its lifetime (§5).

---

## 5. The scan is the bound

The run **ends when the trace scan bottoms out**. Coverage is measured as **peak
simultaneous** burn during that window — you win by *hitting* WIN_COVERAGE (50%)
and holding through the breach timer before the scan lands, never by what survives
after. So the whole battle is a **race: how much can your strands paint before the
scan sweeps down through them.**

Pace-vs-scan is the entire tension, and it is tunable. Prototype (board 64×32,
grammar `FFFFFFK`, run ends at scan-bottom):

- **Period ≈ 4 is the knife-edge** — coverage lands 52–67% across seed counts and
  wins by a hair. Faster (p2) trivialises it (~90%); slower (p8+) mostly loses.
- **Scan speed is the difficulty dial** — the existing `aggression` knob. At p4:
  lazy scan 0.15 → 68% win, aggressive 0.30 → 35% loss. Difficulty and the ember
  model are the same system.

---

## 6. Smolder (turning filaments into area)

Turtles are thin; a win needs area. A skeleton cell that reaches age
`smolderDelay` blooms **once** into one neighbour (biased toward the low, safe side
away from the scan). The advancing tip stays a bright searching filament; the body
thickens into rivers behind it; the scan eats the trailing body, so you must keep
pushing frontier. Worth roughly +7–11 coverage points and cleanly tunable —
strength/rules to be set from testing.

---

## 7. The card, and the merge (connector chain)

A card's growth aspect has four channels:

```
growth: { grammar: 'FFFFFFK', pace: 4, seeds: 12, connector: 'SCATTER' }
```

- **grammar** `F/L/R/K` — shape *and* launch direction (§2)
- **pace** — tempo (§4)
- **seeds** — strands raked off the beam spine (the old probability/density axis:
  the coverage multiplier)
- **connector** — how the **next** card in the deck couples to this one

The deck is read **top-to-bottom as a chain** —
`seed → card₁ → [card₁.connector] → card₂ → [card₂.connector] → card₃ …` — which is
the "assembling a program" fiction made literal. A card's connector governs *its*
junction to the card after it, so the merge is **order-dependent by construction**:

- **`SCATTER`** — no handoff; the next card seeds fresh from the spine. This is the
  order-blind union — cards run as an independent swarm.
- **`SPROUT`** — the next card continues from this card's frontier tips; the chain
  grows longer (a runner that sprouts forks where it traps).
- **`BRANCH`** — the next card fans out as children off the tips; the chain bushes.
- **`OVERLAY`** — the next card runs concurrently from the same seed points.

There is still **no arithmetic** — no pool to sum, no level to average — so the
merge pathologies of a numeric budget cannot arise. `SCATTER` is the neutral
default; the coupling connectors add ordered structure on top. (Rejected
alternative: commutative string-operators that fold cards into one hybrid grammar —
they lose both order and pace diversity.)

**Order matters, non-monotonically.** Prototype, a two-card `SPROUT` chain (16
strands): a runner-then-forker draws 36%, but forker-then-runner draws **55%** — a
19-point swing, and the winner flips with the geometry (bushing low first builds
safe area the scan reaches last, *then* runners climb out of it). Unlike a simple
launch stagger, there is no monotonic "lead with the fast card" rule; the right
sequence is a real puzzle.

**Seed count self-optimises.** More strands is not strictly better: they crowd at
the spine and self-trap into each other. Prototype at p4 — 16 seeds → 67%, 48 seeds
→ 52%. An emergent sweet spot, no cap needed.

---

## 8. Synergy comes from pace diversity

Because the beam is a swarm, the deckbuilding depth is **blending tempos**, and it
is genuinely non-additive:

- **Vanguard + fill.** Prototype, 24 strands: uniform p4 → 56%; a **fast-scout
  (p3) + slow-filler (p8)** mix → **71%**. The fast strands punch their paths
  first; the slow strands trickle into the gaps *later*, so they don't crowd and
  self-trap. Temporal separation makes strands cooperate instead of compete. This
  is the engine of the system — a "scouts and fillers" archetype, no special card.
- **Connector order** (§7) is the second synergy axis — sequencing the chain to
  build safe area before climbing is worth ~19 points and is non-monotonic.
- **Direction fan** is a minor, situational knob (+~7% for a wide lateral fan that
  spreads into territory the scan reaches last; full 8-way does not help). Spice,
  not a headline.

So the "dynamic synergy" the growth rework was chasing comes from the two mechanics
that replaced budget: diverse *paces* in one swarm, and the *order* of the chain.

---

## 9. Implementation touch points

- `src/cards.js` — growth aspect → `{grammar, pace, seeds, connector}`; drop the
  `GROWTH` reproduce/reach table and the additive `mergeBeam` growth math; merge
  becomes an ordered connector chain over the slotted cards.
- `src/beam.js` — replace the reproduce block in `stepEmbers` with the turtle VM
  (symbols, looped `pc`, searching reroute, fork); per-strand pace clock; the
  connector handoff (tip → next segment) on trap; add the smolder pass; end the run
  at scan-bottom and track peak coverage.
- `src/battle.js` — gutter readout shows the chain (grammar / pace / connector per
  card) and seed total; wire scan speed to `aggression`.
- `src/juice.js` — a beat for the advancing frontier; see [`juice-model.md`](juice-model.md).
- `tests/` — determinism (same swarm + field twice → identical), searching-reroute
  never re-treads, coverage regression on a fixed seeded board at fixed scan speed.

---

## 10. Open / to-tune

- **Pace band** — where the knife-edge sits on the real 80×40 board at the shipped
  scan speed; the p≈4 figure is prototype-relative.
- **Smolder** strength & bias — tune to land 50% at "barely winnable."
- **Turtle-type roster** — validate a starter set (runner / forker / coiler /
  wanderer) feels distinct; pace and connector per card.
- **Connector semantics** — pin down `SPROUT`/`BRANCH`/`OVERLAY` handoff rules and
  which the starter cards carry; confirm order stays non-monotonic across the roster.
- **Seed sweet spot** per grammar, and the canonical launch heading off the spine.
- **Enclosed-territory** coverage (Qix/Go) — parked; possible later spice for
  looping grammars.

---

## 11. References

Langton's ant; diffusion-limited aggregation / dielectric (Lichtenberg) breakdown;
turtle graphics & bounded L-systems (structure from dumb local rules). The
pace-diversity synergy is the deckbuilding lineage (composition patterns from
Balatro / Slay the Spire / Noita wand chains) expressed as tempo blending rather
than number-stacking, plus the ordered connector chain (Noita wand-chains: a card
transforms what comes after it). Prototypes: `scratchpad/pace{2,3,4}.mjs`
(geometry, run-ends-at-scan-bottom, pace/scan sweeps, pace-mix + direction-fan) and
`order2.mjs` (connector chain, non-monotonic order).
