# L-System Growth — design doc (proposal)

*Reshapes the GROWTH aspect of OVERRIDE. Supersedes the `reproduce% + spreadReach`
growth model of [`ember-model.md`](ember-model.md) §4–§5 — the isotropic
"reproduce into a random neighbour" spread and its `None/Low/Med/High` levels.
Everything else in ember-model (turret, beam spine, probability, direction,
terrain cost, trace scan, WIN_COVERAGE 50%) stands. Status: prototype-validated
2026-07-16 (`scratchpad/lsys{,2,3}.mjs`); constants un-tuned; not yet in `src/`.*

Terminology: a growing ember is a **turtle**. Its trail is the **skeleton**; the
fill behind it is **smolder**.

---

## 0. Why (the flat-diamond diagnosis)

The shipped growth reproduces a burning ember into a **random orthogonal
neighbour** (`beam.js` `stepEmbers`). Isotropic growth on a grid always relaxes to
a diamond — an L¹ ball — because no ember has a *heading*. You cannot tune your way
out of a diamond; the shape has to come from committed direction plus a rule for
changing it. And the `N/L/M/H` levels only ever said *more vs. less* reproduce%,
so the axis read as one flat knob where "only H does anything."

Fix: each turtle carries a **heading** and runs a tiny **deterministic grammar**
(an L-system / turtle program) that advances, turns, and forks. Structure, not a
blob. `L/M/H` become *different grammars* — a creeper, a bloom, a blaze — not a
power ladder.

North stars for "structured but NOT smart, searching": **Langton's ant**
(2-rule turn machine → emergent highway), **diffusion-limited aggregation /
Lichtenberg breakdown** (the branching-blaze look from a dumb local rule), and
**bounded L-systems** (turtle graphics). None plan; all *look* like they search.

---

## 1. Deterministic weapon, variable field

The grammar has **no RNG**. Same grammar + same board ⇒ byte-for-byte identical
result (verified: `lsys3.mjs` determinism check `IDENTICAL`). A player must trust
the tool; all variation comes from the **field** — terrain, walls, and where other
turtles have already burned. This is the core constraint the rest obeys.

---

## 2. The symbol set (quaternary)

Four symbols, executed one per tick per turtle:

| sym | meaning |
|-----|---------|
| `F` | advance one cell in the heading and **burn** it (costs 1 budget) |
| `L` | turn **left** 45° |
| `R` | turn **right** 45° |
| `K` | **fork**: spawn a child turtle here, **splitting the budget** |

Ternary (`0=turn, 1=advance, 2=spawn`) was the first sketch and is **one symbol
short**: with a single "turn," the merge operators (§5) can't weave a left-curl
against a right-curl, so you never get zig-zags or worms out of composition. Two
turn symbols is the minimum that makes the operator algebra expressive. `K` is the
old `2=spawn`.

Headings are the existing 8 compass directions; `L`/`R` step ±1 around them.

---

## 3. Turtle mechanics

State: `{x, y, heading, pc, budget}`. The program string is read on a **loop**
(`pc mod len`), so a 4-symbol grammar like `FFRF` executed past its length becomes
a spiral — large emergent form from a tiny grammar (the L-system payoff).

**Searching reroute (the "not smart" rule).** On `F`, probe headings in the fixed
deterministic order `0, +1, −1, +2, −2, +3, −3, +4` and take the **first** cell
that is on-board, non-wall, and unburned. If none, the turtle dies. This makes the
blaze hug walls and thread gaps with zero pathfinding — reactive, not planned, and
fully reproducible. (Prototype renders show turtles wrapping around wall blocks.)

**Fork budget split.** `K` gives the child `⌊budget/2⌋` and keeps the rest; child
heading turns `+2` (90°), parent `−1`. Splitting (not free spawning) is what bounds
the branching process against `MAX_EMBERS`.

---

## 4. Turtle types (named grammars — starter roster)

Cards ship **named, pre-baked grammars**; the player composes them via the merge
operators, not by authoring strings (strings stay visible as 1983 flavour).

| name | grammar | silhouette |
|------|---------|-----------|
| `RUNNER` | `F` | straight lance — reach, no area |
| `COIL` | `FFR` | arc / spiral — compact bloom |
| `WORM` | `FFRFFLL` | meander |
| `FORKER` | `FFK` | branching tree |
| `CURL·L` / `CURL·R` | `FFL` / `FFR` | single-hand curls (feedstock for interlace) |

Roster is a starting point (decision: "turtle types and then we'll see").

---

## 5. Merge operators (the synergy = string algebra)

Slotting several cards **combines their grammars as strings**, which is where the
deckbuilding depth lives. Each operator yields a visibly distinct, nameable form
(all confirmed on the grid in `lsys.mjs`):

- **append** `A·B` — `RUNNER×10 · COIL×6` → a stalk that curls at the tip: a **fiddlehead**.
- **prepend** `B·A` — same parts, curl-then-run: a different silhouette.
- **interlace** `A₀B₀A₁B₁…` — `RUNNER ⋈ FORKER` → a **fern**; `CURL·L ⋈ CURL·R` → a **zig-zag**.
- **multiply** `A×k` — `FFR ×4` → a **coil**.

