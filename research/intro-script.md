# INTRO SCRIPT — the cold open / recruitment (working draft)

*The first thing a new player sees. Doubles as the Tier-1 tutorial: the mysterious
contact teaches the card grammar (shape · direction · probability · growth) and the
LOADOUT/EXEC loop, then releases you into your first breach. Draft v0.1 — everything
here is up for rewrite.*

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
  you something that runs anything you're dumb
  enough to feed it.

  but a program's not magic, kid. it's four parts
  bolted together, and you're learning all four:

    SHAPE      — how the thing MOVES
    DIRECTION  — where it REACHES
    ODDS       — how often it BITES
    GROWTH     — how mean it BREEDS

  slap 'em together. they FUSE. don't sweat the
  order — there isn't one. only what you scrounged.

  so go on — bolt something ugly together. blow it
  up. do it again. when it stops feeling like
  homework, hit EXEC.

  then, kid? you're GONE.
```

On the last line the panels **relight** — but transformed: FIELD is now the living
memory block, STATUS is the battle HUD, TRAY is the LOADOUT with your starter cards.
The civilian machine is gone. You're jacked in.

### Mechanic mapping (the tutorial payload)

| Contact line | → teaches |
|---|---|
| "runs anything you're dumb enough to feed it" | the deck = forbidden programs you load |
| "four parts bolted together" | the bundled quad — every card is `(shape, dir, prob, growth)` |
| SHAPE / DIRECTION / ODDS / GROWTH | the four card aspects, named in player-facing words |
| "slap 'em together. they FUSE. don't sweat the order" | the merge rule (adds/unions/sums; commutative) |
| "bolt something ugly together. blow it up. do it again." | free play in the LOADOUT tray — slot cards, watch the merged-beam preview |
| "when it stops feeling like homework, hit EXEC" | the one input: fire the packet |
| "then, kid? you're GONE." | pun — released into the run / your first breach. "gone" = EXEC fires *and* you're out |

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

2. **"ODDS" vs "PROBABILITY" vs "CHANCE."**
   The spec calls it `probability`; the contact says **ODDS**. Lock one player-facing
   word and make the HUD label match. (Recommend ODDS — punchy, era-fit, one syllable.)

3. **Skippable?** Returning players hit this every new run (it's the new-game screen).
   Full cinematic first time, then a tap-to-skip / abbreviated version after?

4. **Length & pacing.** Beat 1 idle theatre: how long before the blackout? Too short
   and the "ordinary" doesn't land; too long and it's a wait. ~5–7s is my guess.

5. **The unfinished word.** Essay cuts on `stopped asking questio_`. Is the missing
   "-ns" too cute, or exactly right? (It's the one place the machine "stops asking.")
