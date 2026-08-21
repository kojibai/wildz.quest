# Wildz Deterministic Three-Dimensional World Design

## Status

Approved direction on 2026-08-21. This specification defines a genuinely three-dimensional, traversable Wildz world whose visible terrain, physical terrain, traversal rules, and persistent coordinates all derive from one deterministic authority.

This document is an architectural contract, not an implementation change. Delivery remains phased so every slice preserves the current smooth mobile movement baseline, proof authority, saved progress, and existing world coordinates.

## Product outcome

Wildz should feel like a continuous physical place rather than a flat plane decorated with scenery. Players can descend into valleys, follow mountain passes, climb toward summits, cross water with the right capability, and reach overlooks from which the land they traversed remains visible and coherent.

Geography must create understandable choices:

- roads and valleys provide safe, legible routes;
- steep slopes and cliffs create boundaries without invisible walls;
- water, climbing, gliding, and flight turn creature abilities into meaningful access;
- summits, caves, isolated islands, and overlooks reward exploration;
- settlements, trails, landmarks, encounters, and discoveries inhabit terrain that explains why they are there.

The system succeeds only when terrain looks physical, behaves physical, remains deterministic, and adds no perceptible latency to ordinary walking.

## Non-negotiable constraints

- One deterministic terrain authority is the source of elevation, slope, surface type, water depth, traversability, and static obstacles at exact world coordinates.
- Rendering and gameplay consume the same authority. A visible mountain cannot be flat to movement, and an invisible collider cannot contradict the rendered route.
- Ordinary movement uses bounded analytical math and spatial indexing. Wildz does not add a heavyweight general-purpose physics engine to the exploration hot path.
- The current proof object remains authority. Terrain does not introduce a server-verification dependency into local play.
- Existing horizontal coordinates, saves, proof objects, discoveries, encounters, routes, and progression remain compatible.
- Upload, restore, publication, and background synchronization remain outside the visible gameplay hot path.
- Terrain tiles never own durable truth. They are disposable projections of deterministic world coordinates.
- Each implementation phase must independently satisfy mobile frame pacing, deterministic replay, and save compatibility before the next phase begins.

## Coordinate and authority model

### Stable horizontal identity

Existing Wildz `x` and `z` coordinates retain their exact meaning. Terrain is introduced beneath those coordinates; they are not rescaled, remapped, or migrated. Existing landmark, encounter, discovery, trainer, boss, and ecology coordinates therefore continue to identify the same horizontal place.

### Derived elevation

Ground elevation is derived from the terrain authority:

`groundY = terrain.sample(x, z).elevation`

For ordinary grounded saves, `y` is projection state rather than new proof authority. On load, the runtime derives a safe grounded elevation from the saved `x` and `z`. A later save format may retain bounded traversal context such as being airborne, swimming, climbing, inside an authored cave, or standing on a declared platform, but it must never permit caller-shaped elevation to bypass terrain rules.

### Deterministic terrain sample

The core pure query returns a bounded immutable sample equivalent to:

```ts
type TerrainSample = {
  elevation: number;
  normal: { x: number; y: number; z: number };
  slope: number;
  surface: "trail" | "soil" | "grass" | "rock" | "sand" | "shallow-water" | "deep-water";
  waterDepth: number;
  regionId: string;
  materialId: string;
  traversal: readonly TraversalRequirement[];
};
```

All values derive from the world seed, authored world data, versioned terrain rules, and exact coordinates. The query has no network access, storage access, clock access, random state, or React state.

### Versioning

Terrain rules carry an explicit version. A released version is immutable for coordinates already admitted into player history unless a declared migration preserves reachability and landmarks. Cosmetic rendering may improve independently when it does not change physical samples.

## Terrain generation

### Layered deterministic field

The base terrain combines bounded low-frequency continental shape, regional relief, local detail, and authored corrections. Each layer is deterministic and independently testable.

1. Continental shape establishes broad elevation bands and water basins.
2. Regional relief establishes mountain ranges, ridges, valleys, plateaus, and passes.
3. Local detail adds small undulation without creating impassable noise.
4. Authored masks reserve settlements, arenas, trails, entrances, bridges, overlook platforms, and story-critical clearings.
5. Surface projection assigns ecology and material behavior from elevation, slope, water, biome, and authored masks.

Authored corrections are data, not mesh-only edits. The authority applies them before rendering and collision so a carved trail is both visibly and physically walkable.

### Seamless tiles

Tiles are cache and rendering units only. Terrain samples use absolute coordinates, so adjacent tiles calculate identical shared edges. Mesh vertices on borders sample the same exact positions and normals. Skirts may hide distant level-of-detail seams, but they cannot substitute for correct shared-edge geometry.

