# Terrain Textures — procedural variety for the memory field

*Design exploration for widening `src/terrain.js` beyond value noise. Status:
prototyped in `preview/textures.js` + `preview/textures.html`, not yet wired into
production generation. Constants un-tuned.*

Run the lab: `python3 -m http.server`, open `preview/textures.html`. `←/→` or
`1-8` cycle textures, `R` reseeds, `T` toggles triptych (three textures divided
by firewalls — how a real machine would mix them), `[ ]` cycle CA rules, `\`
cycles heightmap ramps, `S` toggles the CA seed.

---

## 1. The framing: terrain *is* texture

OVERRIDE has no separate "background." Every cell of the 80×33 field is
`OPEN / HARD / WALL / BUS / VAULT / HONEY`, and that single layout is *both* the
picture on the CRT *and* the cost field a ping pays to burn (`COST = [1, 6, ∞,
-1, 2, 1]`, ember-model §2). So a "texture" is not decoration painted on top —
it is **a different function for deciding each cell's type.** Today there is
exactly one such function: two octaves of value noise thresholded twice
(`genSector`, terrain.js:122). Everything below is an alternate generator with
the *same signature*, so it drops into the same slot.

Two consequences shape all the options:

- **A texture must stay winnable-ish.** WIN is 50% coverage of a sector's
  claimable cells (`WIN_COVERAGE`). A texture that is 90% WALL is not a fun
  machine, it is a brick. Each generator therefore exposes a density knob, and
  the lab prints the live `OPEN/HARD/WALL` mix so we can keep sectors in a sane
  band (roughly OPEN 45-65%, WALL 10-30%).
- **Some shapes live in the character, not the block.** A Sierpinski triangle or
  a 10 PRINT weave reads through the *glyph* (`╱ ╲`, ramp chars), not through
  block density. So the field now carries an optional **per-cell glyph override**
  (`glyph[]` in the prototype) that render checks before falling back to the
  type's default block. This is a one-line addition to `drawMachineBoard`
  (render.js:117) and costs one parallel array on the machine.

---

## 2. The catalogue

Eight generators are prototyped. All are O(cells) or close, all seeded, all
sector-scoped. Costs are for one 26×33 sector.

| # | Texture | What it reads as | Shape carried by | Cost | Gameplay character |
|---|---------|------------------|------------------|------|--------------------|
| 1 | **value noise** *(current)* | organic blobs, islands | block density | 2 lattices | the baseline — soft masses, decorrelated HARD |
| 2 | **1D cellular automata** | fractal circuitry | block density | 1 pass, O(w·h) | *structured* difficulty — see §3 |
| 3 | **10 PRINT maze** | woven diagonal labyrinth | `╱ ╲` glyphs | O(w·h) | dense HARD lattice, thin OPEN threads |
| 4 | **random shapes** | motherboard: chips, pads, traces | block density | O(shapes·area) | discrete obstacles, open plazas between |
| 5 | **bus bars** | PCB / graph-paper grid | block density | O(w·h) | lanes & gaps — very navigable, striped |
| 6 | **ASCII heightmap** | contour / elevation relief | ramp glyphs | 1 lattice | same as noise but *legible* as terrain |
| 7 | **voronoi crack** | cracked glass, cell membranes | block density | O(w·h·seeds) | open cells walled by thin HARD borders |
| 8 | **circuit traces** | routed conduits on a board | box-drawing glyphs | O(traces·len) | sparse HARD wiring, mostly OPEN |

### The five you asked for

**1D cellular automata (2).** The standout. Seed one cell, evolve *downward*
(y = time). Rule 90 draws a perfect Sierpinski triangle; rule 30 is chaotic
(Wolfram's own PRNG rule); **rule 110 is the Turing-complete one** (gliders drift
through it); rule 150 is XOR (a dense woven lattice); rule 22 is sparse fractal
dust. Live cells become HARD veins; a live cell flanked by two live neighbours
*cores* into WALL, so the densest parts of the pattern are the impassable parts —
difficulty tracks the visual automatically. The band wraps toroidally so it is
seamless across reseeds. This is the most *on-theme* option in the whole set: a
1983 hacker cracking a machine literally rendered out of computing history's most
famous automata. Curated rules ship in `CA_RULES`.

**10 PRINT maze (3).** `10 PRINT CHR$(205.5+RND(1));: GOTO 10` — each cell is
independently `╱` or `╲`; the labyrinth is an optical illusion of the two PETSCII
diagonals meeting. Full density (every cell a diagonal) is the iconic look but
that is 100% HARD and unplayable, so the prototype exposes a `density` (~0.62
default): diagonals are HARD veins on OPEN floor, and rare same-slope stacks knot
into WALL. The glyph override carries the `╱ ╲`, so it reads as the real C64
maze, not a generic block field.

**Random shapes (4).** Scatter filled/outlined boxes, discs and thick line
segments of HARD or WALL onto OPEN floor. Reads as motherboard architecture —
chips, solder pads, bus traces — with open plazas between. Outlined boxes give
"rooms," which combined with the ping model create pockets you have to land
*inside*. The most controllable option: obstacle count and size are direct knobs.

**Bus bars / lines (5).** Regularly-spaced vertical and/or horizontal bands with
a little jitter and occasional gaps (vias); `both` overlays them into a PCB grid.
The cheapest generator and instantly "1983 hardware." Gameplay is very readable —
lanes and gaps — which makes it a good *easy-tier* texture or a palette-cleanser
between denser machines.

**ASCII heightmap (6).** The classic terrain renderer: noise → elevation → a
glyph ramp (`' .:-=+*#%@'`), so the same underlying noise now reads as *contours*
instead of binary blocks. Low ground OPEN, mid HARD, peaks WALL. It is noise
mechanically but transformed perceptually — the ramp is doing all the work. See
the emoji caveat in §4.

### Three bonus textures found while exploring

**Voronoi crack (7).** Scatter seeds, tile each cell to its nearest seed, HARD
the borders between regions. Reads as cracked glass / a die shot / cell
membranes: open cells caged by thin walls. A few whole regions vitrify to solid
WALL for variety. Distinct feel — you burn *within* a cell cheaply, then pay to
cross a membrane.

**Circuit traces (8).** Greedy walkers lay connected runs of box-drawing pipe
(`┌ ┐ └ ┘ │ ─`) as HARD conduits on OPEN floor. Distinct from 10 PRINT: these are
*continuous routes*, not a diagonal weave — literal circuit routing. Sparse and
very navigable.

**Others catalogued but not built** (candidates if we want more): **Truchet
tiles** (quarter-arc generalisation of 10 PRINT — flowing loops); **brick
courses** (offset masonry — cheap, very "wall"); **ordered dither / Bayer
matrix** (a HARD-density *gradient* — good for transition zones); **diamond-square
/ midpoint displacement** (rockier heightmaps than value noise);
**reaction-diffusion / Turing patterns** (organic spots & stripes — but iterative
and the most expensive thing here, probably too slow to justify).

---

## 3. Why cellular automata is the pick for *difficulty*

Value noise makes difficulty an accident — `difficultyOf` (terrain.js:214) reads
the generated field and labels it EASY→BRUTAL after the fact. CA inverts this:
the *rule* is a difficulty dial you choose up front.

- Sparse rules (22, 90 near the apex) → lots of OPEN → EASY.
- Dense rules (150, 110's busy regions) → HARD lattice + WALL cores → HARD/BRUTAL.

And because the WALL cores sit exactly where the pattern is densest, the picture
*tells the player* where it is hard — the Sierpinski holes are the safe pockets,
the filled bands are the grind. That legibility is rare and worth a lot in a
watch-don't-click game (juice-model: the board must read at a glance).

---

## 4. Costs, caveats, and the one real trap

**Cheap enough, all of them.** Everything is single-pass O(cells) except voronoi
(×seeds, but seeds are single digits) and shapes/circuit (×primitives, also
small). Generation already happens once per machine at jack-in; none of these
move that needle. No new per-frame cost — the field is static after generation,
exactly like today.

**The emoji trap (answering idea 5's second half).** An *emoji* terrain ramp
looks fantastic in a mockup and **breaks the grid in practice**: emoji render
double-width in a monospace `<pre>`, so every emoji cell shoves the rest of its
row one column right, shearing the 80-column field and misaligning the firewalls,
labels, and the trace-scan line. The lab includes an `emoji` ramp *specifically
to demonstrate this* — flip to it and watch the columns tear. **Recommendation:
stick to single-width ramps** (`ascii`, `blocks`, `relief` all ship). If we ever
want pictographic terrain, it must be single-width symbol glyphs (`▲ ● ≈ ░`),
never emoji, or the whole fixed-grid CRT premise falls apart. This is the most
important practical finding here.

**Glyph override is required for 3, 6, 8.** These carry their shape in the
character. Adding `machine.glyph` (a parallel `Array` set during generation,
checked first in `drawMachineBoard`) is the enabling change. Burned cells still
override to `#`/`@`/`$` as today — the glyph only shows on *unburned* terrain, so
the burn spectacle is untouched.

