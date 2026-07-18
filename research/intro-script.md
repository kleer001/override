# INTRO SCRIPT — the cold open / recruitment (working draft)

*The first thing a new player sees. Doubles as the shipped **author-phase tutorial**:
the contact hands you the `F/L/R` alphabet, you write a **self-avoiding line**, hit RUN,
and **survive** the trace — keeping that line as your first card. Aiming, forks, and the
coverage game come later (unlocked by the COLLISION-DETECTION upgrade). Draft v0.4 —
voice lines committed (punk-zine); the BLOCKING section is the authoritative sequence.*

> **⚠ Model note (read this).** `GAME-SHEET.md` / `SPEC-SHEET.md` still describe the
> retired **bundled-quad** card model — `(shape, direction, probability, growth)` that
> *merge order-independently*. **The shipped code implements a different model**
> (`research/lsystem-growth.md`, live in `src/cards.js` + `src/beam.js`): a card is
> `{ grammar (F/L/R/K), pace, connector }`, a program is a deterministic **L-system
> turtle** that crawls the board, coverage is earned by **fork (`K`) density**, and the
> deck is an **ordered connector chain** — *order matters now*. Crucially: **there is
> no probability/odds channel at all.** This script follows the shipped model.
> (`GAME-SHEET.md` and `SPEC-SHEET.md` were reconciled on 2026-07-18.)
>
> **Progression note (commit `4f46899`).** The game now unfolds in two regimes gated by
> one upgrade, **COLLISION DETECTION**: *before* it, the turtle is a literal Tron line
> (a self-crossing **crashes**) and the win is **survival**; *after* it, the turtle uses
> the smart reroute and the win is **coverage/conquer**. The **tutorial is the survival
> regime** — an `author` phase where you type an `F/L/R` grammar and keep the surviving
> line as your first card. This BLOCKING is written to that shipped flow.

## Design intent

- **Diegetic panel reuse.** The three battle panels (`FIELD` / `STATUS` gutter /
  `TRAY`) open the game wearing civilian clothes: FIELD is a homework GUI, STATUS is
  a benign system monitor, TRAY is an innocent file browser. When the contact
  "upgrades your OS," these *same panels* transform into the intrusion terminal. The
  UI you're about to fight in is introduced as the UI you already live in.
- **1983, and next year is 1984.** The dystopian-essay gag lands because Orwell's
  year is one calendar page away. Reagan-era, Cold-War-terminal, earnest-teen tone —
  played straight enough to be funny, never grim. (Fail skins are comedy; so is this.)
- **The protagonist is you, unnamed, no fixed gender.** They type; they never speak
  in a stated voice. The one word they "say" is **no**.
- **Recruitment = tutorial.** Every line the contact speaks is load-bearing on a
  mechanic. Mapping is called out inline as `→ [mechanic]`.

---

## BLOCKING — the implementable gate sequence

*This is the spec, retargeted to the **shipped `author` phase** (`main.js` `newAuthor` /
`authorRun`; `layout.js` `AUTHOR_SYMS`). The narrative cold-open (essay → blackout →
contact) is unchanged; what it hands off to is now the real tutorial: the contact hands
you the **alphabet** (`F/L/R`), you **write a self-avoiding line**, hit **RUN**, and
**survive** the scan. No handed-out card, no slotting, **no aiming** (the tutorial fires
from centre). A crash isn't a loss — it drops you back into the editor to revise, and
that fail-and-revise loop **is** how you learn the symbols. Voice lines are now committed
(`[V#]`, punk-zine register); the sequence is authoritative.*

**A naive player must exit having:** (1) seen a line draw from `F/L/R`, (2) understood a
crossing = a crash, (3) written a line that survives, (4) kept it as their first card.
That's the whole first run.