Tile identity includes terrain version, quality-independent world tile coordinates, and deterministic authored-data digest. Visual quality changes tessellation and decoration density, never the underlying elevation field.

### Level of detail and streaming

The runtime maintains concentric tile rings:

- a near ring with movement-grade geometry and obstacle detail;
- a middle ring with reduced geometry sufficient for navigation and landmark silhouettes;
- a far ring or horizon projection with stable mountain and skyline forms.

Tile work is budgeted and interruptible. New geometry is prepared outside the movement step and committed at a frame boundary. Tiles behind the player are retained briefly to prevent thrash during camera turns. Missing distant detail falls back to a lower-detail deterministic tile rather than removing visible terrain.

No tile may disappear inside the forward camera frustum merely because the player approaches it. Occlusion, fog, and level-of-detail transitions may reduce detail, but the landform and major physical object remain present until naturally outside the view.

## Physical world model

### Grounded movement

Each fixed movement step:

1. reads the requested horizontal displacement;
2. queries the terrain along the swept path;
3. projects the proposed displacement onto walkable ground;
4. resolves static obstacle penetration with the player capsule;
5. applies slope, surface, and movement-mode limits;
6. commits one finite, quantized position and grounded state;
7. lets the camera follow the committed result smoothly.

The simulation remains deterministic and independent of render frame rate. Rendering interpolates between fixed states.

### Player capsule

The explorer uses an upright capsule with declared radius, body height, step height, and skin width. Capsule-versus-obstacle resolution uses bounded analytical tests against nearby primitives or simplified authored collision shapes. The resolver slides along contact tangents instead of stopping dead when the intended path has a valid sideways component.

Collision is divided by semantic material:

- solid: trunks, large rocks, walls, buildings, closed gates, cliffs, and authored structures;
- stepable: small roots, low stones, curbs, and shallow ledges within the step-height contract;
- soft: grass, flowers, ferns, light brush, and purely visual debris;
- conditional: water, climbable faces, glidable gaps, flight corridors, doors, and ability-gated routes.

Soft decoration never enters the movement collision set.

### Static obstacle authority

Every physical obstacle has a deterministic stable id, world-space bounds, semantic material, and collision approximation. Rendering may use a rich mesh while gameplay uses a conservative capsule, cylinder, box, plane, or small convex set derived from the same obstacle record.

Nearby obstacles are resolved through a deterministic spatial index keyed by absolute world cells. The movement step queries only cells touched by the swept capsule. It never scans the Vault, all scenery, all cards, or all loaded tiles.

### Slope and cliffs

Walkability is a function of sampled slope, local curvature, surface, movement mode, and active traversal capability. Gentle slopes preserve full walking speed. Moderate slopes apply bounded uphill and downhill response. Surfaces beyond the walk threshold either expose a valid climb route, cause controlled sliding, or block forward motion with lateral slide.

Cliffs are produced from the same terrain field and authored masks used to render them. No invisible cliff wall may extend beyond the physical face without an authored safety reason and a visible cue.

## Water, climbing, gliding, and flight

### Water

- Shallow water remains walkable and applies a deterministic speed and acceleration modifier.
- Deep water transitions only at a visible, queryable depth threshold.
- Without swimming capability, deep water blocks entry or returns the player to the last safe grounded point through an explicit edge response.
- With swimming capability, the controller enters a distinct buoyant traversal state with bounded speed, turning, shore exit, and stamina rules.

### Climbing

Climbable surfaces are declared by terrain material or authored obstacle metadata. Entry requires a compatible creature anatomy or earned ability, a valid facing angle, and a reachable contact point. Climbing follows an analytical surface frame and declared routes; it does not rely on arbitrary triangle-mesh physics.

Loss of capability, stamina, or valid surface produces a deterministic safe transition such as ledge hold, controlled drop, or return to the last safe anchor. It cannot teleport the player through geometry.

### Gliding and flight

Gliding requires an airborne start and an eligible active creature capability. It converts height and forward momentum into bounded range while preserving collision against terrain and major obstacles. Flight, when earned, provides broader controlled elevation but still respects declared ceilings, protected interiors, world boundaries, and authored encounter constraints.

Flight is progression, not a debug bypass. Distant terrain must retain navigable silhouettes, landing zones, and meaningful aerial routes. Streaming budgets anticipate higher visibility and speed before flight ships.

### Creature capability projection

Traversal derives from exact admitted creature anatomy, abilities, living condition, and earned progression. The Vault becomes a strategic traversal roster:

- aquatic anatomy or learned swimming opens deep-water routes;
- climbing anatomy or learned grip opens declared rock and structure routes;
- wings, membranes, or earned glide abilities open gaps and descent routes;
- true flight opens declared aerial spaces;
- injuries, fatigue, or retirement may reduce or remove capabilities under existing living-card rules.

