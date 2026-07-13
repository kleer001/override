# JUICE — game-feel research & plan for OVERRIDE

*Research + buildable plan for the game-feel layer. Grounds the canonical "juice"
toolkit in OVERRIDE's three hard constraints (monochrome · 80×40 character grid ·
watch-don't-click) and in the current code (`src/juice.js`, `src/render.js`,
`src/audio.js`, `src/battle.js`, `src/main.js`). Status: research banked, a first
layer already shipped in `src/juice.js`, constants un-tuned. 2026-07-13.*

---

## 0. Why juice is load-bearing here, not garnish

In most games juice is the polish you add last — the screen-shake on top of a
mechanic that already plays fine without it. **OVERRIDE is the exception, and the
design already says so.** Design pillar #1 is *"You write it, then watch it — the
joy is spectacle, not clicking"* (GAME-SHEET). During EXEC the player does
**nothing**: no input, no clicks (base game). The entire back half of the loop is
a spectator sport. If the spectacle is flat, there is no game — just a number
climbing a bar with the player's hands in their lap.

So for OVERRIDE, **juice *is* the payload of the EXEC phase**, not a coat of
polish over it. That reframes the whole research question: not "what feedback can
we sprinkle on the action" but "how do we make *watching a computed number turn
into territory* feel like the best thing you saw all day." The rest of this doc is
that, mapped onto a monochrome terminal.

---

## 1. The canonical toolkit (what "juice" means, cited)

The term and the technique set come from a small, well-known literature. The
grounding matters because every one of these was invented for sprite/particle
games, and OVERRIDE has neither — §2 translates each into a grid idiom.

| Technique | Origin | The one-line idea |
|-----------|--------|-------------------|
| **Squash & stretch, anticipation, follow-through** | Disney's *12 Principles of Animation* (Thomas & Johnston, 1981) | deform on impact / wind up before a hit / overshoot and settle — sells mass |
| **"Juice"** as a design term | Jonasson & Purho, *Juice it or Lose it* (2012 talk) | take a working game, add abundant feedback per event, watch it come alive |
| **Game feel** as a discipline | Steve Swink, *Game Feel* (2008) | the feel lives in the ~real-time response window after the player acts |
| **Screen shake, done right** | Jan Willem Nijman, *The Art of Screenshake* (2013) | impact = shake + hit-pause + flash + sound, all at once, proportional |
| **Trauma-based shake** | Squirrel Eiserloh, *Math for Game Programmers: Juicing Your Cameras* (GDC 2016) | drive shake off a decaying `trauma` scalar (shake ∝ trauma²), never a fixed jerk |
| **Hit-stop / freeze frames** | fighting-game & action lineage | freeze 2–6 frames on a big hit so the brain registers the impact |

**The two rules that survive translation to any medium:**

1. **Proportionality.** Feedback must scale to the weight of the event. A `+3`
   BRUTE tick gets a whisper; an `XOR ×4` detonation gets the works. Uniform juice
   reads as noise and the big moments stop landing.
2. **The response window.** Feel is what happens in the fraction of a second
   *after* an event fires. On a ~1.5 s-per-pass loop (SPEC-SHEET) that window is
   generous — we have room for a real wind-up → hit → settle arc per card.

---

## 2. The constraint triangle → grid-native translations

OVERRIDE can't do any of the canonical techniques *literally*. It has no sprites
to squash, no particle emitter, no free camera to shake, and no color. What it has
is a **fixed 80×40 glyph grid**, **per-cell brightness/opacity** (already exploited
by `src/juice.js`), a **CRT filter**, a **density ramp** (`· : = + * @ %` →
`# X █`), and **procedural WebAudio** (AUDIO-APPENDIX). Every technique has to be
re-expressed in that vocabulary. This table is the core research result:

| Canonical technique | Why it's impossible literally | **Grid-native equivalent for OVERRIDE** |
|---------------------|-------------------------------|------------------------------------------|
| **Screen shake** | grid is fixed; can't jitter individual cells | **CRT-container shake:** CSS `transform: translate()` on the whole terminal element for 80–200 ms, amplitude ∝ event weight. The character grid never moves *relative to itself* (stays legible); the "screen" does. Reuse Eiserloh's decaying-`trauma` model. |
| **Hit-stop / freeze** | already have a tick loop | **pass-hold:** on a big detonation, pause the tick loop 60–120 ms mid-pass so the frame the multiplier lands *sticks*. Nearly free (it's a timing tweak in `main.js`), and it's the single highest-value beat in a watch-game. |
| **Squash & stretch** | glyphs can't deform | **brightness punch + glyph promotion:** flash a captured region to full white for one frame, then ease back down (already the conquer path in `juice.js:63`); *and* momentarily promote glyphs up the density ramp (`@`→`%`→`#`) at the moment of impact, then let them settle. |
| **Particles** | no emitter, no sub-cell motion | **glyph sprays:** eject transient sparks (`*`, `+`, `·`) from an ignition/vault-capture cell for a few frames, decaying down the ramp before vanishing. The density ramp already *is* a particle palette — a burning frontier reads as a spray of `@`/`%`. |
| **Anticipation (wind-up)** | — | **charge glow:** before the accumulator detonates on a `×` card, ramp the program-track playhead and the whole burned mass a notch brighter over ~200 ms, *then* release. The oscillating-gnomon aim (SPEC-SHEET) is already textbook anticipation — extend the same instinct into EXEC. |
| **Follow-through / secondary motion** | — | **phosphor afterglow trails:** when a cell flips or the trace scan passes, leave a dim decaying ghost for a few frames (CRT persistence is *real* on the hardware we're imitating — lean into it). |
| **Easing** | linear opacity reads robotic | ease all opacity ramps (the `wave()` cosine in `juice.js:22` is already an ease — extend it to breaches, code-locks, and the trace line). |
| **Floating damage numbers** | no free-floating sprites | **stamped pop-text on the grid:** at a vault capture, stamp the resolved CODE digit (or `+N cells`) in the log row / over the cell for a few frames, bright, then fade. The CODE bar locking a digit is *already* a floating-number moment — juice it (§3). |
| **Color / chromatic punch** | monochrome amber | **brightness + bloom + the CRT filter** carry all the punch. "Color change on hit" becomes "brightness spike + one-frame bloom." The phosphor *is* the color budget. |

**Design consequence — the amber constraint is a feature.** A monochrome grid
can't lean on a rainbow of particles, so it's forced toward the *disciplined*
juice the literature actually recommends: brightness, timing, and sound, tightly
proportional. The look-&-feel spine (amber phosphor, CRT, `finding_numbers`
lineage) is preserved for free because every technique above lives inside it.

---

## 3. OVERRIDE's juice moments, ranked (the proportionality ladder)

Proportionality (§1, rule 1) demands we rank the events and spend juice budget by
rank. Small routine ticks get a whisper; the rare payoffs get the full stack
(shake + hold + flash + spray + sound). This ladder is the spend plan:

| Weight | Event | Juice stack (small → full) | Current state |
|--------|-------|----------------------------|---------------|
| ▁ whisper | `BRUTE +N` fires | one square blip (pitch ∝ N, AUDIO-APPENDIX); playhead cell brightens | audio speced, not wired to visual |
| ▂ | crack-% tick / new cells burned | frontier glyphs spray up the ramp; soft tick per point | partial — burn pulse exists (`juice.js:71`) |
| ▃ | `FORK()` seeds a 2nd front | a bright flash at the new beachhead + a distinct spawn chime | not built |
| ▄ | honeypot tripped | **warning jolt:** short sharp shake + descending sawtooth (AUDIO-APPENDIX "INTERRUPT/error") — this is a *bad* surprise, must feel like one | not built |
| ▅ | **`XOR ×N` detonation** (the payoff card) | **the full stack:** ~200 ms charge glow → pass-hold freeze → CRT shake (∝ N) → full-brightness flash → ramp-promotion across the burned mass → rising square arpeggio. This is *the* moment the whole game exists to deliver. | audio speced; visual + freeze + shake unbuilt |
| ▅ | CODE digit locks in | digit slams in bright, one-frame bloom, a decisive "lock" chime; brief hold | digit locks logically; no juice |
| ▆ | **sector breach (≥50% hold)** | flash → 4 fast unison pulses → settle to locked `#` grid, unburned ground goes dark | **built** — `juice.js:47–68` (the celebration path) |
| ▇ | tier clear (all 3 sectors) | zoom-out beat: the whole conquered machine collapses to one node, a rising sting | not built |
| █ doom | **trace scan reaches bottom** (run ends) | the descending line accelerates its last rows, everything it's crossed goes dark behind it, a flatline tone — the fail must feel like getting *caught*, not a polite "you lose" | scan drawn (`render.js:148`); no juice on arrival |

Two observations from the ladder:

- **The detonation and the breach are the tentpoles.** They're rare, they're the
  skill-expression payoff (sequencing → the `×` detonation; whole-sector win → the
  breach), and they should be visibly, audibly *bigger* than everything else. The
  breach is already built; **the `×` detonation is the biggest unbuilt win.**
- **Juice the failures too.** The honeypot jolt and the trace-line doom are
  negative juice — the literature (Nijman) is explicit that *bad* events need feel
  as much as good ones, or the tension goes slack. On the fantasy this is perfect:
  the trace line *is* WarGames "they're tracing the call," and it should read as
  dread on the CRT.

---

## 4. What's already shipped, and the gap

`src/juice.js` is a real first layer — a per-cell **brightness compositor** that
wraps burned field cells in opacity spans (`composeBoard`). It already delivers:

- **Active-burn breathing** — burned clusters pulse on a phased sine so a
  spreading stain *feels alive* rather than static (`juice.js:71`, `PERIOD 1400`).
  This is follow-through/secondary-motion, done grid-native.
- **The breach celebration** — flash → 4 fast unison pulses → settle to a locked
  `#` grid with the ground darkened (`juice.js:60–68`). This is the ▆ moment on
  the ladder, complete and well-shaped.
- **Correctness discipline already in place** — HTML-escaping every emitted glyph
  (`juice.js:37`, the board is `innerHTML`), and never touching the sector-label
  row (`juice.js:57`) so juice never clobbers legibility. **Any new juice must
  keep both invariants.**

**The gap** is everything on the ladder that isn't the breach: the `×` detonation
stack (§3 ▅), the pass-hold freeze, the CRT-container shake, glyph-ramp promotion,
vault/CODE-lock pops, the honeypot jolt, and the trace-line doom. And critically,
**the audio in AUDIO-APPENDIX is speced but not wired to these visual beats** — the
biggest cheap win is firing the existing synth recipes *in sync* with the visual
punches (Nijman's whole point: shake + flash + sound as one event, never staggered).

---

## 5. Staged implementation plan (cheapest wins first)

Ordered by feel-per-line-of-code. Each stage is shippable and testable on its own.

1. **Wire audio to the beats.** The synth recipes exist (AUDIO-APPENDIX); fire
   `sfx.card()` / `sfx.mult(n)` / `sfx.crack()` from the exact frame the playhead
   hits each card in `main.js`. Near-zero risk, immediate lift — a silent watch-game
   is a dead watch-game. *(touches `main.js`, `audio.js`)*
2. **Pass-hold on detonation.** Freeze the tick loop 60–120 ms when a `×` card
   lands a big multiplier. One timing branch in the loop; buys the single most
   important "impact" read in a game with no other impact channel. *(main.js)*
3. **CRT-container shake.** A decaying-`trauma` scalar (Eiserloh) driving a CSS
   `transform` on the terminal element; add trauma proportional to event weight
   from the §3 ladder. Grid stays internally legible. *(new tiny module + `main.js`;
   the container transform is CSS, not a grid change — cheap and reversible.)*
4. **Glyph-ramp promotion + sprays.** Extend `juice.js` so impact frames push
   burned glyphs up the density ramp and eject transient sparks that decay down it.
   Reuses the compositor's existing per-cell hook (`cellStyle`, `juice.js:51`).
5. **Pop-text: CODE locks & vault captures.** Stamp the resolved digit / `+N`
   bright over the cell (or the log row) for a few frames, then fade. Highest-value
   "floating number" beat — it's the `finding_numbers` callback (you *find the
   numbers* by taking ground).
6. **Negative juice.** Honeypot jolt (▄) and the trace-line doom (█). Ties the
   tension clock (ember-model §5, the single-scan traceback) to real dread.

**Verification.** The visual layer is timing/opacity math over deterministic state
— unit-testable in the same `node --test` harness as the rest (assert `cellStyle`
returns the expected opacity ramp at known `dt`, that celebration timing hits its
phases, that pop-text clears). The *feel* still needs an eyeball pass in the
headless browser, same as the existing slice.

---

## 6. Open dials / questions

- **Shake amplitude ceiling.** How hard can the CRT container jerk before it reads
  as a bug rather than a punch on a "1983 terminal"? Needs a `preview/` slider.
- **Juice vs. the idle contract.** Pillar #1 says hands-off. Does the pass-hold
  freeze (§5.2) ever feel like a *stall* rather than a *hit*? Cap total held time
  per battle so a long combo chain doesn't drag.
- **Reduced-motion / accessibility.** Screen shake + rapid brightness pulsing is a
  photosensitivity concern. Ship a `prefers-reduced-motion` path that keeps the
  brightness *states* but drops the shake and slows the pulses.
- **Audio-visual sync tolerance.** WebAudio scheduling vs. the rAF render clock —
  how tight can we keep the flash-and-blip together? (Nijman: they must feel
  simultaneous.)
- **Budget on the 80×40 HUD.** Pop-text and sprays compete for the same cells as
  the log and CODE bar. Which juice is allowed to overlap furniture, and which must
  stay inside the field rows (4–36)?
- **Detonation escalation across tiers.** Should the detonation stack get *bigger*
  at deeper tiers (bigger accumulators, per ember-model §7), or stay fixed so the
  Tier-1 payoff never gets outclassed and feel-flat?

---

## Sources

- Martin Jonasson & Petri Purho — *Juice it or Lose it* (2012). <https://www.youtube.com/watch?v=Fy0aCDmgnxg>
- Steve Swink — *Game Feel: A Game Designer's Guide to Virtual Sensation* (2008).
- Jan Willem Nijman (Vlambeer) — *The Art of Screenshake* (2013). <https://www.youtube.com/watch?v=AJdEqssNZ-U>
- Squirrel Eiserloh — *Math for Game Programmers: Juicing Your Cameras with Math* (GDC 2016).
- Frank Thomas & Ollie Johnston — *The Illusion of Life: Disney Animation* (1981) — the 12 principles (squash & stretch, anticipation, follow-through).
- *Game feel* — Wikipedia overview. <https://en.wikipedia.org/wiki/Game_feel>
