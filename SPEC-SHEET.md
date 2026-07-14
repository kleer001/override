# SPEC SHEET — *OVERRIDE* (Tier 1 MVP)

Technical spec for the buildable vertical slice. Numbers are starting points to
tune, not gospel.

> **Authoritative core:** the battle loop, card model, ignition, and win/lose
> clock described below follow [`research/ember-model.md`](research/ember-model.md)
> (the "Beam-Card Model," core locked 2026-07-14). Where a section here still
> describes the retired ordered-accumulator design, treat `ember-model.md` as
> the source of truth and this doc as the section that needs porting.

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

| Rows | Region | Cells |
|------|--------|-------|
| 1–3 | HUD: status · trace-scan + CODE bar · drifting address ticker | 240 |
| **4–36** | **the CA field (living board)** | **33 × 80 = 2,640** |
| 37 | slot track (merged beam readout) + turret | 80 |
| 38 | CRACK / TERRITORY bar | 80 |
| 39–40 | scrolling log | 160 |

**Living field = 2,640 / 3,200 = 82.5% of the screen**, most of it churning every
tick — the "everything moves" target, before counting the drifting HUD overlays.

Render each CA cell as one glyph on the 80×40 grid; pick a near-square CRT
font/scale to taste (cosmetic, not a code change). Field origin is rows 4–36; the
HUD and controls are fixed furniture the CA never touches.

---

## The living board (cellular automaton)

*Ignition and the win/lose clock are settled by
[`research/ember-model.md`](research/ember-model.md) §1, §4, §9 — one packet
fires a beam that emits and spreads embers over time, and a top-down **trace
scan** (not a passes-based lockdown) is the run clock. The CA field mechanics
below (infect/grow/decay, islands, links, CODE bar) still describe the living
board itself.*

**Core idea:** crack % *is* territory on a living CA field, so the number going up
is literally a stain spreading across the screen.

Your **intrusion** (spreading embers) claims cells from **neutral memory**; the
**trace scan** reclaims burned cells back to neutral as it descends. **Crack %
= fraction of the grid you hold.** Win by holding **≥50% coverage** through the
breach timer / resolving the CODE; lose if the trace scan reaches the bottom
before you get there (traced).

### Cell model & CA rules (per tick)

Each cell = `{ owner: none | worm, strength: 0–9 }`. Double-buffered grid,
deterministic under seeded RNG. **Settled: Tier 1 has one active faction — your
intrusion (`worm`) against neutral memory — and the antagonist is the descending
trace scan, not a second spreading CA player. A rival spreading faction
(hardened ICE that infects your cells back) is a later-tier escalation (§ later
tiers of `ember-model.md`), not the base board. "ICE" at Tier 1 is the trace /
countermeasures, i.e. the scan itself.**

- **Spread:** a burned cell's embers advance into open neighbours, spending REACH
  against the terrain cost — the moving frontier is where most motion lives.
- **Grow:** an interior burned cell (all neighbours held) slowly gains strength →
  held territory hardens (the render ramp climbs).
- **Reclaim/die:** a cell the trace scan crosses is set back to neutral and its
  strength resets → no static blobs; the scan band is a travelling wipe.
- **Churn:** the advancing frontier, the scan's moving reclaim line, drifting
  addresses and ticking strength digits keep the board alive without a second
  faction. (Later tiers reintroduce a true border war once ICE spreads.)

### Islands & links

The grid splits into 2–4 **sectors** ("islands": `KERNEL`, `IO.SYS`, `SWAP`…)
joined by **link lines**. Your infection can only cross to a new island through a
link you control; a link goes dead when the **trace scan reclaims its cells**,
isolating (and starving) your cells on the far side. `FORK()` seeds a beachhead on
a fresh island → two fronts. (Later-tier ICE can actively sever links.)

### Overlays that never stop moving

- **Addresses** — each island tagged with a hex address that drifts/increments
  every tick (`0x7F3A → 0x7F3B…`): ambient flicker.
- **Strength digits** — border cells show a 0–9 that ticks as the war rages.
- **CODE bar** — the launch code, e.g. `7 _ 4 _ _ 1 _ _`, with digits **locking
  in** as you capture key "vault" cells. Direct callback to `finding_numbers` —
  you *find the numbers* by taking ground. This is the real win meter; territory %
  is the pressure behind it.

### Board mock (80 wide; ~14 of the 33 field rows)

