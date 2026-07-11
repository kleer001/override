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

## The core loop (three beats)

1. **ASSEMBLE** — Draw **5** instruction cards, slot **3** into an execution
   sequence. Order is everything.
2. **EXEC** — The sequence auto-runs on a loop, left→right, hands-off. Your
   intrusion spreads across the board, crack % climbs, defenders hold, ICE pushes
   back, the lockdown clock ticks. You watch.
3. **RESULT** — Crack the target before you're overrun → **breach**, draft a card,
   advance. Get overrun or time out → **fail skin**, the run ends, bank meta, go
   again.

Fully idle: assemble, watch, result. No clicking during EXEC in the base game.

---

## Cards = the dawn of computing

Every card is a real machine instruction or hacking-history artifact, and they
execute on a running **accumulator** exactly like a CPU — so *sequence is the
strategy*. Adds early build the value; multipliers late detonate it.

Examples: `BRUTE +3`, `XOR ×2`, `NOP` (sled synergy), `GOTO ↑` (re-run the prior
card), `FORK()` (spawn a second front), `INTERRUPT` (stun the enemy), `2600Hz`
(phreak the line — draw cards), `PUNCHCARD` (one-shot bomb). The lore is an
endless, free card-name pipeline: LISP recursion, the Morris Worm, Turing's
Bombe, Ken Thompson's compiler backdoor, blue boxes, buffer overflows.

**Why order matters (worked example):**
`[BRUTE+3][BRUTE+3][XOR×2]` → (0+3+3)×2 = **12** per pass.
`[XOR×2][BRUTE+3][BRUTE+3]` → ((0×2)+3+3) = **6** per pass.
Same three cards, half the result.

---

## A run

Roguelike climb (Balatro / Slay-the-Spire shape): clear nodes, draft one card
between battles, zoom out a whole tier when a system falls. **One lost battle
ends the run.** A persistent meta-currency (**ROOT**) survives — spend it between
runs on permanent unlocks (extra starting cards, bigger hand, new card types,
retry-from-a-deeper-tier).

---

## The seven fractal tiers

The geography is self-similar: each tier is the same battle at a bigger scale,
and winning one collapses that whole system into a single node on the tier above.
Zoom out = ascend a layer (the prestige structure). Each tier introduces one new
subsystem, not just bigger numbers.

| # | Tier | Scale | New subsystem it teaches | Fail skin (flavor only) |
|---|------|-------|--------------------------|-------------------------|
| 1 | THE MACHINE   | one computer            | base board / accumulator      | terminal burns out          |
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

---

## Look & feel

- Monochrome amber-phosphor, an **80×40 character grid**, WebGL CRT filter — all
  lifted from `finding_numbers`.
- The board is alive: a cellular-automata territory war fills ~82% of the screen,
  churning every tick (see the spec sheet). Numbers going up = a stain spreading.
- Chunky procedural bleeps + a handful of CC0 electromechanical textures + a
  number-station ambient bed (see the audio appendix).

---

## Design pillars (do not lose these)

1. **You write it, then watch it.** The joy is spectacle, not clicking.
2. **Order is the game.** The accumulator makes sequencing the core skill.
3. **The number is visible.** Crack % is territory on a living field, never a
   bare bar.
4. **Fractal reuse.** One battle engine, seven reskins + one new rule each —
   maximum perceived depth, minimum distinct systems (kind to a solo dev).
5. **Free assets only.** Procedural audio + CC0/PD samples; no licensing debt.
