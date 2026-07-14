# Beam-Card Model — living design doc

*The settled core of OVERRIDE's mechanic. Supersedes, in order: the free
omnidirectional flood (MVP), the ordered-accumulator point-ignition, and the
opcode-alphabet sketch. Status: core locked 2026-07-14; GROWTH folded in as the
4th card aspect 2026-07-14; constants un-tuned.*

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
- The deck is **bundled-quad cards**: every card is a complete beam —
  `(shape, direction, probability, growth)` — and playing several **merges** them.
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
   **reach** against the terrain cost table (§4), and — driven by the merged
   **growth** aspect — **reproduce**: a burning ember may spawn a child onto a
   fresh unburned neighbour, so the fire sustains and fills instead of guttering
   when the initial spray runs out (§4). The **trace scan** descends and claws
   cells back (§9). Coverage is the tug-of-war.
5. **Result** — hold **≥50% (WIN_COVERAGE)** through the **breach timer** → sector
   breached, loot a card, earn a slot, advance. Scan bottoms out first → traced,
   run ends, bank meta (§9–§10). (Tier-1 50% is deliberately barely winnable — you
   barely crack your own terminal; GROWTH is what makes it reachable, §4.)

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

## 3. THE CARD MODEL — bundled quads (the core)

**Every card is a complete, valid beam.** A card bundles four aspects:

| Aspect | What it sets | Tier-1 vocabulary | Default (unslotted) |
|--------|--------------|-------------------|---------------------|
| **Shape** | the spine curve `shape(y)` | Linear (pencil) · Sine · 3rd-harmonic · Rectified-sin · Tan · Sawtooth | Linear |
| **Direction** | which way embers emit off the spine | `←` `→` · diagonals `↖↗↘↙` · `↑` `↓` | none (inert until a direction is present) |
| **Probability** | which spine cells emit | 10% · 25% · 50%, or a deterministic pattern (every-other = 50%, every-fifth = 20%) | 0% (nothing fires) |
| **Growth** | how burning embers **reproduce** — each burning ember's per-step chance to spawn a child onto a fresh unburned neighbour, and how far that child persists | None · Low (10%) · Med (20%) · High (40%) reproduce, coupled to a child spread-reach | 0% (fire dies when the spray budget is spent) |

The starter forbidden card is **`SCRIPT.COM = Linear + Left + 25% + Low-growth`**.
Weak on purpose — one card, with just enough reproduce to barely crack your own
terminal (§4 — GROWTH is what lets a single finite-REACH packet breach at all).

### Merge rules (how slotted cards combine into one beam)

- **Probability ADDS**, capped at 100%. `25% + 25% = 50%`. Overflow past 100% is
  wasted in Tier 1 (a deliberate "bad stack" lever); a ROOT-shop OVERCLOCK can later
  route surplus density into the REACH pool (§4).
- **Direction UNIONS.** `Left` + `Right` = both (a curtain). Each direction in the
  union emits its own ember per firing cell — so **more directions = more embers =
  more surface area** (this is where coverage multiplies; no separate branch stat
  needed at Tier 1).
- **Shape SUMS** (superposition). Two sines reinforce (bigger amplitude); a line + a
  sine = a wavy line; sine + 3rd-harmonic starts squaring the wave. This is literal
  **Fourier synthesis** — you *build a waveform out of harmonics*, dead-on theme for
  an '83 signals/phreak game, and legible because you watch the waves add. Amplitude
  clips to the board.
- **Growth ADDS** its reproduce chance, capped (Tier-1 cap ~60% — a high-growth
  stack chaos-fills; overflow past the cap is wasted, same "bad stack" lever as
  probability). The child **spread-reach** (how far a spawned child persists) takes
  the **MAX** of the contributing cards — the most persistent growth on the beam
  sets how long its children live. More growth = the fire *sustains* and fills 2D
  instead of guttering when the initial spray budget runs out (§4). Growth is the
  sustained-burn lever; REACH is the initial-spray lever — two separate knobs (§12).
- **Order does not matter.** All four merges are commutative — this is the
  conscious trade for the bundled model (it retires the old ordered accumulator).
  Cost-benefit now lives in **slot allocation + additive stacking + bundled
  trade-offs**, not sequencing.

