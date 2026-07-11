# AUDIO APPENDIX — *OVERRIDE*

**Verdict: synthesize the bleeps, sample a tiny set of textures.** The
interactive layer (card fires, crack ticks, multiplier chains, win/fail stings)
is ~100 lines of procedural WebAudio — zero licensing, zero download weight, and
exactly the expected retro timbre. Sample only what you can't convincingly fake:
electromechanical clatter and the number-station bed. Keep the sampled set small
enough to hand-audit every license.

---

## Synthesize (WebAudio oscillators — no files, no licensing)

| Game event | Synth recipe |
|------------|--------------|
| Card placed / UI confirm | triangle 600 Hz, 50 ms pulse |
| `BRUTE +` fires | short square blip, pitch rises per stacked add |
| `XOR ×` fires (the payoff) | square arpeggio up — pitch scales with the multiplier |
| Crack-% tick | square 800 Hz, tiny decay per point |
| ICE attack / buffer overflow | noise burst + square flicker, 50–150 ms |
| `INTERRUPT` / error | sawtooth 200→100 Hz descend |
| `2600Hz` card | literal **2600 Hz sine** (the real phreak supervisory tone) |
| `BLUE BOX` | MF pairs from {700, 900, 1100, 1300, 1500, 1700} Hz (KP = 1100+1700) |
| `BOMBE` / decrypt | 600–800 Hz sine, dot/dash CW timing |
| Win jingle / fail sting | pre-bake with **JSFXR** (Unlicense/PD), embed as ~2–5 KB base64 |

Build as a small preset library (`sfx.card()`, `sfx.crack()`, `sfx.mult(n)`,
`sfx.alarm()`), same shape as jsfxr. ADSR via `GainNode` ramps; `type` =
`square` for NES/arcade, `sawtooth` brighter, `triangle` softer, plus a noise
buffer for glitches.

Tools: **JSFXR** (https://github.com/chr15m/jsfxr, Unlicense/PD),
**ChipTone** (https://sfbgames.itch.io/chiptone, CC0 output),
**MDN OscillatorNode** reference.

---

## Sample (verified CC0 / Public-Domain only)

| Texture | Source | License |
|---------|--------|---------|
| Number-station ambient bed (the `finding_numbers` thread) | The Conet Project — archive.org `ird059` / `The-Conet-Project` | **CC0 1.0** |
| Teletype clatter (log output) | archive.org `78_teletype-machine_gbia3000941a` | **Public Domain** |
| Dot-matrix printer (result screen) | Freesound `viertelnachvier/181420` | **CC0** |
| Floppy seek (loading) | BigSoundBank — 3.5" floppy reading | **CC0-equivalent** |
| Relay / mech-key click (card slot) | Freesound `FOSSarts/740267`, `GeorgeHopkins/537244` | **CC0** |
| CRT power-on & flyback whine (boot / "terminal burns out") | Freesound `Fission9/693863`, `693860` | **CC0** |
| Modem handshake (start of run) | Wikimedia `Dial_up_connection.ogg` | **Public Domain** |

---

## Licensing strategy & caveats

- **Ship rule:** CC0 or Public Domain only for samples. One `CREDITS.txt` line
  covers courtesy attribution; nothing is legally required.
- **Not CC0 (usable but read the terms):** Pixabay / Mixkit are royalty-free
  house licenses, *not* public domain — fine to use, don't treat as CC0.
- **Avoid outright:** the Shortwave Radio Audio Archive and OrangeFreeSounds WAVs
  are **CC-BY-NC** (non-commercial = unusable if you ever sell it). Avoid
  **CC-BY-SA** (ShareAlike is legally murky for a proprietary game).
- **Verify-on-page:** a couple of Freesound hits (e.g. the craigsmith teletype)
  reported ambiguous licenses — confirm CC0 on the actual page before pulling, or
  use the PD archive.org teletype instead.
- **Gap:** no clean isolated **punch-card** clip surfaced as CC0 (only embedded in
  PD educational films — the archive.org IBM 029 Key Punch reels). Either extract
  from those (PD, safe) or synthesize the *ka-chunk*.

**Net:** the whole game can ship with ~7 tiny CC0/PD samples plus a procedural
synth. No paid assets, no attribution obligations, and the number-station bed
ties the audio identity straight back to `finding_numbers`.

---

## Licensing cheat-sheet

| License | Commercial | Attribution | Ship it? |
|---------|-----------|-------------|----------|
| **CC0 / Public Domain** | yes | no | ✅ prefer |
| **CC-BY** | yes | yes (one credits line) | ✅ ok |
| **CC-BY-SA** | yes | yes | ⚠️ avoid (ShareAlike risk) |
| **CC *-NC** | no | — | ❌ never (non-commercial) |
| Pixabay / Mixkit house | yes | no | ✅ ok, read terms |
