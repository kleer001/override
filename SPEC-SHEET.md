# SPEC SHEET — *OVERRIDE* (Tier 1 MVP)

Technical spec for the buildable vertical slice. Numbers are starting points to
tune, not gospel.

---

## Grid (BANKED: 80×40 logical)

Monospace glyphs run ~1 wide : 2 tall, so a 1-char cellular-automata cell would
read as a tall sliver. Treating the logical grid as **80×40** cancels that: the
doubled row count makes each cell's on-screen footprint near-square, and it lifts
the board to **3,200 cells**. It's a game — the *look* sells "1983 terminal"
(VT100/IBM-PC-ish), not the exact row count.

### Row budget (40 rows)

| Rows | Region | Cells |
|------|--------|-------|
| 1–3 | HUD: status · lockdown + CODE bar · drifting address ticker | 240 |
| **4–36** | **the CA field (living board)** | **33 × 80 = 2,640** |
| 37 | program track (the 3-card sequence + playhead) | 80 |
| 38 | CRACK / TERRITORY bar | 80 |
| 39–40 | scrolling log | 160 |

**Living field = 2,640 / 3,200 = 82.5% of the screen**, most of it churning every
tick — the "everything moves" target, before counting the drifting HUD overlays.

Render each CA cell as one glyph on the 80×40 grid; pick a near-square CRT
font/scale to taste (cosmetic, not a code change). Field origin is rows 4–36; the
HUD and controls are fixed furniture the CA never touches.

---

## The living board (cellular automaton)

**Core idea:** crack % *is* territory on a living CA field, so the number going up
is literally a stain spreading across the screen.

Three factions fight over cells: your **intrusion** (spreading worm), the
system's **ICE** (pushing back), and **neutral memory**. The 3-card program feeds
*infection pressure* into the CA each pass. **Crack % = fraction of the grid you
hold.** Win by controlling the core sector / resolving the CODE; lose if ICE
reclaims your beachhead or lockdown runs out.

### Cell model & CA rules (per tick)

Each cell = `{ owner: none | worm | ice, strength: 0–9 }`. Double-buffered grid,
deterministic under seeded RNG.

- **Infect:** a cell spreads to an orthogonal neighbor when
  `myStrength > neighborStrength`. Both worm and ICE do this, so borders churn.
- **Grow:** an interior cell (all neighbors same owner) slowly gains strength →
  held territory hardens.
- **Decay/die:** an isolated cell (surrounded by enemy) loses strength each tick
  and flips → no static blobs.
- **Border war:** contested cells flicker between owners tick to tick — this is
  most of the on-screen motion.

### Islands & links

The grid splits into 2–4 **sectors** ("islands": `KERNEL`, `IO.SYS`, `SWAP`…)
joined by **link lines**. Your infection can only cross to a new island through a
link you control; **ICE cutting a link** isolates (and starves) your cells on the
far side. `FORK()` seeds a beachhead on a fresh island → two fronts.

### Overlays that never stop moving

- **Addresses** — each island tagged with a hex address that drifts/increments
  every tick (`0x7F3A → 0x7F3B…`): ambient flicker.
- **Strength digits** — border cells show a 0–9 that ticks as the war rages.
- **CODE bar** — the launch code, e.g. `7 _ 4 _ _ 1 _ _`, with digits **locking
  in** as you capture key "vault" cells. Direct callback to `finding_numbers` —
  you *find the numbers* by taking ground. This is the real win meter; territory %
  is the pressure behind it.

### Board mock (80 wide; ~14 of the 33 field rows)

```
 TIER 1: THE MACHINE     NODE 1/3     ROOT:120        LOCKDOWN[####......] 6/10
 CODE  7 _ 4 _ _ 1 _ _    ::  vault cells resolve digits    ADDR 0x7F3A -> 0xA10C +
+------------------------------------------------------------------------------+
| 0x7F3A ·:·=+*@@%#4  @@·      ══╗          2 #X#:·..  ·:=+*@@@%#  0xA10C  ·:· |
| :·=+*@@@@@%*=3 @@@·  @@2   ═══╬════       ·:=+*@@@· 5   @@@%#X#:  ==+*@·  ·:  |
| ·+*@@@@8@%#=· @@@@@·        ║             +*@@@@@%#=· @@·  #X#:·.  @@@@ %*=·  |
| @@@%#X#:·  @@@@@· 1         ║       ╔═════@@@%9#X#·  ==+  ·:=+*@@@@@%#=  ·:·· |
| %#X#:·.. @@@ 6 @@·  ══╗     ╚═══════╝  #X#:· @@@@ %*=·   =+*@@@%#X#:· @@@@@·  |
| ·:· KERNEL          ═╬═  <link cut!>       IO.SYS         ·:=+ SWAP  @@@@%#X# |
| ·:=+*@@@@@@%#= 2  @@@@@·     ║          ·:=+*@@@@@%#X#· 3  @@@@%#X#:. 7  @@·  |
| =+*@@@%#X#:· @@@@@   @@·   ══╝          @@@@%#X#:·.. @@@·   #X#:· @@@ 4 @@@%*= |
| @@%#X#:· 8 @@@@@%*=·       ║            %#X#:· @@@ 2 @@@·  ·:=+*@@@@@%#=· ·:·· |
| ·:·=+*@@@%#X#:·  @@·    ════╬══         ·:=+*@@@· 9  @@@@· @@%#X#:·. @@@@ %#X# |
| #X#:·.. @@@@ 5 @@@@%*=     ║            +*@@@@%#X#:  @@·   ·:=+*@@@%#=·  ==+*@ |
| ·:=+*@@@@@%#=· @@@· 3      ══════╗      @@@%#X#:·.  ·:=+*@@@@%#X#:· @@@@ 6 @@· |
+------------------------------------------------------------------------------+
| PROGRAM  [ BRUTE+3 ][ XOR x2 ][ FORK() ]   ^                                  |
| CRACK [##################################################............] 71%    |
| > FORK seeded beachhead in SWAP (0xA10C). worm +14 cells.                     |
| > ICE cut KERNEL<->IO.SYS link. isolated cells starving. code digit 4 LOCKED. |
+------------------------------------------------------------------------------+
```

