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

## Status

Design locked (banked): format, seven fractal tiers + fail skins, the 5-draw /
3-slot loop, dawn-of-computing instruction cards on a CPU accumulator, the
cellular-automata living board, the audio plan, and the 80×40 grid. Next step is
the MVP vertical slice (Tier 1).
