# L-System Growth — design doc

*Replaces the GROWTH aspect of OVERRIDE. In [`ember-model.md`](ember-model.md)
the beam still fires a spine and emits strands, but a strand is no longer an
isotropic `reproduce%`-into-a-random-neighbour ember with a `spreadReach`. It is a
**deterministic L-system turtle** drawn at a per-card **pace**, racing the trace
scan. No budget, no reproduce level. Turret, beam spine, terrain cost, trace scan,
and WIN_COVERAGE 50% stand from ember-model; direction folds into the grammar (§2).
Status: **shipped to `src/`** (turtle VM in `src/beam.js`, connector chain in
`src/cards.js`, tuned via `preview/beam-balance.js`).

The model settled through play in two big moves past the first ship:

- **One anchor strand per card, not a seed swarm.** The old `seeds` count (8–18
  strands raked off the spine per card) saturated the real board — on a median map
  the open spine is ~20 cells, so 18–42 launches stacked into a wall of embers that
  read identically regardless of deck. Now each launching card anchors exactly **one**
  turtle on a straight spine (bottom / top / centre of the open column), and coverage
  is earned purely by grammar fork density and pace (§6). Card stacking became legible
  and the deck's structure shows on the field. The `seeds` aspect is gone entirely.
- **Three connectors, not four (§7).** SCATTER, SPROUT, OVERLAY are the minimal
  algebraically independent set (parallel-union, graft, concatenation); the old BRANCH
  was a fixed-arity special case of the graft and added no expressiveness.

Grammars run on a base-10 loop so a card's turn/fork pattern has room to draw before
it repeats. Area is earned by grammar fork density (§6) — a runner is thin and loses
while a forker bushes out and fills. Terrain cost folds into the pace clock (HARD
slows a strand, BUS speeds it). The tunable knife-edge is the aggression band: the
one-anchor beam paints less than the old swarm, so the winnable range is compact
(~0.20 easy to ~0.65 grail-loses), and the whole aggro/DDA economy is scaled to it.*

Terminology: a growing ember is a **turtle**; its branching trail is the
**skeleton** — and that skeleton (via fork density) *is* the area; there is no
separate fill.

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

**`F` has two modes, gated by the COLLISION-DETECTION upgrade (§12).**
- *Collision on* — the **searching reroute** (the "not smart" rule): on `F`, probe
  headings in the fixed order `0, +1, −1, +2, −2, +3, −3, +4` and take the **first**
  cell that is on-board, non-wall, and unburned. If none, the turtle dies. This makes
  the blaze hug walls and thread gaps with zero pathfinding — reactive, deterministic,
  and it never re-treads its own trail. The full game runs here.
- *Collision off* — the **literal Tron turtle**: step the single cell in the current
  heading; if it is off-board, a wall, or already burned, the strand **crashes** and
  dies. Crossing your own trail is fatal, so a self-avoiding grammar is the whole
  skill. This is the pre-upgrade / tutorial regime.

**Fork.** `K` spawns a child near the current cell (a short forward probe finds it
live ground so it doesn't trap on the parent's burned cell) with heading turned `+2`
(parent `−1`), sharing nothing — there is no budget to split (§4). Child count is
bounded by `MAX_TURTLES`; grammars near `d ≈ 0.33` `K`-density stay cheap.

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

Pace-vs-scan is the entire tension, and it is tunable. On the real 62×28 block with
one anchor per card, the winnable band is **compact**: the aggression dial scales the
scan (`scanSpeed = 0.40 × aggro`), and even the grail deck loses past aggro ≈ 0.65,
while a starter opens fairly around 0.30. The whole aggro/DDA economy in `battle.js`
is scaled to that [0.20, 0.65] range (§10). Pace is the per-card power knob (2 =
fast/strong, 3–4 = slow/weak); scan speed is the difficulty dial — difficulty and the
beam model are the same system.

The win condition is **hold**, not peak: coverage must sit at/above WIN_COVERAGE for
the breach timer. With one anchor per card, coverage *spikes and decays* (strands
trap out, then the scan erodes) rather than plateauing, so `breachHold` is a weak
knob (4 vs 15 ticks barely move win rate) — the load-bearing terminal constants are
WIN_COVERAGE and the aggression band.

**Survival win (collision off, §12).** Before the collision-detection upgrade the win
flips: keep a self-avoiding literal strand alive until the scan bottoms out (having
drawn ≥`survivalMinCells`), on a fixed brisk scan (`SURVIVAL_SCAN`, ~8s). Because a
crossing is fatal, the found recipe is a *balanced* zigzag — the data says ≥3 turns
with equal `L`/`R` counts (unbalanced formulas net a turn, spiral in, and self-crash);
`FLLFRR`, `FLLLRRR`, `FLLRR` are reliable survivors, a straight runner races off the
edge. ~15–23% of all formulas survive, so it is findable, not lucky.

