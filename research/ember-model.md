# Turret / Trail / Ember Model — living design doc

*Evolving spec for OVERRIDE's core mechanic. Supersedes the card-programmed
point-ignition of the MVP **and** the free omnidirectional flood before it. Status:
active design, constants un-tuned.*

Terminology: **embers → PINGS** (fits the '83 wardialer/phreak theme — you *ping*
systems). "Ember" still appears in older code and, informally, here.

---

## 0. What changed and why (the 2026-07-14 overhaul)

The card-programs-an-accumulator loop was mechanically fine but **flat**: the deck
funnels into a single number, one number can only say *more vs. less*, and "more
vs. less" is not a playstyle. Vampire Survivors feels deep because a melee cone and
an orbital ring are different **shapes** on screen, not different damage values. We
had no shapes and no visible feedback from a card choice.

Three moves fix that without throwing away the arithmetic:

1. **Ignition becomes a Peggle-style turret + a trail** (was: a point, aimed by the
   oscillating-gnomon minigame). You slide a turret along an edge, fire **one**
   packet, and it rakes a *line* of ember seeds across the board. One aim per
   battle, then hands-off watching.
2. **The accumulator runs *along the trail*.** The ordered POWER cards apply as the
   packet flies, so the running accumulator sculpts the **energy/density profile of
   the trail**. Re-ordering the same three cards visibly moves where the fire is
   hot. The arithmetic survives — and for the first time it's *legible on the
   board*.
3. **The jack-in character is the playstyle axis.** War-dialer / Shotgunner /
   Catapultist define the *shape of the trail itself* (thin lance / wide spray /
   deep lob) = sniper / bruiser / artillery, chosen at run start. This is where the
   Vampire-Survivors divergence lives; the cards are the build texture on top.

Also folded in: **one screen** (ASSEMBLE / EXEC / RESULT collapse into a single
frame — no cutaways), and the **burn threshold is dead** (terrain is a spend cost,
not a `heat > resist` gate — already decided, see §4).

Division of labour, so nothing overlaps:

| Layer | Owns | Kind of skill | Visible as |
|-------|------|---------------|-----------|
| **Character** (run-start) | shape of the trail | playstyle main | lance vs. spray vs. blob |
| **POWER deck** (ordered) | energy/density *profile* along the trail | arithmetic + cost-benefit | where the trail runs hot |
| **Turret aim** (one slide) | *which lane* the trail rakes | spatial read of terrain | trail position |
| **Spread knobs** (later tiers) | how seeds grow in the watch phase | tempo & routing | fire shape over time |

The scan-as-clock, breach-timer win, aggression dial, and economy (§7–§10) are
unchanged by the overhaul — the pivot is contained to *how you ignite and how the
deck reaches the board*.

---

## 1. The battle, end to end (one screen, one shot)

1. **Assemble** — arrange the 3-slot POWER sequence (draw 5 / slot 3). Order is the
   game (§3).
2. **Aim** — a turret slides along the top edge; tap/SPACE **once** to fire a single
   packet. Its launch column is your only positional choice.
3. **The shot** — the packet travels down through the field, **skimming cell to
   cell**, and at each cell it may drop an **ember seed** (probability = §3). The
   POWER cards resolve *as it flies*, so the seed's energy depends on where along
   the trail it landed.
4. **The watch** — hands off. Every ember spreads on its own cadence, spending its
   energy budget to claim ground (§4–§6). Meanwhile the **trace scan** descends and
   claws cells back (§7). Coverage is the tug-of-war between the two.
5. **Result** — reach **WIN_COVERAGE (50%)** and hold through the **breach timer**
   → sector breached, draft a card, advance. The scan bottoming out first →
   discovered, run ends, bank meta (§7–§9).

All of that happens in **one frame**. Fully idle after the single shot — the only
input in the whole battle is *arrange, slide, fire*.

### Screen mock (80 wide; top turret, downward trail, ~11 of the 33 field rows)