"Runner woven with forker = fern" is a real thought a player can have and *see*.
Degenerate merges (all-turn programs that spin in place) just fizzle — a natural
anti-synergy, no special-casing.

Which operator a card applies is its third growth field (`mergeOp`).

---

## 6. Smolder (turning filaments into area)

Turtles are thin; a win needs area. So a burned **skeleton** cell that reaches age
`smolderDelay` blooms **once** into one neighbour (priority down, left, right, up),
marking it smolder. The advancing tip stays a bright searching filament; the body
thickens into rivers behind it; the trace scan eats the trailing body, so you must
keep pushing new frontier. Worth **+7–11 coverage points** and cleanly tunable
(§7). Strength/rules to be tuned from testing.

---

## 7. Coverage model (validated)

> **coverage ≈ (turtles the beam seeds) × (per-worm area) − (scan reclaim)**

A beam seeds **many** turtles — one per firing cell along the spine — not one. That
seed count is the coverage multiplier, and it maps onto the existing **probability
/ density** axis. Prototype numbers (`lsys3.mjs`, board 64×32, WIN 50%):

- **Budget alone plateaus.** One worm: budget 100 → 9.4%, 400 → 20.5%, 1600 → 36%.
  Absurd budgets for a slow crawl — the wrong lever.
- **Seeds are the multiplier.** Budget-80 rake: 8 seeds → 39%, 15 → 48%, 30 → 49%.
- **Smolder** adds ~+7–11 pts and saturates.
- **A winning build:** 20 seeds × budget 100 × `smolderDelay 4` → **peak 49.3%**,
  clears 40% by tick 17. Coverage tops out ~48–50% (board − walls − scan), so the
  **50% WIN bar sits right at "barely winnable"** — as intended.

Every axis gets one non-overlapping job:

| axis | job |
|------|-----|
| probability / **density** | seed count → coverage multiplier |
| **budget** | per-worm length (diminishing alone) |
| **grammar** `F/L/R/K` | worm shape |
| **branching** (`K` density) | reach ↔ width — **has an optimum** (heavy forking *lowers* coverage: budget starves into short stubs) |
| **smolder** | fill strength |
| **direction** | race vs. the descending scan (drill down = outrun it; wander = reclaimed) |

---

## 8. Win metric

Coverage is measured as **peak simultaneous** coverage — you win by *hitting*
WIN_COVERAGE (50%) and holding through the breach timer before the scan bottoms
out, never by what survives to the end. (By end-of-run the scan has reclaimed
almost everything; that is correct.)

---

## 9. Card-aspect change

The GROWTH block of a card changes from `{ reproduce%, spreadReach }` to:

```
growth: { grammar: 'FFK', budget: 80, mergeOp: 'interlace' }
```

`mergeBeam` (`src/cards.js`) stops summing reproduce / max-ing reach and instead
**folds the grammars with the operators** (§5), sums seed budget, and picks the
seed count from the merged density. The other three merges (shape SUM, direction
UNION, probability ADD) are unchanged.

---

## 10. Implementation touch points

- `src/cards.js` — new growth field; `mergeBeam` grammar-fold; `GROWTH` table → grammar roster; label helpers.
- `src/beam.js` — replace the reproduce block in `stepEmbers` with the turtle VM (symbols, looped `pc`, searching reroute, fork split); add the smolder pass; seed **many** turtles off the spine.
- `src/battle.js` — gutter readout shows grammar / seed count instead of `grXX%`.
- `src/juice.js` — a beat for the advancing frontier and (later) any criticality flip; see [`juice-model.md`](juice-model.md).
- `tests/` — determinism (same grammar+field twice → identical), fork budget conservation, coverage regression on a fixed seeded board.

---

## 11. Open / to-tune

- **Smolder** strength & rule (one neighbour vs. two, delay) — tune to land 50% at "barely winnable."
- **Turtle-type roster** — validate the starter set feels distinct; add/cut.
- **DIRECTION → seed headings** — how the direction axis seeds initial turtle headings and rake spacing.
- **Branching optimum** — where the reach/width knee sits per grammar.
- **Enclosed-territory** coverage (Qix/Go) — parked; possible later spice for looping grammars.
- **True L-system rewriting** (string expands each generation) — parked behind fork-turtles; a rare "recursive" modifier candidate.

---

## 12. References

Langton's ant; diffusion-limited aggregation / dielectric (Lichtenberg) breakdown;
turtle graphics & bounded L-systems (structure from dumb local rules). Merge-as-
string-algebra draws the deckbuilding-synergy lineage (composition-order and
enabler/payoff patterns from Balatro / Slay the Spire / Noita wand chains) into the
growth axis. Prototypes: `scratchpad/lsys.mjs` (silhouettes & operators),
`lsys2.mjs` (determinism, collision, smolder, scan), `lsys3.mjs` (multi-seed,
budget plateau, coverage sweep).
