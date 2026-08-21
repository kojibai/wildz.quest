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

These capabilities create player verbs rather than passive labels:

- tracking reveals concealed signals and narrows discovery direction;
- illumination exposes cave paths, nocturnal markings, and abyssal creatures;
- climbing opens cliff faces, canopy routes, ruins, and summit shortcuts;
- burrowing opens deterministic underground entrances and hidden chambers;
- breaking clears explicitly authored cracked barriers without replacing ordinary collision;
- camouflage permits closer observation or safer approach to skittish creatures;
- current riding turns discovered water currents into fast travel routes;
- pressure, heat, cold, and storm resistance admit otherwise hostile environmental bands;
- anchoring prevents current or wind displacement at exposed interaction points;
- rescue abilities improve recovery from exhaustion without bypassing injury or mortality rules;
- balance opens narrow branches, ledges, ropes, and unstable crossings.

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

Deep water also supports deliberate ascent and descent. A player may remain near the surface, descend through the water column, or reach the visible floor when the selected creature's dive depth and pressure tolerance permit it. The camera, explorer, companion, encounter targeting, and depth status consume the same bounded depth authority. The player cannot fall through the seabed or disappear below the rendered world.

## Aquatic creature identity

Aquatic creatures must read as aquatic before the player opens a capability panel. Their canonical projection may include fins, flippers, webbing, gills, shells, streamlined bodies, rudder tails, buoyancy organs, pressure adaptations, and bioluminescent markings. Fins never reuse the functional-wing silhouette. A creature that has both fins and wings renders both in distinct anatomical positions and receives only the capabilities supported by each functional organ.

Aquatic movement is anatomy-specific. Propulsive tails undulate, fins steer, flippers stroke, serpentine swimmers coil, buoyant creatures pulse, and bottom dwellers crawl or anchor. The card art, wild actor, captured actor, and capability UI use the same aquatic anatomy terms.

## Layered living encounters

Discovery exists across ground, water, and air while retaining the coherent scan, reveal, battle, capture, and seal loop.

- Ground encounters remain positioned on authoritative terrain.
- Shore and surface-water encounters are reachable by wading or swimming.
- Underwater encounters occupy a deterministic depth in the water column or a position on the seabed.
- Air encounters occupy a deterministic altitude and flight path above authoritative terrain.

Each encounter carries a derived spatial layer and bounded vertical coordinate in addition to its existing world x/z location. Vertical placement is deterministic from the encounter identity and physical environment; it is not server authority and does not alter the proof law.

Underwater life includes visible ambient swimmers as well as discoverable creatures. Schools, solitary swimmers, drifting luminous creatures, reef or rock dwellers, and rare abyssal individuals use quality-bounded local projections. Ambient creatures never masquerade as catchable encounters: a discoverable creature has the same existing signal, reveal, battle, and capture language used on land.

Rare aerial creatures become discoverable only when their altitude intersects the player's current flight or glide capability. They move through deterministic local flight paths and remain real once revealed; they do not appear at range and disappear on approach. Aerial battle and capture preserve altitude context, then seal the exact creature that was seen.

## Persistent world discoveries

The endless terrain contains deterministic discovery sites that make exploration surprising without making the world disposable. Site families include caves, mountain passes and interiors, hidden valleys, canyons, submerged grottos, reefs, trenches, ruins, canopy routes, springs, caverns, and rare sky islands.

Sites are selected from exact world coordinates, terrain, Kai context, and stable world seeds. Discovery feels unknown to the player, but generation is deterministic: returning to the same place restores the same site's entrance, geometry, habitat, inhabitants, and recorded discoveries. A visible entrance or distant landmark cannot disappear because the player approached it or because an LOD changed.

Mountain scale ranges from small climbable hills to massive multi-route massifs. Large mountains contain foothills, valleys, passes, cliffs, high-altitude weather bands, summit overlooks, rare habitats, and possible interior cave networks. Their full elevation remains visible and physical from the ground and during flight. Low-altitude flyers use valleys and passes; peak overflight requires sufficient lift, endurance, control, and weather tolerance.

Waterfalls follow actual elevated water routes, remain visible on approach, and create physical pools, mist, current, sound, and possible concealed entrances below. Cave scale ranges from shallow shelters to branching caverns and bounded streamed underground worlds containing chambers, rivers, shafts, luminous ecosystems, ruins, rare habitats, and stable alternate exits.

Altitude is embodied. Camera elevation and horizon follow the player; wind and atmosphere respond to height. Exposed ledges admit a deterministic falling state and impact consequence. Flight, glide, grip, or rescue capabilities may recover a fall. Safe authored routes remain available, while dangerous climbs, dives, currents, caves, storm flights, and narrow ledges trade risk for speed, access, or rare rewards.

Each site has:

- a physical entrance anchored to authoritative terrain, water depth, cliff geometry, or air altitude;
- an admitted interior or traversal space with bounded streaming;
- one or more ability-readable routes rather than an invisible capability wall;
- habitat-specific ambient and catchable creatures;
- optional rare discoveries, overlooks, resources, ecology events, or world-history evidence;
- a persistent discovery key stored in the player's exploration continuity.

Ordinary routes remain accessible. Capability-gated branches reward ownership without trapping players or making a required first capability inaccessible. Caves can use climbing, illumination, tracking, breaking, burrowing, pressure resistance, or underwater breathing; mountains can use climbing, balance, glide, flight, cold resistance, or storm anchoring; underwater sites can use dive depth, current handling, illumination, pressure tolerance, and aquatic propulsion.

Burrowing may also create persistent player-authored geography. A qualified creature can excavate a physical entrance in soil, rock, or a mountain side, extend a traversable tunnel below the terrain, widen a chamber, or connect two admitted surfaces. The result is not a temporary animation or teleport: its entrance, path, floor, walls, clearance, colliders, stability, exits, and discovery identity remain real on return and may be discovered and traversed by other players.

Each excavation is an append-only world proof event binding the exact terrain region, start and end coordinates, tunnel profile, material class, stability, ventilation, creator identity, contributing creature proof, capability projection, Kai root, parent tunnel head, and idempotency identity. The deterministic reducer admits the segment atomically or writes nothing. Receiz distribution may deliver the addition to other players, but neither a server row nor a local render mesh becomes excavation authority.

Burrowers remain individual. Soft-soil diggers work quickly but cannot cut hard mountain stone; rock borers open stone routes; stabilizers create wider safer passages; compact diggers create narrow shortcuts; ventilation, illumination, rescue, sensing, and structural reinforcement can be separate specialties. Stamina, material hardness, depth, slope, water pressure, collapse risk, protected landmarks, existing routes, and underground-world envelopes bound each action. Every authored excavation retains at least one safe exit or an explicit rescue path, and cannot silently undermine protected structures or erase deterministic geography.

Excavations are represented as sparse tunnel graphs and streamed only near an admitted entrance or occupied segment. Ordinary movement samples the already-projected local collision surface and performs no proof verification, world-history scan, remeshing of distant tunnels, or network work.

The same graph is the foundation for physical construction. Players can turn an excavated chamber into a home inside a mountain, reinforce walls, add doors, bridges, stairs, air shafts, windows, storage, creature habitats, lighting, water control, and public or private route markers. Construction consumes or equips proof-native materials and tools through atomic player/item/world appends; a decorative preview never changes the shared world.

An excavation can continue until it reaches another safe surface, an existing compatible tunnel, a cave interior, or a submerged route. Underwater excavation requires admitted swimming plus the pressure, current, breath, sealing, drainage, or structural capabilities demanded by the exact depth and material. A flooded passage remains visibly and physically flooded unless an admitted construction changes its water boundary; it cannot masquerade as dry land.

Every constructed space has explicit access policy and public-world semantics. An owner may keep a dwelling private, invite named identities, open a route publicly, or transfer stewardship without changing the immutable creation history. Public navigation exposes only admitted entrances and routes the explorer has discovered. Protected settlements, player homes, ecology sanctuaries, and authored structures cannot be overwritten by an intersecting sibling command.

Player action leaves a durable trail. Entrances, tunnels, repairs, expansions, collapses, rescues, discoveries, stewardship changes, and public openings append provenance to the world feature. The visible world projects its current admitted head while retaining the full history of how players and creatures changed it. Old actions never require recurring API discovery and never disappear merely because their creator is offline.

Public entrances may carry one tasteful physical maker mark: a small timber trail post, carved stone plaque, metal seal, cave etching, buoy marker, or other biome-native form. It remains quiet at distance and reveals concise detail only when approached or selected: the admitted route/home name, creating explorer, contributing creature, creation Kai, and optional current steward. The mark projects verified feature provenance, respects the creator's public identity/privacy settings, and never becomes a floating billboard, repeated label field, advertisement, or substitute for the underlying proof history.

Encounter eligibility is physical and capability-aware:

- non-swimmers can still obtain a first swimmer from an admitted shore or shallow-water approach;
- deeper and rarer aquatic creatures require swimming, dive depth, illumination, current handling, or pressure tolerance;
- initial aerial discoveries remain reachable through early glide or low-altitude routes;
- higher, faster, stormborne, or nocturnal aerial creatures require developed flight, control, tracking, or weather resistance;
- no required progression route depends on already owning the capability it awards.

Habitat generation and ambient-life projection are cached outside the movement frame loop. Movement never generates encounter populations, verifies cards, or performs network work.

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

During vertical exploration it also shows exact depth or altitude, the active creature's safe operating band, and the input for returning to a safe layer. Discovery cues indicate whether a signal is above, level, or below the player without adding a separate cognitive system.

## Controllable flight altitude and obstacle clearance

