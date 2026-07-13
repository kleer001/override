# Terrain Texture Catalog — exact variations & settings

*A concrete build sheet for the eight generators in `preview/textures.js`. Every
entry below is a named preset with the **exact `opts` object** to pass and the
**measured** OPEN/HARD/WALL mix it produces (averaged over seeds 1/7/42/99/314,
firewalls excluded). Companion to `research/terrain-textures.md` (the why); this
is the what. View any of these live in `preview/textures.html`.*

## How to use a generator

Each generator has the signature `gen(t, glyph, x0, x1, rng, opts)` and fills the
column band `[x0..x1]` of the type field `t` (`OPEN=0 HARD=1 WALL=2`), optionally
writing a per-cell character into `glyph`. `buildField(seed, pick)` in
`preview/textures.js` wires three bands + firewalls; `pick(sectorIndex)` returns
`{ gen, opts }`. To fill a whole field with one technique:
`buildField(seed, () => ({ gen: 'automata', opts: { rule: 90, seed: 'center' } }))`.

**Opts each generator actually reads** (everything else is fixed or random):

| gen | opts it honors | fixed / random internally |
|-----|----------------|---------------------------|
| `noise` | `sea` (0–1), `hard` (0–1) | lattice freqs 11/6 & 6/3 |
| `automata` | `rule` (0–255), `seed` (`'center'`\|`'random'`) | live→HARD, live-flanked-by-live→WALL |
| `tenprint` | `density` (0–1) | slope 50/50, knot→WALL |
| `shapes` | `count` (int) | shape-mix, WALL:HARD, sizes all random |
| `lines` | `orient` (`'vert'`\|`'horiz'`\|`'both'`), `spacing` (int) | gap freq, type-mix random |
| `heightmap` | `ramp` (`ascii`\|`blocks`\|`relief`\|`emoji`), `t1`, `t2` | lattice freq 12/5 |
| `voronoi` | `seeds` (int) | Euclidean metric, wall-region p=0.22 |
| `circuit` | `traces` (int) | turn p=0.3, WALL frac 0.15 |

Difficulty read below is indicative from the mix (HARD costs 6× OPEN, WALL is
impassable and shrinks claimable area). Confirm against `difficultyOf`
(terrain.js:214) after wiring — it samples the *cheapest 50%*, so HARD in the
cheap half is what actually bites.

---

## 1. `automata` — 1D cellular automata (the variety engine)

Measured sweep of all 256 elementary rules: **88 symmetry classes** (after
left↔right mirror + 0↔1 complement), of which **79 are non-uniform**, breaking
down as **18 chaotic · 28 complex · 2 periodic · 31 stripe/static**. The ~48
chaotic+complex+periodic classes are the visually useful pool. Below is the
curated gallery spanning that pool; the "non-open" column is the measured live
fraction ≈ HARD+WALL coverage, so it doubles as a difficulty predictor.

**Seed matters:** `seed:'center'` (one lit cell) grows a fractal from an apex —
use it for the triangle rules. `seed:'random'` (lit row) fills a homogeneous
field — use it for the chaotic/drift rules. Rules are given with their best seed.

### Fractal triangles — `seed:'center'`
| rule | look | ~non-open |
|------|------|-----------|
| **90** | Sierpinski triangle — the icon, clean nested holes | ~23% |
| **18** | sparse Sierpinski gasket, thinner than 90 | ~23% |
| **60** | one-sided (left-leaning) Sierpinski | ~35% |
| **150** | XOR-3 — dense nested triangles, woven | ~35% |
| **26** | offset fractal lace | ~23% |
| **154** | drifting fractal weave | ~23% |
| **126** | filled "coral" triangles (solid, not hollow) | ~38% |
| **122** | coral variant, denser | ~50% |
| **62** | striped nested triangles (periodic tail) | ~49% |

### Chaotic / noise-like — `seed:'random'`
| rule | look | ~non-open |
|------|------|-----------|
| **30** | chaos — Wolfram's PRNG rule, balanced grain | ~51% |
| **45** | chaotic diagonal streaks | ~51% |
| **106** | asymmetric chaos, leans one way | ~51% |
| **105** | dense woven chaotic lattice (busiest) | ~51% |
| **73** | chaos pocked with triangular voids | ~49% |
| **22** | sparse fractal dust — very open, EASY | ~26% |