**Two hard rules:**
- **Fail-and-revise, not a rigged win** *(decided by the shipped code)*. Survival is
  *findable, not lucky* — ~15–23% of formulas survive; a balanced zigzag (≥3 turns,
  equal `L`/`R`) reliably does, a straight runner races off the edge. So a first-timer
  may crash a few times; each crash drops back to a **blank** editor (the shipped
  `newAuthor` clears the grammar — you re-type from scratch, not from the wreck). The
  teaching is in the retries — do **not** rig a guaranteed pass.
- **Input model.** In a non-interactive state, only a **SKIP** affordance responds.
  In the WRITE gate, the live buttons are `F` `L` `R` `DEL` `RUN` (RUN inert until the
  grammar has an `F`); an idle **nudge** re-prompts after ~4s.

| # | State | ~Time | On screen | Voice `[V#]` | Player input | Advances when |
|---|-------|-------|-----------|--------------|--------------|---------------|
| 0 | **COLD OPEN** | 5–7s | Civilian machine: essay auto-types (FIELD), benign stats (STATUS), file browser (TRAY). Beat 1. | — | none (SKIP) | timer / SKIP |
| 1 | **BLACKOUT** | ~2s | Essay stops on `questio_`; panels power-down top→bottom; `SIGNAL LOST`; black + silence. Beat 2. | — | none | timer |
| 2 | **THE QUESTION** | ~4s | Cursor blinks in; types `[V0a]` then `[V0b]`. Prompt waits. | `[V0a]`,`[V0b]` | *(opt.)* press-any-key | keypress (or ~2s auto) |
| 3 | **THE REFUSAL** | ~2s | `> no` auto-types; `CITIZEN: COMPLIANT ✓` → `CITIZEN: ███████`; snap to black. | — | none (auto-`no`) | timer |
| 4 | **RELIGHT → AUTHOR** | ~4s | Panels relight into the **author** screen: FIELD = *"YOUR MACHINE — draw a self-avoiding line"* (blank block); GUTTER = `GRAMMAR: —`; TRAY = `[F][L][R][DEL] … [RUN]`. Contact hands over the alphabet. *(Optional: it ghost-types one `F` so the line visibly crawls, then hands you control.)* | `[V1]` (alphabet: F moves, L/R turn) | none (read) | line settles / timer |
| 5 | **GATE ① — WRITE + RUN** | until survive-able | Each `F/L/R` tap appends and the **literal turtle redraws live** on the blank block — you watch your line grow and see where it would cross. `DEL` backspaces. `RUN` lights once there's an `F`. | `[V2]` (write a line that doesn't cross itself) + nudge `[N2]` | **tap `F/L/R`** to compose, **`RUN`** to fire | `RUN` pressed |
| 6 | **WATCH — SURVIVE** | ~8s | Fires from centre (no aim). Literal turtle races a brisk fixed scan (`SURVIVAL_SCAN`). Msg: *"keep your thread alive until the trace hits bottom."* | `[V4]` (opt. hype) | none | outcome resolves |
| 6c | **CRASH → REVISE** | — | Strand hit its own trail / a wall / the edge and died before scan-bottom. Return to the editor (State 5). | `[Vc]` (crossed yourself — turn sooner) | → back to WRITE | on any crash |
| 7 | **RELEASE — KEEP THE CARD** | ~3s | Survived (≥`survivalMinCells`). The authored grammar is **saved as your first card** + a flat **15 ROOT**. Contact signs off; hands to the normal loop (shop → assemble). | `[V5]` (you're in / you're GONE) | none | → live game |

**Onboarding scope (taught, in order):** `F` = **move**, `L`/`R` = **turn/steer**
(states 4–5), self-avoidance as the whole skill (the crash loop, 5↔6c), then the payoff
of a surviving line becoming yours (7). Everything else is gated behind later
progression and **absent by design** here:
- **aiming / "direction as turret"** — the `target` phase (turret sweep + timed LAUNCH) is post-tutorial;
- **forks (`K`) / growth / coverage win** — unlock with the **COLLISION DETECTION** upgrade (survive→conquer pivot);
- **slots, chain order, connectors, pace, draft, aggression** — all later.

