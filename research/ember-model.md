# Beam-Card Model — living design doc

*The settled core of OVERRIDE's mechanic. Supersedes, in order: the free
omnidirectional flood (MVP), the ordered-accumulator point-ignition, and the
opcode-alphabet sketch. Status: core locked 2026-07-14; constants un-tuned.*

Terminology: **embers → PINGS** informally; "ember" still appears in older code.
The old ordered CPU **accumulator** (BRUTE+3 / XOR×2) is **retired** — its job
(arithmetic + cost-benefit) is now carried by additive card-stacking and scarce
slots (§3). See the reach note in §4 for where "energy" went.

---

## 0. Lineage (why this shape)

The card-programs-an-accumulator loop was flat: the deck funneled into one number,
and one number only says *more vs. less* — never a playstyle. The fix, arrived at
over the 2026-07-14 design pass:

- Ignition is a **Peggle turret** firing **one packet** that draws a **beam spine**
  across the field; embers emit off the spine and spread while you watch.
- The deck is **bundled-triple cards**: every card is a complete beam —
  `(shape, direction, probability)` — and playing several **merges** them.
- The fiction is a **script-kiddie arc**: cards are forbidden/pirated programs,
  slots are terminal memory, and cracking systems earns both (§7).

One screen (no ASSEMBLE/EXEC/RESULT cutaways). No burn threshold (terrain is a
spend **cost**, not a gate — §4).

---

## 1. The battle, end to end (one screen, one shot)

1. **Assemble** — arrange your cards in your earned slots. They merge into one beam
   (§3).
2. **Aim** — a turret slides along the bottom edge; tap once to fire a single packet
   at column `p`. Your only positional choice: *which column do I trigger from?*
3. **The beam** — the packet draws the **spine** upward, `x(y) = p + Σ shape(y)`
   (§2). At each spine cell it rolls the merged **probability**; on a hit it emits
   ember(s) in the merged **direction(s)**.
4. **The watch** — hands off. Emitted embers travel outward over time, spending
   **reach** against the terrain cost table (§4). The **trace scan** descends and
   claws cells back (§9). Coverage is the tug-of-war.
5. **Result** — hold **≥50% (WIN_COVERAGE)** through the **breach timer** → sector
   breached, loot a card, earn a slot, advance. Scan bottoms out first → traced,
   run ends, bank meta (§9–§10).

The only input in the whole battle is *arrange, slide, fire.*

---

## 2. The turret & the beam spine

- The turret **slides** along one edge; one tap fires **one** packet per battle at
  column `p`.
- The packet draws a **spine**: the path of contact cells, `x(y) = p + Σ shape(y)`,
  traced up the field. Pencil beam = `shape ≡ 0` (straight vertical). Waves make the
  spine snake (§3, shape aspect).
- The spine is where embers are *seeded*; the emission (direction + probability)
  decides how they leave it. Extra packets (`FORK`, upgrades, higher tiers) draw
  extra spines = second fronts.

---

## 3. THE CARD MODEL — bundled triples (the core)

**Every card is a complete, valid beam.** A card bundles three aspects:

| Aspect | What it sets | Tier-1 vocabulary | Default (unslotted) |
|--------|--------------|-------------------|---------------------|
| **Shape** | the spine curve `shape(y)` | Linear (pencil) · Sine · 3rd-harmonic · Rectified-sin · Tan · Sawtooth | Linear |
| **Direction** | which way embers emit off the spine | `←` `→` · diagonals `↖↗↘↙` · `↑` `↓` | none (inert until a direction is present) |
| **Probability** | which spine cells emit | 10% · 25% · 50%, or a deterministic pattern (every-other = 50%, every-fifth = 20%) | 0% (nothing fires) |

The starter forbidden card is **`SCRIPT.COM = Linear + Left + 25%`**. Weak on
purpose — one card barely cracks your own terminal.

### Merge rules (how slotted cards combine into one beam)

- **Probability ADDS**, capped at 100%. `25% + 25% = 50%`. Overflow past 100% is
  wasted (a deliberate "bad stack" lever).
- **Direction UNIONS.** `Left` + `Right` = both (a curtain). Each direction in the
  union emits its own ember per firing cell — so **more directions = more embers =
  more surface area** (this is where coverage multiplies; no separate branch stat
  needed at Tier 1).
