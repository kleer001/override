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
that — using the terminal as the *substrate*, and layering real graphics on top
wherever a modern-feeling beat hits harder than a glyph trick can.

---

## 1. The canonical toolkit (what "juice" means, cited)

The term and the technique set come from a small, well-known literature. It was
all invented for sprite/particle games — which is exactly the modern-game feel
we're catering to. §2 maps each technique onto OVERRIDE: some land as cheap
grid-native tricks, others as real graphical layers over the grid. Both are on
the table, and the richer one wins whenever the moment deserves it.

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

## 2. The grid is the substrate, not the cage

**Design stance (important — read before you start narrowing your options).** The
80×40 amber grid is OVERRIDE's *default look and coordinate system*, **not a rule
that all feedback must be spellable in glyphs.** Today the whole screen is one
`<pre>` text buffer (`index.html`, `render.js` → string → `juice.js` spans →
`innerHTML`), but nothing stops us mounting a **transparent `<canvas>` / WebGL
pass over that `<pre>`** for anything the grid can't render with punch — real
bloom, real particles, glow, curvature, color accents, free-floating pop-text.
The docs already point this way: the CRT is *"a CSS approximation for the MVP; the
WebGL CRT shader can be dropped in later for real curvature/bloom"* (`styles.css`),
and the terminal is *"the look… not the exact row count"* (`SPEC-SHEET.md`). So
this is the roadmap, not a departure from it.

That gives every canonical technique **two implementations**: a cheap grid-native
version we can ship today inside the `<pre>`, and a richer graphical-layer version
for when a tentpole beat (§3) needs to hit like a 2020s game. **Ship the cheap one
first to prove the beat; reach for the layer when the moment earns it.** The two
coexist — the overlay reads as part of the same phosphor because it's tinted and
bloomed to match, so we get modern punch *without* throwing away the identity.

| Canonical technique | Grid-native version (cheap, ship first) | Graphical-layer upgrade (modern punch) |
|---------------------|------------------------------------------|-----------------------------------------|
| **Screen shake** | CSS `transform: translate()` on the `<pre>`/CRT container for 80–200 ms, amplitude ∝ event weight; drive it off Eiserloh's decaying-`trauma` scalar. | shake the WebGL pass with real 2D noise + a chromatic-split / lens-wobble on the shake peak — the Vlambeer look, not a rigid nudge. |
| **Hit-stop / freeze** | **pass-hold:** pause the tick loop 60–120 ms mid-detonation so the frame the multiplier lands *sticks* (a timing tweak in `main.js`). Single highest-value beat in a watch-game. | pair the hold with a full-screen flash-frame + a radial bloom pulse on the overlay so the freeze reads as an *impact*, not a stutter. |
| **Squash & stretch** | brightness punch + glyph promotion up the density ramp (`@`→`%`→`#`) at impact, easing back down (extends the conquer path, `juice.js:63`). | a real scale-punch: pop the affected region's canvas layer to ~1.15× and ease back (true squash-&-stretch), the grid text riding under it. |
| **Particles** | **glyph sprays:** eject transient sparks (`*`, `+`, `·`) from an ignition/vault cell, decaying down the ramp. The density ramp already reads as a spray. | a real particle emitter on the overlay canvas — embers, sparks, debris with velocity + gravity + additive glow, spawned at grid-cell coordinates so they line up with the burn. |
| **Anticipation (wind-up)** | **charge glow:** ramp the playhead + burned mass a notch brighter over ~200 ms before a `×` detonates, then release. | a gathering-energy VFX on the overlay (in-drawing ring / intensifying glow at the accumulator) so the payoff is *telegraphed*, then explodes. |
| **Follow-through / secondary motion** | **phosphor afterglow trails:** leave a dim decaying ghost for a few frames when a cell flips or the scan passes (CRT persistence, leaned into). | motion-blur / feedback-buffer trails on the overlay for real phosphor smear behind fast-moving elements (the trace line, sprays). |
| **Easing** | ease every opacity ramp (the `wave()` cosine, `juice.js:22`, is already one — extend to breaches, code-locks, the trace line). | spring/overshoot curves on the canvas transforms so pops *bounce* and settle instead of linearly arriving. |
| **Floating damage numbers** | stamped pop-text in the grid: at a vault capture, stamp the resolved CODE digit / `+N cells` over the cell for a few frames, bright, then fade. | true free-floating pop-text on the overlay — rises, scales, drifts, fades on its own transform, unconstrained by cell rows. The CODE-lock is the marquee use. |
| **Color** | brightness + bloom carry punch within amber; "color change on hit" = brightness spike + one-frame bloom. | **use color deliberately** — a hot-white/cyan flash on detonation, red on the trace/honeypot danger, against the amber base. Monochrome is the *default palette*, not a ban; a well-placed second hue is a modern, legible accent. |