```
 TIER 1: THE MACHINE   NODE 1/3   ROOT:120   [ WAR-DIALER ]   TRACE v----------
 CODE  7 _ 4 _ _ 1 _ _    :: vault cells resolve digits        ADDR 0x7F3A +
                     ▽  <- turret slides ◂ ▸ ; SPACE fires one packet
+------------------------------------------------------------------------------+
| ·:·=+*@%#  @@·      ║ :          . ·:·  ·:=+*@%#    ═══════  0xA10C   ·:·:·   |
| :·=+*@@@%*3 @·      ║ trail       ·:=+*@·          @@%#X#:   ==+*@·    ·::·   |
| ·+*@@@8@%#· @@·     ▓ (packet)   +*@@@@%#·   @@·    #X#:·.   @@@@ %*=· ·:·:   |
| @@@%#X#:· @@@·      ▓  seeds ->  @@@%9#X·  ==+     ·:=+*@@@@%#=·  ·:·:· @@@·  |
| %#X#:·.. @@ 6 @·    ▓ o          #X#:· @@ %*=·      =+*@@@%#X#:· @@@@@·  ·::  |
| ·:· KERNEL          ║        o       IO.SYS         ·:=+ SWAP  @@@@%#X#·  ·:  |
| ·:=+*@@@@%#= 2 @@·  ▓      o    ·:=+*@@@%#X· 3       @@@@%#X#:. 7  @@·  ==+*@ |
| =+*@@@%#X#· @@@ @·  ▓    o o    @@@@%#X#:.. @·       #X#:· @@@ 4 @@@%*=· ·:·: |
| @@%#X#:· 8 @@%*=·   ▽ <landing  %#X#:· @@ 2 @@·     ·:=+*@@@@%#=· ·:·:· @@@%# |
| ·:·=+*@@%#X#:· @·        o  o   ·:=+*@@· 9  @@@·     @@%#X#:·. @@@@ %#X#:· ·: |
| #X#:·.. @@ 5 @@%*=          o   +*@@@%#X#:  @·       ·:=+*@@@%#=·  ==+*@@· ·: |
+------------------------------------------------------------------------------+
| POWER  [ BRUTE+3 ][ BRUTE+3 ][ XOR x2 ]   profile 3 -> 6 -> 12  (back-loaded) |
| CRACK [########################......................] 41%   BREACH --:--     |
| > packet raked lane 22-24. 7 seeds dropped. hot tail near IO.SYS vault.       |
| > trace scan at row 6/33. reclaimed 4 cells in KERNEL. code digit 4 LOCKED.   |
+------------------------------------------------------------------------------+
```

Legend: `▽` turret · `▓` the packet's live trail · `o` ember seeds mid-spread ·
`· : = + * @ %` your infection rising in strength · `# X █` reclaimed/ICE ·
`═ ║` links · the `TRACE v----` bar at top = the descending scan clock. Turret
orientation (top-down here) is cosmetic; perpendicular to the scan reads cleanest.

---

## 2. The turret & the trail (new)

- The turret **slides** (oscillates) along one edge. A single tap locks the launch
  position and fires **one** packet per battle. This is the whole positional
  decision: *which lane of the board do I rake?*
- The packet **skims cell to cell** along a trajectory. At each cell it rolls
  against a **seed probability** (§3) — hit → drop an ember seed there; miss → the
  cell stays clean and the packet flies on.
- The trajectory's **shape and width come from the character** (§Character below),
  not from the cards. War-dialer lays a clean 1-wide line; Shotgunner sprays a
  3-wide band; Catapultist skips the trail entirely and lobs one dense blob deep.
- The packet is fast and one-shot; all the *duration* of a battle is the ensuing
  **spread**, not the flight. The flight is the payoff beat that seeds everything.

**FORK / extra packets.** One shot is the base. `FORK()` (and certain upgrades /
higher tiers) grant an **additional packet** — a second trail, a second front. This
keeps FORK's identity ("spawn a second front") intact under the new model and is a
natural surface-area upgrade.

---

## 3. The accumulator runs along the trail (keeps ordering; makes it visible)

The 3-card POWER sequence is **not** collapsed to one number and dumped at a point.
It resolves **as the packet flies**, segment by segment:

- Split the trail into **3 segments**, one per card slot (segment 1 = first third
  of the flight, etc.).
- The accumulator starts at 0 and, entering segment *k*, applies card *k*
  (`+` adds, `×` multiplies the running value). The accumulator's **current value**
  is that segment's **local energy** `E_k`.
- Every ember seed dropped in segment *k* is born with **energy `E_k`** — its budget
  for the spread phase (§4).

So order sculpts a **spatial energy profile**:

| Sequence | Profile `E1 → E2 → E3` | Feel |
|----------|------------------------|------|
| `BRUTE+3, BRUTE+3, XOR×2` | 3 → 6 → **12** | back-loaded: cold head, devastating tail — aim the tail at a vault |
| `XOR×2, BRUTE+3, BRUTE+3` | **0** → 3 → 6 | dead head, weak — you *see* the wasted leading third |
| `BRUTE+3, XOR×2, BRUTE+3` | 3 → 6 → 9 | strong belly |

Same three cards, three different **shapes of fire on the board**. The
`[BRUTE+3][BRUTE+3][XOR×2]=12` vs `[XOR×2][BRUTE+3][BRUTE+3]=6` lesson from the
game sheet is preserved — now you don't just get a smaller number, you *watch* the
front third of your trail land stone cold. **That is the visible feedback the old
loop lacked.**

### Probability (knob **a**) = the accumulator's density, in Tier 1

The player's request for a "1–100% chance of a seed along the trail" is satisfied
**through** this profile rather than as a fourth independent slider: seed
probability in a segment scales with its local energy.

```
P_seed(segment k) = clamp( BASE_P + k_slope * normalize(E_k), 0.05, 1.0 )
```

Hot segments approach a **solid wall** of seeds; cold segments drop a **sparse
scatter**. So ordering the deck programs *both* how hard each stretch burns *and*
how densely it's seeded — one legible mechanic, one knob to teach in Tier 1.

> **Open dial:** a later deck may expose a *flat* probability card (a global
> `±density` modifier on top of the profile) for players who want to decouple
> density from energy. Not in Tier 1 — keep it to the accumulator to start.

---

## 4. Spread in the watch phase (the §-old spend loop, unrolled over time)

Once seeded, each ember grows on its own during the hands-off watch. This is the
**finite-energy spend loop** from the previous model, only now **animated over
time** (tick by tick) instead of resolved in a single instant — because the point
of the overhaul is that you *watch* it creep.

Per ember, each spread tick (cadence = knob **b**, §6):

```
if energy <= 0: ember is spent, stop.
pick an allowed, unburned, affordable neighbor c per the GROWTH rule (§5)
energy -= COST[c.terrain]
burn c
maybe branch (knob d, §6)
```

Traversing your **own** burned cells is free (the **Conduit** rule — mandatory
base; otherwise every ember weakens the deeper it reaches inside your own
territory). Energy is only ever spent on **new** ground, so `total energy ≈ new
cells claimed`.

**COST table** (unchanged; validated split from the calibration smoke test):

| terrain | COST | note |
|---------|------|------|
| OPEN | 1 | baseline |
| HONEY | 1 | cheap; random placement means you *can't* avoid tripping it |
| VAULT | 2 | toll for the prize (resolves a CODE digit) |
| HARD | 6 | hot segments afford a few; cold ones bounce — a curve, not a wall |
| BUS | −1 | refund → fire rips down bus lines (accelerant) |
| WALL | ∞ | unaffordable firebreak |

The heat-6 "wall" is a smooth cost curve, not a binary gate. **No burn threshold.**

---

## 5. Ping-IQ ladder — routing intelligence at a conquered cell (BANKED)

An upgrade axis (options, not raw stats). Base = Tier 1.

| Tier | Behavior at a conquered cell | Growth shape |
|------|------------------------------|--------------|
| 0 — Blocked | can't enter own territory; stalls when boxed in | *reject — punishes success* |
| 1 — **Conduit** *(base)* | free traverse, no re-infect; energy flows to the frontier | broad, even, diffuse stain |
| 2 — Homing *(upgrade)* | prefers unburned neighbors; crosses burned only when forced | directed, concentrated pushes |
| 3 — Leapfrog *(top)* | hops *over* a burned cell to the unburned cell beyond; can hop an unburned honeypot (buys out the trace penalty) | surgical strikes into pockets |

---

## 6. The four spread knobs → decks, staged one per tier

The player themselves flagged that four probability/timing knobs is a lot to juggle
— and a watcher can't intervene in chaos. So expose **one register per tier** (the
spec's "one new subsystem per tier"), and the *character* (not a deck) carries the
playstyle divergence from Tier 1:

| Knob | What it controls | Deck | Revealed | Shape it makes |
|------|------------------|------|----------|----------------|
| **a — probability** | seed density along the trail | (via POWER profile, §3) | **Tier 1** | wall vs. archipelago |
| **c — direction** | which neighbors a spread may take (`↑ ↕ ↓ ← → ↔` / random) | **GROWTH** | **Tier 2** | directed salient vs. bloom |
| **b — rate** | ms between an ember's spread ticks (10 ms … 1000 ms) | **TRANSFER** | **Tier 3** | flash-burn vs. slow tide |
| **d — branch** | chance a burned cell spawns a *new* independent ember | **FORK / BRANCH** | **Tier 4** | fractal tree vs. single blob |

Reveal order rationale: **direction before rate** — direction produces the clearest
new *shape* (reinforcing distinct playstyles early), while rate is a
tempo/difficulty knob that mostly interacts with the scan. Order is tunable.

**Branch (d) must be budget-capped, not a free coin-flip.** A spawned ember carries
a *split* of the parent's **remaining energy** (total energy conserved), so
branching trades depth for breadth instead of multiplying coverage for free. This is
the fix for the runaway-or-fizzle problem the player raised: the exponential knob
can't run away because the energy budget is closed.

---

## Character = the playstyle axis (the Vampire-Survivors divergence)

Chosen at run start. The character defines **the trail itself**, so the *shape* of
your assault — the thing that makes two runs feel like different games — is a
decision you main into, then tune with cards.

| Character | Trail shape | Slide | Playstyle | Reads like |
|-----------|-------------|-------|-----------|-----------|
| **War-dialer** | thin 1-wide clean line | slow, precise (easy placement) | **Sniper / lance** — pick a lane, punch a clean line at a vault strip | melee whip: one deliberate stroke |
| **Shotgunner** | fat 3-wide spray band | fast (harder to place) | **Bruiser** — overwhelm a wide band, brute coverage | garlic/King-Bible aura: overwhelming footprint |
| **Catapultist** | no trail; one dense high-energy blob lobbed into the far half | medium, arced | **Artillery** — gamble on depth near deep vaults | a lobbed bomb: boom-and-spread |

Upgrade trees stay per-character (hotter first segment, +width, tighter grouping,
aim assist, +packets…). Because the character sets the shape and the POWER deck sets
the profile, **every character plays differently even in Tier 1 with only the
probability knob online** — which is exactly the "distinct, visible playstyles"
target.

---

## 7. Enemy clawback = the TRACE SCAN (the clock)

Because coverage now grows *over time* during the watch, the system claws it back
over time too — the battle is an equilibrium: embers *add* cells, the scan
*removes* them.

**The mechanic:** a horizontal line descends **top-to-bottom** across the field; as
it sweeps it **reclaims a budgeted number of burned cells** it crosses. Its single
descent **is the run clock** — reaching the bottom = traceback complete =
discovered = battle lost. Scan speed (set by level × aggression, §10) is therefore
the effective time limit. This generalizes/replaces `LOCKDOWN = 10 passes`.

- **Reclaim target = NEUTRAL** — reclaimed cells just go unburned, retakeable at
  normal cost (ICE-hardened borders are a later-tier escalation).
- **Honeypots spike the trace** — each burned HONEY nudges the line faster (+trace
  penalty), and random honey placement means you *can't* fully avoid them.
- **Difficulty scaling:** low tier grants a grace delay and a slow constant descent;
  high tier starts the scan **on ignition** and **accelerates**.
- **PTS penalty is emergent** — the scan eating cells lowers peak coverage, which
  lowers banked bonus PTS. A weak deck gets traced and banks little; a strong deck
  out-adds the scan and banks surplus.

**Symmetry:** your shot = a finite energy packet that *adds* cells; the scan = a
finite reclaim budget that *removes* them. Same currency, opposing flows.

### Win condition — reach, then hold (DECIDED)

Not instant at 50%. **Reach WIN_COVERAGE (50%) → a BREACH TIMER starts (length set
by level) → hold ≥50% until it expires → sector breached.** Drop under 50% during
the hold and the timer pauses/resets. The scan's erosion is what threatens the hold,
so the finish is a sprint against the descending line; over-coverage during the hold
banks bonus PTS. Tuning constraint: a strong deck (energy profile × character shape)
must be able to out-pace the scan, reach 50% early, *and* survive the timer.

---

