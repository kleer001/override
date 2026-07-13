# Ping / Assault Model — living design doc

*Evolving spec for OVERRIDE's rewritten core mechanic. Supersedes the "free
omnidirectional flood" of the MVP. Status: in active design, constants un-tuned.*

Terminology: **embers → PINGS** (fits the '83 wardialer/phreak theme — you *ping*
systems). "Ember" may still appear in older code.

---

## 1. The core shift

Kill the free omnidirectional flood (`burnStep`: any burned cell infects every
neighbor each pass, gated only by `heat > resist`). Once one cell burned, you got
the whole reachable region for free — coverage was solved on ignition.

Replace with **finite pings**: metered packets of energy lobbed at the field,
each spending a budget to infect new ground, then dying.

**Locked decisions (2026-07-12):**
- **Terrain resistance is a COST, not a gate** — every cell a ping infects spends
  energy. The heat-6 wall dissolves into a smooth curve.
- **Rate-based, not per-pass counts** — pings arrive at a RATE (pings/min), which
  lets the enemy **claw cells back** between pings (see §5). This revives ICE as
  an active force.
- **Accumulator (the POWER deck) = energy per ping.** Sequencing still rules; more
  fuel = deeper burn per ping.

---

## 2. Spread algorithm (per ping)

```
spend = E                          // E = this pass's accumulator
frontier = { landing cell }
while spend > 0 and frontier has an affordable, allowed, unburned neighbor:
    pick a neighbor c per the GROWTH rule (random / directional / homing)
    spend -= COST[c.terrain]
    burn c ; add c to frontier
```

Burned cells persist; each volley is a fresh finite packet. Energy is spent only
on **new** ground (see §3 conduit rule).

**COST table** (decoupled from the old RESIST gate — OPEN must cost ≥1 or the free
flood returns):

| terrain | COST | note |
|---------|------|------|
| OPEN | 1 | baseline |
| HONEY | 1 | cheap; random placement means you *can't* avoid tripping it |
| VAULT | 2 | toll for the prize |
| HARD | 6 | hot pings afford a few; cold pings bounce — a curve, not a wall |
| BUS | −1 | refund → pings rip down bus lines (accelerant) |
| WALL | ∞ | unaffordable firebreak |

---

## 3. Ping-IQ ladder — behavior at a CONQUERED cell (BANKED)

A ping's routing intelligence. **A behavior/option upgrade axis** (fits the
"unlock options, not raw stats" shop philosophy). Base = Tier 1.

| Tier | Behavior at a conquered cell | Feel / growth shape |
|------|------------------------------|---------------------|
| 0 — **Blocked** | can't enter; stalls when boxed in by own territory | *reject — punishes success* |
| 1 — **Conduit** *(base)* | free traverse, no cost, no re-infect; energy flows to the frontier | broad, even, diffuse stain |
| 2 — **Homing** *(upgrade)* | prefers unburned neighbors; crosses burned only when forced | directed, concentrated pushes |
| 3 — **Leapfrog** *(top)* | jumps *over* a burned cell to the unburned cell beyond, pays destination only | surgical strikes into pockets; **can hop over an unburned honeypot** (buys out the trace penalty) |

Why Conduit is the mandatory base: by pass 3+ a volley lands inside your own
burned mass; if crossing conquered cells cost energy, every volley weakens as you
succeed and coverage stalls. Free pass-through makes `E ≈ new cells claimed`.

---

## 4. Growth direction — the SPREAD dimension

Alongside random growth, pings can be **directionally biased**: `↑` up-only,
`↕` up+down, `↓` down-only, `←`, `→`, `↔`, or random (default). Controls which
neighbors are "allowed" in the spread loop. Composes with the IQ ladder (a Homing
`→` ping drives a concentrated rightward salient). This is deck content (§6).

---

## 5. Enemy clawback = the TRACE SWEEP (revives ICE)

Because pings arrive at a **rate**, the system claws cells back between them. The
battle is an equilibrium: your pings *add* cells, the enemy sweep *removes* them.

**The mechanic — a scan line (decided 2026-07-12):** a horizontal line descends
**top-to-bottom** across the field; as it sweeps it **reclaims a set number of
burned cells** it crosses (a per-sweep budget). Simple constant waves to begin.

**Difficulty scaling (higher tiers):**
- **Onset** — low tier grants a grace delay; high tier the sweep **starts
  immediately on ignition** ("upon contact").