### Probability: random vs. pattern (stacking rule)

Two flavors of the probability aspect, and they compose cleanly:
- **Random-%** cards (10/25/50%) **sum** their percentages (cap 100) — organic scatter.
- **Pattern/mask** cards (`every-other` = 50%, `every-fifth` = 20%) name *which* cells
  fire — a deterministic comb — and **union** their masks.
- **Mixed:** masks resolve first (their cells always fire); the summed random-% then
  fills among the cells the masks left open. So `every-other` + `25% random` = every
  even cell **plus** 25% of the odd cells (~62.5%), never double-counted.

Masks read as *designed* textures (a regular comb — legible, on-theme for `COMB.EXE`,
`DAEMON`); randoms read as organic spread. Both earn their place.

### Why bundling is the whole point (the MTG discipline)

You draft the **package, not the aspect.** A gorgeous sine spine arrives welded to
*its* direction, *its* probability, and *its* growth. "Some cards are bad on
purpose" gets its teeth here: a great shape stuck on `Left`-only at `10%` with
`None`-growth is a real cost you pay, pair, or pass — and a monster reproduce rate
can arrive welded to a shape you didn't want. Four welded aspects is the deliberate
onboarding weight: the payoff is that the grail card `WORM` (High-growth self-spread)
is worth chasing precisely because you can't buy its growth à la carte.
**Distinct decks are which compromises you accept.**

---

## 4. Emission, reach & terrain (the watch-phase spread)

On a firing spine cell, each unioned direction emits an ember. All embers from the
packet draw from **one shared REACH pool**, so they **travel outward over time**,
burning cells until their share of the pool is spent — and as they burn they
**reproduce** off the merged GROWTH aspect, so the fire keeps filling instead of
dying at pool's end:

```
POOL   = terminal REACH stat (+ any REACH cards)
share  = min(REACH_CAP, POOL / max(1, emberCount))   // per-ember initial budget
GROWTH = merged (reproduce %, spreadReach)           // §3 growth aspect
per emitted ember:  budget = share
  each spread tick (cadence = default rate, §8):
    step one cell in the emission direction (± terrain-fingered jitter)
    budget -= COST[cell.terrain]      // BUS refunds, HARD is steep
    burn cell
    if rng() < GROWTH.reproduce and emberCount < MAX_EMBERS:
        spawn a child onto a random UNBURNED orthogonal neighbour,
        child.budget = GROWTH.spreadReach      // fresh sustained-burn budget
    if budget <= 0 or cell is WALL: ember is spent
```

**MAX_EMBERS** caps the live population (compute guard against a runaway branching
process). The **unburned-neighbour rule** — children only seed onto not-yet-burned
cells — plus the scan's ongoing erosion (§9) keeps reproduction *generative but
gated*: it grows coverage toward an equilibrium against the scan, it does **not**
reopen the free omnidirectional flood the MVP model killed (no child ever re-burns
held ground, so growth can't run away past the board or the clock).

**Reach is a SHARED POOL — this is the depth/width trade.** The retired accumulator's
job (how far/deep a volley burns) is now a per-packet **REACH pool**: a **terminal
meta-stat** (script-kiddie fiction — a faster CPU / more RAM = a bigger pool), grown
via ROOT and a few rare cards, but **split across every ember the packet emits**. The
trade then falls out for free: a Curtain (high probability × both directions = many
embers) spreads each ember *shallow* — wide but thin; a Lance (low probability × one
direction = few embers) concentrates the pool — *deep* but narrow. `REACH_CAP` stops
a lone ember from tunnelling the whole board. So the card carries no per-card reach
number (reach stays a meta-stat), width-vs-depth becomes a real build lever, and the
terrain interaction (rips down BUS, stalls on HARD) is preserved.

**REACH and GROWTH are two separate budgets — don't conflate them.** REACH (the
shared pool) is the *initial spray*: how far the first wave of embers throws before
guttering. GROWTH (the card aspect) is the *sustained burn*: whether that spray keeps
reproducing into fresh ground afterward. Calibration proved a single finite-REACH
packet with no growth caps at ~40–57% and the fire *dies*; adding reproduce grows
coverage toward an equilibrium (a curtain stack climbs 55% → 83% as growth rises). A
deck can be deep-REACH/low-GROWTH (a lance that stabs far once) or shallow-REACH/
high-GROWTH (a spark that catches and spreads) — genuinely different fires.

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

