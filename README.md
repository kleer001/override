# OVERRIDE — design set

Working title. An idle deckbuilding intrusion battler: a 1983 teenage hacker
assembles programs out of real computing-history instructions, hits `EXEC`, and
*watches* them crack ever-deeper systems — bedroom terminal to the multiverse —
one breach ahead of the ICE tracing them back. WarGames as it should have been.

Built on the bones of [`finding_numbers`](https://github.com/kleer001/finding_numbers):
vanilla ES modules, no build step, a WebGL CRT filter over a character grid,
WebAudio, seeded `mulberry32` RNG. The CRT look, the character-grid renderer, and
the number-station audio bed carry forward.

## Contents

- [`GAME-SHEET.md`](GAME-SHEET.md) — the player-facing pitch: fantasy, core loop,
  cards, the seven tiers, runs, look & feel.
- [`SPEC-SHEET.md`](SPEC-SHEET.md) — the buildable spec: the 80×40 living-board
  cellular automaton, tier-1 numbers, card effects, data model, MVP build order.
- [`AUDIO-APPENDIX.md`](AUDIO-APPENDIX.md) — synth-vs-sample plan and a vetted
  CC0 / public-domain source list.

## Run the MVP

No build step. Serve the folder and open it (ES modules need HTTP, not `file://`):

```sh
cd override
python3 -m http.server 8099
# open http://localhost:8099/index.html
```

**Play (mouse / touch / keyboard):** build a 3-card program (tap hand cards),
tap **TARGET**, then tap one of the three sectors to assault — matching your
program's **heat** to the sector's terrain (KERNEL easy, SWAP a fortress).
Conquer all three to crack THE MACHINE. Keyboard also works: `1`–`5` load ·
`Backspace` undo · `Enter` target · `1`–`3` pick sector/draft · `Enter` continue.
Order is everything — adds early, multipliers late. Fits mobile (best in landscape).

**Strategy:** you see all three terrains and draw a blind loadout each node, so
plan the order — take the fortress when you draw a hot hand, save easy KERNEL for
a cold one.

**Test:** `node --test` (pure-logic suite: accumulator, win/lose, determinism,
CA well-formedness).

## Code layout (`src/`)

- `rng.js` — seeded mulberry32 (+ shuffle).
- `layout.js` — shared screen geometry (card/button/sector rects) used by render + input.
- `input.js` — unified pointer input (mouse + touch via Pointer Events), à la finding_numbers.
- `cards.js` — card defs + the accumulator interpreter (`evalProgram`).
- `terrain.js` — the machine: 3 sectors (KERNEL/IO.SYS/SWAP), layered terrain
  generation (noise + walls + bus lanes + BFS-depth vaults), and the heat-gated burn.
- `battle.js` — a node = conquering one sector; accumulator sets the fire's heat.
- `render.js` — composes the 80×40 monochrome screen buffer.
- `audio.js` — procedural WebAudio chiptune SFX (no samples).
- `main.js` — phase state machine (assemble → exec → result → draft), input, loop.

## Status

Design banked and a **playable Tier-1 vertical slice is built**: the 5-draw /
3-slot loop, the accumulator, the cellular-automata living board, procedural
audio, node advance, the draft, and persistent ROOT. Verified end-to-end in a
headless browser (assemble → breach) with a passing `node --test` suite.

Not yet built: Tiers 2–7, the DEFCON two-clock set piece, richer card pool,
the WebGL CRT shader port from `finding_numbers` (MVP uses a CSS approximation).
