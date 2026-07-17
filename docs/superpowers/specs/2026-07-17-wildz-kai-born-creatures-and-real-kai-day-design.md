# Wildz Kai-Born Creatures and Real Kai-Day Design

Date: 2026-07-17

Status: Approved

## Purpose

Make the real Kai Klok moment a living source of world expression and creature identity without replacing the authored Wildz worlds, districts, habitats, or catalog. The moment must affect what the world feels like now, which valid creatures are most likely to appear, and the permanent identity of a creature born through capture.

The system must remain additive and lightweight. It may not introduce network work, large assets, render-loop React state, avoidable remounts, or proof migrations that invalidate existing cards.

## Approved Outcomes

1. New captures permanently seal a Kai Birth Profile into a versioned portable card.
2. The current moment influences which habitat-valid creatures are shown.
3. Chakra, Ark, harmonic day, week, month, geometry, and meaning affect color, markings, aura, motion, temperament, personality, and card narrative.
4. The birth moment redistributes stats within strict limits while preserving the catalog stat total.
5. The card back displays the Birth Pulse and the label `Cadueus KAI`, then translates the moment into emotionally resonant creature language.
6. The real Kai day drives a continuous sunrise-to-night cycle across six Arks.
7. Beat and Ark changes receive tasteful, deduplicated visual and synthesized-audio acknowledgements.
8. Existing worlds and districts retain their authored palettes beneath a bounded atmospheric overlay.
9. Existing generator-v1 cards remain valid and unchanged.

## Architectural Approach

Use one shared family of pure Kai projections.

- `deriveKaiKlokMoment` remains the canonical clock projection.
- A new creature-birth projection converts an exact moment plus catalog and encounter facts into a proof-sealable birth profile.
- Encounter affinity uses the same semantic axes but produces only bounded selection weights over habitat-valid candidates.
- The existing world-expression projection expands to provide continuous light, sky, fog, sun, particle, and transition values.
- UI and Three.js components consume projections. They do not reinterpret Kai meaning independently.

This keeps the meaning, geometry, colors, and timing consistent across encounters, cards, card backs, the world, and transition effects.

## Portable Card Versioning

### Legacy cards

Generator-v1 cards continue using their current seed, trait derivation, manifest fields, and verifier. Verification must reproduce the existing v1 output exactly. Imported and already-owned cards must never be recolored, restatted, or rewritten by the current world moment.

### New cards

New captures use `variant.generatorVersion: 2`. The v2 variant remains within the existing card manifest schema unless implementation proves a schema discriminator is required for safe decoding. The generator version selects the verifier and deterministic derivation path.

The v2 sealed basis includes:

- form ID
- encounter ID
- owner Receiz ID
- capture timestamp
- Kai pulse
- battle transcript digest
- generator identity

The complete derived traits and Kai Birth Profile are included in the manifest and covered by the existing canonical digest and proof seal.

### Kai Birth Profile

The compact profile contains only durable facts needed to reproduce identity and prose:

- canonical pulse and lattice coordinate
- `Cadueus KAI` display coordinate
- chakra, gate, Ark, harmonic day, week, and month identifiers
- semantic geometry identifiers and side count
- moment color/accent
- emotional signal identifiers derived from approved Kai teachings
- encounter affinity identifiers
- personality/character trait identifiers
- palette influence and marking topology identifiers
- zero-sum stat shift record
- birth-profile digest/version

Long teaching paragraphs are not duplicated in every card. Stable identifiers are sealed, while deterministic projection tables produce display prose.

## Creature Encounter Affinity

The moment affects which creatures are shown without breaking habitat truth.

1. Begin with candidates already valid for the player position, habitat, progression, discovery state, and encounter rules.
2. Score candidates against current chakra, Ark, element, geometry, temperament, and habitat affinities.
3. Apply a bounded moment bonus to deterministic candidate selection.
4. Preserve a nonzero baseline for all valid candidates so the moment influences rather than hard-locks the ecosystem.
5. Penalize immediate repetition where existing encounter rules permit alternatives.
6. Use location, encounter identity, owner basis, and exact moment as deterministic tie-break material.

The same inputs must always select the same result. Kai affinity may not invent unavailable forms, ignore progression gates, or create paid/artificial rarity.

## Kai-Born Visual Identity

The catalog form remains an invisible compatibility skeleton for habitat, combat, saves, and legacy cards—not a species ceiling. Each v2 Kai profile deterministically constructs its own named species lineage, three evolution expressions, ecology, morphology, and individual identity; the Field Guide presents these living lineages as an open-ended `∞` space.

### Palette

- Start from the species/catalog palette.
- Blend a bounded chakra/Ark influence into primary, accent, and glow channels.
- Keep contrast and renderer-safe luminance within validated ranges.
- Preserve sufficient catalog color identity so creatures remain recognizable.

### Geometry and markings

- Day, week, month, and Ark geometry select compatible marking topology, placement, density, aura particle, and adornment motifs.
- Geometry modifies existing Heartbound traits and templates rather than adding new heavy meshes.
- The side count and semantic shape may guide lightweight particle arrangements and SVG markings.

### Motion and character

