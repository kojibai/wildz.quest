# Wildz Living Taxonomy and Discovery-Sealed Identity

## Purpose

Wildz creatures must feel like living individuals rather than recolored catalog entries. Related creatures should remain recognizably related, while every discovered creature has a permanent identity with enough physical, emotional, and behavioral specificity to inspire attachment.

The creature exists before ownership. Discovery seals its identity. Capture records a relationship and ownership transition but cannot create, rename, recolor, or regenerate the creature.

## Product Rules

- Discovery permanently seals the creature's real name and complete identity.
- Every name is one compact, pronounceable word of at most seven letters.
- A sealed creature is never renamed by later Pulses, capture, evolution, trade, import, or multiplayer activity.
- Each new discovery uses its own world facts and Kai Pulse to create a new individual.
- Related creatures share recognizable inherited features.
- Every individual remains visibly, behaviorally, and emotionally distinct.
- Family and species variation must remain anatomically coherent.
- Canonical creature colors must remain saturated and readable in gameplay; palette generation must not drift into white or near-white bodies.
- Existing sealed cards and generator versions remain byte-verifiable.
- The entry-page background and Powered by Receiz motion share the exact 5.236-second Pulse duration.

## Identity Model

The new versioned `LivingCreatureIdentity` has three layers.

### Family inheritance

A family is a stable authored grammar, not a single fixed model. It defines:

- recognizable silhouette and scale range;
- face structure and expressive anchors;
- locomotion and compatible body plans;
- compatible ears, horns, wings, tails, crests, shells, and surface types;
- habitat and ecological role;
- bounded base palette ranges;
- inherited naming phonemes;
- an emotional promise, such as protective nest-building or curious gift-carrying;
- compatible evolution and species-branch rules.

Family traits create recognition without forcing identical bodies.

### Species branch

A species is a deterministic branch within a family grammar. It selects a compatible combination of:

- anatomy and appendages;
- surface type and marking grammar;
- locomotion and movement language;
- palette range;
- habitat specialization;
- ecology, temperament tendency, and evolution forms;
- a family-compatible naming dialect.

Species generation must use compatibility tables and validation. It may not freely combine unrelated traits that create broken anatomy or an incoherent silhouette.

### Individual genome

The individual genome permanently seals:

- one discovery-time real name of at most seven letters;
- exact family and species branch;
- facial proportions and expression anchors;
- body proportions, posture, appendage variants, and asymmetry;
- canonical primary, secondary, marking, glow, eye, and surface colors;
- marking topology, placement, density, and motif;
- temperament, contrasting trait, favorite activity, comfort behavior, curiosity, social preference, and vulnerability;
- idle habit, bonding gesture, movement cadence, and emotional reactions;
- discovery location, encounter identity, Kai moment, and proof identity;
- immutable identity and visual fingerprints.

Growth can add history, scars, adornments, mastery, and relationship memories. It cannot replace the sealed identity.

## Emotional Embodiment

Each creature has one dominant temperament and one contrasting trait. The contrast should produce a memorable living quality, such as brave but easily startled, watchful but fascinated by music, or dignified but secretly playful.

The creature also receives:

- a favorite activity;
- a comfort behavior;
- a curiosity target;
- a social preference;
- a small vulnerability;
- a signature idle habit;
- a unique bonding gesture;
- reactions to discovery, danger, rest, victory, injury, reunion, and trusted companions.

These traits must affect presentation. Posture, ear position, tail or wing rhythm, gaze, gait, facial expression, cadence, and proximity behavior should communicate personality without requiring text.

Persistent gameplay memories extend the identity. They do not rewrite its discovery-sealed facts.

## Naming System

Names are resolved during discovery and immediately sealed.

Inputs include:

- family naming dialect;
- species phoneme rules;
- body and movement traits;
- individual identity seed;
- discovery encounter and location;
- Kai Pulse, Ark, and geometry;
- proof identity.

The result is one easy-to-pronounce name of at most seven letters. It combines a short family-coherent prefix with a moment-specific suffix, without appending repeated family or species words such as `Flowkin`.

Uniqueness uses a deterministic registry keyed by the normalized complete name. If a collision exists, generation advances through additional digest lanes until it finds an unused valid name. The collision resolution is deterministic and bounded. Failure to resolve within the limit closes the discovery transaction without exposing an unstable creature.

The name stored in the identity is authoritative. Consumers display it; they never regenerate it.