Powered flight supports deliberate climb and descent inside the active creature's current lift, endurance, and control envelope. Gliding trades altitude for distance and cannot climb without an explicit lift source. The HUD shows altitude, safe operating band, stamina, and the reason an ascent is capped or flight is ending.

During admitted aerial traversal, the local explorer's backpack unfolds a transient aerial capability harness. Paired luminous wings inherit the active creature's palette and functional wing language without pretending to be the explorer's permanent anatomy. They open during takeoff, use restrained graceful flaps during powered flight, spread into a stable soaring silhouette during gliding, react to ascent and descent, and fold fully into the backpack on landing. Reduced-motion mode keeps the readable open/spread/fold states while suppressing continuous flap motion. The harness is pre-mounted and quality-bounded; it never mutates or persists the explorer's proof-derived appearance.

Airborne explorer animation never reuses grounded walking. Takeoff and hover keep the torso upright with feet hanging toward the ground while wings actively support lift. Horizontal forward velocity—not merely the flight-mode label—smoothly pitches the body belly-down, streams the legs behind, and selects traveling wing strokes. Releasing forward movement smoothly returns the body upright, feet downward, and wings to a hovering flap. Gliding holds the belly-down streamlined pose with broad wings and small control corrections. Descent raises the torso, returns the feet downward, and flares the wings into landing. Ground stride, foot planting, and walking bob are disabled for every airborne mode.

Collision is height-aware. Takeoff moves the explorer out of the grounded obstacle layer; tree trunks, small rocks, and ordinary ground clutter cannot snag an admitted airborne player. Sufficient clearance passes over tree canopies and low obstacles cleanly. Mountains, cliffs, cave ceilings, large structures, the world terrain envelope, and authored aerial hazards remain physical. Landing chooses an admitted clear surface and never places the explorer inside a tree, rock, or structure.

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
14. Aquatic anatomy is visually distinct from wings in cards and 3D actors; mixed wing-and-fin creatures render both correctly.
15. Surface, water-column, seabed, and aerial encounters preserve deterministic vertical placement through reveal, battle, capture, save, and restore.
16. A swimmer can descend to the visible floor, discover and capture an underwater creature, ascend, and return to shore without clipping, bottom-walking, or camera loss.
17. A flight-capable player can intersect, reveal, battle, and capture a rare aerial creature without terrain teleportation or disappearing encounter geometry.
18. Ambient airborne and aquatic life stays quality-bounded, cannot be mistaken for catchable signals, and performs zero generation work during steady movement.
19. A card with functional flight wings always renders the corresponding paired wings on every 3D actor; a flight-capable winged card can never produce a wingless gameplay creature.
20. Discovered caves, mountains, grottos, trenches, ruins, canopy routes, and sky islands replay deterministically and remain visible/physical on approach and return.
21. Powered flight supports bounded player-controlled ascent/descent, clears grounded tree/rock collision, passes above canopies at sufficient altitude, and still respects mountains, ceilings, structures, and aerial hazards.
22. The explorer's backpack deploys a paired, palette-derived aerial harness on takeoff, presents distinct powered-flight and glide poses, respects reduced motion, and folds completely on landing without changing saved identity.
23. Takeoff, hover, forward flight, glide, descent, and landing have distinct airborne body/leg/wing poses and never run walking animation in the sky.
24. Mountains span stable hill-to-massif scale classes, waterfalls remain route-fed physical features, and caves span shelters through streamed underground worlds with stable entrances/exits.
25. Mountain altitude changes camera/horizon/atmosphere; exposed falls carry deterministic consequences and capability-based recovery opportunities; high peak overflight requires sufficient aerial specialties.
26. Qualified burrowers can create persistent physical entrances, tunnels, chambers, and mountain passages that other players may discover and traverse; the append-only tunnel graph prevents duplication, impossible geometry, protected-site damage, and movement-path latency.
27. Excavated chambers can become proof-built mountain homes and shared structures; routes may connect safe surfaces or continue underwater when exact aquatic/pressure/sealing requirements are met; access policy and complete creator/creature provenance persist for other players.
28. Public player-built entrances may show one small biome-native maker post or plaque whose approach detail truthfully identifies the admitted explorer, creature, creation Kai, route/home, and current stewardship without visual clutter or privacy leakage.

## Implementation phases

1. Canonical visual identity and pseudo-wing correction.
2. Wild-to-captured appearance continuity.
3. Structured individual capability identity with compatibility projection.
4. Shared aquatic presentation and true swim pose.
5. Underwater camera, water ceiling, atmosphere, and scuba overlay.
6. Persistent capability/status UI and progression explanations.
7. Restore admission optimization and hot-path instrumentation.
8. Cross-device, mobile performance, visual, and release verification.

The layered encounter work is implemented after canonical visual identity and capability projection, so underwater and aerial creatures cannot reintroduce wild-to-captured appearance divergence.

Each phase ships only when its compatibility, determinism, and performance gates pass.
