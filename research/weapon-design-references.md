# Weapon-Design References — dial & variable survey

*Research notes for the OVERRIDE overhaul (2026-07-14). Seven scouts surveyed
"design-your-own-weapon" games for the **dials** they expose and — more important —
how they make builds feel **distinct** rather than merely bigger. Feeds the
turret/trail/ember model in [`ember-model.md`](ember-model.md).*

---

## 0. The convergent law (all seven agreed)

**Distinctness never comes from magnitude. It comes from behavior/shape + how the
weapon is composed.** "Don't make it stronger, make it go somewhere different." Two
weapons at identical DPS feel different because of *delivery geometry* and *the
order you assembled them in*, never because one number is larger.

This is the whole justification for the overhaul: our old accumulator was a scalar,
and a scalar can only say more-vs-less.

---

## 1. Per-game dial survey

### Noita — the wand as a *sequencer* (highest-priority reference)

- **Dials:** cast delay (s), recharge time (s), mana max, mana charge speed
  (units/s), spells-per-cast (int), wand capacity (slots), spread (°), spell wrapping.
- **The mechanic:** modifier spells attach to the **next** non-modifier spell;
  multicast draws N and wraps around the list when it runs short. **Order is a
  sequencer** — moving a modifier from slot 2 to slot 5 makes it affect a different
  spell firing at a different time. Reversed order = a different weapon (spray/stall
  vs. steady-chain), same spells.
- **Steal:** this *is* our accumulator-along-the-trail (§3 of ember-model). Confirmed
  worth keeping; order is the deepest, cheapest source of distinctness.

### Path of Exile — behavior supports reshape *coverage*

- **Dials / math:** `added` (flat, once) → `increased` (additive % pool, diminishing)
  → `more` (multiplicative, dominant) → `conversion`. Most support gems give `more`.
- **Behavior supports:** **Fork** (split 60° on hit), **Chain** (ricochet ×4),
  **Pierce** (pass through ×6), **GMP** (fan of +4, −26–35% each), **Spell Echo**
  (auto-repeat). Priority Pierce > Fork > Chain resolves stacked behaviors.
- **Steal:** these map 1:1 to our shape knobs — Fork ≈ **branch**, Pierce ≈ **conduit
  IQ**, Chain ≈ **leapfrog IQ**, GMP ≈ **direction/spread**, Spell Echo ≈ **rate**.
  PoE proves shape should be *named, slottable* content, not a hidden default.

### Borderlands — manufacturer = a *rule*, not a number

- **Dials (the classic stat vector):** damage, fire rate (0.8–20/s), reload (1.2–5s),
  magazine (1–100+), accuracy % (bloom cone), handling/recoil, pellet count (1–12+),
  crit mult (+50–200%), elemental chance (5–35%) + elemental damage, projectile
  speed, ammo regen/amp.
