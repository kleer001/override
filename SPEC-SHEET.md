# SPEC SHEET — *OVERRIDE* (Tier 1 MVP)

Technical spec for the buildable vertical slice. Numbers are starting points to
tune, not gospel.

> **Authoritative core:** the battle loop, card model, and win/lose clock follow
> [`research/lsystem-growth.md`](research/lsystem-growth.md) — the "Beam-Card Model"
> with growth as a deterministic **L-system turtle** (shipped to `src/beam.js` +
> `src/cards.js`, tuned via `preview/beam-balance.js`). This supersedes **both** the
> earlier `ember-model.md` reproduce%/REACH design *and* the original bundled-quad
> `(shape, direction, probability, growth)` model. In the shipped model a card is
> `{ grammar, pace, connector }`; there is **no probability/odds and no REACH
> budget**; a program is a turtle that crawls the board and **forks**; and the deck
> is an **ordered connector chain** — *order matters*. Where a section below still
> describes the retired accumulator, REACH, or quad design, treat the code +
> `lsystem-growth.md` as source of truth.

---

## Grid (BANKED: 80×40 logical)

Monospace glyphs run ~1 wide : 2 tall, so a 1-char cellular-automata cell would
read as a tall sliver. Treating the logical grid as **80×40** cancels that: the
doubled row count makes each cell's on-screen footprint near-square, and it lifts
the board to **3,200 cells**. It's a game — the *look* sells "1983 terminal"
(VT100/IBM-PC-ish), not the exact row count.

What's BANKED is the **80×40 logical grid as the CA/coordinate substrate** — the
game logic, hit-testing, and CA field are addressed in these cells. It is **not** a
rule that all *rendering* must be glyphs: a graphical layer (canvas / WebGL) can be
mounted over the grid for real particles, bloom, shake, and color on the payoff
beats. The grid is what elements are *positioned on*, not the limit of how they're
*drawn*. See [`research/juice-model.md`](research/juice-model.md) §2.

### Row budget (40 rows)

> **Superseded by the three-panel play screen** (see §"The play screen" below and
> `src/layout.js`): the field is now the 62×28 FIELD panel (cols 0–63), run state +
> controls live in the GUTTER (cols 64–79), and cards in the TRAY (rows 30–39). The
> proportion below still holds — the living block is ~80% of the window.

| Rows | Region | Cells |
|------|--------|-------|
| 0–29 | FIELD panel — the living memory block (62×28 inset) | ~1,736 |
| 0–29 | GUTTER panel — status + phase controls | 16 × 30 |
| 30–39 | TRAY panel — hand / draft / jack-ins | 80 × 10 |

**Living block ≈ 80% of the screen**, most of it churning every tick — the
"everything moves" target.

Render each CA cell as one glyph on the 80×40 grid; pick a near-square CRT
font/scale to taste (cosmetic, not a code change). Field origin is rows 4–36; the
HUD and controls are fixed furniture the CA never touches.

---

## The living board (turtle crawl + trace scan)

*Settled by [`research/lsystem-growth.md`](research/lsystem-growth.md): one packet
anchors one **turtle** per launching card; each crawls the memory as a deterministic
L-system, burning cells and forking, while a top-down **trace scan** descends and
reclaims. There is **no cellular-automaton faction and no smolder fill** — the board
"lives" from the crawling frontier, the scan's travelling wipe, and render heat-decay.
Terrain generation, islands, and bus links (below) still stand.*

**Core idea:** crack % *is* territory — the cells your turtles have burned — so the
number going up is literally a stain crawling across the screen.

Your **turtles** (burning crawlers) claim cells from **neutral memory**; the **trace
scan** reclaims burned cells back to neutral as it descends. **Crack % = fraction of
the claimable grid you hold.** Win by holding **≥50% coverage** through the breach
timer; lose if the trace scan reaches the bottom first (traced). (Pure coverage — the
CODE/vault objective was cut.) *This is the post-**COLLISION DETECTION** regime; before
that upgrade the win is **SURVIVAL** — keep a self-avoiding literal line alive to
scan-bottom — see §"Progression".*

### Cell model & board motion (per tick)