Do **not** expose the raw shape×direction×probability×growth grid — it reads as a
spreadsheet. Hand-author named cards with identity and a deliberate wrinkle. Names
are the free "dawn of computing" pipeline. **Growth** is the new 4th aspect
(reproduce rate); it's welded to each card like the other three, so a great shape
can arrive with dead growth and a monster spreader can arrive on a bad shape.

| Card | Shape | Dir | Prob | Growth | Identity / wrinkle |
|------|-------|-----|------|--------|--------------------|
| `SCRIPT.COM` | Linear | ← | 25% | Low | the starter forbidden card — just enough reproduce to barely crack your own terminal |
| `SCRIPT.SYS` | Linear | → | 25% | Low | the mirror — early draft to open a curtain |
| `BUFFER.OVR` | Linear | ←→ | 50% | Med | overflow; the curtain workhorse |
| `WORM` | Sine | ←→ | 25% | **High** | the Morris spread — low prob, but self-replicates hard; the growth grail |
| `HARMONIC` | Sine(2×) | ←→ | 25% | Med | octave up; sums with WORM toward a square |
| `PHREAK` | Sine(3×) | ← | 25% | Low | 3rd harmonic; squares the wave |
| `BLUEBOX` | Rect-sin | ↑ | 50% | Low | phreak jets straight up toward objectives |
| `LOGICBOMB` | Step | ↓ | 50% | Med | drives downward, toward the core |
| `XOR` | Linear | ↗↙ | 25% | Low | crossing diagonals; fills gaps |
| `DAEMON` | Linear | ← | every-5th (20%) | **High** | sparse spine but a persistent background spawner — deterministic mask meets self-spread |
| `NOP.SLED` | Linear | — | 50% | None | high prob, **no direction, no growth** — inert alone (pure enabler; bad on purpose) |
| `TANGENT` | Tan | ←→ | 10% | None | asymptote blowout — mostly wasted, sometimes clutch |
| `ROOTKIT` | Linear | ←→ | 75% | Med | premium; expensive |
| `PAYLOAD` | Sine | ←→ | 50% | High | rare workhorse you grind for |
| `0DAY` | Sine | ←→ | 100% | High | legendary grail — dense *and* self-spreading |