```
 TIER 1: THE MACHINE     NODE 1/3     ROOT:120         TRACE SCAN[####......]
 CODE  7 _ 4 _ _ 1 _ _    ::  vault cells resolve digits    ADDR 0x7F3A -> 0xA10C +
+------------------------------------------------------------------------------+
| 0x7F3A  ·:=+*@@%%@@*=:·  @@·      ══╗        ·:=+*@@@@%*=  0xA10C   ·:·      |
|   :=+*@@@@%%@@@*=4 @@@·  @@2   ═══╬════     +*@@@@@%=·  @@·   ==+*@·   :·    |
|   ·+*@@@8@@%*=·  @@@@@·        ║          ╔═══*@@@@%=· @@@·  ·:=+*@@@%=·     |
|   ·:=+*@@@%*=:·  @@@@· 1       ║     ╔════╝   +*@@@· 9  @@@@· ·:=+*@@@%=·    |
|   ·:=+X X:·  X @@·  ══╗    ╚════╝    X   ·:X @@@@ X    =+*@X:·  @@@@@·  ·    |
| ####################       ###############################  ############     |
| ·:· KERNEL       ═╬═   <link cut!>      IO.SYS        ·:=+ SWAP   @@@%*=·    |
| ·:=+*@@@@@@%*= 2  @@@@@·   ║          ·:=+*@@@@@%*=· 3  @@@@%*=:. 7  @@·     |
| =+*@@@@%*=:· @@@@@   @@·   ║          @@@@%@@%*=:.. @@@·   *=:· @@@ 4 @@@%*  |
| @@@%*=:· 8 @@@@@%*=·       ║          %@%*=:· @@@ 2 @@@·  ·:=+*@@@@@%*=· ·:  |
| ·:=+*@@@%*=:·  @@·    ════╬══         ·:=+*@@@· 9  @@@@· @@%*=:·  @@@@ %*=·  |
| ·:=+*@@@@@%*=· @@@· 3      ══════╗    +*@@@@%*=:  @@·   ·:=+*@@@%*=·  ==+*@  |
+------------------------------------------------------------------------------+
| SLOTS  [ SCRIPT.COM ][ SCRIPT.SYS ][ WORM ]  MERGED: Lin+Sin·L+R·75%·gr High |
| COVERAGE [##################################################............] 71% |
| > packet fired col 34. beam spine drawn, embers spreading + reproducing (WORM).|
| > trace scan crossed KERNEL<->IO.SYS link. cells reclaimed. code digit 4 LOCKED.|
+------------------------------------------------------------------------------+
```

Legend (monochrome density ramp): `· : = + * @ %` = your infection rising in
strength · `#` = trace-scan line · `X` = just-reclaimed cell · `█` = firewall (WALL)
· `═ ║ ╬ ╗ ╝` = links / bus · digits = per-cell strength / CODE.

---

## Battle model

*Full mechanic: [`research/ember-model.md`](research/ember-model.md) §1–4, §9.
The ordered accumulator and its pass loop are retired.*

- Slotted cards **merge** into one beam before the battle starts: probability
  adds (capped at 100%), direction unions, shape sums (Fourier superposition),
  growth adds (capped ~60%). This merge is a one-time computation, not a per-tick
  loop — order doesn't matter.
- A **turret** slides along the bottom edge. One tap fires **one packet** at
  column `p`. The packet draws the beam **spine** upward,
  `x(y) = p + Σ shape(y)`; at each spine cell it rolls the merged probability,
  and on a hit emits ember(s) in the merged direction(s).
- Emitted embers then **spread hands-off**, burning cells and spending
  **REACH** against the terrain COST table (§ below) each tick, and — off the
  merged **growth** — **reproducing** onto fresh unburned neighbours so the fire
  sustains instead of dying at pool's end. No further input.
- **One clock, not two:** a top-down **trace scan** descends the field,
  reclaiming burned cells to neutral as it crosses them. Its single descent
  from top to bottom *is* the run clock (replaces the old `LOCKDOWN = 10
  passes` counter). Honeypots spike the scan's speed.
- **Win = reach, then hold:** hit **≥50% coverage** → a **breach timer**
  starts; hold ≥50% until it expires → breached. Drop under 50% and the timer
  pauses/resets. Scan bottoms out first → traced, run ends.
- **Timing:** the fire is instantaneous; the watch phase (emission + spread +
  scan) runs the length of a Tier-1 battle, on the order of ~12–15 s. Snappy
  now; deeper tiers add rate/branch/hold aspects (§8 of the ember model), not
  more phases.

---

## Cards drive the beam (bundled quads, per `ember-model.md` §3, §5)

Every card is a complete beam — `(shape, direction, probability, growth)` — not a
CA effect applied in sequence. Slotting several **merges** them into one beam
before the packet fires.

| Card | Shape | Direction | Probability | Growth | Identity / wrinkle |
|------|-------|-----------|-------------|--------|---------------------|
| `SCRIPT.COM` | Linear | ← | 25% | Low | the starter forbidden card |
| `SCRIPT.SYS` | Linear | → | 25% | Low | the mirror — opens a curtain |
| `BUFFER.OVR` | Linear | ←→ | 50% | Med | overflow; the curtain workhorse |
| `WORM` | Sine | ←→ | 25% | **High** | self-replicates hard — the Morris spread |
| `NOP.SLED` | Linear | — (none) | 50% | None | high prob, no direction/growth — inert alone, bad on purpose |