Each cell = `{ terrain, burned: 0|1 }` (plus a per-cell burn *tick* the renderer reads
for brightness). Deterministic: the **turtle VM is RNG-free** — same grammar + same
field ⇒ byte-for-byte identical growth; the only seeded RNG left is the scan's reclaim
order and terrain generation. Tier 1 has **one active agent — your turtles — against
the descending scan**; a rival *spreading* faction (hardened ICE) is a later-tier
escalation, not the base board. "ICE" at Tier 1 is the scan itself.

- **Crawl:** each turtle probes headings (straight, then gentle turns out, reverse
  last) and steps to the first on-board, non-wall, **unburned** cell, burning it — so
  it hugs walls and threads gaps with zero pathfinding and never re-treads. The moving
  frontier is where most motion lives.
- **Fork (`K`):** a turtle spawns a child crawler turned off its heading — **fork
  density is the entire area engine** (no fill pass); a forkless runner stays thin, a
  forker bushes out and fills.
- **Pace, not budget:** a turtle has no total-cells cap; it advances on a per-strand
  **pace** clock (ticks per step). Terrain folds into that clock — HARD ground stalls a
  crawler, a BUS lane speeds it — so terrain cost is *felt as time*, not a REACH spend.
  A turtle ends by self-trapping, leaving the board, or being reclaimed by the scan.
- **Reclaim:** a cell the trace scan crosses is set back to neutral → no static blobs;
  the scan band is a travelling wipe, and coverage is measured as **peak simultaneous
  burn**, not what survives after.

### One memory block, islands within it

A run is ONE **memory block** (`THE MACHINE`, a single 62×28 sector — the 3-sector
`KERNEL`/`IO.SYS`/`SWAP` split is retired). The noise carves **islands** in a sea of
firewall, bridged by **bus links**; distant islands can stay stranded, so a block can
be only partly reachable (or unwinnable). A link dies when the trace scan reclaims its
cells. A **`SPROUT`** connector grafts the chain's next crawler past a wall its
predecessor trapped on, relaying onto fresh ground → a new front.

### Overlays

- **Addresses** — a drifting hex address ticker: ambient flicker.
- **Burn heat** — a burned cell's brightness derives from *how recently* it burned
  (newest = brightest tip, cooling behind), so the frontier reads bright and the body
  fades — no per-cell strength value, just the burn tick.
- *(CODE bar cut — see §"Battle model". The win is pure coverage; no digit objective.)*

### The play screen — three static panels

One window, three panels that persist across every phase (contents swap as play
modulates — see `src/layout.js`); the 80×40 grid divides 80% / 20%:

```
┌── THE MACHINE — one memory block ─────────┐┌─ STATUS ──┐
│  terrain · beam spine · turtles crawling  ││ ROOT 1240 │   FIELD  cols 0–63
│  · forking · the descending #scan#        ││ PTS   80  │   (block drawn at a
│  · ▲ turret at the base                   ││ DECK 11   │    1-cell inset)
│                                           ││ TRACE …   │
│                                           ││ COVERAGE… ││   GUTTER cols 64–79
│                                           ││ CHAIN …   ││   (run state + the
│                                           ││ AGGRO …   ││    phase's controls)
└───────────────────────────────────────────┘└───────────┘
┌── LOADOUT — tap a card to slot the chain ─────────────┐   TRAY  rows 30–39
│ [SCRIPT.COM][FORK.COM][BUFFER.OVR][WORM]              │   (hand / draft, in
└───────────────────────────────────────────────────────┘    slot order; 25% tall)
```

Legend (heat ramp): `· : = + * @ %` = burn *recency* rising (cool body → bright tip) ·
`#` = trace-scan line · `X` = just-reclaimed cell · `▓` = firewall (WALL) · `═` = bus ·
`▲` = turret.

---

## Battle model

*Full mechanic: [`research/lsystem-growth.md`](research/lsystem-growth.md) §2–9.
The ordered accumulator, the REACH budget, and the bundled-quad merge are all retired.*