- **Speed** — low tier is a slow constant descent; high tier **accelerates**
  (faster and faster as the run goes).

Thematically this *is* the WarGames "they're tracing the call" — a CRT scan line
wiping your worm, which reads perfectly as a moving bar on the character grid.

**Elegant symmetry:** your ping = a finite energy packet that *adds* cells; the
sweep = a finite reclaim budget that *removes* cells. Same currency (cells),
opposing flows — a clean, tunable tug-of-war. Maps to the spec's Tier-3 "traced
back, you bleed": you literally bleed cells to the descending line.

### Unify the sweep with the TRACEBACK clock (proposed)

We need a discovery deadline: a **TRACEBACK countdown** → player discovered → run
ends. Rather than a separate meter, **make the scan line the clock**: each full
top-to-bottom sweep advances traceback one tick; after **K sweeps** you're
discovered, run over. One visual (the descending line), two pressures (ground
loss + the clock). This generalizes/replaces the current `LOCKDOWN = 10 passes`,
and honeypots feed it as they do today (burning HONEY spikes trace).

Reclaim target — a dial: reclaimed cells go to **neutral** (retake at normal cost,
simple) or to **ICE** (border *hardens*, re-burning contested ground costs more —
a real front). Start neutral, harden later.

---

## 6. THE MULTI-DECK MODEL (emerging — the big idea)

The assault is a **program composed across several independent instruction
streams** — one deck per programmable aspect. Each is its own draw/assemble
surface, like registers on the machine:

| Deck | Programs… | Sets | Status |
|------|-----------|------|--------|
| **POWER** | the accumulator (BRUTE, XOR, NOP, GOTO…) | **energy per ping** | built (MVP) |
| **ASSAULT** | placement — how pings hit | random → center-of-mass → grid → deep → aimed | new (absorbs the old targeting minigame + character patterns) |
| **TRANSFER** | rhythm — how often pings hit (rate, bursts, drips, ramps — all "how often") | ping timing | new |
| **GROWTH** | spread shape — direction + IQ (§3,§4) | which cells a ping takes | new |

Separation of concerns: POWER = how hard, ASSAULT = where, TRANSFER = how often,
GROWTH = which way. Clean, composable, and each deck is a fresh source of cards
from the "dawn of computing" name pipeline.

**Risk to manage:** four decks is a lot for a "write it then watch" game. Ship
staged (§7), not all at once — onboarding and the 80×40 HUD layout both cap how
much you can expose early.

---

## 7. Decks ARE the progression (ties to the 7-tier climb)

This answers the original "where are the levels / what's missing for progression"
question. Each fractal tier can **introduce one new deck** — the spec's "one new
subsystem per tier," made concrete:

- **Tier 1 — THE MACHINE:** POWER deck only. Assault=random, transfer=steady,
  growth=random (fixed defaults). *(the current MVP, minus the free flood)*
- **Tier 2 — THE LAN:** unlock **ASSAULT** deck — now you program *where* pings land.
- **Tier 3 — THE CORP:** unlock **TRANSFER** deck — program the rhythm; enemy
  clawback (§5) bites hard here = the spec's "you bleed."
- **Tier 4+ — THE GRID…:** unlock **GROWTH** deck (direction + IQ), then
  rule-editing at the substrate tier.

So a "new run at a deeper tier" literally hands the player a new programmable
register. Progression = more decks + more cards per deck, not bigger numbers.

---

## 8. Open dials / questions

- ~~TRANSFER's second axis~~ — resolved: "how often" covers all rhythm; TRANSFER
  is a single-axis deck (different cards = different rhythms).
- Ping-rate units: real-time pings/min vs pings-per-power-pass.
- Unify sweep + traceback into one scan-line clock (§5) vs two separate meters?
  Leaning unified. If unified: how many sweeps K to discovery per tier?
- Reclaim target: neutral (simple) vs ICE (hardening border). Start neutral.
- Win = momentary coverage ≥ 50% (breach the instant you touch it) vs held 50%?
  Leaning momentary — erosion already makes reaching it hard.
- How many decks in the first playable build past POWER-only — just ASSAULT next,
  or ASSAULT+TRANSFER together?
- INTERRUPT's new job (was +heat): freeze the sweep for a beat? +energy?
- `E = acc` scale, COST numbers, sweep budget/speed need a `preview/` calibration.
