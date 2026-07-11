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

**Play:** `1`–`5` load a card into the next program slot · `Backspace` undo ·
`Enter` runs `EXEC` (then watch) · `Enter` again to continue past a result.
Order is everything — adds early, multipliers late.

**Test:** `node --test` (pure-logic suite: accumulator, win/lose, determinism,
CA well-formedness).

## Code layout (`src/`)

- `rng.js` — seeded mulberry32 (+ shuffle).
- `cards.js` — card defs + the accumulator interpreter (`evalProgram`).
- `board.js` — the 3-faction cellular automaton (worm / ice / neutral, firewalls, links).
- `battle.js` — pass resolution: CRACK meter (accumulator-driven win) + board spectacle.
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