Legend (monochrome density ramp): `· : = + * @ %` = your infection rising in
strength · `# X █` = ICE · `═ ║ ╬ ╗ ╝` = links · digits = per-cell strength / CODE.

---

## Battle model

- The 3-card program sits on a track. A **playhead** sweeps left→right, firing
  each card, then loops. One full sweep = **1 pass**.
- **Accumulator** resets to 0 at the start of each pass. Cards apply in order:
  `+` adds, `×` multiplies the accumulator-so-far. At pass end, the accumulator
  becomes this pass's **infection pressure**, applied to the CA.
- **Two fail clocks (the DEFCON tension):** `LOCKDOWN = 10 passes` (timeout) **and**
  ICE reclaiming your beachhead / core sector.
- **Timing:** ~1.5 s/pass (3 cards × ~0.4 s beat + a gap). A Tier-1 battle runs
  ~12–15 s. Snappy now; deeper tiers add lanes/islands, passes, and card slots.

---

## Cards drive the CA (5-draw / 3-slot, unchanged)

| Card | Effect on the field |
|------|---------------------|
| `BRUTE +3` | +3 infection strength this pass → your cells overpower more borders |
| `XOR ×2` | ×2 **spread rate** this pass → worm jumps 2 cells instead of 1 |
| `NOP` sled | primes a burst: next card's CA effect doubled (2+ NOPs in a row) |
| `FORK()` | seed a new infection cluster on another island (second front) |
| `INTERRUPT` | freeze ICE spread for 1 pass (whole enemy field stalls) |
| `GOTO ↑` | re-apply the previous card's CA effect |

Accumulator/order still rule: adds early build strength, `×` late detonates
spread. Same math as a bare bar — now visible as a spreading stain.

### Tier-1 starting deck (10 cards)

| Card | Effect | Type |
|------|--------|------|
| `BRUTE +3` ×4 | +3 to accumulator | add |
| `XOR ×2` ×2 | ×2 accumulator so far | mult |
| `NOP` ×2 | nothing; 2+ in a row → next card ×2 (sled) | filler / combo |
| `FORK()` ×1 | spawn beachhead on another island | offense/utility |
| `INTERRUPT` ×1 | stun ICE spread 1 pass | defense |

Core tension in 3 slots: pure offense races the ICE vs. spending a slot on
`FORK`/`INTERRUPT` to survive longer and grind. Both viable → real decisions from
turn one.

---

## Economy / progression

- **Win node** → draft 1 of 3 new cards into the deck; +ROOT.
- **Clear 3 nodes** → zoom out to Tier 2 (adds a 2nd island cluster + upgrades the
  loop toward `HAND 6 / SEQ 4`).
- **Lose battle** → fail skin, run ends, keep ~50% ROOT.
- **ROOT (persistent)** buys: extra starting cards, +1 hand size, unlock new card
  types in drafts, retry-from-a-deeper-tier.

---

## Data model (sketch)

```js
Cell   = { owner: 'none'|'worm'|'ice', strength: 0 } // 0–9
Card   = { id, name, kind: 'add'|'mult'|'filler'|'defense'|'utility', value, fx(state) }
Board  = { w: 80, h: 33, cells: [...],            // double-buffered
           islands: [{ id, addr, rect }], links: [{ a, b, owner }] }
Battle = { crack: 0, target: 100, pass: 0, lockdown: 10,
           board: Board, code: [7,null,4,null,null,1,null,null],
           program: [Card, Card, Card], playhead: 0 }
Run    = { tier: 1, node: 1, deck: [...], root: 120 }
```

Resolution is a deterministic tick loop: apply the current playhead card to
infection pressure → run one CA pass → advance the playhead → check win/fail.
Pure function of state → trivially unit-testable with `node --test` (same harness
as `finding_numbers`).

---

## Tech (reused from `finding_numbers`)

Vanilla ES modules, **no build step**. WebGL CRT shader + amber styling lifted as
is. WebAudio for card SFX (procedural — see audio appendix). Seeded `mulberry32`
RNG for reproducible draws, boards, and runs.

---

## MVP build order

1. Port grid renderer + CRT filter; render a static 80×40 Tier-1 screen.
2. Card data + ASSEMBLE (draw 5 / place 3).
3. Battle tick loop: accumulator + CRACK bar (no CA yet) — tune the number feel.
4. Add the CA living board + islands/links (the territory war replaces any lane).
5. Result screen + fail skin + node advance.
6. Draft-between-nodes + ROOT meta.

→ Steps 1–6 = a complete Tier-1 vertical slice.
