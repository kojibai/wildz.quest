# Wildz Living-World Capability Controls Design

Date: 2026-08-25

Status: Approved in chat; written review pending

## Purpose

Give every proof-derived creature capability an obvious, truthful, useful world control. A capability is never a decorative label, a dead button, or a remote permission request. It is a real relationship between the active creature, its current condition, the explorer, and an exact nearby part of the living world.

This design completes the capability UI and world-action portion of `2026-08-21-wildz-living-creature-capabilities-and-underwater-world-design.md`. Existing flight, swimming, climbing, harvesting, excavation, construction, discovery, condition, and source-proof systems remain the implementation foundations.

## Non-negotiable laws

1. The admitted creature proof and current living revision determine capability identity.
2. Runtime condition may strengthen, weaken, exhaust, injure, or recover a capability; it may not invent one.
3. Every capability expressed by the active creature appears in the gameplay capability cluster.
4. Every displayed control has a meaningful tap result in every state.
5. A world mutation is admitted by its source proof object. SDK, API, MCP, AI skills, databases, and public URLs may distribute or synchronize the result but may never demote or replace the source.
6. Missing remote transport never turns a valid local capability into an unavailable local action.
7. All innate special abilities are usable at Level 1. Progression improves power, endurance, precision, range, efficiency, and recovery; it does not withhold the creature's defining verb.
8. Baseline explorer actions remain possible without a creature where already designed. A companion capability improves, extends, automates, protects, or specializes the action rather than becoming an artificial permission wall.
9. Ordinary movement and rendering perform no proof verification, network work, capability sorting, terrain generation, or React-state churn.

## Playable loop

Read the active creature's capability icons, notice which ones awaken in the current environment, tap one, watch the creature approach or assume its capability pose, see the world respond, and receive immediate condition, discovery, resource, route, safety, or world-state feedback.

The loop has no tutorial layer. Players learn through stable icon language, living highlights, creature motion, environmental response, short world feedback, and the card's detailed capability dossier.

## Canonical capability registry

Introduce one exhaustive registry keyed by `CreatureSpecialtyFamily`. Each definition contains:

- stable family ID;
- world-facing label and icon;
- active, sustained, traversal, protection, or support behavior;
- context-query kind;
- deterministic target ordering;
- condition/capacity projection;
- local preview and action intent;
- source-proof commit adapter when the action changes shared state;
- actor pose, world highlight, VFX, haptic, and audio cue IDs;
- concise ready, dormant, active, recovering, and blocked explanations;
- progression dimensions shown on the card back.

The registry must be exhaustive at compile time. Adding a new `CreatureSpecialtyFamily` without a world definition, icon, projector, tests, and player explanation fails type checking or contract tests.

## Capability functions

### Flight

Powered takeoff, sustained lift, altitude control, canopy clearance, flight endurance, and safe landing continue through the existing aerial authority. Tapping from the ground takes off when physically clear. Tapping in flight requests a safe landing.

### Glide

Glide is distinct from powered flight. Tapping at an admitted height begins a controlled energy-preserving descent. When no launch is available, the nearest visible overlook or launchable ledge receives a subtle route highlight.

### Swim

Swimming admits deep-water locomotion and highlights the nearest reachable deep-water entry while on land. In water it projects the exact safe water column, keeps explorer, companion, and camera submerged, and returns cleanly to wading and land.

### Dive

Dive owns deliberate underwater descent, seabed approach, ascent, breath/pressure endurance, and below-player discovery cues. On land or shallow water, tapping highlights the nearest compatible deep-water route instead of doing nothing.

### Current

Current reads deterministic water-flow vectors, exposes a visible route ribbon, and lets the creature pull the explorer into a faster bounded current ride. Where authored water control is compatible, it can redirect or calm a flow through an admitted source transition. It cannot invent water or rewrite terrain.

### Climb

Climb exposes grip capacity and admits steep physical terrain. Tapping selects the nearest reachable climb surface, moves the creature toward it, and begins the same height-aware traversal used by direct contact. If none is within reach, the nearest visible climb-readable face is highlighted.

