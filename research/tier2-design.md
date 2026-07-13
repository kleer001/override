# Tier 2 Design — THE LAN / the ASSAULT deck

*Buildable spec for OVERRIDE's second fractal tier. Grounds the ember-model §6–7
multi-deck thesis in the current code (`src/battle.js`, `src/terrain.js`,
`src/cards.js`, `src/main.js`, `src/render.js`, `src/layout.js`). Status: design,
constants un-tuned. 2026-07-13.*

---

## 0. The one-line thesis

**Tier 1 programmed *how hard* pings hit (the POWER accumulator). Tier 2 unlocks
a second program that decides *where* they land — the ASSAULT deck.** Same battle
engine, same trace scan, same win condition; one new register. This is
ember-model §7 made concrete ("each tier introduces one new programmable deck").

The reconciliation with GAME-SHEET (which labels Tier 2 "multiple nodes — pick
targets"): the *geography* grows a second node cluster (reskin, flavor), but the
genuine new *subsystem* is the ASSAULT deck. Choosing which sector to hit already
exists (`chooseSector`, the target phase) — the new teaching is programmable
placement, not a new map screen. (See open Q1.)

---

## 1. The ASSAULT deck

Today every ping lands at a uniform-random non-WALL cell — `spreadPing`
(`terrain.js:224`), lines 226–229:

```js
do { sx = randInt(rng, s.x0, s.x1); sy = randInt(rng, 0, FIELD_H - 1); tries++; }
while (t[idx(sx, sy)] === WALL && tries < 40);
```

The ASSAULT program replaces *that landing choice only*. Spread-from-landing
(the frontier loop, the Conduit rule, terrain COST) is untouched — POWER still
owns the energy budget, ASSAULT only owns the seed point per ping.

### Composition model (mirrors the accumulator)

An ASSAULT program is 3 cards resolved left→right into a **placement descriptor**
`{ anchor, radius, shape, avoidHoney }`, exactly parallel to `evalProgram`
folding into a scalar. Per ping we resolve the descriptor to a landing cell.

Fold rules (the sequencing lesson, restated — order is the game):

- **SEEK cards** set `anchor` **and reset `radius` to WIDE.** Last SEEK wins the
  anchor (like `lastNumeric` for GOTO). A SEEK reset means a FOCUS *before* a
  SEEK is wasted — the direct analogue of "`×2` before the `+3`s is wasted."
- **SPREAD cards** (`FOCUS` / `BROADCAST`) scale `radius`; they only bite if they
  come *after* the anchor they mean to modify.
- **SHAPE cards** (`RASTER`) set the sampling pattern; last shape wins and
  overrides radius sampling.
- **`SANDBOX`** sets `avoidHoney` (a flag, order-independent).

Seed state (= today's Tier-1 default, so an empty/absent ASSAULT program is
byte-identical to current behavior): `{ anchor:'random', radius:Inf,
shape:'point', avoidHoney:false }`.

Per-ping resolution `pickLanding(machine, s, place, rng, pingIndex)`:
1. resolve `anchor` → a point `A` (see table);
2. if `shape==='raster'`, place on the Nth lattice node across the sector
   (`pingIndex` steps the raster) — even coverage, radius ignored;
3. else sample a random non-WALL cell within Manhattan `radius` of `A`
   (reject WALL/honey-if-avoid; fall back to `A`, then to uniform random).

### Card list (7)

| id | name | class | fold effect | feel |
|----|------|-------|-------------|------|
| `LFSR`    | `LFSR`        | SEEK   | `anchor='random'`, radius WIDE | baseline scatter (the Tier-1 default, as a card) |
| `COREDUMP`| `CORE DUMP`   | SEEK   | `anchor='mass'` (center-of-mass of burned; entry if none) | densify — pile pings where you already hold, push one coherent front |
| `PROBE`   | `DEEP PROBE`  | SEEK   | `anchor='deep'` (BFS-deepest reachable OPEN/HARD cell) | lob at the vault / far ground — programmable Catapultist |
| `PERIM`   | `PERIMETER`   | SEEK   | `anchor='frontier'` (random burn-frontier cell) | grow the edge — most cells-per-energy, even expansion |
| `FOCUS`   | `NARROWCAST`  | SPREAD | `radius = max(2, radius/2)` (tighten) | concentrate the volley into a tight strike |
| `BROADCAST`| `BROADCAST`  | SPREAD | `radius *= 2` (widen) | thin the volley over more ground |
| `RASTER`  | `SCANLINE`    | SHAPE  | `shape='raster'` (grid-stamp across pings) | mechanical even coverage; CRT-scan flavor |
| `SANDBOX` | `CHROOT`      | FLAG   | `avoidHoney=true` (landings reject HONEY) | dodge the trace spike — trade placement freedom for a slower scan |

(All names are real: linear-feedback shift registers, core dumps, deep-packet
probes, narrowcast/broadcast, raster scanlines, `chroot` jails. The name pipeline
holds.)

### Worked examples (order matters)

- `[PROBE][FOCUS][FOCUS]` → deep anchor, radius quartered → a **tight strike at
  the far vault**. Great with high POWER energy (Catapultist synergy).
- `[FOCUS][FOCUS][PROBE]` → both FOCUS wasted (PROBE resets radius) → a **wide
  deep scatter**. Same three cards, opposite result. (The lesson survives.)
- `[COREDUMP][BROADCAST][BROADCAST]` → mass anchor, radius ×4 → **fat coherent
  blob** that hardens interior (Grow rule) while spreading.
- `[PERIM][LFSR][SANDBOX]` → LFSR resets anchor to random, SANDBOX dodges honey →
  **safe even scatter** (PERIM overwritten — a mis-sequence to teach against).

### Interaction with POWER, FORK, characters

- **POWER** sets `energy` per ping and ping **count**; ASSAULT places each of
  those pings. Orthogonal — POWER = how hard, ASSAULT = where (ember-model §6).
- **FORK** (`flags.fork`, `beginVolley:66`) adds pings → the extra pings follow
  the *same* ASSAULT descriptor. `FORK + PERIMETER` = many frontier pings = fast
  even growth; `FORK + PROBE+FOCUS` = multiple deep strikes.
- **Characters** (`characters.js`: `pingBonus`/`energyBonus`) stay passive
  surface-area/energy leans; ASSAULT is the *active* control on top. Catapultist's
  deep-lob flavor overlaps `PROBE` — fine, one's a passive tilt, one's a
  programmed choice. Recommend dropping the "scatter/where your pings hit" framing
  from `characters.js` header comment once ASSAULT ships (placement is now
  programmed, not character-defined).

---

## 2. Tier state machine

Today: `run.tier` is set once to 1 (`main.js:60`) and never advances;
`advance()` (`main.js:220`) calls `tierClear()` at `conquered >= 3`, which just
+100 ROOT and restarts via `startRun()`. Tier 2 needs the climb to *continue the
same run* with the deck intact.

### Changes

- **`advance()` (`main.js:220`)**: on win with `conquered >= 3`, if
  `run.tier < TIER_MAX` call new `advanceTier()`; else `tierClear()` (final).
- **`advanceTier()` (new, `main.js`)**: `run.tier++`, `run.conquered = 0`,
  `run.locked = new Array(8).fill(false)`, regenerate the board
  (`run.machine = generateMachine(newSeed)`), reset `run.code`, set
  `run.aggression = run.baseAggro = aggroBaseFor(run.tier)`, and **unlock the
  ASSAULT deck** (`run.assaultDeck ??= startingAssaultDeck()`,
  `run.assaultUnlocked = true`). Show a short interstitial (reuse the `tierclear`
  phase screen, reskinned "ZOOM OUT → THE LAN"), then `newAssemble()`.
- **`buildScreen` (`render.js:157`)**: the hardcoded `TIER ${run.tier}: THE
  MACHINE` becomes a per-tier name table `TIER_NAMES = [_, 'THE MACHINE', 'THE
  LAN', …]`.

### Geography for Tier 2

**Reuse `generateMachine` as-is** (still a 3-sector 80×33 field). This is the
fractal-reuse pillar and the lowest-risk path: Tier 2 is "another node cluster"
(a second BBS/LAN box) reskinned, not a wider map. The real new subsystem is the
ASSAULT deck, not the geometry (ember-model §7). Sector labels can reskin per
tier (`KERNEL/IO.SYS/SWAP` → `BBS.A/BBS.B/BBS.C`) via a per-tier label set — a
`render.js`/`terrain.js` cosmetic, no generator change.

Stretch (defer): a genuine multi-machine LAN map where you pick among several
3-sector boxes. Not needed for the ASSAULT teaching; flag as Q1/Q2.

**Yes — Tier 2 reuses the same battle engine.** `createNode` / `beginVolley` /
`lobOne` / `advanceScan` / `resolveVolley` are unchanged except `beginVolley`
also evaluates the ASSAULT program (§6). Fractal reuse holds.

---

## 3. Two decks in ASSEMBLE

Current assemble (`drawAssemble`, `render.js:57`) uses rows 3–24 for ONE deck:
title 3–4, DECK/PTS 5, five hand cards at `HAND_CARDS` (y=7, h=8 → rows 7–14),
PROGRAM row 17, ACCUMULATOR row 19, hint 22, buttons (`BTN_REDRAW/UNDO/EXEC`)
row 24. Rows 25–36 are free.

### Recommendation: PHASE SPLIT (reuse everything)

Assemble POWER first (exactly as today), then assemble ASSAULT on the *same*
layout, then → target. Rationale: reuses `HAND_CARDS`, `drawCard`, `loadSlot`,
`undoSlot`, `dealHand`, and the whole button row verbatim; teaches decks one at a
time (ember-model §6 "ship staged"); costs almost no new layout.

Concrete flow (state added to `game`):

- `game.deckPhase: 'power' | 'assault'` while `phase==='assemble'`.
- POWER sub-phase: unchanged. `BTN_EXEC` label becomes **`ASSAULT ▶`** (via a
  computed label). Its handler (`gotoTarget`, `main.js:130`) branches: if
  `run.assaultUnlocked && deckPhase==='power'`, switch to `deckPhase='assault'`,
  deal from `assaultDeck`, and re-enter assemble; else proceed to target.
- ASSAULT sub-phase: same screen; header swaps to **"ASSEMBLE ASSAULT —
  placement"**, the preview line shows the resolved pattern (§6 `assaultPreview`)
  instead of the accumulator; `BTN_EXEC` label → `TARGET ▶`; `BTN_UNDO` on an
  empty ASSAULT program steps back to the POWER sub-phase (nice-to-have).
- Tier 1 (locked): `deckPhase` stays `'power'`, `gotoTarget` goes straight to
  target — **zero behavior change**.

`dealHand` (`main.js:80`) parameterizes over the active deck+hand+program:
`dealFrom(deck) → {hand, program:[null,null,null]}` targeting either
`game.hand/program` (POWER) or `game.assaultHand/assault` (ASSAULT). `loadSlot`
/`undoSlot` read `deckPhase` to pick the target trio.

### Alternative: both decks on one screen (rejected for MVP)

Two card rows fit (5×15=75 cols; rows 7–14 POWER, 16–23 ASSAULT), tracks at 15
and 24, buttons 26. Denser, more new layout code, weaker onboarding. Keep as a
later "expert compact" toggle, not the build target.

---

## 4. How ASSAULT unlocks

**Primary gate = reaching Tier 2** (story unlock, in `advanceTier`). The fiction
hands you the register when you zoom out to THE LAN — matches ember-model §7 and
needs no economy.

**Shop deepens it** (ROOT-shop Shelf A, "unlock a card *type* into the pool"):
introduce `ASSAULT_DRAFT_POOL` and let ROOT unlock placement cards into it
(`SANDBOX`, `SCANLINE`, extra `PROBE`s) — pure option-expansion, zero numeric
power, on-model. A Tier-2 win drafts into *either* POWER or ASSAULT (offer the
player which pool to draw from, or alternate — see Q6).

Optional veteran unlock (Shelf A, permanent option): **"START WITH ASSAULT"** —
sets `assaultUnlocked` from Tier 1. Legible, no power, just earlier complexity
for players who want it.

ASSAULT needs a small default deck on unlock — `startingAssaultDeck()`
(`cards.js`), e.g. `LFSR ×3, PERIM ×2, COREDUMP, FOCUS, PROBE` (~8 cards). Bias
toward SEEK so beginners always have a valid anchor; FOCUS/RASTER/SANDBOX arrive
via draft/shop.

---

## 5. Difficulty at Tier 2

Keep the single `aggression` dial and the player-owned target-phase escalation
(`raiseAggro`/`lowerAggro`) unchanged. Deeper = more pressure via a **per-tier
baseline**:

- Replace the constant `AGGRO_BASE` baseline with `aggroBaseFor(tier)` in
  `battle.js`: `AGGRO_BASE + (tier-1) * AGGRO_TIER_STEP` (e.g. 0.75, 1.0, 1.25…).
  `advanceTier` sets `run.baseAggro = aggroBaseFor(run.tier)`.
- The scan already scales off `node.aggro` (`advanceScan:85–86`): higher baseline
  → faster descent + bigger reclaim = GAME-SHEET's "deeper = more pressure." No
  new mechanic.
- **Onboarding ramp is Tier-1 only.** `onboardingBase(plays)` (`main.js:47`) eases
  the first runs; by the time a player reaches Tier 2 they're past it, so Tier 2
  uses the real `aggroBaseFor(2)`. Gate the ramp on `tier===1` (or just let it
  saturate — `plays>=6` returns REAL anyway).
- **Design balance:** Tier 2 adds pressure (higher baseline) *and* the tool to
  answer it (ASSAULT placement efficiency — `PERIMETER` yields more cells/energy
  than random, `PROBE+FOCUS` reaches sectors random scatter can't cover in time).
  New pressure paired with new agency = the right difficulty shape.
- `rewardMult`/`draftPicks` are already relative to `baseAggro`, so they keep
  paying correctly at the higher Tier-2 baseline with no change.

---

## 6. Concrete build order (minimal-risk)

Ordered so Tier 1 stays green at every step (the default descriptor reproduces
current behavior).

1. **`cards.js` — ASSAULT data + interpreter (new, isolated).** Add
   `ASSAULT_CARDS`, `startingAssaultDeck()`, `ASSAULT_DRAFT_POOL`, and
   `evalAssault(program) → { anchor, radius, shape, avoidHoney, steps }` mirroring
   `evalProgram`. No existing code touched. *Low risk.*
2. **`terrain.js` — placement resolution.** Add pure helpers `centerOfMass`,
   `deepestReachable` (reuse `bfs`), `frontierCells`, and
   `pickLanding(machine, s, place, rng, pingIndex)`. Refactor `spreadPing`
   (224–260) so lines 226–229 call `pickLanding` when `place` is passed; **keep
   the exact random path when `place` is null/undefined.** *Riskiest step — see
   flags.*
3. **`battle.js` — wire the second program.** `beginVolley` (62) also runs
   `evalAssault(assaultProgram)` and stores `node.place` (null if locked/absent).
   `lobOne` (73) passes `node.place` + a ping index into `spreadPing`. Add
   `aggroBaseFor(tier)`. Update `runVolley` (128) + `createNode` signature to
   carry the assault program. *Low-med risk.*
4. **`main.js` — two-deck flow + tier advance.** Add `game.assault`,
   `game.assaultHand`, `game.deckPhase`; `run.assaultDeck`,
   `run.assaultUnlocked`. Generalize `dealHand`→`dealFrom`; branch `loadSlot`/
   `undoSlot`/`gotoTarget` on `deckPhase`; pass both programs into
   `createNode`/`beginVolley`. Add `advanceTier()`; branch `advance()`. Add
   `assault.deck` localStorage (key + load/save, versioned). *Med risk (state
   surface).*
5. **`render.js` — assemble reskin + preview.** `drawAssemble` reads `deckPhase`
   for header + which preview to show; add `assaultPreview(program)` returning a
   terse pattern string (e.g. `DEEP · TIGHT`, `FRONTIER · WIDE`, `RASTER`). Draw
   the ASSAULT program track. Per-tier `TIER_NAMES` + sector-label reskin. *Low
   risk.*
6. **`layout.js` — labels only** for the phase-split path (reuse `HAND_CARDS`,
   `BTN_*`); computed `BTN_EXEC` label per sub-phase. *Trivial.*
7. **`characters.js` — comment cleanup** (drop "placement is character-defined"
   framing). *Cosmetic.*

### Riskiest / most-uncertain

- **(2) the `spreadPing` refactor.** Any test asserting Tier-1 coverage numbers
  will break if the default landing RNG draw order shifts by even one call.
  Mitigation: when `place` is null, execute the *original* two-line random draw
  unchanged; only branch into `pickLanding` when a descriptor exists.
- **Placement × difficulty math.** `energyTo`/`difficultyOf` (`terrain.js:202`)
  and their comment explicitly assume *random* placement ("connectivity no longer
  gates"). Programmable `PROBE`/`PERIMETER` **reintroduce targeting**, so the
  "cheapest-N-cells" model understates a skilled player and the "~1 in 8 BRUTAL"
  guarantee may no longer hold (placement could crack a sector the difficulty
  label calls impossible). This is the deepest uncertainty — needs a
  `preview/ping.html` pass with placement modes wired in. *Flag to designer (Q7).*
- **Per-ping anchor recompute cost.** `mass`/`deep`/`frontier` anchors recompute
  against live `burned` state each ping. Ping counts are small (≈3–7), so cheap —
  but `deepestReachable` runs a BFS; cache it per volley (terrain is static within
  a node), not per ping.
- **EXEC animation.** The playhead animates only the POWER program
  (`main.js:168–177`, `render.js:139`). Decide whether ASSAULT shows during exec
  (a second static readout of the resolved pattern) or resolves silently. Lean:
  static readout, no second playhead (keep the beat count at 3). *Q4.*

---

## 7. Open questions / dials for the designer

1. **Subsystem reconciliation.** GAME-SHEET Tier 2 = "multiple nodes — pick
   targets"; ember-model §7 = ASSAULT deck. This doc leads with ASSAULT (per the
   thesis) and treats geography as reskin. Confirm, or promote a real
   multi-machine map to Tier 2 and push ASSAULT elsewhere.
2. **Geography scope.** Reuse the 3-sector generator (recommended) vs. build a
   genuine LAN of several selectable boxes.
3. **Composition precedence.** Is "last SEEK wins + SEEK resets radius" the right
   sequencing rule, or should anchors *stack* (multi-point volleys)? Needs
   preview feel-testing.
4. **ASSAULT during EXEC.** Silent resolve vs. a placement readout vs. a second
   animated playhead (and does that change the 3-beat pass timing?).
5. **Unlock gate.** Tier-gate only, or also a ROOT "start with ASSAULT" veteran
   unlock? And does the shop sell ASSAULT card *types* (recommended) from Tier 2?
6. **Draft after a Tier-2 win.** One merged draft, per-deck drafts (choose POWER
   or ASSAULT), or alternate? Affects `startDraft`/`DRAFT_POOL` split.
7. **Placement vs. the BRUTAL guarantee (biggest).** Programmable targeting may
   invalidate `difficultyOf` and the "~1 in 8 unwinnable" property. Re-derive the
   difficulty metric with placement, or accept that ASSAULT makes more sectors
   crackable (and lean harder on aggression for pressure).
8. **Numbers to calibrate in `preview/ping.html`:** `AGGRO_TIER_STEP`, default
   `radius` (WIDE) and the FOCUS/BROADCAST factors, raster lattice spacing,
   `startingAssaultDeck()` contents/size, and whether `SANDBOX` fully rejects or
   just de-weights honey.