---

## 6. Area comes from forking, not fill

Turtles *look* thin, so the prototype proposed a **smolder** pass: an aged skeleton
cell blooms into a neighbour, thickening filaments into rivers. Building it revealed
smolder to be a **blind subsidy** — a delayed flood that fills reachable area roughly
regardless of what the deck did, which is precisely the flat-diamond failure (§0) in
a new coat. Ablation was decisive: stripping smolder collapsed only the *weak/sparse*
decks (the one-card starter's peak fell 45%→8%) while the real decks were untouched
(a forking curtain 61%→59%, a harmonic 66%→67%). Smolder was propping up structure-
less decks and homogenising everyone toward "reachable area."

So smolder is **cut**, and **fork density is the area engine** — which is the design's
actual north star (§0: DLA / Lichtenberg branching from a dumb local rule). Coverage
scales cleanly and monotonically with the `K`-density of the grammar (headless, real
62×28 blocks, scan 0.30): `FFFFF` 21% → `FFFFFK` 56% → `FFKFK` 64%. A runner is thin
and loses; a forker bushes out and fills; the area is **earned by the grammar you
draft and build for**, not gifted. Stripping every `K` from a strong deck cuts its
coverage ~1.7× (the `forking is load-bearing` test). The roster is tuned so runners
(no `K`) are weak, forkers (`K`-density ≈ 0.2–0.5) carry — pace (2 = fast/strong,
3–4 = slow/weak) is the secondary tempo knob.

---

## 7. The card, and the merge (connector chain)

A card's growth aspect has three channels:

```
growth: { grammar: 'FFKFKFK', pace: 2, connector: 'SCATTER' }
```

- **grammar** `F/L/R/K` — shape *and* launch direction (§2), a base-10 loop
- **pace** — tempo (§4)
- **connector** — how the **next** card in the deck couples to this one

Each launching card anchors **one** turtle on the spine (§0) — there is no seed
count, no launch density. The deck is read **top-to-bottom as a chain** —
`card₁ → [card₁.connector] → card₂ → [card₂.connector] → card₃ …` — which is the
"assembling a program" fiction made literal. A card's connector governs *its*
junction to the card after it, so the merge is **order-dependent by construction**.

The three connectors are the minimal set of **algebraically independent composition
primitives** — a disjoint union, a string concatenation, and a tree graft. Nothing
else adds expressiveness (the retired BRANCH was a fixed-arity, ±90° special case of
the graft, not a fresh operation):

- **`SCATTER`** — no handoff; the next card launches on its own spine anchor. This is
  the parallel union — cards run as independent strands. The neutral default.
- **`SPROUT`** — on self-trap, the next card grafts off the dead tip. A trapped tip
  has all eight radius-1 neighbours blocked (that is *why* it trapped), so the graft
  leaps to the first open cell on the next ring out (radius 2), forward-biased — the
  chain relays past the wall/trail it hit and continues deeper. (This ring-2 leap is
  load-bearing: a graft placed *on* the trapped cell is inert.)
- **`OVERLAY`** — the next card's program is **appended** to this card's: one strand
  runs both grammars as a single base-longer loop, at this card's pace. Resolved at
  chain-build time, so the sim never sees an OVERLAY junction; consecutive OVERLAYs
  splice into one strand. This is the only connector that changes *what a strand is*
  rather than where strands come from.

There is **no arithmetic** — no pool to sum, no level to average — so the merge
pathologies of a numeric budget cannot arise. (Rejected alternative: commutative
string-operators that fold cards into one hybrid grammar — they lose both order and
pace diversity.)

**Order matters, non-monotonically.** A card's connector couples it to the *next*
card, so `A→B` (via A's connector) differs from `B→A` (via B's). Leading with a
forker that SPROUTs, then a runner, differs from the reverse — bushing low first
builds safe area the scan reaches last, *then* the next card climbs out of it. There
is no monotonic "lead with the fast card" rule; the sequence is a real puzzle, and
the TEST bench (a blank scanless block) exists so a player can *see* it.

---

## 8. Synergy comes from pace and connector diversity

The deckbuilding depth is **blending tempos and coupling**, and it is genuinely
non-additive:

- **Vanguard + fill.** A fast card and a slow card in one chain cooperate rather than
  compete: the fast strand punches its path first; the slow one trickles into the
  gaps *later*, so they don't crowd and self-trap. Temporal separation is the engine
  — a "scouts and fillers" archetype with no special card.
- **Connector order** (§7) is the second synergy axis — sequencing the chain to build
  safe area before climbing, non-monotonic.
- **OVERLAY splicing** is the third — folding a coiler's turns or a forker's `K`s into
  another card's loop makes a hybrid strand neither card draws alone.

So the "dynamic synergy" the growth rework was chasing comes from the mechanics that
replaced budget: diverse *paces*, the *order* of the chain, and *spliced* grammars —
never a stacked number.

---

## 9. Implementation touch points

- `src/cards.js` — growth aspect is `{grammar, pace, connector}`; `buildChain` folds
  an OVERLAY junction into the preceding segment (grammar concatenation) and otherwise
  emits an ordered chain of segments.
- `src/beam.js` — the turtle VM (symbols, looped `pc`, searching reroute, `fork`);
  per-strand pace clock; one anchor per launching card (`seedSwarm`); the SPROUT
  handoff (ring-2 graft off a trapped tip); end the run at scan-bottom, track peak
  coverage. Area comes from fork density in the skeleton.
- `src/battle.js` — gutter readout shows the chain (grammar / pace / connector per
  card); scan speed wired to `aggression`; the aggro/DDA economy scaled to the compact
  winnable band.
- `src/juice.js` — a beat for the advancing frontier; see [`juice-model.md`](juice-model.md).
- `tests/` — determinism (same field twice → identical), searching-reroute never
  re-treads, coverage regression on a fixed seeded board, OVERLAY-splice fold, and the
  scanless TEST bench.

---

## 10. Open / to-tune

- **Fork-density curve** — where each card should sit on the `K`-density → coverage
  curve (§6) so the roster spreads from thin runners to bushing grails.
- **Turtle-type roster** — validate a starter set (runner / forker / coiler /
  wanderer) feels distinct; pace and connector per card.
- **Aggression band** — the winnable range is compact (~[0.20, 0.65]); confirm the
  DDA settles there across a real career and that manual cranking earns its reward.
- **Enclosed-territory** coverage (Qix/Go) — parked; possible later spice for looping
  grammars.

---

## 11. Progression: literal turtle → collision detection

The mechanics unfold in layers, gated by one persistent upgrade — **COLLISION
DETECTION** — which is the single switch that picks the whole regime (turtle `F`
behaviour §3, win mode §5, and board terrain). One flag, no divergent code paths.

- **Author (first run, `main.js` `author` phase).** No handed-out deck: the player
  types an `F/L/R` grammar on three buttons and watches the *literal* turtle draw it
  on a blank full block. RUN fires a survival battle; surviving keeps the card as the
  starter and banks a flat bounty (`SURVIVAL_REWARD`). This is where the symbols are
  learned — a crossing kills you, so you learn self-avoidance by doing.
- **Pre-collision runs.** Blank blocks (literal turtles can't navigate walls yet, so
  there are none), survival win, flat bounty. The tutorial pays 15 and collision
  detection costs 35, so it takes a couple of real levels beyond the tutorial to bank it.
- **Collision detection (the pivot).** Strands stop crashing and start navigating.
  The win flips from *survive* to *conquer* (coverage ≥ WIN_COVERAGE), terrain returns
  (`generateMachineUpTo`, ceiling keyed to **conquers** — survival wins don't count, so
  the first walled block is EASY), and the full tuned game begins.

**Economy.** ROOT is paid every run, no bank penalty on a loss — coverage runs pay the
run's **peak** coverage % × aggression mult (a 50% breach ≈ 50; the high-water mark is
the "area burned"), survival runs pay the flat bounty. Card unlocks are spaced ~3 wins
apart (~200 ROOT/tier). Losses only ease the DDA (§10).

---

## 12. References

Langton's ant; diffusion-limited aggregation / dielectric (Lichtenberg) breakdown;
turtle graphics & bounded L-systems (structure from dumb local rules). The connector
algebra rests on three algebraically independent composition primitives (§7): the free
monoid on the symbol alphabet (OVERLAY = string concatenation, the base structure of
L-systems), the grafting product on rooted trees / free pre-Lie algebra (SPROUT =
graft — one graft generator builds the whole tree structure, so a second fixed-arity
graft adds nothing), and a disjoint-union coproduct (SCATTER = parallel launch). The
deckbuilding lineage is tempo blending and ordered chains rather than number-stacking
(Balatro / Slay the Spire / Noita wand-chains: a card transforms what comes after it).