- **Two regimes, one flag.** The **COLLISION DETECTION** upgrade (`extra.collision`,
  `beamParams` in `src/battle.js`; `sim.collision` in `src/beam.js`) picks the *entire*
  regime — turtle `F` behaviour, scan, and win mode all key off it, so pre- and
  post-upgrade play share every code path (no divergent branch). The bullets below
  describe the **collision-on** game (the tuned coverage battle); the pre-upgrade
  **survival** regime is in §"Progression". Everything else here holds in both.
- Slotted cards build an **ordered connector chain** before the battle
  (`buildChain`, `src/cards.js`): the deck is read top-to-bottom and each card's
  connector governs its junction to the *next* card. `OVERLAY` junctions fold at
  build time (two grammars splice into one looped program); `SCATTER`/`SPROUT`
  survive into the sim. **There is no arithmetic and order matters** — nothing sums
  or averages.
- A **turret** slides along the bottom edge. One tap fires **one packet** at column
  `p`. The packet lays a straight **spine** up that column; each *launching* card
  anchors exactly **one turtle** on the spine (bottom / top / centre of the open
  line), so a chain brackets the block even when firewall eats most of the column.
- Each turtle then crawls **hands-off** as a deterministic L-system (§ "living
  board"): `F` advances & burns via the searching reroute, `L`/`R` turn, `K` forks a
  child. It spends no budget — it advances on its **pace** clock, and terrain folds
  into that clock (HARD slows, BUS speeds). Area comes from **fork density**, not a
  fill pass. A `SPROUT` predecessor grafts the next card off its trapped tip. No
  further input.
- **One clock:** a top-down **trace scan** descends the field, reclaiming burned
  cells to neutral as it crosses them. Its single descent *is* the run clock.
  Honeypots (HONEY) spike the scan's speed when burned.
- **Win = reach, then hold (collision-on):** hit **≥50% coverage** → a **breach timer** starts; hold
  ≥50% until it expires → breached. Drop under 50% and the timer resets. Scan bottoms
  out first → traced, run ends. Coverage is **peak simultaneous** burn — with one
  anchor per card it spikes and decays rather than plateauing, so `breachHold` is a
  weak knob; **WIN_COVERAGE (50%) and the aggression band are the load-bearing dials.**
- **Difficulty = AGGRESSION**, a single dial scaling the whole scan
  (`scanSpeed = 0.40 × aggro`, plus reclaim bite). The one-anchor beam paints less
  than the old seed swarm, so the winnable band is **compact (~0.20 easy → 0.65 even
  the grail loses)**; the whole DDA/reward economy in `battle.js` is scaled to it.
- **Timing:** the fire is instantaneous; the watch runs the length of a Tier-1
  battle (~6–18 s, self-scaling with the drama; see `climax_todo.md`). Deeper tiers
  add new card *aspects* (rate, `FORK()` branching, hold), not more phases.

---

## Cards drive the beam (turtle programs, per `lsystem-growth.md` §2–7)

Every card is a complete little program — `{ grammar, pace, connector }` — that
crawls the board as a deterministic turtle. Slotting several builds an **ordered
connector chain** (§7), not a merged number.

- **grammar** `F/L/R/K` — shape *and* launch aim in one (a turn-prefix points it);
  run on a base-10 loop so a small string draws a large emergent form.
- **pace** — ticks per step; the tempo/power knob (2 = fast/strong, 3–4 = slow/weak).
- **connector** — how the **next** card couples: `SCATTER` (parallel — next card
  launches on its own anchor), `SPROUT` (graft — next card relays off this crawler's
  trapped tip, leaping to the next open ring), `OVERLAY` (splice — next grammar
  appends into this one strand).

| Card | Grammar | Pace | Connector | Identity / wrinkle |
|------|---------|------|-----------|---------------------|
| `SCRIPT.COM` | `FFFFFFFFFF` | 3 | SCATTER | the starter warez — a thin forkless runner |
| `FORK.COM` | `FFFFKFFFFF` | 2 | SPROUT | forks once a loop; sprouts the chain onward |
| `SCRIPT.SYS` | `RRFFFFFFKF` | 3 | SCATTER | the mirror — `RR` aims it east, then runs long |
| `BUFFER.OVR` | `FLFKFRFKLF` | 2 | SCATTER | a fast wide forking zig-zag; the curtain workhorse |
| `WORM` | `FFKFFKFFKF` | 2 | SPROUT | the Morris spread — forks hard, sprouts onward |
| `NOP.SLED` | `F` | 3 | SPROUT | a lone forkless sled — weak alone; the next card rides its tips |
| `0DAY` | `FKFKFKFKFK` | 2 | SPROUT | the legendary grail — fast, maximal forks |

Chain rules (`buildChain`): **no arithmetic** — nothing sums or averages. The deck is
read top-to-bottom; a card's connector governs *its* junction to the next card, so the
merge is **order-dependent by construction** (`A→B` ≠ `B→A`). `OVERLAY` folds at
build time into one longer looped grammar; `SCATTER`/`SPROUT` reach the sim. **Fork
(`K`) density is the area engine** — a runner is thin and loses, a forker fills; some
cards (`NOP.SLED`) are inert alone, bad on purpose. Later tiers add new card *aspects*
— rate, `FORK()` directed branching, hold — not new merge arithmetic.

### No handed deck — you author your first card (`cardFromGrammar`, `src/cards.js`)

There is **no starting deck**. A fresh save opens with **0 ROOT** and an empty deck;
the first run drops into the AUTHOR phase (§"Progression") where you *type* an `F/L/R`
grammar and, on a surviving run, keep it as your first card — `PROG.COM`
(`AUTHORED_ID`, pace 1, `SCATTER`), persisted in `localStorage` (`AUTHORED_KEY`). The
deck grows from there: draft picks between nodes (`SCRIPT.SYS`, `BUFFER.OVR`, `WORM`,
`HARMONIC`, `PHREAK`, `BLUEBOX`, `LOGICBOMB`, `XOR`, `DAEMON`) and ROOT-shop buys (a
cheap `FORK.COM` deck-add, then the pool rares `ROOTKIT`/`PAYLOAD`/`0DAY`).

*(The old two-card `SCRIPT.COM → FORK.COM` handout is retired — commit `4f46899`. The
`startingDeck()` helper is still exported from `src/cards.js` but is **no longer
called anywhere** in the game, tests, or preview harness: dead legacy left as a
reference two-card deck.)*

Core tension in a handful of scarce slots (`SLOTS = 3`): which *shapes* you field, and
in what *order* you chain them — sequencing a bushing forker and a fast runner so they
cooperate (scout-then-fill) instead of crowding. **The order you build the chain is the
decision, not just the cards you hold.**

---

## Progression — literal turtle → collision detection

*Spec-altitude mirror of [`research/lsystem-growth.md`](research/lsystem-growth.md)
§11. One persistent upgrade — **COLLISION DETECTION** — is the single flag that selects
the whole regime (turtle `F` §3, win mode §5, board terrain). Pre- and post-upgrade
share every code path (`sim.collision`; `beamParams` in `src/battle.js`).*

- **Author (first run — `main.js` `author` phase).** No handed deck. On a brand-new
  save the run opens the AUTHOR screen: three big `F`/`L`/`R` keys build a grammar (max
  `GRAMMAR_MAX = 12`), and a **literal** turtle draws it live on a blank block. RUN
  fires a **survival** battle from **centre** (no aiming). The turtle is a Tron
  light-cycle — `F` steps one cell; crossing its own trail, a wall, or the edge is a
  **crash** (the strand dies). Win = keep the self-avoiding line alive to scan-bottom
  having drawn ≥ `SURVIVAL_MIN_CELLS` (**10**). Survive → the grammar is kept as your
  first card (`AUTHORED_ID` = `PROG.COM`, `localStorage`) and banks the flat
  `SURVIVAL_REWARD` (**15**); crash → back to the editor to revise & retry.
- **Pre-collision runs.** Blank blocks (`blankMachine` — literal turtles can't navigate
  walls, so there are none), survival win, flat bounty, a fixed brisk scan
  (`SURVIVAL_SCAN = 0.45`, ~8 s, aggression-independent — a fixed-difficulty training
  ground, not the tunable game). ~15–23 % of formulas survive, so a starter is
  findable, not lucky — a *balanced* zig-zag (≥3 turns, equal `L`/`R`; e.g. `FLLFRR`)
  is the recipe.
- **COLLISION DETECTION (the pivot; ROOT shop, cost 35).** Strands stop crashing and
  start **navigating** — `F` becomes the searching reroute that hugs walls and threads
  gaps. The win flips from *survive* → **conquer** (hold ≥ WIN_COVERAGE **50 %** through
  the breach timer), and terrain returns (`generateMachineUpTo`, difficulty ceiling
  keyed to **conquers** — survival wins don't count, so the first walled block is
  **EASY**, not BRUTAL; `difficultyCeil` in `main.js`). Every run after is the full
  tuned coverage game the sections above describe.

The tutorial pays **15** and COLLISION DETECTION costs **35**, so it takes a couple of
real levels past the tutorial to bank the pivot. The splash gates it all: `OVERRIDE
1983` with `[C]ONTINUE` / `[N]EW` (`showTitle` / `resetSave`, `main.js`).

---

## Economy / progression

- **Lean, no-penalty ROOT.** A fresh save opens with **0 ROOT**, and every run banks
  ROOT **whether you win or lose** — there is no loss penalty (`showResult`, `main.js`).
  Coverage (collision-on) runs pay the run's **peak** coverage % × aggression mult
  (`coverageReward`, `src/battle.js`); survival runs pay the flat `SURVIVAL_REWARD`
  (15). A ~50 % breach at baseline pays ~50; a survival scratch pays 15.
- **Win node (coverage)** → draft 1-of-3 looted cards into the deck (more picks if you
  cranked aggression above baseline, `draftPicks`); a breach lifts next run's terrain
  ceiling (`difficultyCeil`, keyed to conquers).
- **Aggression** is the single difficulty/reward dial: raise it for free in the target
  phase (harder scan, bigger payout) or spend **15 ROOT** (`AGGRO_REDUCE_COST`) to lower
  it a step. The persistent baseline also self-adjusts (DDA) toward ~43 % win rate. The
  winnable band is compact (~0.20 → 0.65).
- **ROOT shop (`src/shop.js`, black-market BBS)** — verified catalogue: **COLLISION
  DETECTION** 35 (the survival→coverage pivot, permanent), **FORK.COM** deck-add 10
  (repeatable), **RETRY TOKEN** 100 (survive one lost battle this run), and the
  permanent pool rares **ROOTKIT** 200 / **PAYLOAD** 400 / **0DAY** 600 — spaced
  ~3 wins apart.
- **Clear 3 nodes** → zoom out to Tier 2 (adds a 2nd island cluster + upgrades toward
  more slots and new card aspects, per `lsystem-growth.md` §8). *(Tiers 2–7 are design,
  not yet built.)*

---

## Data model (sketch)

*Reflects the shipped turtle model — see `lsystem-growth.md` §2–9, `src/cards.js`,
`src/beam.js`.*

```js
Cell    = { terrain, burned: 0|1 }                          // one 62×28 block; heat is a separate per-cell tick array
Card    = { id, name, grammar, pace, connector }            // grammar F/L/R/K; connector SCATTER|SPROUT|OVERLAY
Machine = { seed, t:[...], burned:[...], sectors[] }        // the persistent block (one sector at Tier 1)
Chain   = { chain: [{ grammar, pace, connector }], cards }  // buildChain(): ordered segments; OVERLAY folded in
Turtle  = { x, y, heading, pc, seg, clock }                 // a live crawler running its segment's grammar
Sim     = { machine, sector, claim, params, collision,      // params = { p, chain, collision, scanSpeed, reclaim,
            turtles[], scanRow, breachLeft:-1, cov,          //   breachHold, winCoverage:50, survivalMinCells:10 }
            outcome, tick }                                  // collision off ⇒ literal Tron turtle + SURVIVAL win
Run     = { tier:1, deck:[...], slots:3, root }             // one machine per run; SLOTS = 3
```

Resolution is a deterministic tick loop (`stepSim`): `buildChain` slotted cards →
`seedSwarm` anchors one turtle per launching segment on the spine at `params.p` →
each tick, `stepTurtles` advances every crawler on its pace clock (crawl / turn /
fork / SPROUT-handoff) and `advanceScan` descends the trace, reclaiming crossed
cells → check `cov` vs. `winCoverage` (breach timer) and `scanRow` vs. board bottom
(traced). The **turtle VM is RNG-free**; only the scan reclaim + terrain gen are
seeded — so a `(seed, params)` pair replays identically. Pure function of state →
trivially unit-testable with `node --test`.

---

## Tech (reused from `finding_numbers`)

Vanilla ES modules, **no build step**. WebGL CRT shader + amber styling lifted as
is. WebAudio for card SFX (procedural — see audio appendix). Seeded `mulberry32`
RNG for reproducible draws, boards, and runs.

---

## MVP build order (status: Tier-1 slice shipped to `src/`)

1. ✅ Grid renderer + CRT filter; the three-panel 80×40 screen (`render.js`, `layout.js`).
2. ✅ Card data + slot arrangement — draw a hand, slot into an ordered connector chain
   (`cards.js`, `main.js › toggleSlot`).
3. ✅ Battle tick loop: turret fire → spine → one turtle per card → L-system crawl +
   fork against the pace clock → coverage (`beam.js`, `battle.js`).
4. ✅ Generated memory terrain + islands/bus links (`terrain.js`); the turtle frontier
   is the living board (no separate CA / smolder — cut, see `lsystem-growth.md` §6).
5. ✅ Trace scan + breach timer; result + fail skin + node advance (`main.js`).
6. ✅ Draft-between-nodes + ROOT shop meta (`shop.js`).
7. ✅ On-ramp progression (commit `4f46899`): AUTHOR-your-first-card survival tutorial
   → **COLLISION DETECTION** pivot into the coverage game — one regime flag across the
   sim (`main.js` `author` phase, `beam.js` `sim.collision`, `battle.js` `beamParams`,
   `shop.js`). See §"Progression".

→ The Tier-1 vertical slice is live. **Open art-direction pass:** the breach climax
(`climax_todo.md`). **Not yet built:** jack-in character picker (straight into loadout
today) and Tiers 2–7.

---

## Living board v2 — terrain & burn (prototyped in `preview/`)

*This section's **terrain generation** still stands and is shipped in `src/terrain.js`.
The burn/cost model has moved on: there is **no REACH budget** — terrain cost folds
into each turtle's **pace clock** (`lsystem-growth.md` §4; `paceSurcharge` in
`src/beam.js`). The "heat = accumulator" gate and the oscillating-gnomon jack-in
minigame described here are retired in favor of the pace clock and the Peggle turret.
Read the cost table below as a **pace surcharge** (per step), not a spend budget.*

