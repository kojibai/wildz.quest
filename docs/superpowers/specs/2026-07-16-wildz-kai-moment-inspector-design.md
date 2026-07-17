# Wildz Kai Moment Inspector Design

## Purpose

The Living Command Center will explain the complete Kai Klok coordinate without increasing its closed footprint or weakening its cockpit character. The Eternal Pulse telemetry becomes a quiet disclosure control. A concise deterministic moment statement remains visible directly beneath the pulse, while an anchored popover reveals the complete calendar, geometry, meanings, colors, and mathematical specification.

The implementation follows the canonical logic in `kojibai/klok` and the Receiz live-player presentation. It does not invent a second calendar or use generated interpretation.

## Language law

Canonical proper names remain exact: Solhara, Aquaris, Flamora, Verdari, Sonari, Kaelith; Awakening Flame through Krowned Light; Aethon through Liora; and Ignite, Integrate, Harmonize, Reflekt, Purify, and Dream.

Explanatory prose uses readable standard English. Source spellings that replace `c` with `k`, or place `s` where standard English uses `c`, are normalized. This normalization changes presentation only; it must not alter sequence, meaning, colors, elements, geometry, formulas, or deterministic selection logic. The UI may label the expanded source-aligned material “Full teaching,” but it will present normalized prose rather than duplicate archaic spelling.

## Closed Command Center behavior

The existing Eternal Pulse block becomes a semantic button with an explicit accessible label and expanded state. It retains its current size, color behavior, and location.

Directly beneath `☤ KAI {pulse}`, the block shows one compact statement derived only from the current Kai coordinate. It includes the active harmonic day and its governing action in one or two short lines. It must remain legible on mobile without pushing the telemetry header wider.

Example structure:

> Verdari opens the Heart Spiral through the Air Gate. Amarin deepens compassionate presence; the Reflection Ark asks you to make connection coherent before acting.

No language model, network request, randomness, locale-dependent calendar, or mutable content service may produce this statement.

## Popover interaction

Tapping or pressing the Eternal Pulse block opens a popover anchored within the Command Center. On narrow mobile screens it becomes a contained inset sheet inside the existing command sheet, not a new browser-level modal. It must:

- add no space while closed;
- remain inside the dark Command Center surface;
- avoid covering the close control or permanent browser safe area;
- trap no focus when closed;
- close with its icon control, Escape, or a second press on Eternal Pulse;
- restore focus to Eternal Pulse;
- expose `aria-expanded`, `aria-controls`, a dialog label, and a live current-coordinate summary;
- honor reduced motion;
- preserve scroll position in the underlying Command Center.

The popover uses compact disclosure rows so the complete teaching is available without rendering every long paragraph simultaneously.

## Information architecture

### 1. Current moment

The top section presents:

- `BEAT:STEP:PULSE`, zero-padded;
- Eternal Pulse with the caduceus mark before KAI;
- harmonic year, month, day, and week;
- harmonic day name;
- eternal month name;
- eternal week name;
- chakra ark;
- chakra/gate;
- active geometry and color;
- authority: local continuity, admitted, or shared world;
- the full deterministic coordinate.

### 2. What this moment is saying

The statement engine composes a bounded message from canonical table entries:

1. harmonic day supplies the immediate bodily center, element, geometry, and action;
2. eternal month supplies the larger developmental field;
3. eternal week supplies the current seven-part integration theme;
4. chakra ark supplies the current daily directional movement;
5. beat, step, and pulse locate the statement inside that movement without inventing a forecast.

The same coordinate must always produce byte-identical structured meaning and the same displayed statement.

### 3. Six harmonic days

The inspector lists the canonical six-day cycle:

1. Solhara — Root; deep crimson; Earth and primal fire; square foundation; stability, anchoring, and sacred will.
2. Aquaris — Sacral; ember orange; water in motion; vesica piscis; flow, feeling, connection, and creativity.
3. Flamora — Solar Plexus; golden yellow; solar fire; radiant triangle; clarity, confidence, and aligned will.
4. Verdari — Heart; emerald green; air and earth; hexagram; love, compassion, union, and coherent presence.
5. Sonari — Throat; deep blue; wind and sound; sine wave within a pentagon; truthful expression and resonant command.
6. Kaelith — Crown; violet-white; ether; twelve-petaled crown; remembrance, stillness, insight, and direct knowing.

### 4. Seven harmonic weeks

The inspector lists Awakening Flame, Flowing Heart, Radiant Will, Harmonic Voh, Inner Mirror, Dreamfire Memory, and Krowned Light. Each row includes its ordinal, chakra emphasis, canonical color, element, geometry, and normalized canonical meaning.

### 5. Eight eternal months

The inspector lists:

