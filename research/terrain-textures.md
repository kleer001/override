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