The MVP board is homogeneous, so a point ignition spreads as a Manhattan-distance
diamond. v2 replaces the uniform field with a generated **memory terrain** the
beam must burn *through*. Prototype: `preview/terrain.js`, `ignite.js`, `burn.js`
(open `preview/index.html?arch=fortress&heat=8`).

**Layered generation** — each technique does its one job:
1. base fuel = 1–2 octave value noise → open / hard / wall bands (organic slow &
   fast spots, ragged fronts);
2. structure = partition walls (with gap chokepoints) + straight **bus corridors**
   (fast lanes);
3. islands = big unreachable islands bus-linked to the entry; distant ones stay
   stranded (some blocks are only partly reachable);
4. honeypots = HONEY placed deep in open reachable ground (trips the trace).

**Terrain cost** (`COST` by type, `src/terrain.js` — now a **pace surcharge**, not a
spend budget): OPEN 1 · HONEY 1 (spikes the trace when burned) · HARD 6 · BUS −1
(accelerant) · WALL ∞ (a firebreak the reroute never enters). The turtle VM reads this
as `paceSurcharge = clamp(COST − 1, −1, 3)` (§4): OPEN +0, HARD +3 (a crawler waits
longer per step on hard ground), BUS −1 (faster), HONEY +0, WALL never stood on. So
terrain is *felt as time*, not an affordability gate. (Five types — VAULT was cut with
the CODE objective.)