## Canonical Color and Material Rules

Family palettes define recognizable hue families. Species branches narrow those ranges, and individuals select exact colors plus markings.

Validation requires:

- bounded lightness that excludes white and near-white body colors;
- minimum chroma and contrast between body, face, and markings;
- readable eyes and facial features under every supported lighting rig;
- consistent sRGB handling and shared PBR material roles;
- no gameplay-only replacement palette;
- mutation and growth colors stored as append-only appearance history rather than transient renderer overrides.

The same canonical palette and material roles must drive the world, encounters, Hearttree, Mortal Arena, cards, thumbnails, public views, and exports.

## Discovery Transaction

Discovery executes deterministically:

1. Read the canonical encounter, habitat, ecology, location, world state, and Kai moment.
2. Select a compatible family.
3. Generate a valid species branch from the family grammar.
4. Generate the individual genome.
5. Resolve and collision-check the single discovery name.
6. Validate anatomy, palette, pronounceability, uniqueness, and bounded traits.
7. Seal the complete `LivingCreatureIdentity` and its digest.
8. Publish the creature to the encounter state.

Invalid candidates advance to a deterministic fallback lane. The implementation must not use unseeded randomness.

Capture references the exact discovered identity digest, then records ownership and relationship history. It must fail closed if the discovery identity is absent, changed, or mismatched.

## Versioning and Compatibility

The living-taxonomy generator is a new generator version. Previous generator functions, manifests, names, palettes, fixtures, and verification paths remain unchanged.

Legacy creatures may receive a presentation adapter only when the adapter preserves the original verified name, colors, and proof facts. Adapters cannot silently rewrite sealed bytes.

The rollout must include fixtures proving that legacy Vaults, Identity Seals, living-card admissions, and public proofs still verify.

## Rendering and Motion

The renderer consumes the stored identity instead of independently deriving palette or personality.

Creature motion maps identity traits to:

- breathing and idle cadence;
- gaze and attention;
- ear, tail, wing, crest, or body follow-through;
- discovery response;
- bonding gesture;
- threat, injury, victory, rest, and reunion poses.

Family resemblance remains visible through inherited silhouette and movement anchors. Individuality appears through proportions, asymmetry, markings, cadence, gestures, and emotional reactions.

## Entry-Page Pulse Motion

The entry page owns one CSS custom property:

```css
--kai-pulse-duration: 5.236s;
```

The background geometry, aurora, brand halo, Powered by Receiz seal, and glint use this duration. Each layer may have a different phase offset, direction, amplitude, and easing, but all cycles land on the same Pulse boundary.

The Powered by treatment should feel responsive to the world Pulse without competing with the primary actions. `prefers-reduced-motion: reduce` disables animation and retains a deliberate composed state.

## Failure Behavior

- Invalid family/species combinations advance to a deterministic fallback candidate.
- Invalid palettes are rejected before sealing.
- Invalid or unpronounceable names advance to the next deterministic name lane.
- Exhausted fallback limits fail the discovery without creating a partial identity.
- Missing or mismatched discovery identity blocks capture.
- Unknown generator versions fail closed.
- Legacy verification never falls through to the new generator.

## Verification

Automated coverage must prove:

- large-scale family, species, genome, visual-fingerprint, and name uniqueness;
- family resemblance plus measurable individual differentiation;
- exact single-name seven-letter limit and prefix/suffix composition;
- pronounceability rules across the generated corpus;
- adjacent 5.236-second Pulses produce distinct new discoveries;
- already discovered creatures retain their sealed names across later Pulses;
- palette lightness, chroma, and contrast bounds prevent white bodies;
- discovery-to-encounter-to-capture identity and digest preservation;
- capture cannot rename or regenerate a creature;
- legacy generator and proof fixtures remain valid;
- world, Hearttree, Mortal Arena, cards, thumbnails, profiles, and exports consume the same identity;
- entry-page animation declarations share `--kai-pulse-duration`;
- reduced-motion behavior is static;
- typecheck, production build, complete automated suite, and desktop/mobile visual checks pass.

## Completion Criteria

The feature is complete when a player can discover two related creatures, immediately recognize their family resemblance, distinguish their species and individual personalities, read two unique compact names, see saturated canonical colors in every gameplay surface, capture either creature without changing its identity, and later recognize the same individual through its motion, appearance, name, and accumulated memories.