**Keep the post-passes.** shear, island-bridging, vault/honeypot placement and
the entry carve (terrain.js:132-182) are texture-agnostic and should run *after*
whichever generator fills the base types. CA and lines especially benefit from
shear staying off (they are already crisp); noise wants it. Suggest making shear
a per-texture flag.

---

## 5. Recommended integration path

Smallest useful step, in order:

1. **Add the glyph channel.** `machine.glyph = new Array(W*H).fill(null)`;
   `drawMachineBoard` uses `machine.glyph[c]` before `TERRAIN_G[t[c]]` on unburned
   cells. Unlocks 3/6/8 with no other change. (~5 lines.)
2. **Make the base fill pluggable.** Extract the noise loop in `genSector` behind
   a `texture` param; pass a generator from `preview/textures.js` (promote it to
   `src/textures.js`). Keep shear/islands/vaults as shared post-passes.
3. **Assign textures per machine/tier**, seeded from the run seed so a machine is
   reproducible. Options:
   - *Per sector* — the triptych: KERNEL noise, IO.SYS automata, SWAP circuit.
     Maximum variety, reads as "different subsystems."
   - *Per machine* — one texture per node, escalating (early nodes: lines/shapes;
     deep nodes: dense CA). Cleaner theme, ties texture to depth.
   - Recommend **per-machine with a weighted table**, CA over-represented at
     depth because it doubles as a difficulty dial (§3).
