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

## Simulation vs. presentation — keep the seam clean

The codebase has two layers, and the whole thing stays sane only while they're
kept apart. Respect the seam when you edit here.

- **Simulation (the truth).** `battle.js`, `terrain.js`, `cards.js`, `rng.js`,
  `shop.js` — pure logic. Deterministic from the seeded `mulberry32` RNG, no
  timing, no audio, no DOM. A whole battle resolves *instantly* here: `runVolley`
  computes a volley start-to-finish in one synchronous call (this is what
  `node --test` drives). The outcome of an EXEC is fully decided the moment you
  hit it — the accumulator is one `evalProgram` number, the marks are one RNG
  walk, win/lose falls out of the math. **Nothing here is "computed over time."**

- **Presentation / drama (the show).** `main.js` (the EXEC animation loop),
  `render.js` (state → 80×40 buffer), `juice.js`, `audio.js`, `shake.js` — the
  playhead stepping through instructions, the gnomon gliding + locking, embers
  blooming cell-by-cell, sleeps, sfx, shake, flashes. This layer **reveals** the
  already-decided result slowly and dramatically. It is theater, not arithmetic.

**The load-bearing invariant: the drama must never change the outcome.** The
animated path and the instant `runVolley` path must always agree. So if a
presentation helper needs to peek ahead (e.g. `planVolley`, which precomputes a
whole volley's marks so the gnomon can aim through them before the show plays), it
must be **outcome-neutral**: draw the RNG in the same order and roll back any
state it touched, so a test resolving the battle instantly and a player watching
it bloom get identical results. When in doubt, resolve in the sim layer and let
the drama layer only *read* and *reveal* — never decide.

Corollary for editors: game *rules* go in the sim layer (and get a `node --test`
case); game *feel* goes in the drama layer (see `research/juice-model.md`). Don't
leak `setTimeout`/`sfx`/`draw()` into the sim modules, and don't let `render.js`
mutate state — it's a pure view.

## Boundaries

- Don't touch `.scaffold.json` by hand.
- If this repo grows code, run `create_project --type python-app NEW_NAME` for a fresh scaffold rather than retrofitting this one.
- See `~/.claude/CLAUDE.md` for general guidance.
