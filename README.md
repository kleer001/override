# OVERRIDE — design set

Working title. An idle deckbuilding intrusion battler: a 1983 teenage hacker
assembles programs out of real computing-history instructions, hits `EXEC`, and
*watches* them crack ever-deeper systems — bedroom terminal to the multiverse —
one breach ahead of the ICE tracing them back. WarGames as it should have been.

Vanilla ES modules, no build step, a WebGL CRT filter over a character grid,
WebAudio, seeded `mulberry32` RNG.

## ▶ Play

**[Play OVERRIDE in your browser →](https://kleer001.github.io/override/)**

## Run the MVP

No build step. Serve the folder and open it (ES modules need HTTP, not `file://`):

```sh
cd override
python3 -m http.server 8099
# open http://localhost:8099/index.html
```

**Play (mouse / touch / keyboard):** pick a **jack-in character** (sets your
ignition style), build a 3-card program (tap hand cards), tap **TARGET**, tap a
sector — matching your program's **heat** to the terrain — then **aim your
jack-in**: an oscillating gnomon sweeps for X (tap/SPACE to lock), then for Y;
your ember(s) land at the mark and the burn begins. Breach ≥50% of a sector to
take it; conquer all three to crack THE MACHINE. Keys: `1`–`5` load · `Backspace`
undo · `Enter` target · `1`–`3` pick character/sector/draft · `SPACE` lock aim ·
`Enter` continue. Order is everything — adds early, multipliers late.

**Strategy:** you see all three terrains and draw a blind loadout each node, so
plan the order — take the fortress when you draw a hot hand, save easy KERNEL for
a cold one.

**Test:** `node --test` (pure-logic suite: accumulator, win/lose, determinism,
CA well-formedness).

## Status

Design banked and a **playable Tier-1 vertical slice is built**: the 5-draw /
3-slot loop, the accumulator, the cellular-automata living board, procedural
audio, node advance, the draft, and persistent ROOT. Verified end-to-end in a
headless browser (assemble → breach) with a passing `node --test` suite.

Not yet built: Tiers 2–7, the DEFCON two-clock set piece, richer card pool,
the WebGL CRT shader port (MVP uses a CSS approximation).
