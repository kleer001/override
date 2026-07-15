# Climax TODO — the breach moment (a big art-direction session)

The watch phase now paces to ~6–18s (self-scaling with the drama), but its
**climax is undesigned**. This is deferred as its own art-direction pass — it's
the payoff spike of the whole loop (one shot per run → the breach *is* the run's
Extreme Fever), and it deserves dedicated design, not a bolt-on.

## Why this is load-bearing (not polish)

- Research pass (2026-07-14): the game-feel literature says **juice = amplifying
  output feedback beyond the input** to make a moment feel significant, and that
  amplification is *the* lever for a low-input, watch-it-happen moment. Length
  matters less than **shape + climax**.
- Peggle isn't long — a ball is ~3–8s. Its magic is the **Extreme Fever** climax:
  slow-mo + bloom + "Ode to Joy" on the last orange peg. Pachinko stretches its
  watch only because it's a rising **near-miss "reach"** ramp.
- So OVERRIDE's watch wants an **arc**, and the breach is where the arc peaks.

## What exists today (the hooks to build on)

- `src/main.js › startExec()` — the watch loop; already detects the breach onset
  (`wasBreaching` / first `breachLeft >= 0`) and fires `detonate()` + `kick(0.5)`
  + `sfx.crack()`; win fires `kick(0.7)` + `sfx.win()`; loss `sfx.flatline()` +
  `kick(0.9)`.
- `src/juice.js` — `detonate(now, strength)` (white-hot flash → eased glow),
  per-cell breathing pulse, conquer celebration; `setReducedMotion` path.
- `src/shake.js` — trauma-driven CRT shake (`kick`).
- `src/audio.js` — procedural sfx.
- `TICK_MS` (main.js) — the watch cadence; **the hit-stop lever** (slow it during
  the breach hold to savor the 50% crossing, then snap back).
- `research/juice-model.md` — the existing juice research + EXEC-phase spectacle
  plan. **Read this first** for the session.

## Directions to explore (the session's menu)

1. **Hit-stop / slow-mo at the 50% crossing** — the Extreme Fever move. During the
   breach-hold ticks, drop `TICK_MS` way down (or freeze a beat), swell brightness
   + bloom + a rising audio tone; snap back when it locks or the scan claws it out.
2. **The escalation arc** — ignition beat (spray lands, dense feedback) → build
   (reproduction spike, embers 7→hundreds — already happens; amp it) → breach
   climax → resolve. Design what escalates *visually/aurally* at each beat.
3. **Near-miss tension (the "reach")** — when coverage hovers at ~48–50% and the
   scan is clawing it back, lean into the dread: pulsing edge, tightening audio.
4. **Two distinct climaxes** — BREACH (triumph) vs TRACED (doom). The loss wants
   its own flatline spectacle, not just a red flash.
5. **Monochrome-amber constraint** — the palette is one hue, so **brightness,
   bloom, scanline surge, and shake** are the amplification vocabulary (not color).
   The CRT filter (`styles.css`) is the canvas.
6. **Audio as the "Ode to Joy"** — a signature breach sting; escalation cues that
   ramp with coverage; a doom drone for the trace.

## Constraints / guardrails

- Respect `prefers-reduced-motion` (juice-model §6): keep the STATE changes, drop
  the rapid flashes / slow-mo strobing.
- Keep it balance-neutral — climax is presentation; don't let a hit-stop change
  the per-tick ratios that decide win/lose (freeze *rendering/pacing*, not the
  sim's relative rates).
- One shot per run makes this the emotional peak of the session — spend the
  boldness here.