### Burrow

Burrow selects compatible nearby soil or qualified rock, presents a zero-write entrance/tunnel preview, and enters the existing excavation flow. Confirmation creates a real persistent source-authoritative tunnel addition with geometry, collision, safe exit, provenance, and deterministic bounds. A button tap never fabricates a completed tunnel.

### Balance

Balance reveals and admits narrow ledges, roots, ropes, unstable platforms, and bridge crossings. During a crossing it improves lateral stability and visibly centers the companion and explorer. At a compatible unfinished structure it can contribute a bounded stabilization work action.

### Light

Light emits a bounded creature-centered illumination field that reveals dark paths, cave markings, nocturnal signals, abyssal life, and compatible hidden evidence. Its illumination affects discovery presentation and visibility but does not create undiscovered objects. Sustained light consumes capability capacity and ends cleanly on exhaustion or a second tap.

### Camouflage

Camouflage blends the explorer and creature with compatible terrain, reduces detection radius, and enables closer non-hostile observation of skittish creatures. Sprinting, attacking, harvesting, construction, or incompatible terrain breaks concealment visibly. It never makes the player nonexistent to shared-world authority.

### Track

Track reads proof-sealed traces already present in the admitted neighborhood. It reveals the nearest matching creature trail, player route, resource trace, discovery evidence, or authored objective direction using a bounded trail ribbon and compass cue. It never scans the network or exposes undiscovered private coordinates.

### Break

Break targets the nearest explicitly breakable cracked barrier, damaged structure, obstructing deposit, or authored combat/world object. The creature approaches, performs its real work pose, and advances that object's exact integrity state. It cannot destroy ordinary terrain, protected structures, healthy living sources, or another player's private property.

### Resist

Resist projects the creature's matching heat, cold, pressure, storm, impact, or environmental tolerance. Tapping assumes a protective travel stance and shares a bounded protection envelope with the explorer. It admits hostile bands only while the exact resistance and capacity remain sufficient; it cannot erase hazards.

### Anchor

Anchor holds the explorer and nearby admitted companions against current, wind, knockback, unstable footing, and exposed interaction forces. Tapping toggles a visible anchored stance at a compatible physical point. Movement releases it. At construction sites, anchor may qualify stabilization without replacing exact material requirements.

### Rescue

Rescue selects the nearest admitted endangered explorer, creature, traversal failure, trapped route participant, or recoverable exhausted companion. It performs a bounded intervention that restores safe position or recovery margin without undoing injury, mortality, custody, or already-admitted consequences. With no active emergency, tapping briefly indicates that the nearby party is safe.

### Lumber and quarry work

The existing timber and stone controls remain. They deterministically select the nearest ready matching source within physical reach, bring forward a capable rested companion, animate the approach/work, mutate the source only through its proof object, spend a small visible capacity amount, and update Satchel and Living Construction totals immediately.

## Named ability treatment

Every creature retains its two proof-derived named ability descriptors. The capability cluster uses the named ability as the accessible label and detail title when that ability owns the family. The icon remains the stable family glyph so players learn the world language across different individuals.

Traversal and work capabilities not represented by a named ability receive their own family control. Duplicate family controls are merged; no creature shows two buttons that trigger the same world verb. The card back continues to show both exact named abilities, their current power, defining family, action, present function, growth curve, fatigue/injury effects, and next improvement.

## HUD behavior

Create a dedicated `WildsCapabilityControls` cluster inside the existing bottom-left quick-utility home.

- Only the active creature's canonical controls render.
- Every control keeps at least a 44 CSS-pixel touch target.
- The cluster wraps through stable two-column tracks and grows upward, away from the movement pad and play path.
- Portrait and short-landscape layouts reduce gaps and decorative chrome before reducing hit targets.
- No label truncation is required because icons own the compact state; complete names remain available through accessible labels, press feedback, and the card dossier.
- Existing camp, movement, construction, and contextual controls remain visually distinct from creature capabilities.