**Pace = the tempo clock.** A turtle carries a per-card **pace** (ticks per step) and
the terrain surcharge above stacks on it — there is **no REACH budget and no total-cells
cap**. A strand is bounded by *time × space*: self-trapping caps its footprint, the
descending scan caps its lifetime. Pace is the per-card power knob (2 = fast/strong,
3–4 = slow/weak); aggression scales the scan on the other side of the race.

**Area = fork density (not surface-area math).** Coverage scales monotonically with
the `K`-density of the grammar (headless, real 62×28 blocks, scan 0.30: `FFFFF` 21% →
`FFFFFK` 56% → `FFKFK` 64%). A runner is thin and loses; a forker bushes out and fills.
Later `FORK()` (a whole new front) and the planned jack-in spine shapes are more
fork/front tools — but the base engine is grammar fork density, not emission-point
counting.

**Live generation (src/terrain.js).** The one block generates as:
- **Three independent noise fields** (different seeds & frequencies) place WALL
  (big low-freq seas), HARD (finer veins) and OPEN, so the types decorrelate.
- **Land islands in a sea of firewall, bridged by bus links** — but only a couple
  of *nearby* islands link, so distant islands stay stranded.
- **Horizontal shear** — thin bands of 1–2 rows shifted a big **4–18 columns**
  for an aggressive, torn, digital look.