Growth-vocabulary shorthand: **None** = 0% reproduce (fire dies at pool's end) ·
**Low** ≈ 10% · **Med** ≈ 20% · **High** ≈ 40% (chaos-fill). `WORM` and `DAEMON`
are the two cards drafted *for* their growth — the self-replication fantasy made
literal.

Later-tier cards add new aspects (§8): `FORK()` (spine emits sub-emitters — a
*directed* escalation of baseline growth), `FIREWALL.C` (hold/harden vs. the scan),
homing/pierce IQ.

---

## 6. Escalation stacks (build archetypes + power curves)

Each stack shows the acquisition order, the **merged beam at each milestone**, and
the intended **weakness** — because "bad on purpose" means no stack is universally
best. These double as balance targets.

Each line now also carries the **merged growth** (`gr`), because reproduction is
what carries a stack past the ~40–57% single-spray ceiling to its listed coverage.

### A — THE CURTAIN *(bruiser / raw coverage)*
```
SCRIPT.COM                    Lin · ←        · 25%  · gr Low    one weak edge sheet
+ SCRIPT.COM (copy)           Lin · ←        · 50%  · gr Low    denser
+ SCRIPT.SYS                  Lin · ←→       · 50%  · gr Low    curtain opens both ways
+ BUFFER.OVR                  Lin · ←→       · 100% · gr Med    solid wall, both sides   (prob cap hit)
+ ROOTKIT                     Lin · ←→       · 100% · gr High   overflow → routes to growth; slab now self-sustains
```
**Feel:** a solid advancing slab that *keeps* advancing as growth climbs; overwhelms
a sector. **Weakness:** zero precision, wastes reach on held ground, slow to 50% on
huge sectors, scan-food if under-reached and under-grown.

### B — THE LANCE *(sniper / vault-diver)*
```
SCRIPT.SYS                    Lin · →        · 25%  · gr Low    thin right jab
+ REACH upgrades (meta)       Lin · →        · 25%  · gr Low    but travels deep
+ PACKET                      Lin · →↑       · 50%  · gr Low    angled deep strike
+ (T4) HOMING IQ              seeks unburned/vault cells
```
**Feel:** a thin deep spear onto a vault strip (War-dialer synergy) — deliberately
**low growth**, so all the pool concentrates into depth, not spread. **Weakness:**
low total coverage — bad against a wide win condition; whiffs if aimed wrong.

### C — THE HARMONIC *(Fourier / show-off coverage)*
```
WORM                          Sin · ←→       · 25%  · gr High   soft wave that self-spreads
+ HARMONIC                    Sin+Sin2 · ←→  · 50%  · gr High   wave gains structure
+ PHREAK                      …+Sin3 · ←→    · 75%  · gr High   waveform squares up → broad even front
+ PAYLOAD                     …             · 100% · gr High   dense structured curtain, growing
```
**Feel:** intricate wave-fronts that fill wide, evenly, and *keep filling* (WORM's
growth is the engine). **Weakness:** patterned coverage leaves periodic gaps the
scan threads; amplitude can clip off-board.

### D — THE FENCE *(vertical rush / beat the scan)*
```
BLUEBOX                       Rect-sin · ↑   · 50%  · gr Low    picket of upward jets
+ BLUEBOX (copy)              Rect-sin · ↑   · 100% · gr Low    dense vertical comb
+ LOGICBOMB                   +Step · ↑↓     · 100% · gr Med    jets up AND drills down
```
**Feel:** races vertically toward top objectives before the top-down scan reaches
them; low growth keeps it a fast picket, not a slow flood. **Weakness:** thin
horizontally — easy for the scan to reclaim the flanks.

### E — THE GLITCH DECK *(glass-cannon gambler)*
```
TANGENT                       Tan · ←→       · 10%  · gr None   usually fizzles…
+ TANGENT (copy)              Tan · ←→       · 20%  · gr None   …occasionally an asymptote blowout paints half a sector
+ WORM                        …merged        · 45%  · gr High   the gamble: if TANGENT catches, High growth chaos-fills from it
```
**Feel:** high-variance; some runs the spine barely fires, some it detonates and the
High-growth graft turns a lucky asymptote into a sector-wide chaos-fill. **Weakness:**
literally unreliable — the deliberate bad-card build for players chasing a high.

**Stacking caps / diminishing returns:** probability caps at 100% (overflow wasted);
growth caps at ~60% reproduce (overflow wasted); direction caps at the 8 compass
headings; shape amplitude clips to the board. Past a cap, surplus cards should
convert to REACH or ROOT so a slot is never fully dead.

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

Tier 1 is the **four base aspects — shape + direction + probability + growth** — plus
a fixed emission rate. GROWTH is in the base ladder, not a later tier, because
calibration proved a growth-less packet *can't breach at all* (it caps ~40–57% then
dies). What Tier 1 ships is **undirected** growth: children seed onto a random
unburned neighbour. Deeper tiers add *new card aspects* and *shape* that growth, not
bigger numbers:

- **Tier 2 — rate:** cards that set emission cadence (ms) — flash-burn vs. slow tide.
- **Tier 3 — branch (`FORK`):** growth gains *aim*. Instead of a child onto a random
  neighbour, a firing emitter spawns full sub-**emitters** that inherit direction and
  carry a *split* of remaining reach (total conserved → no runaway on top of the
  Tier-1 MAX_EMBERS cap). Directed surface-area escalation — the power-tool version of
  baseline reproduce.
- **Tier 4 — hold / IQ:** `FIREWALL.C` hardens cells against the scan; the Ping-IQ
  ladder (Conduit → Homing → Leapfrog) routes embers around/over terrain.

