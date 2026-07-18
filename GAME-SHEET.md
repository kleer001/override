# GAME SHEET — *OVERRIDE* (working title)

**Logline.** A 1983 teenage hacker assembles programs out of real
computing-history instructions, hits `EXEC`, and *watches* them crack ever-deeper
systems — bedroom terminal to the multiverse — one breach ahead of the ICE
tracing them back.

**The fantasy.** You don't type the hack move-by-move. You *write* it, then lean
back and watch your little program either sing or stall against the machine's
defenses. WarGames as it should have been — nuclear codes on the line, the free
world, blah blah.

---

## The core loop (one screen)

*Settled in [`research/lsystem-growth.md`](research/lsystem-growth.md) — the "Beam-Card
Model," with growth now a deterministic **L-system turtle**. No ASSEMBLE / EXEC /
RESULT cutaways; it's one screen, one shot.*

1. **Arrange** — slot your cards into your earned slots, top to bottom. They form an
   ordered **connector chain**: each card is a little program, and each card's
   connector governs how the *next* card couples onto it. **Order matters** — a fast
   scout leading a slow filler plays nothing like the reverse.
2. **Aim & fire** — a turret slides along the bottom edge; tap once to fire a
   single packet at the column of your choice. That's the only positional call
   in the whole battle.
3. **Watch** — the packet anchors one **crawler** per card on the spine; each crawls
   the memory as a tiny **turtle program** — advancing, turning, hugging walls,
   threading gaps, and **forking** into fresh crawlers so the burn bushes out and
   fills — racking up coverage while a top-down **trace scan** bears down. Hold
   **≥50% coverage** through the breach timer → **breach**, loot a card, earn a slot,
   advance. Scan reaches the bottom first → traced, **fail skin**, the run ends, bank
   meta, go again.

Fully idle after the fire: arrange, slide, fire, watch. No clicking once the
packet is away.

---

## Cards = the dawn of computing

Every card is a real machine instruction or hacking-history artifact — pirated,
forbidden warez traded on a BBS. Each card is a **complete, self-contained
program** — a little turtle that crawls the memory and burns a path — bundling
three channels:

- **grammar** — a string of `F` (advance & burn), `L`/`R` (turn 45°), `K` (fork a
  new crawler). This is the card's *shape and its aim in one*: the way it wiggles,
  and — since a turn-prefix points it before it runs — which direction it heads.
  Run on a loop, a tiny grammar draws a large emergent form (a spiral, a zig-zag,
  a bushing fork-tree).
- **pace** — how fast it crawls (ticks per step). The only "how much" knob, and it's
  a *rate*, not a quantity — fast crawlers punch a path, slow ones trickle into the
  gaps left behind.
- **connector** — how the **next** card in the chain couples to this one:
  `SCATTER` (the next card launches on its own anchor), `SPROUT` (it grafts off this
  crawler's dead tip and relays deeper), or `OVERLAY` (its grammar splices onto this
  one — one crawler running both programs).

Slotting several cards reads the deck **top-to-bottom as an ordered chain** —
`card₁ →[connector]→ card₂ →[connector]→ card₃` — the "assembling a program" fiction
made literal. There's **no arithmetic to merge** (no probability to add, no reach to
sum), and **order matters, non-monotonically**: a card's connector couples it to
what comes *after*, so `A→B` differs from `B→A`. **Area is earned by fork (`K`)
density** — a forkless runner stays thin and loses; a forker bushes out and fills.