### Complex / localized — `seed:'random'`
| rule | look | ~non-open |
|------|------|-----------|
| **110** | gliders drifting through structure — Turing-complete | ~54% |
| **54** | class-4 localized blocks & walls | ~47% |

### Diagonal drift / traffic — `seed:'random'`
| rule | look | ~non-open |
|------|------|-----------|
| **170** | pure right shift — clean parallel diagonal stripes | ~38% |
| **2** | pure left shift — parallel diagonals, other way | ~15% |
| **184** | traffic rule — self-organizing merging diagonal lanes | ~38% |

**To harvest more:** reproduce the sweep — evolve every rule 0–255 (toroidal, both
seed modes) exactly as `genAutomata` does, dedup by the symmetry group
{identity, left↔right mirror, 0↔1 complement} to the 88 class representatives,
then classify each by tail vertical-period and tail row-entropy (uniform / stripe
/ periodic / complex / chaotic). The 28 "complex" and remaining "chaotic" classes
not curated above
(e.g. 9, 11, 25, 27, 35, 41, 43, 46, 58, 74, 134, 142, 146, 162) are all valid
extra looks; they were cut only to keep the gallery legible.

---

## 2. `noise` — value noise (current generator)

`sea` = WALL threshold (higher → more WALL), `hard` = HARD threshold within land.

| preset | opts | mix |
|--------|------|-----|
| islands | `{ sea: 0.30, hard: 0.35 }` | OPEN 77 · HARD 17 · WALL 7 — open, EASY |
| balanced | `{ sea: 0.42, hard: 0.50 }` | OPEN 33 · HARD 41 · WALL 26 — MED/HARD |
| dense | `{ sea: 0.55, hard: 0.60 }` | OPEN 8 · HARD 31 · WALL 61 — mostly wall, BRUTAL/broken |
| veined | `{ sea: 0.35, hard: 0.72 }` | OPEN 5 · HARD 82 · WALL 13 — HARD sea, expensive |

Default production randomizes `sea∈[0.30,0.56]`, `hard∈[0.34,0.64]` per sector.
Frequencies are fixed; exposing them is the cheapest variety win (see §9).

---

## 3. `tenprint` — 10 PRINT maze (`╱ ╲` glyphs)

One dial: `density`. Full density is the iconic C64 look but 0% OPEN.

| preset | opts | mix |
|--------|------|-----|
| sparse | `{ density: 0.35 }` | OPEN 65 · HARD 29 · WALL 6 — open weave, EASY |
| classic | `{ density: 0.62 }` | OPEN 38 · HARD 44 · WALL 18 — the recommended default |
| dense | `{ density: 0.85 }` | OPEN 15 · HARD 50 · WALL 35 — tight labyrinth, HARD |
| solid | `{ density: 1.0 }` | OPEN 0 · HARD 51 · WALL 49 — pure C64 look, unplayable as a field |

---

## 4. `shapes` — random boxes / discs / lines

One dial: `count`. Shape-mix and WALL:HARD are random per shape (see §9 to expose).

| preset | opts | mix |
|--------|------|-----|
| sparse | `{ count: 4 }` | OPEN 88 · HARD 7 · WALL 6 — a few chips, very EASY |
| rooms | `{ count: 10 }` | OPEN 72 · HARD 14 · WALL 13 — motherboard, MED |
| cluttered | `{ count: 18 }` | OPEN 55 · HARD 24 · WALL 21 — dense board, HARD |

Instance-rich: every seed is a distinct arrangement, so `count` × seed gives many
clearly-different boards.

---

## 5. `lines` — bus bars / PCB grid

`orient` ∈ vert/horiz/both, `spacing` = cells between bands (jittered ±1).

| preset | opts | mix |
|--------|------|-----|
| rails-tight | `{ orient: 'vert', spacing: 2 }` | OPEN 55 · HARD 28 · WALL 16 |
| rails-wide | `{ orient: 'vert', spacing: 6 }` | OPEN 85 · HARD 9 · WALL 6 — open lanes, EASY |
| ladders | `{ orient: 'horiz', spacing: 4 }` | OPEN 78 · HARD 15 · WALL 7 |
| grid | `{ orient: 'both', spacing: 3 }` | OPEN 49 · HARD 32 · WALL 19 — PCB, MED |
| grid-coarse | `{ orient: 'both', spacing: 6 }` | OPEN 72 · HARD 18 · WALL 10 |