- **Shape SUMS** (superposition). Two sines reinforce (bigger amplitude); a line + a
  sine = a wavy line; sine + 3rd-harmonic starts squaring the wave. This is literal
  **Fourier synthesis** — you *build a waveform out of harmonics*, dead-on theme for
  an '83 signals/phreak game, and legible because you watch the waves add. Amplitude
  clips to the board.
- **Order does not matter.** All three merges are commutative — this is the
  conscious trade for the bundled model (it retires the old ordered accumulator).
  Cost-benefit now lives in **slot allocation + additive stacking + bundled
  trade-offs**, not sequencing.

### Why bundling is the whole point (the MTG discipline)

You draft the **package, not the aspect.** A gorgeous sine spine arrives welded to
*its* direction and *its* probability. "Some cards are bad on purpose" gets its
teeth here: a great shape stuck on `Left`-only at `10%` is a real cost you pay,
pair, or pass. **Distinct decks are which compromises you accept.**

---

## 4. Emission, reach & terrain (the watch-phase spread)

On a firing spine cell, each unioned direction emits an ember that **travels
outward over time**, burning cells until its **reach** is spent:

```
per emitted ember:  budget = REACH
  each spread tick (cadence = default rate, §8):
    step one cell in the emission direction (± terrain-fingered jitter)
    budget -= COST[cell.terrain]
    burn cell
    if budget <= 0 or cell is WALL: ember is spent
```

**Reach = where "energy" went.** The retired accumulator's job — how *far/deep* a
volley burns — is now a **terminal stat** (`REACH`), part of the script-kiddie
upgrade fiction: a faster CPU / more RAM lets embers travel further. Base REACH is
small; it grows via ROOT/meta and a few late cards. This keeps the terrain
interaction (fire rips down BUS lanes, stalls on HARD) without a per-card number
soup.

**COST table** (unchanged; validated split):

| terrain | COST | note |
|---------|------|------|
| OPEN | 1 | baseline |
| HONEY | 1 | random placement → you can't avoid tripping it (spikes the trace) |
| VAULT | 2 | toll for the prize (resolves a CODE digit) |
| HARD | 6 | a curve, not a wall — deep reach affords a few |
| BUS | −1 | refund → embers rip down bus lines (accelerant) |
| WALL | ∞ | unaffordable firebreak |

No burn threshold — the heat-6 "wall" is a smooth cost curve.

---

## 5. The card pool (authored, ~25–30; representative slice)

Do **not** expose the raw shape×direction×probability grid — it reads as a
spreadsheet. Hand-author named cards with identity and a deliberate wrinkle. Names
are the free "dawn of computing" pipeline.

| Card | Shape | Dir | Prob | Identity / wrinkle |
|------|-------|-----|------|--------------------|
| `SCRIPT.COM` | Linear | ← | 25% | the starter forbidden card |
| `SCRIPT.SYS` | Linear | → | 25% | the mirror — early draft to open a curtain |
| `BUFFER.OVR` | Linear | ←→ | 50% | overflow; the curtain workhorse |
| `WORM` | Sine | ←→ | 25% | wide, thin — the Morris spread |
| `HARMONIC` | Sine(2×) | ←→ | 25% | octave up; sums with WORM toward a square |
| `PHREAK` | Sine(3×) | ← | 25% | 3rd harmonic; squares the wave |
| `BLUEBOX` | Rect-sin | ↑ | 50% | phreak jets straight up toward objectives |
| `LOGICBOMB` | Step | ↓ | 50% | drives downward, toward the core |
| `XOR` | Linear | ↗↙ | 25% | crossing diagonals; fills gaps |
| `DAEMON` | Linear | ← | every-5th (20%) | sparse but cheap; deterministic mask |
| `NOP.SLED` | Linear | — | 50% | high prob, **no direction** — inert alone (pure enabler; bad on purpose) |
| `TANGENT` | Tan | ←→ | 10% | asymptote blowout — mostly wasted, sometimes clutch |
| `ROOTKIT` | Linear | ←→ | 75% | premium; expensive |
| `PAYLOAD` | Sine | ←→ | 50% | rare workhorse you grind for |
| `0DAY` | Sine | ←→ | 100% | legendary grail |

Later-tier cards add new aspects (§8): `FORK()` (spine emits sub-emitters),
`FIREWALL.C` (hold/harden vs. the scan), homing/pierce IQ.

---

## 6. Escalation stacks (build archetypes + power curves)