The retired opcode-alphabet's good ideas survive here: `FORK` = directed branch (an
escalation of Tier-1 growth), `WALL`/`FIREWALL` = hold. FORK and hold are late-game
aspects; base growth is not.

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
far before guttering; a high-**GROWTH** fire that visibly **catches and multiplies** —
you watch new embers bud off the burn front and the coverage keep climbing after the
spray has landed, vs. a growth-less spray that throws once and stalls. This is a
`research/juice-model.md` requirement, not a finishing pass.

---

## 12. Design dials — resolved & still-open

**RESOLVED (2026-07-14):**
- **GROWTH = the 4th card aspect** (§3). Cards are now bundled **quads**
  `(shape, dir, prob, growth)`. Reproduce chance ADDS (cap ~60%), child spread-reach
  takes the MAX. GROWTH is core at Tier 1 (a growth-less packet can't breach — it
  caps ~40–57% then dies), so the "one aspect per tier" ladder puts base growth in the
  Tier-1 set and reserves *directed* growth (`FORK`) for Tier 3 (§8). Full 4-aspect
  weld is the accepted onboarding cost; the payoff is grail cards (`WORM`, `0DAY`)
  you draft *for* their growth.
- **REACH ≠ GROWTH — two separate budgets** (§4). REACH is the initial-spray pool
  (how far the first wave throws); GROWTH is the sustained-burn lever (whether it
  keeps reproducing after). REACH stays a **terminal meta-stat** (not a card aspect);
  GROWTH lives on the card. Width-vs-depth still emerges from ember count; the new
  spray-vs-sustain axis emerges from REACH-vs-GROWTH. Accumulator stays fully retired.
- **Reproduction is generative-but-gated, not a free flood** (§4). Unburned-neighbour
  rule + `MAX_EMBERS` cap + scan erosion bound it to an equilibrium; no child re-burns
  held ground, so it does not reopen the flood the MVP killed.
- **Direction-union vs. reach overshoot** — solved by the shared pool + `REACH_CAP`
  (§4): more embers just means each is shallower.
- **Probability random vs. pattern stacking** — randoms sum (cap 100), masks union,
  masks resolve first and randoms fill the remainder (§3).
- **Probability overflow** — wasted in Tier 1 (legible "bad stack"); a ROOT-shop
  OVERCLOCK later converts surplus density → REACH pool. (Growth overflow past its
  ~60% cap is wasted the same way.)

**STILL OPEN (need the `preview/beam.html` sandbox or a playtest):**
- `POOL` base size, the `POOL / emberCount` split curve (linear may over-punish wide
  decks — try sub-linear), and `REACH_CAP` — pure calibration.
- **GROWTH calibration:** the `reproduce` cap and the None/Low/Med/High → % mapping,
  `spreadReach` (child persistence), and how growth trades against REACH so a strong
  deck wins ~5/6 without reproduction becoming a free win. The sandbox exposes both
  `reproduce` and `spread reach` sliders for this pass.
- Default Tier-1 emission **rate**: start ~60–100 ms/cell, tuned so embers finish
  spreading by ~40% of the scan's descent (i.e. against scan speed, not in isolation).
- Slot curve (start 1, +1 per breach, cap ~3 in Tier 1 → 6+ later) and card-rarity
  weights (common 25% / single-dir / simple-shape / low-growth … legendary `0DAY`
  100% + high growth). An economy playtest, not a lone number.

## 13. Calibration sandbox (`preview/beam.html`)

Reuses the real `src/terrain.js` generator so tuned numbers port straight in.
Sliders: trigger column, shape set (with live Fourier sum preview), direction union,
merged probability, REACH pool + cap, **reproduce + spread reach** (the GROWTH
levers), emission rate, scan speed, reclaim/row, breach hold, win coverage. A live
**embers-alive** readout catches reproduction spikes. RESEED cycles sectors. Should
let us *watch* the six escalation-stack end states move against real terrain and tune
the caps.

**Prior validated split** (headless, 6 seeds, KERNEL): `COST = {OPEN 1, HARD 6,
WALL ∞, BUS −1, VAULT 2, HONEY 1}`; strong deck ~5/6 (peaks 73–91%), weak 6/6 (<19%),
lone strong loss = intended BRUTAL. Carry as starting numbers; the single-shot
emit-and-spread loop needs a fresh equilibrium pass.