4. **Tune the density knobs** against `difficultyOf` so each texture lands in the
   intended EASY→BRUTAL band, then let `energyTo` do the rest unchanged.

Nothing above touches the ping/burn/trace model — textures only change what the
cost field *looks like* and how its HARD/WALL is arranged. The whole ember model
(ember-model.md) applies verbatim on top.

---

## 6. Variety budget — how many visibly different fields per technique

For evaluating each technique's payload when it fills a whole field on its own.
"Visibly different" = a field a player would name as a *different kind* of texture
at a glance, **not** the same look reshuffled by a new seed. That distinction is
the whole point here, so every technique is scored on two axes:

- **Archetypes** — how many genuinely different *looks* the dials reach.
- **Seed distinctness** — does a fresh seed read as a new *board*, or just the
  same texture on a different machine?

| Technique | Dials that change the *look* | New seed reads as… | ~Archetypes |
|-----------|------------------------------|--------------------|-------------|
| **1D automata** | **rule** (the whole ballgame) + seed-mode (single cell vs random row) | reshuffle *within* a rule | **~30–50** |
| **random shapes** | count, shape-mix (box/disc/line), fill vs outline, WALL:HARD | **a distinct board** | ~10–12 |
| **heightmap** | ramp (ascii/blocks/relief) × elevation thresholds × noise freq | reshuffle | ~12–18 |
| **voronoi crack** | seed count (few big cells ↔ many shards), wall-region % | **a distinct board** | ~8–12 |
| **bus bars / lines** | orient (V/H/grid) × spacing × gaps | reshuffle | ~8–12 |
| **value noise** *(current)* | blob size (freq) × density (2 thresholds) | reshuffle | ~6–9 |
| **circuit traces** | trace count, turn probability, run length | **a distinct board** | ~6–8 |
| **10 PRINT** | density (sparse scatter → solid labyrinth) | reshuffle (one iconic look) | ~3–5 |

**Cellular automata alone does more than the other seven combined.** The rule
*is* the archetype and it is a *categorical* dial, not a continuum — rule 90
(nested triangles), rule 30 (chaos), rule 110 (drifting gliders) are three
different worlds, not three settings of one look. Of the 256 elementary rules
there are 88 independent classes after symmetry (left-right reflection + 0/1
complement); ~30–40 of those produce something visually interesting rather than
going uniform or trivially striped. Cross that with single-cell seeding (a growing
fractal cone) vs random-row seeding (homogeneous chaos) and one technique clears
40+ distinct looks. The 8 rules in `CA_RULES` are the greatest hits, not the
ceiling. *(Un-verified count — worth confirming against the lab: sweep all 256
rules, drop the ones that go uniform/period-2, tally what's left.)*

**Everything else is a density / orientation continuum.** The honest archetype
count is smaller than it first looks, because most of the apparent variety is one
look at different densities.

**The split that matters for design.** The techniques fall into two families, and
a good texture table wants both:

- *Archetype-rich, instance-poor* — CA, heightmap, lines, noise, 10 PRINT. Few
  *kinds*, but each look is stable: a new seed = "same texture, new machine." Use
  when a texture should *mean* something (this subsystem always looks like this).
- *Archetype-poor, instance-rich* — shapes, voronoi, circuit. Only ~6–12 kinds,
  but because they are *compositions* of scattered primitives, every seed reads as
  a hand-placed board. Use when each machine should feel bespoke while reusing one
  technique.

10 PRINT is the extreme: essentially **one** unmistakable look, infinite instances
that all say "10 PRINT." That is why it works as a *signature* texture, not a
variety engine.

**Cheap ways to raise the low numbers** (dials currently hardcoded):

- *noise / heightmap* — the two lattice frequencies are fixed (11/6, 6/3).
  Exposing them turns ~6–9 looks into coarse/medium/fine × density ≈ 15–20.
- *voronoi* — swap the distance metric (Euclidean → Manhattan/Chebyshev): round
  cells become faceted/diamond, ~doubling its archetypes.
- *10 PRINT* — swap the glyph pair (diagonals → quarter-arc Truchet → box elbows):
  2–3 clearly different weaves from the same algorithm.
- *lines* — a type gradient (HARD edges → WALL core, or vice-versa) adds a depth
  read plain stripes lack.

**Bottom line:** summed across all eight, one-technique-per-field lands on the
order of **80–120 distinguishable archetypes** — but that figure is misleading.
It is ~40% CA, and the variety a player actually *feels* in play leans far more on
the instance-rich techniques (shapes / voronoi / circuit), where every seed is a
new board. All counts here are design-judgment estimates, not measured.

**For the exact list** — every rule number, seed mode and the precise `opts` +
measured OPEN/HARD/WALL mix for each preset of all eight techniques — see the
build sheet in [`terrain-texture-catalog.md`](terrain-texture-catalog.md).