Examples: `SCRIPT.COM` (the starter warez — `FFFFFFFFFF`, a thin forkless runner),
`FORK.COM` (`FFFFKFFFFF` — forks once a loop and sprouts the chain onward), `WORM`
(`FFKFFKFFKF` — the Morris spread, forks hard), `HARMONIC`/`PHREAK` (tight forking
coilers; `HARMONIC` splices the next card's program onto its own via `OVERLAY`),
`LOGICBOMB` (`RRRRFFFFKF` — the `RRRR` turns it to face *down* and drill the core),
`NOP.SLED` (a lone `F` — inert alone, but the next card rides its sprouted tips; bad
on purpose), `0DAY` (the legendary grail: `FKFKFKFKFK` — fast, maximal forks). The
lore is an endless, free card-name pipeline: LISP recursion, the Morris Worm,
Turing's Bombe, Ken Thompson's compiler backdoor, blue boxes, buffer overflows.

**Why the chain matters (worked example):**
`SCRIPT.COM` alone (`FFFFFFFFFF`) is a forkless runner — it snakes a thin trail and
usually can't rake 50% before the scan lands. Chain it into `FORK.COM`
(`FFFFKFFFFF`) and the fork density roughly doubles the burn — but *which order* you
chain them, and whether the connector is `SCATTER` vs `SPROUT`, changes where the
second program takes root. The trade-off isn't a stat to stack; it's the *shape* you
drafted and the *sequence* you built. A gorgeous grammar can arrive welded to a
sluggish pace or an awkward connector. Some cards are bad on purpose.

---

## A run

Roguelike climb (Balatro / Slay-the-Spire shape): clear nodes, loot a card and
earn a slot between battles, zoom out a whole tier when a system falls. **One
lost battle ends the run.** A persistent meta-currency (**ROOT**) survives —
spend it between runs at the black-market BBS (the ROOT shop) on permanent
unlocks (extra forbidden cards, more terminal-memory slots, lower aggression,
new card types, retry-from-a-deeper-tier).

---

## The seven fractal tiers

The geography is self-similar: each tier is the same battle at a bigger scale,
and winning one collapses that whole system into a single node on the tier above.
Zoom out = ascend a layer (the prestige structure). Each tier introduces one new
subsystem, not just bigger numbers.

| # | Tier | Scale | New subsystem it teaches | Fail skin (flavor only) |
|---|------|-------|--------------------------|-------------------------|
| 1 | THE MACHINE   | one computer            | base board / bundled-beam merge | terminal burns out          |
| 2 | THE LAN       | homes, BBSes            | multiple nodes — pick targets | grounded for a week         |
| 3 | THE CORP      | company mainframes      | heat — traced back, you bleed | dad loses his job           |
| 4 | THE GRID      | NORAD / the WOPR        | the DEFCON two-clock: stall vs. crack | jail time           |
| 5 | THE WORLD     | the whole net           | other agents — rival hackers act | national manhunt         |
| 6 | THE SUBSTRATE | reality-as-computer     | rule-editing cards            | redacted from every record  |
| 7 | THE MULTIVERSE| parallel timelines      | NG+ / infinity: many boards, meta-multipliers | you were never born |

The narrative engine that justifies seven layers is paranoid escalation: you
crack the launch codes at Tier 4 — the "expected" ending, the WarGames climax —
and learn NORAD is a *front*; the real codes live one layer up, and up, and up.
The "only winning move is not to play" resolves at the top: every timeline runs
the same game, and the actual win is *stopping the machine*.

The fail skins double as a depth gauge — the consequence tells you how deep you
got. Pure comedy, zero real stakes.

Every card is forbidden, pirated software; your terminal-memory slots are the
RAM you've expanded by hacking; the seven tiers are the fractal climb from a
nobody script kiddie on a bedroom terminal to the hacker the FBI is quietly
building a case against.

---

## Jack-in characters (run-start meta)

*(Planned layer — not in the current Tier-1 slice, which drops you straight into the
loadout with a straight-column spine. See `SPEC-SHEET.md`.)*

You pick *how you break in* at the start of a run — a character with an
upgrade tree, defined by the **shape of the beam** its turret draws when it
fires:

- **War-dialer** — a thin, precise lance. Small surface area, but every ember
  counts. Upgrades: pick-your-entry, hotter first ember.
- **Shotgunner** — a wide spray off the spine; big initial surface area, but
  scattershot (may hit hard terrain or a honeypot). Upgrades: +embers, wider
  spread, tighter grouping.
- **Catapultist** — a deep lob that plants the spine far from the turret;
  gamble for depth (lands on rich open ground, or in a dead-end). Upgrades: aim
  assist, deeper throw.

Beam/trail shapes are prototyped in `preview/` — see the terrain screenshots.

## Look & feel

- Monochrome amber-phosphor, an **80×40 character grid**, WebGL CRT filter — all
  lifted from `finding_numbers`. This is the **signature baseline**, not a ceiling:
  the grid is the substrate, and modern graphical juice (real particles, bloom,
  screen-shake, deliberate color flashes, free-floating pop-text) layers on top for
  the payoff beats — see [`research/juice-model.md`](research/juice-model.md).
- The board is alive: a cellular-automata territory war fills ~82% of the screen,
  churning every tick (see the spec sheet). Numbers going up = a stain spreading.
- Chunky procedural bleeps + a handful of CC0 electromechanical textures + a
  number-station ambient bed (see the audio appendix).

---

## Design pillars (do not lose these)

1. **You write it, then watch it.** The joy is spectacle, not clicking.
2. **The deck is turtle programs you chain.** Every card is a complete little
   program — grammar (shape + aim), pace, and a connector — that crawls the memory
   as a deterministic L-system turtle. Slotting cards builds an *ordered connector
   chain*, not a merged number; area is earned by fork density. The skill is
   scarce-slot allocation, sequencing the chain, and accepting bundled trade-offs —
   some cards are bad on purpose.
3. **The number is visible.** Crack % is territory on a living field, never a
   bare bar.
4. **Fractal reuse.** One battle engine, seven reskins + one new rule each —
   maximum perceived depth, minimum distinct systems (kind to a solo dev).
5. **Free assets only.** Procedural audio + CC0/PD samples; no licensing debt.