- Beat, step, and Ark signals guide idle cadence, gaze, signature gesture, posture, celebration, and aura behavior.
- Motion values remain bounded by existing animation and accessibility limits.
- These traits are fixed at birth for the card; the current world moment does not overwrite them later.

## Personality and Emotional Narrative

Creature personality combines three sources:

1. Catalog nature: species, habitat, element, anatomy, and abilities.
2. Individual genome: existing proof-seeded Heartbound traits.
3. Kai birth meaning: chakra, Ark, harmonic day/week/month, geometry, and emotional signals.

The prose generator must create deterministic, creature-specific language. It should translate raw Kai concepts into lived character imagery rather than expose clock mechanics.

Example style:

> Its mirrored markings settled across the tidal reeds as the afternoon grew still. It watches before acting, then answers trust with a bright looping gesture that gathers the scattered pack close.

Avoid generic horoscope phrasing, raw teaching dumps, and claims of external authority. The narrative describes this fictional creature's sealed character.

## Balanced Stat Redistribution

The Kai moment affects gameplay while preserving fairness.

- Start from catalog stats.
- Select one or two favored stats from Ark/chakra/creature compatibility.
- Select one or two supporting offsets from the remaining stats.
- Move only a small bounded number of whole points.
- Preserve the exact total across health, power, guard, speed, and bond.
- Keep every stat within catalog-defined global safety bounds.
- Prevent a shift from reversing the intended species role beyond an approved threshold.
- Store the exact shift record in the v2 profile and reproduce it during verification.

Abilities remain the catalog abilities and keep their recognized names. Existing variant ability modifiers may remain bounded, but Kai identity cannot silently replace the ability set or create an unverified competitive advantage.

## Card-Back Presentation

Add a compact birth section near the character story:

- `Birth Pulse`
- `Cadueus KAI`
- Ark/chakra title presented in world language
- one emotionally written birth passage
- geometry translated into creature-specific imagery
- personality traits, communication, motivations, bonding, cautions, quirks, and care cues influenced by the birth profile

The detailed visual DNA/proof section shows:

- sealed birth-profile fingerprint
- geometry and moment identifiers
- palette influence
- exact stat redistribution
- generator/profile version

Legacy cards keep a truthful legacy presentation. They may derive a non-authoritative display interpretation from `capturedAt`, but it must be labeled as interpretation and cannot claim a sealed v2 profile.

## Real Kai-Day World Cycle

The Kai day is divided continuously across its six Arks. `00:00:00` is sunrise.

| Ark | World phase | Expression |
| --- | --- | --- |
| Ignite | Sunrise | Rising warmth, grounded square/tetrahedral accents, first light |
| Integrate | Morning | Open light, waterlike motion, vesica/lemniscate patterns |
| Harmonize | Midday | Strong balanced light, hexagonal/wave geometry, coherent color |
| Reflekt | Afternoon | Lengthening shadows, mirrored/octahedral glints, contemplative clarity |
| Purify | Sunset and twilight | Chakra-tinted horizon, crown/torus shimmer, descending warmth |
| Dream | Night to pre-sunrise | Darker sky, spiral/merkaba constellations, quiet memory particles |

### Continuous projection

The world expression derives a normalized Kai-day progress value and normalized progress within the active Ark. It projects:

- sun azimuth and elevation
- sky/base-background color
- fog tint and density bounds
- hemisphere and directional light colors/intensities
- shadow strength and direction
- sun-shaft visibility
- sparkle/particle speed, color, and geometry motif
- night luminance floor for gameplay readability

Values interpolate continuously. Ark boundaries may change semantic targets, but visual properties ease across the boundary rather than jump.

### Palette preservation

World chapter, biome, settlement, and district colors remain the base. Kai expression blends over atmosphere, light, sky, fog, and particles at bounded influence. Ground, structures, district identity, and authored landmarks are not recolored wholesale.

The result must look like the same place under a different living moment.

## Beat and Ark Transitions

### Beat transition

At a newly observed beat:

- play one soft synthesized tone through the existing audio system
- apply one brief light breath
- show one small geometry ripple using the current moment shape

### Ark transition

At a newly observed Ark:

- play one short layered ceremonial chord
- apply one restrained sky bloom
- resolve the new Ark geometry into the ambient particle field

### Deduplication and accessibility

- Track the last acknowledged Kai day/beat/Ark coordinate.
- Initial mount establishes the baseline and does not fire a transition burst.
- Reload, timer catch-up, background-tab resume, and duplicate updates may acknowledge at most the newest transition once.
- Respect existing audio enablement and volume settings.
- Respect reduced motion by replacing spatial ripple/bloom with a short opacity/color breath or omitting it.
- Effects never block input, open UI, alter simulation time, or modify canonical world state.

No external audio files are required. Existing synthesis primitives provide tones and chords.

## Performance Requirements

- No new network requests for creature birth or world expression.
- No new large models, textures, audio downloads, or shader packages.
- Kai projections are pure arithmetic/string-table work and are memoized at existing moment update boundaries.
- No React state updates per animation frame.
- Three.js receives primitive props or refs for colors, positions, and intensities.
- Geometry motifs reuse low-count primitive/instanced structures within existing quality-profile particle budgets.
- Low-quality profiles may reduce or omit decorative geometry without changing semantic state.
- Existing movement, camera, persistence, multiplayer, and card-list render boundaries remain unchanged.

