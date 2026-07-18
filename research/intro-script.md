# INTRO SCRIPT — the cold open / recruitment (working draft)

*The first thing a new player sees. Doubles as the Tier-1 tutorial: the mysterious
contact teaches the two channels the player actually acts on — **shape** (which
program) and **direction** (where you aim it) — then releases you into your first
breach. Draft v0.2 — everything here is up for rewrite.*

> **⚠ Model note (read this).** `GAME-SHEET.md` / `SPEC-SHEET.md` still describe the
> retired **bundled-quad** card model — `(shape, direction, probability, growth)` that
> *merge order-independently*. **The shipped code implements a different model**
> (`research/lsystem-growth.md`, live in `src/cards.js` + `src/beam.js`): a card is
> `{ grammar (F/L/R/K), pace, connector }`, a program is a deterministic **L-system
> turtle** that crawls the board, coverage is earned by **fork (`K`) density**, and the
> deck is an **ordered connector chain** — *order matters now*. Crucially: **there is
> no probability/odds channel at all.** This script follows the shipped model.
> (`GAME-SHEET.md` and `SPEC-SHEET.md` were reconciled to this model on 2026-07-18.)

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

  here's your first one. watch how it moves — crawls
  up, feels for a gap, keeps going. that little
  wiggle IS the program. that's its SHAPE. steal a
  hundred of these and no two crawl the same.

  now point it. slide that turret along the bottom —
  where you drop it is where it starts, and which way
  it runs. that's DIRECTION. and tonight? that's the
  whole trick. pick your shape, aim it, let it rip.

  (how they breed, how you chain a stack of 'em into
  one nasty program — that's later. you'll steal it.)

  so quit reading. slide it. lock it. hit EXEC.

  then, kid? you're GONE.
```

On the last line the panels **relight** — but transformed: FIELD is now the living
memory block, STATUS is the battle HUD, TRAY is the LOADOUT with your starter cards.
The civilian machine is gone. You're jacked in.

### Mechanic mapping (the tutorial payload)

| Contact line | → teaches |
|---|---|
| "the programs THEY made illegal" | the deck = forbidden warez you load (cards) |
| "watch how it moves — crawls up, feels for a gap" | **SHAPE** — the card's grammar; a program is a turtle that draws a path (`F` forward, `L`/`R` turn) |
| "that little wiggle IS the program… no two crawl the same" | each card *is* a shape; you pick shapes, you don't tune numbers |
| "slide that turret… where you drop it is where it starts, and which way it runs" | **DIRECTION** — the one live input: aim the turret, tap to fire one packet |
| "how they breed… how you chain a stack of 'em… that's later" | deferred by design: forks (`K` = growth/area), pace, connectors, deck **order** — all future tutorial beats |
| "slide it. lock it. hit EXEC" | the single tap that fires the packet |
| "then, kid? you're GONE." | pun — released into the run / your first breach. "gone" = EXEC fires *and* you're out |

*Deliberately teaches only the two channels the player acts on their first run —
**shape** (which program) and **direction** (where you aim it). Everything numeric or
compositional (fork density = area, pace, the SCATTER/SPROUT/OVERLAY connectors, and
that deck **order** now matters) is held back for later beats. There is no
"probability/odds" to teach — the sim has none (verified headless; see the note below).*

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

## Open questions (still to decide)

1. **The essay text — how on-the-nose?**
   Current draft is broad satire ("I am thankful for the cameras"). Dial up (funnier,
   more cartoon) or down (drier, creepier, more real)?

2. **Naming the two channels for the player.** SHAPE and DIRECTION are the picks.
   Do we ever surface the F/L/R "grammar" letters to the player (flavor: the contact
   flashes `FFKFK` on screen), or keep it fully wordless — a program is just "a shape
   that crawls"? The preview sandbox types grammars, but the real game only picks/orders
   cards. *(Resolved down from the old spec: there is no "odds/probability" channel to
   name at all — the sim has none.)*

3. **Skippable?** Returning players hit this every new run (it's the new-game screen).
   Full cinematic first time, then a tap-to-skip / abbreviated version after?

4. **Length & pacing.** Beat 1 idle theatre: how long before the blackout? Too short
   and the "ordinary" doesn't land; too long and it's a wait. ~5–7s is my guess.

5. **The unfinished word.** Essay cuts on `stopped asking questio_`. Is the missing
   "-ns" too cute, or exactly right? (It's the one place the machine "stops asking.")

---

## How it actually plays (headless findings, 2026-07-18)

Ran the real sim headless (`src/beam.js` + `src/battle.js`, scanless TEST bench and
seeded battles) to keep this script honest about the mechanics it introduces:

- **A card carries no numbers to "tune."** It's `{ grammar, pace, connector }`. The
  player's whole surface is: *which cards*, *what order*, and *where they aim*. There
  is no probability, no reach, no reproduce level. → the tutorial teaches **picks +
  aim**, never a stat.
- **Shape and direction are the same channel** (the grammar). A turn-prefix *is* the
  aim: `SCRIPT.SYS` (`RRFFFFFFKF`) runs east; `LOGICBOMB` (`RRRRFFFFKF`) turns to
  face down and drills. So "SHAPE" (the crawl) and "DIRECTION" (which way / where you
  drop the turret) are the two honest halves of one idea — exactly the two the intro
  keeps.
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