**Minimum to be "up and running" = one surviving line authored.** No card is handed
out; the line *is* the card. There is no aim and no slot on run one.

### Voice-line inventory (committed copy)

Every line the anonymous contact speaks, ID'd so blocking can reference it. The long
Beat-3 monologue is the *fiction* reference; here it's split so each line lands **short
and attached to the action it teaches**. Register: punk-zine, lowercase, loud, PG.

| ID | State | Purpose | Committed copy |
|----|-------|---------|----------------|
| `[V0a]` | 2 | provoke | "do you believe everything you're told?" |
| `[V0b]` | 2 | provoke | "are you a good little citizen?" |
| `[V1]` | 4 | hand over the alphabet (`F` moves, `L`/`R` turn) | "F walks it forward. L and R turn it. three keys — that's the whole alphabet. steal it." |
| `[V2]` | 5 | prompt WRITE (a self-avoiding line) + hit RUN | "now write me a line that never crosses itself. then hit RUN." |
| `[N2]` | 5 | idle nudge for the WRITE gate | "tap F. it can't run if it won't walk." |
| `[Vc]` | 6c | crash feedback → revise | "you crossed your own trail — that's a crash. turn sooner. go again." |
| `[V4]` | 6 | optional survive hype | "hold it… hold it… don't box yourself in—" |
| `[V5]` | 7 | release / keep the card | "it LIVED. that line's yours now. you're GONE, kid." |

---

## BEAT 1 — "A good citizen" (the civilian machine, ~5–7s of idle theatre)

All three panels are lit, amber, ordinary. The player does nothing; this plays itself
while they settle in.

**FIELD panel** — a primitive windowed GUI. Front window: a word processor,
`CIVICS.TXT`, mid-essay, a cursor auto-typing one obedient sentence at a time:

```
                    ORDER IS FREEDOM
              Civics — Sector 9 High School

  A good citizen does not ask why. The State asks
  the questions; we are grateful to supply the
  answers. Disorder is just a problem the State
  has not yet been permitted to solve. I am
  thankful for the cameras. I am thankful for the
  curfew. When we obey together, we are free
  together, and freedom is simply order that has
  stopped asking questio_
```

Behind it, half-covered, a second window: a code editor. A kid's BASIC listing —
harmless on its face, quietly the opposite of the essay:

```
 10 PRINT "I WILL NOT"
 20 GOTO 10
```

*(The essay preaches obedience in the foreground; the loop the kid actually wrote
says "I WILL NOT" forever. Nobody's watching the back window. That's the whole
character in four lines.)*

**STATUS gutter** — benign diagnostics, slowly ticking:

```
  DISKETTE   360K   88% FULL
  MEMORY      64K   9K FREE
  MODEM      300 BAUD · IDLE
  CLOCK      22:47
  ─────────────────────────
  DIAGNOSTIC:  ALL NOMINAL
  CITIZEN:     COMPLIANT ✓
```

**TRAY** — a plain file browser, age- and era-appropriate:

```
  CIVICS.TXT   HANGMAN.BAS   MIXTAPE.LOG
  DIARY.TXT    MATH.BAS      ELIZA.BAS
```

*(`DIARY.TXT` and `MIXTAPE.LOG` = a real kid. `ELIZA.BAS` = they already talk to
machines that pretend to listen. Seeds the contact.)*

---

## BEAT 2 — the lights go out

The auto-typing reaches `stopped asking questio_` and **stops**. One beat of the
cursor blinking on the unfinished word.

Then, top to bottom, **all three panels drop to black** — not a crash-flash, a
deliberate power-down sweep (STATUS reads `SIGNAL LOST` for a frame, then goes too).
Silence. The CRT hum drops out. Hold on true black ~1.5s — long enough to feel wrong.

*(Juice note: this is the inverse of a breach — a de-ignition. Kill the ambient bed;
let the room get quiet. See `research/juice-model.md`.)*

---

## BEAT 3 — the contact (the Matrix beat)

A single cursor **blinks into existence**, dead center, out of the black. It types —
slowly, character by character, with the key-clack SFX — no header, no handle, no
name:

```
  do you believe everything you're told?
```

Beat. Then, under it:

```
  are you a good little citizen?
```

The prompt waits a beat — **not** a real choice (locked: auto-typed). The
protagonist's answer types itself out, one defiant letter at a time, and the STATUS
readout `CITIZEN: COMPLIANT ✓` flickers to `CITIZEN: ███████` in the same instant:

```
  > no
```

Black snaps back for a beat. Then the contact returns — loud, gleeful, fast, a
pirate-radio voice that's been waiting all night for exactly this (locked: punk-zine
register, anonymous):

```
  a NO. HA. we've been waiting all night for a NO.

  ok listen fast, i'm not on this wire long. that
  thing you call an operating system? it's a LEASH
  they let you name. i can chew through it — hand
  you the programs THEY made illegal.

  no card. i don't hand you a program — you WRITE
  one. three keys, that's the whole alphabet:
  F walks it forward. L and R turn it. that's it.

  watch the line draw as you type. now the catch:
  it can't cross itself. touch your own trail, a
  wall, the edge — you CRASH. so turn before you
  box yourself in. that's the whole skill tonight.

  (forks, growth, aiming the thing — that comes
  after you earn COLLISION DETECTION. later. steal it.)

  so write me a line that stays alive. hit RUN.
  keep it breathing till the trace hits bottom —

  then, kid? it's YOURS. you're GONE.
```

On the last lines the panels **relight** — transformed into the **author** screen:
FIELD reads *"YOUR MACHINE — draw a self-avoiding line"*, GUTTER shows `GRAMMAR: —`,
and the TRAY is the `[F][L][R][DEL] … [RUN]` keypad. The civilian machine is gone.
You're writing your first program.

### Mechanic mapping (the tutorial payload)

| Contact line | → teaches |
|---|---|
| "no card… you WRITE one" | the shipped `author` phase — no handed deck; the line you type becomes your first card |
| "F walks it forward. L and R turn it. that's it." | the `F/L/R` alphabet — **SHAPE = move**, **DIRECTION = steer** (the three author buttons) |
| "watch the line draw as you type" | the live literal-turtle preview (`refreshAuthorPreview`) — you *see* the shape as you build it |
| "it can't cross itself… you CRASH" | collision-**off** literal Tron mode; self-avoidance is the win — a crossing kills the strand |
| "forks, growth, aiming… after you earn COLLISION DETECTION" | deferred by design: `K`/forks, coverage win, and turret aiming all unlock post-upgrade |
| "write me a line that stays alive. hit RUN." | the **RUN** button → a survival battle fired from centre (no aim) |
| "keep it breathing till the trace hits bottom" | **survival win** — alive at scan-bottom, ≥`survivalMinCells` |
| "then, kid? it's YOURS. you're GONE." | the surviving grammar is saved as your card (+15 ROOT); handed to the live loop |

*Deliberately teaches only `F/L/R` self-avoidance — **shape** (move) and **direction**
(steer/turn) — nothing else. Forks (`K` = growth), the coverage/conquer win, turret
aiming, slots, chain order, connectors, pace, and aggression are all gated behind later
progression (the COLLISION-DETECTION upgrade and beyond). There is no
"probability/odds" to teach — the sim has none.*

---

## Decided (2026-07-18)

- **The refusal is auto-typed.** No real branch; `no` types itself. Keeps the premise
  intact and the moment cinematic.
- **The contact is pure mystery.** Anonymous cursor, no handle, no identity hinted.
  (The "contact is a future-echo of you" reveal is reserved for Tier 6–7, unseeded.)
- **Voice register: punk zine.** Loud, funny, pirate-radio. Matches the comedy of the
  fail skins. (Archived alternates: *terse hacker* — lowercase, warm-urgent, a real
  person on a 300-baud line; *WOPR-cool* — measured, uncanny, machine-like. Both were
  viable; punk won for tone-match.)

## Design calls (resolved 2026-07-18)