Capability projection reads already-admitted local proof state. It does not reverify every card during movement.

## World composition

### Routes and settlements

Trails favor stable grades, valley floors, ridge saddles, bridges, and authored switchbacks. Settlements favor defensible level ground, water access, crossings, and route convergence. World generation reserves these spaces before decorative scattering.

Existing locations that would otherwise become inaccessible receive an authored compatibility apron, trail, stair, bridge, tunnel, or safe relocation mask that preserves their exact horizontal identity and interaction radius.

### Discovery placement

Ordinary discoveries remain reachable through walking routes. Rare discoveries may occupy summits, caves, isolated islands, cliff shelves, deep-water sites, and aerial spaces only when their required traversal capability is explicit, attainable, and represented in the player-facing world language.

Procedural placement must validate:

- stable ground or declared traversal state;
- clearance for the player capsule and interaction camera;
- a reachable route under the intended capability tier;
- no overlap with solid obstacles or protected authored spaces;
- preservation of existing discovery identity and proof coordinates.

### Mountains and overlooks

Every major mountain has at least one authored walking route and may have optional capability routes. The route language uses passes, switchbacks, ledges, caves, vegetation, material changes, and distant silhouette cues rather than floating markers alone.

Overlook markers are optional rewards placed at stable, safe viewpoints. Reaching one can reveal distant named landmarks and offer a brief player-controlled vista camera. The player retains exit control; the vista does not seize movement indefinitely, change proof coordinates, or conceal danger.

Landmark revelation records only the existing deterministic discovery or progression event needed by the game. Camera presentation is not authority.

## Camera

The exploration camera follows committed terrain elevation through critically damped smoothing with bounded vertical speed. It reads the same terrain and obstacle authority but never changes player simulation state.

The camera must:

- avoid vertical jitter across tile boundaries and small ground detail;
- preserve readable horizon and forward terrain while climbing or descending;
- prevent terrain and large obstacles from occluding the explorer through analytical camera collision;
- avoid clipping beneath the ground or through cliff faces;
- adapt pitch and distance gradually on steep routes;
- keep direct player control during ordinary traversal;
- restore the prior controlled composition after a vista.

Camera smoothing cannot lag far enough behind the physical player to cause motion sickness or conceal immediate obstacles.

## Runtime boundaries and performance

### Hot path

The visible movement step may read only:

- current controller input and movement mode;
- active traversal capability projection;
- bounded terrain samples along the proposed sweep;
- nearby obstacle cells;
- current deterministic movement state.

It may not perform proof verification, artifact parsing, Vault merging, persistence serialization, profile publication, network fetches, whole-world tile generation, or React collection projection.

### Precomputation and caching

- Terrain samples are pure and memoizable by versioned coordinate cell.
- Obstacle records are generated with their tile and indexed once.
- Render meshes, normals, and materials are prepared outside the fixed movement step.
- The active creature capability projection updates only when admitted card state or selection changes.
- Persistence consumes bounded movement checkpoints through the existing coalescing scheduler.
- Background work yields while gameplay is visible and never repeats work whose admitted result is unchanged.

### Budgets

Initial implementation gates establish measured budgets rather than assuming device capability:

- stable 60 FPS on the supported capable-phone tier;
- authored stable 30 FPS fallback on lower-power supported devices;
- no movement-step allocation proportional to Vault size, world history, or total loaded scenery;
- bounded terrain and obstacle queries per fixed step;
- no long task caused by a tile commit during active walking;
- no visible terrain hole or forward-frustum disappearance during the supported movement speeds;
- no increase to input-to-motion latency after card, Vault, or Identity Seal upload.

Exact millisecond, memory, and tile-count budgets are set from baseline traces during the implementation plan and become release tests.

## Persistence and compatibility

Existing saves load through a compatibility projection:

1. retain exact `x` and `z`;
2. derive terrain elevation under the released terrain version;
3. test capsule clearance;
4. if obstructed, search a tightly bounded deterministic safe-radius sequence;
5. prefer the nearest compatible trail or authored location apron;
6. record no gameplay reward or discovery merely for migration.

Existing proof objects, card coordinates, discovery identities, causal history, and ownership are not rewritten. A migration may store a local terrain-version acknowledgement and safe derived position, but the proof object remains the authority it was before terrain shipped.

Airborne, swimming, climbing, and vista states are transient unless a future save contract explicitly persists a bounded resumable traversal state. Backgrounding in a dangerous transient state first records a deterministic safe checkpoint.

## Failure handling