---

## 6. `heightmap` — ASCII contour ramp (glyphs)

`ramp` picks the glyph set; `t1`/`t2` are the OPEN|HARD and HARD|WALL elevation
cutoffs (defaults 0.45 / 0.78). **Note:** default noise rarely exceeds 0.78, so
default WALL is only ~2% — lower `t2` to get real walls.

| preset | opts | mix |
|--------|------|-----|
| ascii | `{ ramp: 'ascii' }` | OPEN 34 · HARD 64 · WALL 2 — contoured, HARD-heavy |
| high-water | `{ ramp: 'ascii', t1: 0.30, t2: 0.70 }` | OPEN 8 · HARD 82 · WALL 9 — flooded, expensive |
| low-water | `{ ramp: 'ascii', t1: 0.60, t2: 0.85 }` | OPEN 72 · HARD 27 · WALL 0 — mostly open, EASY |

Ramp is cosmetic (same mix): `ascii` `' .:-=+*#%@'`, `blocks` `' ·░▒▓█'`, `relief`
`' .,~=≈#▓█'`. **`emoji` is intentionally broken** — double-width, shears the
grid; never ship it (see terrain-textures.md §4).

---

## 7. `voronoi` — cracked cells

One dial: `seeds` (region count). Borders between regions become HARD; ~22% of
regions vitrify to solid WALL.

| preset | opts | mix |
|--------|------|-----|
| plates | `{ seeds: 4 }` | OPEN 72 · HARD 7 · WALL 21 — few big cells |
| cells | `{ seeds: 8 }` | OPEN 68 · HARD 11 · WALL 21 — cell membranes |
| shards | `{ seeds: 16 }` | OPEN 58 · HARD 17 · WALL 25 — shattered glass |

Instance-rich: each seed is a distinct crack pattern.

---

## 8. `circuit` — routed pipe traces (box-drawing glyphs)

One dial: `traces` (number of walkers). Always very open — a wiring overlay, not
a fill.

| preset | opts | mix |
|--------|------|-----|
| sparse | `{ traces: 3 }` | OPEN 94 · HARD 5 · WALL 1 — a few runs |
| board | `{ traces: 6 }` | OPEN 90 · HARD 9 · WALL 2 — routed board |
| busy | `{ traces: 14 }` | OPEN 78 · HARD 19 · WALL 3 — dense wiring |

---

## 9. Dials currently hardcoded — expose these to widen variety

If the other instance wants more archetypes than the presets above, these params
exist in the code but aren't yet reachable via `opts`:

| gen | hardcoded now | where | suggested opt | payoff |
|-----|---------------|-------|---------------|--------|
| noise / heightmap | lattice freqs (11/6, 6/3, 12/5) | textures.js `makeNoise` calls | `freq: [a, b]` | coarse/med/fine blob scale → 3× the looks |
| voronoi | Euclidean distance | `genVoronoi` inner loop | `metric: 'manhattan'` | round cells → faceted/diamond, ~2× |
| voronoi | wall-region p=0.22 | seed push | `wallP` | tune WALL density directly |
| tenprint | `╱ ╲` glyph pair | `genTenPrint` | `tiles: 'diag'\|'arc'\|'box'` | Truchet arcs / box elbows → 2–3 weaves |
| shapes | shape-mix + WALL:HARD | `genShapes` kind/ty draws | `kinds`, `wallP` | box-only "rooms" vs disc-only "blobs" |
| lines | type-mix + gap freq | `genLines` | `wallP`, `gapP`, type gradient | edge-HARD→core-WALL depth read |
| circuit | turn p=0.3, WALL frac | `genCircuit` | `turn`, `wallP` | straight rails vs tangled knots |

---

## Quick index

`noise` 4 · `automata` ~20 curated of ~48 usable classes · `tenprint` 4 ·
`shapes` 3 · `lines` 5 · `heightmap` 3 (×3 cosmetic ramps) · `voronoi` 3 ·
`circuit` 3. All mix values come from running each preset through `buildField`
over seeds 1/7/42/99/314 (firewalls excluded); the CA class counts from a full
256-rule sweep with symmetry dedup.
