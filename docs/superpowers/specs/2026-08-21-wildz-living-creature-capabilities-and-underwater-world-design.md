# Wildz Living Creature Capabilities and Underwater World Design

Date: 2026-08-21

Status: Approved design

## Purpose

Make every Wildz creature a permanent individual whose visible anatomy, movement, and abilities agree everywhere. Make deep water feel physically real by moving the explorer and companion into the water column, taking the camera below the surface, and presenting an unmistakable underwater state without adding verification or gameplay latency.

## Non-negotiable identity laws

1. The creature first seen in the wild is the creature the player captures.
2. Capture changes custody and progression state; it does not reroll appearance.
3. Wild encounter, card art, active companion, support companion, battle actor, Vault, Profile, export, upload, and restore consume the same canonical visual projection.
4. Name, palette, markings, morphology, anatomy, appendages, cadence, and visual fingerprint remain identical across ordinary capture, save, upload, and restore.
5. An explicitly earned evolution or transformation may change appearance only through its existing recorded revision history.
6. Art templates may style sealed anatomy but may never invent anatomy.
7. A visible functional traversal organ and its gameplay capability must agree. A nonfunctional organ must be visually and semantically distinguishable.

## Architecture choice

Use a deterministic compatibility projection derived from already-sealed card and encounter inputs. Do not mutate existing V1, V2, or V3 proof objects and do not add fields to `LivingCreatureIdentityV3` in place.

Two pure authorities are introduced:

- `projectCreatureVisualIdentity(...)` returns the exact render inputs shared by wild and captured creatures.
- `projectCreatureCapabilityIdentity(...)` returns immutable anatomy functions, innate potentials, and structured individual abilities derived from the proof digest, discovery identity, genome, current revision, and catalog fallback.

Dynamic condition is applied separately by `projectCreatureRuntimeCapabilities(...)`. Fatigue, injury, level, bond, mastery, and upgrades may unlock, strengthen, suppress, or recover a capability. They may never fabricate anatomy or reroll identity.

Existing cards receive deterministic compatibility projections. A future proof schema may seal structured capability descriptors directly, but this release does not rewrite or invalidate admitted cards.

## Canonical appendage taxonomy

Every projected appendage has a presence and function.

- Presence: `absent`, `vestigial`, or `functional`.
- Wing functions: `display`, `balance`, `glide`, or `powered-lift`.
- Fin functions: `display`, `steering`, `aquatic-propulsion`, or `current-riding`.
- Tail functions: `display`, `balance`, `rudder`, `propulsion`, or `prehensile-grip`.
- Grip functions: claws, pads, coils, or horns used for climbing and anchoring.
- Shell functions: armor, buoyancy, anchoring, or pressure resistance.
- Respiratory functions: surface breathing, extended breath, or underwater breathing.
- Spirit hover is separated into cosmetic float, levitation, glide, or powered flight.

Functional flight wings are paired, articulated, attached high on the back, and animated for lift. Glide membranes have a different silhouette and never imply powered flight. Vestigial winglets, shoulder sails, fins, and display frills are shorter, rounder, and use distinct motion and anatomy labels. A single tail remains centered at the rear.

Bird and dragon are visual body families, not automatic flight grants. A flightless bird or dragon may have vestigial winglets or display frills, but the player can recognize it immediately as flightless.

## Existing pseudo-wing correction

The V3 anime renderer currently paints wings for any `bird` or `dragon` archetype even when the sealed genome says `appendages.wings === "none"`. Remove that shortcut.

For existing cards:

- Canonical genome wings continue to render as wings and participate in aerial capabilities.
- Archetype-only pseudo-wings become an anatomy-appropriate non-wing silhouette such as shoulder frills, aquatic fins, a mantle, shell plates, or a tail fan.
- The replacement is selected deterministically from existing sealed inputs and is identical after reload or cross-device restore.
- No proof bytes, manifest fields, or identity digests change.

## Exact wild-to-captured continuity