- A missing near tile uses direct analytical terrain sampling and a low-detail fallback mesh; movement does not fall through the world.
- A failed decorative asset leaves its physical obstacle visible through an authored fallback silhouette when the obstacle remains solid.
- Invalid or non-finite terrain data fails closed to a safe known surface and emits bounded diagnostics outside the movement loop.
- Tile-worker failure degrades detail and streaming radius before affecting input latency.
- Capability projection failure retains the last admitted projection or falls back to ordinary walking; it never grants traversal.
- A save loading inside new solid geometry uses the deterministic safe-position procedure and preserves all account and proof state.
- Network loss has no effect on local terrain, collision, camera, or already-admitted traversal capabilities.

## Delivery phases

### Phase 1: terrain authority

Create the pure versioned terrain and obstacle query contracts, absolute-coordinate tile identity, authored correction masks, deterministic fixtures, compatibility sampling, and performance benchmarks. The rendered world remains visually flat during this phase.

Exit gate: deterministic samples, shared-edge equality, bounded query cost, existing-coordinate compatibility, and zero gameplay behavior regression.

### Phase 2: visual elevation

Render streamed near, middle, and far terrain from the authority. Add stable normals, materials, shadows, horizon silhouettes, level-of-detail transitions, and forward-frustum retention. Player collision remains on the existing baseline until visual parity is proven.

Exit gate: no cracks, holes, forward popping, landmark displacement, camera clipping, or unacceptable mobile frame regression.

### Phase 3: grounded movement and collision

Bind player elevation, capsule sweep-and-slide, slope limits, step handling, camera terrain follow, physical trunks, rocks, buildings, and cliffs to the same authority. Keep soft foliage pass-through.

Exit gate: deterministic replay, smooth hills and valleys, stable collision, safe old-save load, preserved input latency, and complete mobile playtest coverage.

### Phase 4: water and climbing

Add shallow-water response, deep-water boundaries, swimming, authored climb surfaces, capability projection, safe transitions, route validation, and traversal teaching.

Exit gate: capability-appropriate reachability, no bypasses, no trapping, and exact living-card condition effects.

### Phase 5: gliding, flight, and vistas

Add glide and flight controllers, aerial streaming budgets, landing validation, flight constraints, mountain routes, overlook rewards, landmark reveal, and player-controlled vista presentation.

Exit gate: stable high-speed streaming, readable aerial navigation, deterministic collision, safe resume, and no authority or progression shortcuts.

## Verification contract

### Pure and deterministic tests

- identical seed, version, authored data, and coordinates produce byte-identical samples;
- every shared tile edge produces identical positions and normals;
- terrain samples remain finite and within declared world bounds;
- path, settlement, arena, entrance, and landmark masks preserve required clearances;
- obstacle ids and spatial-cell membership are stable and duplicate-free;
- representative routes are reachable with their declared minimum capabilities;
- migration preserves exact horizontal coordinates unless the bounded safety rule is required;
- fixed-step movement replays identically across frame schedules.

### Gameplay tests

- walking, running, uphill, downhill, cross-slope sliding, steps, walls, trunks, rocks, buildings, and cliffs;
- shallow water, blocked deep water, swimming entry and exit;
- climbing entry, traversal, ledge, fall, cancellation, and lost-capability recovery;
- gliding launch, landing, collision, stamina, and range;
- flight takeoff, landing, ceilings, interiors, high-speed streaming, and camera response;
- old saves at landmarks, trails, settlements, encounter sites, and world extremes;
- card, Vault, and Identity Seal upload followed by identical movement and frame pacing.

### Visual and device tests

- mobile WebKit and Chromium on portrait and landscape phone sizes;
- representative low, middle, and high quality tiers;
- slow walking, running, rapid camera rotation, ridge traversal, valley traversal, summit approach, flight, background/resume, and orientation change;
- screenshots and nonblank-canvas checks at tile seams, mountain horizons, water edges, cliff routes, settlements, caves, and overlooks;
- frame-time traces, long-task capture, memory retention, tile churn, input latency, and camera jitter measurements.

### Release invariants

- no server call or proof reverification is required for ordinary terrain traversal;
- no movement hot-path work scales with Vault size;
- rendering and collision agree at every sampled acceptance fixture;
- no existing proof, identity, Vault, discovery, or progression test regresses;
- no phase ships without its exit gate and rollback boundary.

## Explicitly out of scope for this specification

- replacing Receiz proof authority or making the server authoritative;
- changing existing card proofs, discovery identities, or ownership history;
- a general rigid-body destruction or ragdoll simulation;
- unrestricted flight through protected interiors or authored encounter boundaries;
- procedural terrain changes that invalidate previously admitted coordinates;
- implementing all phases in one release without independent qualification.

## Final architectural decision

Wildz will use one deterministic analytical world authority beneath both rendering and gameplay. Terrain becomes meaningful progression: the land is visible, physical, traversable, and unlocked through the player's exact living creatures. The architecture deliberately keeps ordinary walking lightweight and local, preserves existing proof and save compatibility, and makes every later traversal system an additive, independently verified phase.
