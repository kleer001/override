# override

OVERRIDE — an idle deckbuilding intrusion battler (working title). A 1983 hacker
assembles programs out of real computing-history instructions, hits `EXEC`, and
*watches* them crack ever-deeper systems. Vanilla ES modules, no build step, an
80×40 monochrome character grid under a CRT filter, procedural WebAudio, seeded
`mulberry32` RNG. Run with `python3 -m http.server` (see README); test with
`node --test`.

## Important documents

Design and research live in Markdown at the repo root and in `research/`. Read the
relevant one before changing the system it covers:

- [`GAME-SHEET.md`](GAME-SHEET.md) / [`SPEC-SHEET.md`](SPEC-SHEET.md) — player pitch
  and the buildable spec (core loop, accumulator, living CA board, tiers).
- [`AUDIO-APPENDIX.md`](AUDIO-APPENDIX.md) — procedural-synth + CC0-sample plan.
- **[`research/juice-model.md`](research/juice-model.md)** — **game-feel / "juice"
  research and the build plan for the EXEC-phase spectacle. IMPORTANT: OVERRIDE is
  a watch-don't-click game, so juice is the payload of the loop, not polish —
  consult this before touching `src/juice.js`, EXEC-phase feedback, or any
  screen-shake / hit-stop / brightness work.**
- [`research/ember-model.md`](research/ember-model.md), [`research/tier2-design.md`](research/tier2-design.md),
  [`research/ROOT-shop-design.md`](research/ROOT-shop-design.md) — living design docs
  for the assault model, Tier 2, and the ROOT shop.

## What this is

A no-build-step browser game: `index.html` + ES modules in `src/`, a `preview/`
tuning sandbox, and pure-logic tests in `tests/` (`node --test`).

## Boundaries

- Don't touch `.scaffold.json` by hand.
- If this repo grows code, run `create_project --type python-app NEW_NAME` for a fresh scaffold rather than retrofitting this one.
- See `~/.claude/CLAUDE.md` for general guidance.