Merge rules: probability **adds** (capped at 100%), direction **unions** (each
unioned direction emits its own ember per firing cell — more directions = more
surface area), shape **sums** (superposition — two sines reinforce; a line +
sine wavers; sine + 3rd-harmonic starts squaring), growth **adds** its reproduce
rate (capped ~60%; child spread-reach takes the max). Order does not matter — see
§3 of the ember model for the full merge rules and the discipline behind
"some cards are bad on purpose." Growth is core at Tier 1 (a growth-less packet
can't breach — §4). Later tiers add new card *aspects* — rate (T2), `FORK()`
directed branching (T3), hold/IQ (T4) — per §8; Tier 1 is shape + direction +
probability + growth.

### Tier-1 starting deck (9 cards, indicative)

| Card | Bundle | Type |
|------|--------|------|
| `SCRIPT.COM` ×4 | Linear · ← · 25% · gr Low | curtain starter |
| `SCRIPT.SYS` ×2 | Linear · → · 25% · gr Low | curtain mirror |
| `BUFFER.OVR` ×2 | Linear · ←→ · 50% · gr Med | curtain workhorse |
| `NOP.SLED` ×1 | Linear · — · 50% · gr None | enabler; bad alone |

Core tension in a handful of scarce slots: stacking probability/direction on
one bundle for raw coverage vs. spreading across bundles for a wider curtain —
every card is welded to its own trade-off, so the deck you can field is the
decision, not the order you'd fire it in.

---

## Economy / progression

- **Win node** → draft 1 of 3 new cards (warez looted off the breached
  machine) into the deck; earn a slot; +ROOT.
- **Clear 3 nodes** → zoom out to Tier 2 (adds a 2nd island cluster + upgrades
  toward more slots and the rate aspect, per `ember-model.md` §8).
- **Lose battle** → fail skin, run ends, keep ~50% ROOT.
- **ROOT (persistent)** buys, at the black-market BBS shop: extra starting
  cards, +1 slot, +REACH, unlock new card types in drafts,
  retry-from-a-deeper-tier.

---

## Data model (sketch)

*Reflects the bundled-quad card model and turret/reach/scan battle loop —
see `ember-model.md` §3–4, §9.*

```js
Cell   = { owner: 'none'|'worm', strength: 0 }          // 0–9; scan reclaims to 'none'
Card   = { id, name, shape, direction, probability, growth } // the bundled quad
Board  = { w: 80, h: 33, cells: [...],                  // double-buffered
           islands: [{ id, addr, rect }], links: [{ a, b, owner }] }
Beam   = { shape, direction, probability, growth }       // the merged result of slotted cards
Battle = { coverage: 0, winCoverage: 50, reach: 0,
           board: Board, code: [7,null,4,null,null,1,null,null],
           slots: [Card, Card, Card], beam: Beam,
           turretCol: null, scanRow: 0, breachTimer: null }
Run    = { tier: 1, node: 1, deck: [...], slots: 3, root: 120 }
```

Resolution is a deterministic tick loop: merge slotted cards into `beam` once
→ fire the packet at `turretCol` to seed the spine and initial embers → each
tick, spread embers (spend `reach` against terrain COST) and advance the trace
`scanRow` → check coverage vs. `winCoverage` (breach timer) and `scanRow` vs.
board bottom (traced) for win/fail. Pure function of state → trivially
unit-testable with `node --test` (same harness as `finding_numbers`).

---

## Tech (reused from `finding_numbers`)

Vanilla ES modules, **no build step**. WebGL CRT shader + amber styling lifted as
is. WebAudio for card SFX (procedural — see audio appendix). Seeded `mulberry32`
RNG for reproducible draws, boards, and runs.

---

## MVP build order

1. Port grid renderer + CRT filter; render a static 80×40 Tier-1 screen.
2. Card data + slot arrangement (draw / merge bundled quads into one beam).
3. Battle tick loop: turret fire → spine + emission → spread against REACH +
   reproduce off GROWTH + COVERAGE bar (no CA yet) — tune the number feel.
4. Add the CA living board + islands/links (the territory war replaces any lane).
5. Trace scan + breach timer; result screen + fail skin + node advance.
6. Draft-between-nodes + ROOT meta.

→ Steps 1–6 = a complete Tier-1 vertical slice.

---

## Living board v2 — terrain & burn (prototyped in `preview/`)

*Ignition, reach, and the cost model here are settled by
[`research/ember-model.md`](research/ember-model.md) §2 and §4 — this section's
terrain generation and CA plumbing still stand; the "heat = accumulator" gate
and the oscillating-gnomon jack-in minigame below are retired in favor of
REACH and the Peggle turret.*

The MVP board is homogeneous, so a point ignition spreads as a Manhattan-distance
diamond. v2 replaces the uniform field with a generated **memory terrain** the
beam must burn *through*. Prototype: `preview/terrain.js`, `ignite.js`, `burn.js`
(open `preview/index.html?arch=fortress&heat=8`).

**Layered generation** — each technique does its one job:
1. base fuel = 1–2 octave value noise → open / hard / wall bands (organic slow &
   fast spots, ragged fronts);
2. structure = partition walls (with gap chokepoints) + straight **bus corridors**
   (fast lanes);
3. objectives = vaults placed at BFS-deepest reachable cells (routing matters);
4. fairness = flood-fill guard so a vault is never fully walled off.

**Terrain cost** (`COST` by type, per `ember-model.md` §4 — a spend curve, not a
gate): OPEN 1 (baseline) · HONEY 1 (random placement, spikes the trace) · VAULT 2
(toll for the prize — resolves a CODE digit) · HARD 6 (a curve, not a wall; deep
reach affords a few) · BUS −1 (refund — accelerant) · WALL ∞ (unaffordable
firebreak). A per-burn ±1 jitter keeps fronts fingered, not round. Supersedes the
earlier `RESIST` table and its heat-gate framing.

**Reach = the terminal stat.** Each emitted ember spends a **REACH** budget as it
travels, `budget -= COST[cell.terrain]` per step, until it hits 0 or a WALL (see
`ember-model.md` §4). There is no ignition threshold to clear — REACH is a smooth
cost curve, not a gate. REACH is a script-kiddie fiction: a faster CPU / more RAM
lets embers travel further, and it's largely a terminal (meta-progression) stat
rather than a per-card number. This replaces "heat = the accumulator"; the old
cold/hot-fire numbers (116 cells @ heat 5, 2,155 cells @ heat 8) were measured
under the retired gate model and need a fresh pass under the cost-curve model.

**Surface area = spread rate.** Growth ∝ (emission points) × (front perimeter) ×
(REACH vs. terrain cost). Hence direction-union stacking (more unioned
directions = more emitted embers = more fronts), later `FORK()` (T3, an extra
spine = a whole new front), and the jack-in characters (War-dialer / Shotgunner /
Catapultist beam shapes) are surface-area tools, not just flat bonuses.

**Live generation (src/terrain.js).** Each sector generates independently:
- **Three independent noise fields** (different seeds & frequencies) place WALL
  (big low-freq seas), HARD (finer veins) and OPEN, so the types decorrelate.
- **Land islands in a sea of firewall, bridged by bus links** — but only a couple
  of *nearby* islands link, so distant islands stay stranded.
- **Horizontal shear** — thin bands of 1–2 rows shifted a big **4–18 columns**
  for an aggressive, torn, digital look.
- **Honeypots bite:** burning a HONEY cell trips the trace scan — each
  newly-burned honeypot speeds the scan's descent (surfaced in the trace-scan
  meter). Honey sits in open reachable ground, so honey-dense sectors cost you
  time.
