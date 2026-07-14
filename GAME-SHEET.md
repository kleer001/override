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

*Settled in [`research/ember-model.md`](research/ember-model.md) — the "Beam-Card
Model." No ASSEMBLE / EXEC / RESULT cutaways; it's one screen, one shot.*

1. **Arrange** — slot your cards into your earned slots. They **merge** into one
   beam: probability adds, direction unions, shape sums. Order doesn't matter —
   which cards you have slots for does.
2. **Aim & fire** — a turret slides along the bottom edge; tap once to fire a
   single packet at the column of your choice. That's the only positional call
   in the whole battle.
3. **Watch** — the packet draws a beam spine up the field; embers emit off it
   and spread outward, burning terrain and racking up coverage while a top-down
   **trace scan** bears down. Hold **≥50% coverage** through the breach timer →
   **breach**, loot a card, earn a slot, advance. Scan reaches the bottom first
   → traced, **fail skin**, the run ends, bank meta, go again.

Fully idle after the fire: arrange, slide, fire, watch. No clicking once the
packet is away.

---

## Cards = the dawn of computing

Every card is a real machine instruction or hacking-history artifact — pirated,
forbidden warez traded on a BBS. Unlike an accumulator, each card is a
**complete, self-contained beam**: it bundles a shape (the spine's curve), a
direction (which way embers emit off the spine), and a probability (which
spine cells fire). Playing several cards **merges** them into one beam —
probability adds (capped at 100%), direction unions, shape sums like harmonics
building a waveform. **Order doesn't matter; which cards you have slots for
does.**

Examples: `SCRIPT.COM` (the starter forbidden program — Linear, Left, 25%),
`WORM` (a wide, thin sine spread — the Morris Worm), `HARMONIC`/`PHREAK`
(stacking sine harmonics into a literal Fourier synthesis), `NOP.SLED` (all
probability, no direction — inert alone, a deliberately bad card), `FORK()`
(spawn a second beam spine), `0DAY` (the legendary grail: Sine, both
directions, 100%). The lore is an endless, free card-name pipeline: LISP
recursion, the Morris Worm, Turing's Bombe, Ken Thompson's compiler backdoor,
blue boxes, buffer overflows.

**Why the bundle matters (worked example):**
`SCRIPT.COM` alone = Linear · Left · 25% — a thin, unreliable trickle.
`SCRIPT.COM` + a second copy of `SCRIPT.COM` **merges** to Linear · Left ·
**50%** — same shape and direction, but probability stacks. Two cards, one
beam, twice the hit rate. There's no order to choose — the trade-off is
entirely which cards you have slots for: a gorgeous shape can arrive welded to
a bad direction or a starved probability. Some cards are bad on purpose.

---

## A run

Roguelike climb (Balatro / Slay-the-Spire shape): clear nodes, loot a card and
earn a slot between battles, zoom out a whole tier when a system falls. **One
lost battle ends the run.** A persistent meta-currency (**ROOT**) survives —
spend it between runs at the black-market BBS (the ROOT shop) on permanent
unlocks (extra forbidden cards, more terminal-memory slots, deeper REACH,
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

You pick *how you break in* at the start of a run — a character with an
upgrade tree, defined by the **shape of the beam** its turret draws when it
fires:

- **War-dialer** — a thin, precise lance. Small surface area, but every ember
  counts. Upgrades: pick-your-entry, hotter first ember.
- **Shotgunner** — a wide spray off the spine; big initial surface area, but
  scattershot (may hit hard terrain or a honeypot). Upgrades: +embers, wider
  spread, tighter grouping.
- **Catapultist** — a deep lob that plants the spine far from the turret;
  gamble for depth (lands near a vault, or in a dead-end). Upgrades: aim
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
2. **The deck is bundled triples.** Every card is a complete beam — shape,
   direction, and probability welded together. Merging cards adds probability,
   unions direction, and sums shape like Fourier harmonics; order is
   commutative. The skill is scarce-slot allocation and accepting bundled
   trade-offs — some cards are bad on purpose.
3. **The number is visible.** Crack % is territory on a living field, never a
   bare bar.
4. **Fractal reuse.** One battle engine, seven reskins + one new rule each —
   maximum perceived depth, minimum distinct systems (kind to a solo dev).
5. **Free assets only.** Procedural audio + CC0/PD samples; no licensing debt.