Each stack shows the acquisition order, the **merged beam at each milestone**, and
the intended **weakness** — because "bad on purpose" means no stack is universally
best. These double as balance targets.

### A — THE CURTAIN *(bruiser / raw coverage)*
```
SCRIPT.COM                    Lin · ←        · 25%   one weak edge sheet
+ SCRIPT.COM (copy)           Lin · ←        · 50%   denser
+ SCRIPT.SYS                  Lin · ←→       · 50%   curtain opens both ways
+ BUFFER.OVR                  Lin · ←→       · 100%  solid wall, both sides   (cap hit)
+ ROOTKIT                     Lin · ←→       · 100%  (overflow wasted) → bank REACH instead
```
**Feel:** a solid advancing slab; overwhelms a sector. **Weakness:** zero precision,
wastes reach on held ground, slow to 50% on huge sectors, scan-food if under-reached.

### B — THE LANCE *(sniper / vault-diver)*
```
SCRIPT.SYS                    Lin · →        · 25%   thin right jab
+ REACH upgrades (meta)       Lin · →        · 25%   but travels deep
+ PACKET                      Lin · →↑       · 50%   angled deep strike
+ (T4) HOMING IQ              seeks unburned/vault cells
```
**Feel:** a thin deep spear onto a vault strip (War-dialer synergy). **Weakness:**
low total coverage — bad against a wide win condition; whiffs if aimed wrong.

### C — THE HARMONIC *(Fourier / show-off coverage)*
```
WORM                          Sin · ←→       · 25%   soft wave
+ HARMONIC                    Sin+Sin2 · ←→  · 50%   wave gains structure
+ PHREAK                      …+Sin3 · ←→    · 75%   waveform squares up → broad even front
+ PAYLOAD                     …           · 100%  dense structured curtain
```
**Feel:** intricate wave-fronts that fill wide, evenly. **Weakness:** patterned
coverage leaves periodic gaps the scan threads; amplitude can clip off-board.

### D — THE FENCE *(vertical rush / beat the scan)*
```
BLUEBOX                       Rect-sin · ↑   · 50%   picket of upward jets
+ BLUEBOX (copy)              Rect-sin · ↑   · 100%  dense vertical comb
+ LOGICBOMB                   +Step · ↑↓     · 100%  jets up AND drills down
```
**Feel:** races vertically toward top objectives before the top-down scan reaches
them. **Weakness:** thin horizontally — easy for the scan to reclaim the flanks.

### E — THE GLITCH DECK *(glass-cannon gambler)*
```
TANGENT                       Tan · ←→       · 10%   usually fizzles…
+ TANGENT (copy)              Tan · ←→       · 20%   …occasionally an asymptote blowout paints half a sector
+ NOP.SLED                    (adds 50% prob to whatever fires)  · 70%
```
**Feel:** high-variance; some runs detonate, some flop. **Weakness:** literally
unreliable — the deliberate bad-card build for players chasing a high.

**Stacking caps / diminishing returns:** probability caps at 100% (overflow wasted);
direction caps at the 8 compass headings; shape amplitude clips to the board. Past a
cap, surplus cards should convert to REACH or ROOT so a slot is never fully dead.

---

## 7. The story = the progression (script-kiddie arc)

A card is a **forbidden program** — pirated warez traded on a BBS, an exploit on a
cracked floppy. The arc *is* the roguelike climb:

- **One forbidden card** on your bedroom terminal → you barely crack your own machine.
- **Breach a system** → earn a **slot** (terminal memory, expanded by hacking) and
  **loot a card** (better warez off a better machine).
- **Own terminal → other terminals → the LAN → the corp → NORAD** = the seven-tier
  fractal climb (GAME-SHEET), now with a character arc: nobody kid → the hacker the
  FBI is tracing.
- **ROOT shop = the black-market BBS** (see `ROOT-shop-design.md`): between runs,
  spend ROOT on forbidden cards, memory (slots/REACH), and unlocks.

Acquisition (**decided direction, tune later**): draft **one-of-three** off each
breached system (warez it dropped) **and** a persistent BBS shop for ROOT. Rarity
gates the grail cards (`PAYLOAD`, `0DAY`).

---

## 8. Later-tier layers (staged, one subsystem per tier)

Tier 1 is shape + direction + probability + a fixed emission rate. Deeper tiers add
*new card aspects*, not bigger numbers:

- **Tier 2 — rate:** cards that set emission cadence (ms) — flash-burn vs. slow tide.
- **Tier 3 — branch (`FORK`):** emitted embers spawn sub-emitters, carrying a *split*
  of remaining reach (total conserved → no runaway). Surface-area escalation.
- **Tier 4 — hold / IQ:** `FIREWALL.C` hardens cells against the scan; the Ping-IQ
  ladder (Conduit → Homing → Leapfrog) routes embers around/over terrain.

The retired opcode-alphabet's good ideas survive here: `FORK` = branch, `WALL`/
`FIREWALL` = hold. They're late-game aspects, not the base.

---

## 9. Enemy clawback = the TRACE SCAN (the clock)

A horizontal line descends **top-to-bottom**, reclaiming a budgeted number of burned
cells it crosses. Its single descent **is the run clock** — reaching the bottom =
traced = run ends. Speed is set by level × aggression (§10). Reclaimed cells go
**neutral** (retakeable). Honeypots spike the trace (nudge the line faster);
random placement means you can't fully avoid them.

- **Onset/speed scale by tier:** low tier = grace delay + slow constant descent; high
  tier = starts on ignition + accelerates.
- **Win = reach, then hold:** hit 50% → **breach timer** starts → hold ≥50% until it
  expires → breached. Drop under 50% and the timer pauses/resets. Over-cover during
  the hold to bank bonus PTS. A strong deck must out-add the scan, reach 50% early,
  and survive the timer.
- **PTS penalty is emergent** — the scan eating cells lowers peak coverage, which
  lowers banked PTS. Weak deck traced → banks little; strong deck → banks surplus.

Symmetry: your beam adds cells (finite reach); the scan removes cells (finite
reclaim budget). Same currency, opposing flows.

---

## 10. Difficulty & economy

**Aggression dial (built):** one scalar scales the whole scan (speed + reclaim). The
player owns it at aim time — **raise for free** (harder scan, more ROOT/PTS + extra
draft picks) or **spend PTS to lower it**. One loss ends the run, so cranking is a
real gamble. Player-chosen escalation (Ascension/Heat), not hidden rubber-banding.
Onboarding ramp eases baseline aggression over the first ~7 runs (a "TRAINING RUN"
tag).

**Economy:** breach → loot a card + earn a slot + ROOT · clear a tier → new aspect ·
lose → fail skin, keep banked PTS/ROOT · ROOT (persistent) buys cards, slots, REACH,
and unlocks at the BBS shop.

---

## 11. Legibility is load-bearing (not polish)

Distinct math that *looks* the same is still lame. Every aspect needs a signature the
eye catches in under a second: a high-probability spine visibly **dense** with
emission points; a summed harmonic where you can **see the waves add**; a wide-union
direction that visibly **fans** both ways; a deep-REACH ember that visibly **drives**
far before guttering. This is a `research/juice-model.md` requirement, not a
finishing pass.

---

## 12. Open dials / questions

- **REACH as a pure meta-stat vs. also a rare card aspect** — leaning meta-stat +
  a few cards; confirm the accumulator stays fully retired.
- Probability-overflow reward (convert surplus to REACH?) vs. pure waste.
- Pattern-mask (`every-5th`) vs. random-% stacking rule when both are present:
  masks union, randoms fill the remainder — confirm on the grid.
- Default emission **rate** for Tier 1 so the watch is paced (knob deferred to T2 as
  a card, but needs a good fixed default now).
- Direction-union ember count vs. reach budget — many directions × deep reach could
  overshoot; may need a per-packet total-reach pool split across emitted embers.
- Exact slot curve (how fast slots are earned) and card rarity tiers.

## 13. Calibration sandbox (`preview/beam.html`)

Reuses the real `src/terrain.js` generator so tuned numbers port straight in.
Sliders: trigger column, shape set (with live Fourier sum preview), direction union,
merged probability, REACH, emission rate, scan speed, reclaim/row, breach hold, win
coverage. RESEED cycles sectors. Should let us *watch* the six escalation-stack end
states move against real terrain and tune the caps.

**Prior validated split** (headless, 6 seeds, KERNEL): `COST = {OPEN 1, HARD 6,
WALL ∞, BUS −1, VAULT 2, HONEY 1}`; strong deck ~5/6 (peaks 73–91%), weak 6/6 (<19%),
lone strong loss = intended BRUTAL. Carry as starting numbers; the single-shot
emit-and-spread loop needs a fresh equilibrium pass.