**Design consequence — the terminal is a strong identity, and tentpoles are
allowed to break frame.** The amber grid gives OVERRIDE a distinctive, coherent
baseline (and keeps the routine 80% of the screen cheap and legible). But the rare
payoff moments — the `×` detonation, the breach, the trace-line doom — are exactly
where a modern game spends its graphical budget, and there's no reason to hold
those back to what a 1983 VT100 could draw. The rule isn't "stay inside the
glyphs"; it's **proportionality (§1): routine beats stay grid-cheap, tentpole
beats get the full graphical layer.**

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

A second layer has since landed on top of the compositor:

- **The `×` detonation stack (§3 ▅)** — the frame a mult card lands fires sound +
  a white-hot flash across the burned mass + a trauma shake + a ~90 ms pass-hold,
  all on one frame (`juice.js` `detonate()`, `main.js` exec loop).
- **Trauma-based CRT shake** — a pure decaying scalar (`src/shake.js`, Eiserloh),
  sampled each frame into a CSS transform on the `.crt` container; events add
  trauma by ladder weight.
- **Negative juice** — the honeypot warning jolt (▄) and the trace-complete doom
  (█): new sawtooth/flatline sfx paired with a hard shake.
- **The scanning gnomon** — an automated targeting crosshair (`render.js`
  `drawGnomon`, `main.js` `sweepGnomon`) sweeps the arena to each random ping
  landing site and locks on before the ember blooms. This is the **anticipation /
  wind-up** row of §2, done grid-native: the placement is *telegraphed* so a
  random lob reads as a deliberate strike. The player watches it aim — they never
  drive it (the old user-driven aiming gnomon is not back; this is its ghost).
- **Reduced-motion path** — `prefers-reduced-motion` drops the shake, pass-hold
  and rapid flashes and slows the breathing pulse, keeping the brightness *states*.

**The remaining gap:** vault/CODE-lock pop-text (§5.5), glyph-ramp *sprays*, the
`FORK()` beachhead flash, the tier-clear zoom-out, and the graphical overlay
(§5.7). Audio is now wired in sync with the visual beats it fires beside.

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
7. **Stand up the graphical overlay (the modern-punch layer).** Mount a
   transparent `<canvas>` (or the ported WebGL CRT pass) over the `<pre>`, sized
   and positioned to the same cell grid so effects land on-cell. This unlocks the
   right-hand column of §2 — real particles, bloom, scale-punch, free-floating
   pop-text, deliberate color flashes — and is where the tentpole beats (§3 ▅/▆/█)
   graduate from glyph-tricks to something a modern player reads as *produced*.
   Do it once the cheap versions (1–6) prove the beats land; then upgrade the
   tentpoles one at a time. *(new render layer beside `render.js`; the `<pre>`
   stays the substrate and hit-testing is unchanged — `layout.js`/`input.js` keep
   mapping taps to cells.)*

**Verification.** The visual layer is timing/opacity math over deterministic state
— unit-testable in the same `node --test` harness as the rest (assert `cellStyle`
returns the expected opacity ramp at known `dt`, that celebration timing hits its
phases, that pop-text clears). The *feel* still needs an eyeball pass in the
headless browser, same as the existing slice.

---

## 6. Open dials / questions

- **How far off the grid do we go?** The stance here (§2) is "grid as substrate,
  graphical layers on tentpoles." The open question is *how much* — is the overlay
  reserved for the rare payoff beats (keeps the identity crisp), or do we let it
  carry routine feedback too (more modern, risks diluting the terminal look)? A
  `preview/` sandbox with the overlay live is the way to feel this out, not decide
  it on paper.
- **Shake amplitude + color budget.** How hard can the container jerk, and how much
  non-amber color, before it stops reading as "OVERRIDE" and starts reading as a
  different game? Not a reason to hold back — a reason to tune it with a slider.
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