Wild encounter actors currently receive identity palette and morphology but not the full anatomy used by captured actors. Introduce one encounter visual projection that derives the same future sealed genome render inputs before capture. Pass the full visual projection to `WildsCreatureActor` in every context.

A capture-boundary contract test records the actor props immediately before sealing and immediately after capture. Form, palette, anatomy, appendages, morphology, cadence, and fingerprint must be deeply equal. The same assertion applies after save/restore and upload/restore.

## Individual capability identity

Each creature receives:

- one family elemental ability;
- one immutable individual signature ability;
- zero or more traversal potentials grounded in functional anatomy;
- numeric specialties derived from sealed individuality.

Specialty parameters include speed, acceleration, control, endurance, efficiency, lift, glide ratio, dive depth, breath duration, current handling, climb grip, terrain tolerance, recharge rate, and recovery. Two creatures may both fly or swim while feeling materially different.

Initial capability families include:

- powered flight;
- gliding;
- surface swimming;
- diving;
- current riding;
- climbing and cliff gripping;
- burrowing;
- balance and narrow-route traversal;
- illumination and dark-water navigation;
- camouflage and encounter concealment;
- scent or signal tracking;
- obstacle breaking;
- heat, cold, pressure, and storm resistance;
- buoyancy, anchoring, and rescue support.

Structured ability descriptors use stable IDs, action tags, explicit traversal grants, deterministic power curves, cooldown or endurance behavior, and player-facing explanations. Runtime code does not infer authority by regular expressions over display names.

## Progression and differentiation

Innate potential is immutable; usable capability develops through existing living progression.

- Level 1 exposes affinity, passive expression, and a readable future potential.
- Early levels unlock anatomy-appropriate swimming, climbing, balance, or tracking.
- Functional glide anatomy unlocks controlled gliding before powered flight.
- Functional flight anatomy unlocks powered flight at an appropriate level.
- Later levels improve endurance, lift, control, recovery, depth, speed, and environmental tolerance.
- Bond improves cooperation and control.
- Mastery improves efficiency and specialized technique.
- Fatigue and injuries may temporarily reduce or suppress a capability.
- Recovery restores capability without changing identity.

The HUD explains why an ability is available, unavailable, exhausted, injured, or still developing, and how it returns.

## Underwater world authority

Export one shared physical waterline constant from terrain rendering. Water mesh height, aquatic presentation, camera submersion, depth reporting, and underwater effects all consume that exact value.

Compute one immutable aquatic presentation per admitted player position change using the existing analytical terrain authority. It contains:

- terrain elevation and surface;
- water surface height and water-column depth;
- `land`, `wade`, `blocked`, or `swim` mode;
- selected creature swim specialization;
- explorer and companion local swim elevation;
- underwater-camera eligibility;
- transient scuba visibility.

The projection performs no network request, verifier call, proof parsing, hotspot scan, React timer, or per-frame allocation.

## True swimming movement

In deep water with an admitted swimmer:

- the explorer leaves the terrain bed and is suspended at a stable depth inside the water column;
- the explorer pitches into a forward swimming posture;
- walking, foot planting, and ground bobbing stop;
- arms perform swim strokes and legs perform fin kicks;
- movement remains responsive and uses the existing deterministic horizontal movement authority;
- the selected companion swims alongside the explorer at an anatomy-appropriate offset and pose;
- transitions into and out of the water column are damped and do not snap;
- shallow water returns to wading, then normal grounded locomotion on land.

The initial implementation uses an automatically stable swim depth so mobile controls remain cognitively light. Diving specialists may later expose deliberate depth control through the same aquatic projection without changing the horizontal movement contract.

## Underwater camera and presentation

When swimming, preserve the player's orbit angle and distance while damping camera and target below the shared water surface. A small hysteresis band prevents rapid surface flicker. Returning to shore restores the prior orbit relationship smoothly.

Underwater rendering includes:

- a visible double-sided water ceiling;
- teal depth fog with a bounded draw distance;
- reduced exposure and warm-color attenuation;
- quality-bounded bubbles and particulate drift;
- subtle light variation without a postprocessing pass;
- clear silhouettes for the explorer and companions.