Each capability has five readable states:

- **Ready:** owned and usable, but no immediate target is selected.
- **Awakened:** a compatible nearby target or environmental relation exists; a restrained ring/glow appears.
- **Active:** the creature is currently performing or sustaining the ability.
- **Recovering:** fatigue, injury, cooldown, or depleted capacity temporarily limits execution; the exact recovery reason is available.
- **Guidance:** the capability is real but the present environment lacks a target; tapping highlights the nearest compatible route or gives one concise natural explanation.

State uses icon shape, meter position, color, and brief motion rather than color alone. Reduced motion retains shape and meter differences without pulses.

## Context and target selection

One pure capability-context projector consumes already-admitted local projections:

- player and active companion position;
- current site space and terrain/water presentation;
- warmed obstacle and discovery neighborhoods;
- nearby source, structure, tunnel, hazard, encounter, trace, route, player, and companion summaries;
- active creature runtime capabilities and condition;
- active traversal/work/sustained-action state.

It produces a bounded immutable map from family to UI state, ordered candidate IDs, primary target, explanation, and preview intent. Candidate ordering is deterministic by eligibility, urgency, distance, and stable ID. The projector performs no fetch, proof verification, full-world scan, mutation, or per-frame allocation.

Context refreshes only when admitted position, local projection head, active creature, condition object, site space, or active action changes. Button presses use the already-projected target and revalidate the exact physical/source head at commit.

## Action pipeline

Every control follows one path:

1. UI dispatches `request-capability` with family and active asset ID.
2. The controller reads the current capability-context projection.
3. If a direct local action exists, it starts the actor pose and deterministic local traversal/sustained state immediately.
4. If a source mutation is required, it creates a zero-write preview bound to exact actor, creature, target, position, Kai root, expected source head, cost, and idempotency key.
5. The source proof object admits the transition locally at the edge.
6. The local world, creature condition, inventory, and feedback update atomically from the admitted result.
7. Distribution/global sync proceeds outside the input and movement hot paths.

Representation/projection failures cannot cancel or reverse a locally admitted source transition. Conflicting source heads reproject the local target and retry only through the explicit button action; they do not create a recurring retry loop.

## Capacity, consent, and consequences

Capability costs are small, visible, and family-specific. Ordinary assisted actions use the established approximately three-percent condition cost. Sustained or high-force actions drain gradually or spend a larger bounded amount declared by the registry. Progression increases duration, range, precision, safety, and recovery rather than removing Level-1 verbs.

Creature consent and condition remain real. A living companion can decline dangerous sustained work when exhausted or severely injured, but basic player actions and safe guidance remain available. The HUD states the exact embodied reason and recovery path. It never says a connected living world is “arriving” or asks a representation to admit the source.

Actions have visible consequences: changed source integrity, revealed traces, altered detection, illuminated geometry, active current ribbons, stabilized traversal, protected hazard bands, rescued positions, persistent tunnels, material gains, fatigue changes, mastery progress, and proof history where durable.

## Presentation and game feel

Capability activation uses the existing active companion actor rather than spawning a cosmetic duplicate. The creature visibly turns toward, approaches, and interacts with its target. Each family has a distinct pose and restrained effect language:

- aerial lift and glide membrane posture;
- aquatic stroke, dive pitch, and current ribbon;
- grip contact and climb lean;
- digging arc and earth particles;
- balancing stance and footing line;
- warm or bioluminescent light field;
- terrain-matched camouflage fade;
- trace particles and directional trail;
- fracture impact and debris bounded to the target;
- resistance envelope, anchor line, and rescue tether.

VFX project admitted state and never outrank it. The world changes in the same interaction cycle as the creature animation. UI feedback never remains stuck over later world clicks.

## Performance boundaries