1. Aethon — deep crimson; Earth and primal flame; square base and tetrahedron ignition; emergence and rooted purpose.
2. Virelai — orange-gold; water in motion; vesica piscis into lemniscate; emotional entrainment, creativity, and union.
3. Solari — golden yellow; fire of will; upward triangle with concentric light; clarity, leadership, and precise action.
4. Amarin — emerald teal; deep water and breath; inward six-petaled lotus; compassion, healing, grace, and surrender.
5. Kaelus — sapphire blue; ether; octahedral fractal mirror; multidimensional intelligence and crystalline language.
6. Umbriel — violet-black; transmutive void; inward torus knot; shadow integration and reclaimed sovereignty.
7. Noktura — indigo-rose iridescence; dream plasma; nested spiral merkaba; lucid memory and divine imagination.
8. Liora — white-gold prism; coherent light; dodecahedron of pure ratio; integration, fulfillment, and source remembrance.

The engine and UI use the single canonical spelling `Noktura` even where upstream source capitalization varies.

### 6. Six chakra arks

The inspector lists Ignite, Integrate, Harmonize, Reflekt, Purify, and Dream. It shows the canonical expanded ark name, active centers, color, element, geometry, and normalized meaning. Existing Kai data controls the selected ark; the UI does not infer it from wall-clock hours.

### 7. Deterministic mathematics

The math section explains and displays the exact contract:

- Golden Breath pulse: `T = 3 + √5 = 2φ² ≈ 5.2360679775 seconds`;
- inhale: `1 + √5` seconds;
- exhale: `2` seconds;
- frequency: `1 / (3 + √5)` Hz;
- semantic lattice: `11 pulses/step × 44 steps/beat × 36 beats/day = 17,424 pulses`;
- continuous daily closure: `N_day = 17,491.270421 pulses`;
- fixed-point daily closure: `17,491,270,421 μpulses`;
- grid day: `17,424,000,000 μpulses`;
- day duration: `17,491.270421 × (3 + √5) ≈ 91,585.480937 seconds`;
- calendar: 6 days/week, 7 weeks/month, 42 days/month, 8 months/year, 336 days/year;
- Genesis: `2024-05-10 06:45:41.888 UTC`, Unix milliseconds `1715323541888`;
- engine indices: beats `00–35`, steps `00–43`, inner pulses `00–10`;
- day boundary closure delta: `67.270421` pulses beyond the semantic grid;
- exact beat phase: `67,270,421 / 484,000,000`;
- exact step remainder: `1,270,421 / 11,000,000` after six full steps;
- micro-pulse conversion uses half-even rounding;
- modulo and boundary calculations use integer `BigInt`, never accumulated floating-point seconds.

The text distinguishes semantic indexing from continuous closure. It must never falsely say that a Kai day ends at exactly Beat 36.

### 8. Coordinate legend

The legend explains:

- Eternal Pulse: total Golden Breaths since Genesis;
- Beat: one of 36 semantic day positions;
- Step: one of 44 positions inside the active beat;
- Pulse: one of 11 breaths inside the active step;
- Day: one of 42 positions inside the month;
- Week: one of seven six-day cycles;
- Month: one of eight harmonic fields;
- Year: a zero-based 336-day harmonic cycle;
- authority: whether the coordinate is local, admitted, or shared-world state.

## Code architecture

`kai-klok-moment.ts` remains the sole arithmetic authority. A separate `kai-klok-teachings.ts` module owns immutable canonical presentation tables and normalization-approved copy. A pure `deriveKaiMomentExpression(moment)` function returns structured IDs and bounded display strings. The function accepts a `KaiKlokMoment`; it does not accept arbitrary prose or time.

`WildsKaiMomentInspector.tsx` owns disclosure state, accessibility, sections, and rendering. `WildsCommandCenter.tsx` only passes the current moment and palette, preventing the main cockpit component from absorbing the full teaching dataset.

## Error and fallback behavior

The inspector renders only from a valid `KaiKlokMoment`. Invalid timestamps already fail closed at the moment boundary. If a teaching lookup is missing, the compact statement falls back to the verified coordinate and names without inventing meaning. A missing description must be visible in development tests and must never break the Command Center.

No network is required. The entire inspector works offline and paints with the Command Center’s first render.

## Performance

The tables are static data. The selected statement is memoized by the deterministic coordinate. Long descriptions mount only when the popover is open, and collapsed teaching rows avoid expensive layout. No animation loop, canvas, image, audio, dependency, or API call is added.

## Testing and acceptance

Tests must prove:

- Genesis produces the exact zero coordinate and teaching selection;
- all six days, seven weeks, eight months, and six arks are complete and uniquely ordered;
- all colors, elements, geometries, and canonical meanings are present;
- prose normalization does not change canonical proper names or formulas;
- equal coordinates return equal structured expressions and text;
- Beat, Step, and Pulse boundaries select valid data without off-by-one errors;
- the closure math and zero-based ranges remain exact;
- the compact statement appears beneath Eternal Pulse;
- the popover adds no closed layout space;
- keyboard, focus, Escape, reduced-motion, mobile overflow, and dark-sheet behavior work;
- no network, randomness, external dependency, or generated interpretation enters the feature.

Production verification includes lint, typecheck, focused tests, the full suite, production build, and mobile browser interaction at the existing Command Center viewport.