## 8. Decks ARE the progression (the 7-tier climb)

- **Tier 1 — THE MACHINE:** POWER deck (ordered) + character. Spread = random,
  steady, no branching (fixed defaults). Distinct playstyles come from the
  character; build texture from card order.
- **Tier 2 — THE LAN:** unlock **GROWTH / direction** (c) — program *which way* fire
  leans.
- **Tier 3 — THE CORP:** unlock **TRANSFER / rate** (b) — program the tempo; the
  scan bites hard here = the spec's "you bleed."
- **Tier 4 — THE GRID:** unlock **BRANCH** (d) + higher Ping-IQ — then rule-editing
  at deeper tiers.

A deeper run literally hands you a new programmable register. Progression = more
decks + more cards per deck + character upgrades, **not** bigger numbers.

---

## 9. Economy (unchanged by the overhaul)

- **Breach a node** → draft 1 of 3 cards; +ROOT.
- **Clear a tier** → zoom out, add a subsystem/deck.
- **Lose (scan bottoms out)** → fail skin, run ends, keep banked PTS/ROOT (emergent
  from peak coverage, §7).
- **ROOT** buys permanent unlocks: extra starting cards, +hand size, new card types,
  character upgrades, retry-from-a-deeper-tier.

---

## 10. Difficulty = the AGGRESSION dial (built)

Difficulty collapses to one scalar, `aggression`, scaling the whole trace scan
(speed + reclaim) — mirroring how the POWER profile scales your whole volley. The
player owns it in the aim phase: **raise for free** (harder scan, bigger payout —
more ROOT/PTS + extra draft picks) or **spend PTS to lower it** (safety valve). One
loss ends the run, so cranking is a genuine gamble. Live, player-chosen escalation
(Ascension/Heat style), not hidden rubber-banding.

**Onboarding ramp** (`onboardingBase(plays)`): baseline aggression eases players in
(runs 1–2 at 0.5, graduating to `AGGRO_BASE = 0.75` by run 7), surfaced as a
"TRAINING RUN" tag; the player still owns the dial on top. Per-sector terrain
difficulty stays a second, independent axis.

---

## 11. Legibility is load-bearing (not polish)

Distinct math that *looks* the same is still lame. Each knob needs a signature the
eye catches in under a second — a high-density trail visibly **encrusted** with
seeds, a directional bias where the whole fire visibly **leans**, a hot trail
segment that flares brighter than a cold one, a branch that visibly **buds** a new
front. This is a `research/juice-model.md` job as much as a mechanics one; if the
signatures are mushy, the overhaul fails on its own goal. Treat per-knob visual
identity as a spec requirement, not a finishing pass.

---

## 12. Open dials / questions

- Turret orientation (top-down vs. edge-slide) and trail curvature — cosmetic to
  start; a curved/angled turret is a later positional upgrade.
- Is one packet per battle enough agency, or should base kit grant 2 by mid-Tier-1?
  (FORK already covers the "second front" want.)
- `k_slope` / `BASE_P` mapping of energy → seed density (§3) needs `preview/`
  calibration alongside the existing COST split.
- Segment count = card-slot count (3). If SEQ grows to 4+ at higher tiers, the trail
  splits into 4+ segments automatically — confirm that reads on an 80-wide board.
- INTERRUPT's new job: freeze the scan for a beat? Refund energy to live embers?
- Spread-vs-scan equilibrium under a *single* shot needs a headless smoke test
  (old test assumed ping-arrival-over-time; new model seeds once then spreads).

---

## 13. Calibration sandbox (`preview/ping.html`)

Standalone tool reusing the **real `src/terrain.js` generator**, so tuned numbers
port straight to the game. Sliders now cover: character (trail shape/width), POWER
profile (per-segment energy), seed-density mapping, spread rate, branch chance, scan
speed, reclaim/row, breach hold, win coverage. RESEED cycles sectors.

**Prior validated split** (headless, 6 seeds, KERNEL): `COST = {OPEN 1, HARD 6,
WALL ∞, BUS −1, VAULT 2, HONEY 1}`; a strong deck won ~5/6 (peaks 73–91%), a weak
deck lost 6/6 (peaks <19%); the lone strong loss was an intended BRUTAL layout.
These carry over as starting numbers; the single-shot spread-over-time loop needs a
fresh pass to reconfirm the equilibrium.