## Failure and Compatibility Behavior

- Invalid capture time, pulse, profile identifier, stat shift, palette, or digest fails card creation/verification closed.
- Capture failure returns to the existing recoverable capsule state and does not partially add inventory.
- Unknown v2 profile identifiers fail verification rather than falling back to random output.
- Unknown future generator versions remain unsupported and fail explicitly.
- V1 verification remains isolated from v2 code paths.
- Imported v2 cards reproduce exactly offline.
- World-expression failure falls back to the authored daytime biome atmosphere without mutating saved state.
- Audio transition failure is nonfatal and silent.

## Legacy Kai Continuity and Color Fidelity

Existing v1 Wildz remain immutable proof objects. Their manifest, digest, generator version, name, species, stats, and original palette are never rewritten to imitate a v2 birth seal.

At read and render time, a pure compatibility projection may recover the Kai moment from the card's verified `capturedAt`, use the existing sealed variant seed for deterministic individuality, and retain the card's stored `kaiPulse` as its historical pulse reference. This recovered projection supplies morphology, markings, motion cadence, geometry, emotional signals, and character traits without changing canonical card bytes.

Palette precedence is:

1. the current living genome palette, when the card has living revisions;
2. the original sealed v1 variant palette;
3. the authored catalog palette only when no verified asset is available.

The compatibility projection must not replace legacy colors with newly derived v2 colors. Gameplay actors, card art, and thumbnails use the same authoritative palette source so a creature does not change color between surfaces.

Because the real Kai night cycle intentionally lowers world light, creature materials retain a small bounded emissive color floor. This preserves readable body and accent color at night without adding point lights, draw calls, animation state, or per-frame React work.

The card back labels this information as a “Recovered Birth Pulse,” keeps `birth.sealed` false, shows the recovered Cadueus KAI coordinate and geometry, and explicitly preserves original catalog balance. It must never claim that a v1 compatibility profile was part of the original sealed proof.

## Testing Strategy

### Unit contracts

- every chakra, Ark, harmonic day/week/month, and geometry maps to valid bounded traits
- v2 derivation is deterministic
- stat shifts preserve total and safety bounds
- palette blending preserves contrast/luminance bounds
- encounter selection is deterministic and habitat-valid
- repetition protection remains bounded
- narrative is deterministic, creature-specific, and free of raw teaching dumps
- day and Ark progress are continuous and bounded
- sunrise occurs at `00:00:00`
- six Ark phases follow the approved order
- transition events deduplicate across mount, reload, catch-up, and repeated inputs

### Proof and compatibility

- existing v1 fixtures remain byte-valid
- v2 cards verify offline
- mutation of every Kai Birth Profile field fails verification
- profile, trait, palette, stats, and digest splices fail closed
- imported and evolved cards preserve their birth profile
- current-world changes never mutate an existing card
- v1 compatibility projection preserves the exact sealed palette and historical pulse reference
- recovered Kai geometry is deterministic from capture time and the existing seed
- v1 proof bytes and verification results remain unchanged after projection

### Render and integration

- creature thumbnails, full cards, world actors, exports, and card backs use the sealed v2 palette and traits
- card back shows Birth Pulse and `Cadueus KAI`
- card story and personality reflect the sealed profile
- world sky moves through sunrise, morning, midday, afternoon, twilight, and night while district identity remains recognizable
- beat and Ark transitions produce one tasteful effect
- audio and reduced-motion preferences are honored
- no relevant console errors, framework overlays, clipping, or interaction regressions
- active and support gameplay companions use the current living palette for both v1 and v2 cards
- legacy body and accent colors remain distinguishable at the darkest Kai night phase
- legacy card backs show recovered moment geometry without claiming a sealed v2 profile

### Performance regression gates

- production build and typecheck
- existing full test suite
- existing Wildz mobile performance/render contracts
- particle and draw-call budgets under representative quality profiles
- no new persistent timers beyond the existing Kai moment scheduler
- no per-frame React renders caused by world time

## Non-Goals

- No permanent terrain or district topology mutation based on the current moment.
- No invalidation, byte mutation, or automatic proof upgrade of existing v1 cards; compatibility is a read-time projection only.
- No real-money scarcity or stronger total stats for favorable moments.
- No replacement of catalog creature identity or abilities.
- No large cinematic interruption at beat or Ark boundaries.
- No requirement to explain Kai Klok mathematics on the card back.
- No network authority requirement for offline capture; authority provenance remains explicit through the existing moment model.

## Acceptance Criteria

The feature is complete when a new capture can be reproduced from its sealed proof as a moment-specific creature whose appearance, character, story, and zero-sum stats express its Kai birth; the current moment influences valid encounters; the world continuously follows the real six-Ark Kai day with tasteful beat/Ark acknowledgements; legacy cards and authored environments remain intact; and the production/test/performance gates pass without added latency or load heaviness.
