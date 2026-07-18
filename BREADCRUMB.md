fresh

## Summary

OVERRIDE (1983 hacker idle deckbuilder, vanilla ES modules, no build). This session
shipped the **tutorial → collision-detection progression** and several balance/roster
reworks on top of the L-system beam model. All work is **committed and pushed to
origin/main** — working tree is clean. No active task in flight; the items below are
open follow-ups worth a future pass, not unfinished work.

Recent commits (newest first):
- `4f46899` feat: tutorial + collision-detection progression (survive → conquer)
- `f49297a` feat(growth): 3-connector algebra, live SPROUT, base-10 grammars, rescaled aggro
- `d2654ec` fix(cards): tame FORK.COM to one fork per loop
- `35185e8` feat(growth): one anchor strand per card; cut seeds/shapes; add TEST bench

## Todos

### Parallel
- [ ] #1 Re-sweep the DDA/aggro band + card cost ladder. Reward now pays **peak**
  coverage (was final), so it pays a bit more than the `scratchpad/econ2.mjs` sim
  assumed — the 200/400/600 card ladder is a touch generous. Aggro band is [0.20,0.65],
  DDA settles ~0.42. Use `preview/beam-balance.js` + a fresh headless econ sim.
- [ ] #2 Sync the lagging docs (`GAME-SHEET.md`, `SPEC-SHEET.md`, `research/ROOT-shop-design.md`)
  to the current model — tutorial/author phase, collision-detection pivot, coverage-%
  economy, 3-connector set. `research/lsystem-growth.md` is already current (§3/§5/§11).
- [ ] #3 (optional/decide) Guaranteed pre-CD stumble: user mused about forcing "at least
  one real fail" before collision detection. Survival runs are deterministic (a working
  formula always survives the blank board), so cost alone can't force a fail. Would need a
  mechanic change (escalating survival-scan speed per run, or a coverage floor on survival).
  Not started — user did not commit to it.
- [ ] #4 (housekeeping) `SCRIPT.COM` stays in `src/cards.js` only as the balance-harness /
  test reference deck; the game no longer hands it out. Decide whether to keep it as a
  reference or fold the harness onto authored/real cards.

## Context

**The one switch:** `hasCollision()` (localStorage `override.collision`) drives turtle
behavior, win mode, AND board terrain — pre/post-CD share every code path. `sim.collision`
false = literal Tron turtle (crash on edge/wall/own-trail) + survival win + blank board;
true = smart reroute + coverage win + walled board.

**Progression arc:** first run → `author` phase (F/L/R buttons build a grammar, literal
turtle draws it live, RUN = survival battle). Survive → keep the card (persisted by grammar
under id `PROG.COM` via `cardFromGrammar`, localStorage `override.authored`) + flat 15 ROOT.
Lean start = 0 ROOT. Collision detection costs **35** (tutorial pays 15, so it takes a
couple real survival levels to bank it — the shop-timing gate is handled by price, not by
delaying the shop). Buying CD flips survive→conquer: walled boards, coverage win (50%),
terrain ceiling keyed to **conquers** (coverage wins only, not survival wins) so first
walled block is EASY.

**Economy:** reward every run, no bank penalty. Coverage runs pay `coverageReward(peakCov,
aggro, base)` = peak% × (aggro/base). Survival runs pay flat `SURVIVAL_REWARD=15`. Card
ladder: FORK 10, COLLISION DETECTION 35, ROOTKIT/PAYLOAD/0DAY 200/400/600.

**Connector algebra (prior commit, now settled):** 3 independent primitives — SCATTER
(parallel launch), SPROUT (ring-2 graft off trapped tips — was inert, now fixed), OVERLAY
(grammar splice, folded in `buildChain`). BRANCH cut. Grammars run base-10.

**Key files:** `src/beam.js` (VM: `advance` two modes, survival resolution in `stepSim`,
`peakCov`/`cellsBurned`), `src/battle.js` (`beamParams` collision branch, `blankMachine`,
`createTestSim`, `coverageReward`, `SURVIVAL_*`), `src/main.js` (author phase funcs,
`showResult`/`advance` routing, persistence helpers), `src/cards.js` (`cardFromGrammar`,
`AUTHORED_ID`), `src/render.js` (author field/gutter/tray, cleaned title), `src/shop.js`
(collision `upgrade` kind), `src/layout.js` (AUTHOR_SYMS buttons). Scratch sims in the
session scratchpad dir (tron*.mjs, econ*.mjs, sweep*.mjs).

**Gotchas:** author state (grammar/preview/board burns) must reset between attempts —
`newAuthor` clears grammar, `refreshAuthorPreview` always builds a fresh sim, `authorRun`
clears `run.machine.burned`. `cardFromGrammar` MUST carry a `desc` (gutter explainer wraps
it). The green title-pixel a user reported is NOT in the render (0 green pixels in
screenshots) — it's their display. Run: `python3 -m http.server` then drive; test:
`node --test` (45 tests). Browser-drive via Playwright MCP with `?v=N` cache-bust.

## Next Step

Nothing is mid-flight. If resuming to improve balance, start with **#1** (re-sweep the
aggro band + cost ladder now that rewards use peak coverage). Otherwise pick up whatever
the user next directs.

/home/menser/Dropbox/ai/code/override