- **All six terrain types in every sector** (OPEN, HARD, WALL, BUS, VAULT, HONEY),
  guaranteed — verified 120/120 sectors.

**Win = coverage, held.** Breach a sector by holding **≥ WIN_COVERAGE% (50%)** of
its claimable cells through the breach timer before the trace scan reaches the
bottom (`ember-model.md` §9) — not by reaching a point. Difficulty is emergent
from the terrain cost curve (HARD's cost of 6 needs real REACH to afford) and
**connectivity** (how much is linked to your entry). Labels: EASY · HARD ·
**BRUTAL** (can't reach 50% at any REACH). **Runs are not guaranteed winnable** —
~1 in 8 machines has a BRUTAL sector, making that run impossible to fully clear
(Candy-Crush rules). Difficulty is randomized per sector, not positional.

**Jack-in (settled: Peggle turret, replaces the oscillating-gnomon minigame).**
You pick a **character** at run start, then aim with a turret that **slides**
along the bottom edge; one tap **fires a single packet** at your chosen column —
no two-axis lock-in, one input. The packet draws the beam spine, and the
character defines that spine's shape: War-dialer draws a thin, precise **lance**;
Shotgunner draws a wide **spray** off the spine; Catapultist draws a deep **lob**
that plants the spine far from the turret. Characters (`src/characters.js`) tune
the spine shape rather than a scattered landing pattern. Wired through
`createNode(…)` → the turret-fire path (supersedes `jackEmbers()`'s
gnomon-locked landing).

The `preview/` archetypes remain a tuning sandbox; the live game uses the
generator above.