- **Honeypots bite:** burning a HONEY cell trips the trace scan — each
  newly-burned honeypot speeds the scan's descent (surfaced in the trace-scan
  meter). Honey sits in open reachable ground, so honey-dense blocks cost you time.
- **All five base terrain types on every block** (OPEN, HARD, WALL, BUS, HONEY),
  guaranteed.
- **Burnable devices — the combo/fireworks payload (src/terrain.js › LANCE/NOVA/FREEZE,
  src/beam.js › drainDetonations).** Three device cells seed onto reachable open ground
  (the drillers gated hard against firewall, like honeypots but useful): a crawler that
  burns one detonates it the same tick. **LANCE** (a spinning bar telegraph) drills a
  straight line of firewall → OPEN along the crawler's heading and launches a fresh
  strand out the tip; **NOVA** (a pulsing mark) blows a filled circle of firewall open;
  **FREEZE** halts the trace scan for a spell. Drilled firewall becomes *claimable* OPEN,
  so coverage stays honest as territory opens. Detonations **chain** — a blast can open
  onto another device — and each link raises a **combo** that scales the *next* device
  (longer bar, wider blast). The combo also drives the EXEC-phase spectacle (grid-native
  motion, trauma shake, brightness surge, rising arpeggio), escalating with the chain.
  All deterministic and RNG-free, so `(seed, params)` still replays byte-for-byte.

**Win = coverage, held.** Breach the block by holding **≥ WIN_COVERAGE% (50%)** of its
claimable cells through the breach timer before the trace scan reaches the bottom
(`lsystem-growth.md` §5) — not by reaching a point. Difficulty is emergent from the
terrain (HARD's pace surcharge stalls crawlers into the scan) and **connectivity** (how
much is linked to your entry). Labels: EASY · MED · HARD · **BRUTAL** (can't reach 50%
with any deck). **Runs are not guaranteed winnable** — ~1 in 8 blocks is BRUTAL, making
that run a loss (Candy-Crush rules).

**Jack-in (turret shipped; character picker not built).** You aim with a turret that
**slides** along the bottom edge; one tap **fires a single packet** at your chosen
column — no two-axis lock-in, one input (`main.js › fireAt`, `beam.js › aimColAt`). The
packet lays a **straight-column spine** and anchors one turtle per launching card.
*Planned:* a run-start **character** that reshapes that spine — War-dialer **lance**,
Shotgunner **spray**, Catapultist **lob** — via a `src/characters.js` that does not yet
exist; today the run drops straight into the loadout (`main.js:128`). The oscillating-
gnomon minigame is retired.

The `preview/` archetypes remain a tuning sandbox; the live game uses the
generator above.
