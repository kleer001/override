# ROOT Shop — Meta-Progression Design Notes

*Research memo informing OVERRIDE's between-runs shop (spends the persistent
`ROOT` currency). Genre survey + concrete recommendation. 2026-07-12.*

---

## Provenance note

This memo blends one **hard-sourced** principle with **established genre
knowledge**. A deep-research pass (fan-out web search + adversarial verification)
only *formally confirmed* claims from a single game-design blog — it rated fandom
wikis and forum threads "unreliable" and killed the rest, not because those facts
are wrong but because it couldn't pin them to an authoritative citation. The one
verified anchor is flagged below; treat the survey table as designer knowledge,
not citations.

---

## The anchor (hard-sourced)

**Slay the Spire's meta-progression is unlock-only: it expands the *pool of
options*, never grants numeric power.** Run depth earns XP whether you win or
lose; XP unlocks new cards/relics into future runs. Its only numeric meta-system
(Ascension) *raises difficulty*, not power. This is the most-respected meta
design in the genre and it dodges the "grind until you win" trap by making
permanence mean *more choices*, not *bigger numbers*.
Sources: cjleo.com "On Slay the Spire… Making Games More Loser-Friendly" (2024) +
slaythespire.wiki.gg corroboration.

Second sourced point: **rewarding losing runs is good design** — a short run
should still feel like progress. OVERRIDE already keeps ~50% ROOT on death, which
aligns. Keep it; surface ROOT-earned prominently on the fail screen.

---

## Genre survey (designer knowledge, not formally verified)

| Game | What's purchasable | Persistent? | Model |
|------|-------------------|-------------|-------|
| **Slay the Spire** | nothing with money; unlocks by play | permanent = pool only | unlock-only — gold standard |
| **Balatro** | in-run vouchers/packs; meta is unlock-only | vouchers last the run | unlock-only meta |
| **Hades** (Mirror of Night) | permanent stat tree via *Darkness*; slot unlocks via *Keys* | permanent numeric power | grind-tolerant, rescued by *Heat* re-adding challenge |
| **Vampire Survivors** | PowerUps = permanent flat stat buys | permanent numeric | embraces trivialization (power fantasy) |
| **Rogue Legacy** | castle stat upgrades | permanent numeric | the *archetypal* "grind-to-win" critique |
| **Monster Train / Loop Hero** | mostly unlocks + a difficulty ladder | permanent = options | unlock-leaning |
| **Idle/incremental** | three sinks: **Progression** (permanent), **Engagement** (consumed refills/boosts), **Prestige** (reset-for-multiplier) | mixed by sink | the sink taxonomy is the useful bit |

**The pattern:** respected designs put permanence on **unlocks (new options)** and
keep **raw numeric power temporary or absent**. Criticized designs (Rogue Legacy,
un-tuned Hades) put permanent numeric power in the shop, flattening the difficulty
curve into a grind.

---

## Blessings vs. curses

Double-edged items are the genre's spice, used sparingly and almost always
**in-run**, not as permanent meta:

- **Runic Dome** (+1 energy, can't see enemy intents), **Ectoplasm** (+economy,
  can't heal) — front-load a big benefit, attach an information/attrition cost
  that bites harder the deeper you go.
- **Deal-with-the-devil** (Isaac): trade *health* (your survival resource) for
  power — opt-in, high-risk.
- **Hades Heat / StS Ascension / Pact of Punishment**: these are *difficulty
  knobs*, not shop items — the player *takes on* curses for *bigger rewards*.
  That's the cleanest way to make a curse worth it: it's the price of a payoff
  multiplier.

**Ratio in practice:** shops are *mostly* pure-upside, with roughly **1-in-3 to
1-in-4** items double-edged. Curses are made worth taking by an *outsized*
payoff, not parity.

---

## Recommendation for OVERRIDE's ROOT shop

Two shelves, mapped onto existing code levers.

### Shelf A — PERMANENT (unlock-only, pool expansion) — ~60%

Follows the StS anchor. **Zero permanent numeric power.**

- **Unlock a jack-in character** — gate `CHARACTERS[]` entries behind ROOT
  (Catapultist, future ones). Pure new option.
- **Unlock a card *type* into the draft pool** — add `2600Hz` / `PUNCHCARD` /
  `GOTO` to `DRAFT_POOL` (`cards.js`). Deepens every future draft.
- **Add one card to your persistent starting deck** — append to `startingDeck()`.
  Mild consistency, not power creep, if priced on an escalating curve.

### Shelf B — RUN-CONSUMABLE (temporary, single-run starting conditions) — ~40%

All the raw numeric power lives here, so it evaporates each run and never
trivializes.

- **+1 HAND this run** (draw 6 — `main.js:64`). Temporary.
- **+1 SEQ slot this run** (4 slots — the big one, price it steep).
- **Retry token** — survive one lost battle this run (loss-friendly).

### Curse/blessing items (~1-in-3 of Shelf B is double-edged)

- **Overclock** — +1 heat floor this run, but **−2 LOCKDOWN** (hotter fire,
  faster trace). Ties into `heatOf()` + the honeypot penalty.
- **Glass cannon** — +1 SEQ slot but −1 HAND. Pure sequencing skill test.
- **Root-hungry** — +50% ROOT reward this run, but −2 LOCKDOWN.

### The split, stated plainly

- **Permanent = options only** (characters, card types, deck slots).
  **Temporary = all the numbers** (hand, seq, heat, retries).
- **Blessing/curse ≈ 1 in 3** of the consumable shelf, each with an *outsized*
  payoff vs. its cost.
- Keep ~50% ROOT-on-death; show ROOT-earned prominently on the fail screen so a
  lost run reads as progress.

This keeps OVERRIDE on the Slay-the-Spire side of the line: grind ROOT for *more
ways to play*, never for *just winning*.

---

## Implementation levers (current code)

- Hand size — `main.js:64` (`.slice(0, 5)`)
- Sequence length — `main.js:24` / `layout.js:18` (3 slots)
- ROOT — `main.js` `saveRoot`/`loadRoot` (earned/banked/saved, never spent)
- Starting deck / draft pool — `cards.js` `startingDeck()` / `DRAFT_POOL`
- Jack-in characters — `characters.js` `CHARACTERS[]`
- Heat / resistance — `battle.js` `heatOf()` / `terrain.js` `RESIST`
- Retry-from-deeper-tier — no tier state yet; `tierClear()` restarts