The local explorer receives a transient scuba overlay: mask, compact tank, and fins. It is a render projection, not proof identity, permanent wardrobe, or saved authority. The player's proof-derived clothing remains unchanged beneath it. Remote players do not receive inferred scuba state until admitted multiplayer presence carries traversal mode.

## Swimming clarity

The existing traversal status area shows one persistent, mutually exclusive state:

- `Shallow water · wading`;
- `Deep water · lead with a swimmer`;
- `Swimming with <creature> · <specialty>`;
- `Diving with <creature> · <depth/control state>`;
- flight and glide states when airborne.

The active creature surface exposes capability type, current strength, progression requirement, fatigue or injury suppression, and recovery behavior. A player never has to guess why flight or swimming stopped.

## Performance and authority constraints

- The proof object remains authority; no server authorization is added.
- Existing verified inventory is not reverified for movement, camera, underwater rendering, or capability projection.
- Static capability identity is cached by immutable asset/revision identity.
- Dynamic condition projection is cached by stable asset and condition object identity.
- Oxygen, depth presentation, animation, and camera scalars are not capability-cache keys.
- One terrain projection is computed per admitted position change and shared with movement presentation, actor height, aerial clearance, and camera.
- No terrain sampling, proof verification, sorting, hashing, React state setter, or object creation is added to the steady-state frame loop.
- Underwater visuals add at most two merged scuba draw calls and one quality-bounded effect group.
- Cache sizes remain bounded.

The implementation must also remove any full-inventory proof verification coupled to routine runtime-checkpoint restore. Restore consumes already-admitted inventory through an admitted path or admission cache; explicit upload remains the verification boundary.

## Persistence and compatibility

Derived visual and capability profiles are never serialized as authority. They are recomputed from admitted sealed inputs.

No required field is added to existing V1, V2, or V3 identities or manifests. Legacy saves restore with the same account, position, inventory, and creature state. Aquatic presentation is safely recomputed from position, terrain, selected creature, and existing condition.

Identity Seal and full Vault restore preserve the exact account and selected creature. Foreign or card-only imports never import another player's position, exploration, underwater presentation, or account state.

## Test and release gates

1. Frozen V1, V2, and V3 card fixtures verify byte-for-byte and retain their proof digests.
2. Anime templates cannot render wings when canonical appendages say wings are absent.
3. Functional, vestigial, and absent appendages have distinct card and 3D render contracts.
4. Wild actor props equal caught actor props before capture, after capture, after save/restore, and after upload/restore.
5. Every visible functional traversal organ agrees with its structured capability.
6. Same proof and condition produce identical capability profiles after cold reload and cross-device restore.
7. Different sealed individuals in the same family receive stable, meaningfully different specialty parameters.
8. Land, shallow water, blocked deep water, admitted swimming, shore exit, flight override, and reload boundary cases pass.
9. A deep-water swimmer floats in the water column, uses swim animation and scuba gear, and never uses the walking pose on the terrain bed.
10. Camera crosses the exact shared waterline, preserves orbit relationship, uses hysteresis, and returns smoothly.
11. Ten thousand warm movement/submersion ticks add zero verifier calls, fetches, slow capability-key builds, capability projections, timers, workers, or hotspot generations.
12. Dry and underwater mobile frame median, p95, long-task, draw-call, and memory budgets remain within the existing release thresholds.
13. Production build, full deterministic suite, mobile browser input path, canvas screenshots, and console/page-error checks pass.

## Implementation phases

1. Canonical visual identity and pseudo-wing correction.
2. Wild-to-captured appearance continuity.
3. Structured individual capability identity with compatibility projection.
4. Shared aquatic presentation and true swim pose.
5. Underwater camera, water ceiling, atmosphere, and scuba overlay.
6. Persistent capability/status UI and progression explanations.
7. Restore admission optimization and hot-path instrumentation.
8. Cross-device, mobile performance, visual, and release verification.

Each phase ships only when its compatibility, determinism, and performance gates pass.