- **Behavior parts:** Tediore (reload = *throw the gun* as a bomb), Torgue (everything
  explodes), Jakobs (crits **ricochet**), Maliwan (dual-element charge), Hyperion
  (reverse-recoil — accuracy improves as you hold), Vladof (extreme rate).
  **Anointments** = conditional overlays ("after Action Skill, next 2 mags +100%
  splash") — rules gated on an event.
- **Steal:** the *reload verb* → a burst-vs-sustain **energy** identity (dump remaining
  budget as a detonation, Tediore-style); **anointment** → conditional-trigger cards
  (below).

### Nova Drift — *options, not stats*

- **Dials:** weapon families (Railgun/Flak/Dart/Grenade/Thermal Lance/Pulse) reshaped
  by mod axes (ricochet, homing, pierce/fragment, split/shrapnel, wave, volley/salvo).
- **Option-upgrades:** Ricochet drops projectile count but forces angle-reading;
  Thermal applies *vulnerability* (an enabler, not +damage); Barrage forces all weapons
  to fire (rhythm discipline). Each locks an incompatible playstyle.
- **Steal:** keep upgrades as *option/behavior* changes, never raw stat inflation —
  already our shop philosophy, reconfirmed.

### DRG / Cosmoteer / Warframe — named-risk trade-offs & iterative choice

- **DRG overclocks:** tiered **Clean / Balanced / Unstable**. Unstable = +200% damage,
  −ammo/−reload. Naming the risk justifies asymmetric swings.
- **Cosmoteer:** a railgun is *N* accelerators; each adds velocity/damage but +0.13s
  charge + weight. The weapon isn't "pick a stat," it's **"add another?" answered 8
  times** — a wide-but-shallow decision tree you *author*, can't optimize.
- **Warframe rivens:** 3–4 random stats, one negative; authorship = learning which
  negatives don't matter.
- **Steal:** **OVERCLOCK cards** (`+1 branch, −40% energy/ember`; `rate ×2, scan +20%
  faster`) and **same-primitive stacking** for iterative scaling.

### Magicka — a tiny alphabet + cancellation (most novel for us)

- **Primitives:** 8 elements (Water, Fire, Cold, Lightning, Earth, Life, Shield,
  Arcane); queue up to 5, pick a delivery verb (self / weapon / area / beam).
- **Rules:** physical & monotonic — Water+Cold=Ice, Fire+Water=Steam, Cold+Lightning
  = superconductive, Life vs. undead. **Opposites cancel in the buffer** (Fire↔Cold,
  Water↔Lightning, Life↔Arcane) — nonsense recipes fizzle and waste slots, a
  self-inflicted guardrail that keeps a huge space legible.
- **Steal (the big one):** a **5-letter opcode alphabet** for OVERRIDE —
  `SEED · FLOW · FORK · WALL · DECAY` — sequenced (Noita), combined into shapes (PoE),
  with opposites that cancel (Magicka):
  - `FLOW+FORK` → branching flood — the **fractal**
  - `FLOW+WALL` → directed lance — the **line**
  - `DECAY+SEED` → sparse scattershot — the **buckshot**
  - `2×FLOW` → halve spread-ms — a **fast tide** (Cosmoteer stacking)
  - `FLOW↔WALL`, `FORK↔DECAY` cancel — waste energy budget
  Thematically ideal: a 1983 hacker writes intrusions in an **assembly opcode
  alphabet**. That *is* the fantasy, not a bolted-on system.

### Vampire Survivors / Brotato / Halls of Torment — auto-fire distinctness (our exact constraint)

- **Archetypes (hands-off, no aim):** Whip (melee arc, pierce-all), Knife (fast
  directional line, ~0.1s), Garlic (dense slow aura, status), Magic Wand (homing,
  pierce 1→5), Rune Tracer (bouncing chaos), Santa Water (persistent zones).
- **What encodes each shape:** fire interval, area radius, projectile count, pierce,
  duration, knockback. Distinctness is *spatial signature*, zero aiming — identical
  to our watch-don't-click constraint.
- **Steal:** the starter weapon catalog (§4).

---

## 2. OVERRIDE dial taxonomy — have vs. steal

| Layer | The dial | Reference | Status |
|-------|----------|-----------|--------|
| **Magnitude** | energy / accumulator | Borderlands damage; PoE added/increased/more | have |
| **Composition** | card/opcode order along the trail | **Noita sequencer** | have |
| **Behavior / shape** | fork, pierce, spread, homing, direction | **PoE** supports; Nova Drift | have as defaults — *promote to content* |
| **Cadence** | spread rate (ms) | VS fire interval | have (TRANSFER) |
| **Risk framing** | unstable trade-offs, stacking | **DRG / Cosmoteer** | **missing — steal** |

---

## 3. The steal list (what to add)

1. **Opcode alphabet** (`SEED·FLOW·FORK·WALL·DECAY`) — small, combinable, order-matters,
   opposites-cancel. Deep through combination, not card count. *Recommended shape model.*
2. **OVERCLOCK / unstable cards** (DRG) — named-risk trade-offs: big behavior boost,
   real cost. Pairs with the aggression dial.
3. **Behavior as first-class content** (PoE) — shape is something you *build*, whether
   as opcodes (#1) or a GROWTH deck.
4. **Conditional-trigger cards** (Borderlands anointments) — `when 25% cracked → flip
   spread direction`; `on burning a vault → spike seed probability 800ms`. Creates a
   visible turning point mid-watch — ideal for a watch-game.

---

## 4. Starter weapon catalog — distinct playstyles from the five knobs

Proof the model yields VS-style divergence. Illustrative presets (calibrate in
`preview/`); knob ranges from the scouts: energy 0.5–5.0, spread radius 2–20 cells,
spread-ms 100–1000, branch factor 0–0.5, pierce depth 1–5.

| Weapon | prob | direction | rate | branch | Board silhouette | Character |
|--------|------|-----------|------|--------|------------------|-----------|
| **KNIFE** (lance) | high | single → | fast | none | tight directed line | War-dialer |
| **WHIP** (bruiser) | ~0.95 | wide arc | fast | low | dense advancing wall | Shotgunner |
| **GARLIC** (attrition) | ~0.3 | omni | slow | med | slow expanding aura | — |
| **RUNE TRACER** (chaos) | ~0.5 | omni | med | **high** | fractal sprawl | — |
| **SANTA WATER** (artillery) | clustered | 3-way burst | burst | med | deep area-drops | Catapultist |
| **MAGIC WAND** (surgical) | low | homing→vault | slow | none | precise vault strikes | — |

Same five knobs → six different things to *watch*.

---

## 5. OPEN DECISION (unresolved — for the designer)

How is the behavior/shape layer expressed in the deck?

- **A — Opcode alphabet** (recommended): one small combinable instruction set. Deep,
  on-theme, legible for a watch-game.
- **B — PoE-style GROWTH deck:** shape as its own deck of named cards. Deepest craft,
  but a second assemble surface on the 80×40 screen + more onboarding.
- **C — Character + OVERCLOCK cards:** shape mostly from run-start character plus a few
  unstable trade-off cards. Leanest, least in-battle build-craft.

Not yet decided; `ember-model.md` currently assumes shape defaults per tier (§6) and is
compatible with any of the three. Resolve before speccing the GROWTH/opcode deck.