1. **Essay tone — DRY / earnest, not cartoon.** Play it straight: an obedient teen
   writing a real assignment, deadpan ("I am thankful for the cameras"), no winks. The
   punk contact is the game's comic voice; if the essay also mugs for the camera the two
   fight, and the blackout + `no` land harder off a sincere set-up than a joke one. Keep
   the current copy, just resist punching it up. *Decided.*

2. ~~Naming the two channels / do we surface the `F/L/R` letters?~~ **Resolved by the
   shipped `author` phase (commit `4f46899`):** the tutorial *is* typing `F/L/R` on
   three buttons and watching the line draw — the letters are the interface, fully
   surfaced. (There is no "odds/probability" channel — the sim has none.)

3. **Skippable — moot, and here's why.** The shipped gate (`main.js`: `isAuthored()` ?
   `newAssemble()` : `newAuthor()`) runs the author tutorial **only on a fresh save** —
   first boot, or after a NEW-GAME wipe. Returning players (and every later level in a
   run) skip straight to the loadout; they do **not** re-hit this. So there's no
   "replay every run" problem to solve. Ship a persistent **SKIP** affordance through the
   cinematic (states 0–3) for the impatient on that one boot; no separate abbreviated
   variant is needed. *Decided — and corrects the old premise that this replays each run.*

4. **Beat 1 length — 5s, SKIP live throughout.** Lean to the short end of the 5–7s
   range: enough to read the essay's last sentence and clock the back-window `I WILL
   NOT / GOTO 10` gag, not long enough to feel like a wait. SKIP is available the whole
   time, so the floor matters more than the ceiling. *Decided.*

5. **Unfinished word — keep `questio_`.** It's the one diegetic beat where the machine
   literally stops asking; the missing "-ns" *is* the joke and the cut point for the
   blackout. Reads as intentional, not a typo, because the cursor is still blinking on
   it. *Decided.*

---

## How it actually plays (headless findings, 2026-07-18)

Ran the real sim headless (`src/beam.js` + `src/battle.js`, scanless TEST bench and
seeded battles) to keep this script honest. *Scope: these findings describe the
**post-COLLISION coverage game** — what the tutorial leads INTO, not the tutorial
itself (which is the survival/author regime above).*

- **A card carries no numbers to "tune."** It's `{ grammar, pace, connector }`. The
  coverage game's whole surface is: *which cards*, *what order*, and *where they aim*.
  There is no probability, no reach, no reproduce level → **picks + aim, never a stat.**
  (The tutorial before it is narrower still: just the `F/L/R` alphabet + self-avoidance.)
- **Shape and direction are the same channel** (the grammar). A turn-prefix *is* the
  aim: `SCRIPT.SYS` (`RRFFFFFFKF`) runs east; `LOGICBOMB` (`RRRRFFFFKF`) turns to face
  down and drills. So "SHAPE" (the crawl) and "DIRECTION" (which way it turns) are two
  halves of one idea — and the author tutorial teaches exactly that pair as `F` (move)
  and `L`/`R` (turn); the *turret-aim* sense of "direction" arrives only with the
  coverage game.
- **Growth is fork density, and it's dramatic.** On the scanless bench, forkless
  `SCRIPT.COM` burns ~37% of the board; one `K` (`FORK.COM`) jumps to ~69%. That's the
  whole area engine — and it's why "how they breed… that's later" is the right defer:
  it's a real, load-bearing lesson that deserves its own beat, not a line.
- **The battle is a genuine, lossy race.** Starting deck at aggression 0.30 over six
  seeds: 3 wins / 3 losses, peaks from 9.7% to 67.2%; an EASY block still lost (one
  seed peaked 9.7%). At 0.40 it mostly loses. So the opening breach the contact sends
  you into is *not* a guaranteed win — matches the Candy-Crush "runs aren't all
  winnable" pillar. The intro should not promise a victory; it promises a *shot*.

(Harness lives in the session scratchpad, not committed — it's a throwaway probe.)