- The registry is static and frozen.
- Capability identity and runtime ability projections reuse existing bounded caches.
- Local context consumes warmed projections and caps candidates per family.
- Steady movement adds no sorting, hashing, verification, fetch, timer, or allocation work.
- Sustained actions use scalar refs or the existing fixed update authority, not competing React intervals.
- Actor meshes, materials, and effect pools are pre-created or memoized and quality bounded.
- Remote sync, Twin enrichment, public projection, and history publication remain off the gameplay hot path.
- Repeated refresh, creature switching, and capability activation cannot accumulate listeners, subscriptions, workers, or retry timers.

## Compatibility

No proof schema or admitted card bytes change. The full registry is a deterministic application projection over existing capability identities and exact source objects.

Legacy cards receive the same stable compatibility-derived specialties they already have. Existing flight, swimming, climbing, harvesting, excavation, construction, battle abilities, and card dossier behavior remain compatible. Save/restore recomputes transient context and sustained presentation from admitted state; it does not serialize stale targets or camera state as authority.

## Implementation boundaries

Prefer focused modules:

- `wilds-world-capability-registry.ts`: exhaustive definitions and presentation metadata;
- `wilds-world-capability-context.ts`: pure bounded context/target projection;
- `wilds-world-capability-action.ts`: preview and local action intents;
- `WildsCapabilityControls.tsx`: responsive accessible capability cluster;
- existing traversal, excavation, harvesting, construction, discovery, encounter, condition, and world-service modules: family-specific adapters only;
- `PlayCampaign.tsx`: orchestration and feedback, not duplicated capability rules;
- `WildsWorldCanvas.tsx` and creature actors: warmed pose/effect projections only.

No single universal reducer may bypass the exact domain authority of terrain, creature condition, construction, excavation, encounter, custody, or shared-world history.

## Testing and release gates

1. Registry exhaustiveness covers every `CreatureSpecialtyFamily` and every visible work/traversal family.
2. Every representative creature receives exactly its proof-derived, deduplicated controls and no foreign capability.
3. Every capability button produces execution, sustained-state change, deterministic target guidance, or an exact embodied recovery explanation.
4. All innate families work at Level 1; progression improves parameters without unlocking the defining verb.
5. Context target selection is deterministic across candidate ordering, reload, and device restore.
6. Flight, glide, swim, dive, current, climb, burrow, balance, light, camouflage, track, break, resist, anchor, rescue, lumber, and quarry each complete one real browser input path.
7. Source-mutating actions fail stale or conflicting source heads with zero partial writes and never let remote sync demote a local source admission.
8. Capability condition cost, meter response, recovery, injury suppression, consent, mastery, and card-back explanations remain truthful.
9. Actor approach, pose, VFX, world mutation, HUD meter, and feedback agree for every family.
10. Capability controls retain 44-pixel targets, safe-area separation, no overlap/truncation, and stable values at 320×568, 360×800, 390×844, 430×932, 844×390, tablet, and desktop sizes.
11. Touch `pointerup`, `pointercancel`, lost capture, blur, visibility change, repeated taps, and creature switches leave no stuck action.
12. Ten thousand warmed movement frames and repeated refresh/switch cycles add zero verifier calls, fetches, capability slow builds, retained listeners, recurring timers, or unbounded allocations.
13. Existing deterministic suites, production build, mobile/desktop screenshots, nonblank canvas, console checks, and one real input path per family pass before release.

## Delivery sequence

1. Exhaustive registry, deduplicated control projection, responsive HUD cluster, and contract tests.
2. Context projector and universal request pipeline with deterministic guidance/highlighting.
3. Existing real adapters: flight, glide, swim, dive, climb, lumber, quarry, and burrow.
4. Discovery/environment adapters: current, balance, light, camouflage, and track.
5. Force/support adapters: break, resist, anchor, and rescue.
6. Creature poses, bounded VFX, meters, feedback, dossier integration, and progression details.
7. Performance instrumentation, refresh/switch leak checks, mobile/desktop browser verification, full suite, build, and release commit.

Each sequence is implemented test-first and remains playable at its boundary. No family ships as an icon without its real world function.
