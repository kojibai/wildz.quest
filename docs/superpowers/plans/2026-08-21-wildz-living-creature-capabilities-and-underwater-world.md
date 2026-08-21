# Wildz Living Creature Capabilities and Underwater World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make creature appearance permanent and capability-honest while adding true underwater swimming, individualized traversal abilities, and deterministic underwater and aerial discovery.

**Architecture:** A canonical proof-derived visual projection feeds every 2D and 3D creature renderer. A separate immutable capability identity describes functional anatomy and innate specialties; a cached runtime projection applies living condition and progression. One analytical aquatic presentation per admitted position drives swim depth, camera, equipment, effects, status, and layered encounters without verification or frame-loop generation.

**Tech Stack:** TypeScript, React 19, Next.js 15, React Three Fiber, Drei, Three.js, Node test runner, existing deterministic Wildz proof/game kernel.

**Spec:** `docs/superpowers/specs/2026-08-21-wildz-living-creature-capabilities-and-underwater-world-design.md`

## Global Constraints

- Existing V1, V2, and V3 proof bytes and digests must remain valid and unchanged.
- Capture, save, upload, and restore never reroll creature appearance.
- The proof object is authority; no server authorization or re-verification is added to gameplay.
- Static capability identity is deterministic from admitted sealed inputs and never serialized as separate authority.
- Steady movement and submersion add zero proof calls, fetches, slow capability projections, hotspot generations, timers, or workers.
- Render and gameplay consume the same terrain, waterline, visual identity, and functional-anatomy authorities.
- Mobile performance must remain within existing median, p95, long-task, memory, and draw-call release thresholds.

---

### Task 1: Canonical Creature Visual Identity

**Files:**
- Create: `src/features/play/creature-visual-identity.ts`
- Modify: `src/features/play/card-kai-appearance.ts`
- Modify: `src/features/play/heartbound-anime-shapes.ts`
- Modify: `src/features/play/WildsCreatureActor.tsx`
- Test: `tests/wilds-creature-visual-identity.test.ts`
- Test: `tests/wildz-creature-thumbnails.test.ts`

**Interfaces:**
- Consumes: `PortableCardAsset`, `LivingCreatureIdentityV3`, `LivingCardGenome`, catalog `CreatureForm`.
- Produces: `CreatureVisualIdentity` and `projectCardCreatureVisualIdentity(asset)`.

- [ ] **Step 1: Write failing canonicality tests**

```ts
assert.equal(projectCardCreatureVisualIdentity(card).appendages.wings.presence, "absent");
assert.doesNotMatch(renderPortableCreatureThumbnail(card), /data-anatomy="functional-wing"/);
assert.deepEqual(projectCardCreatureVisualIdentity(card), projectCardCreatureVisualIdentity(card));
```

- [ ] **Step 2: Compile and run the focused tests to verify RED**

Run: `pnpm exec tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wilds-creature-visual-identity.test.js .test-build/tests/wildz-creature-thumbnails.test.js`

Expected: FAIL because the visual projection and anatomy markers do not exist and dragon/bird templates still invent wings.

- [ ] **Step 3: Implement the visual authority**

```ts
export type FunctionalAppendage = Readonly<{
  presence: "absent" | "vestigial" | "functional";
  kind: "wing" | "fin" | "tail" | "frill" | "shell" | "grip" | "gill";
  function: "display" | "balance" | "glide" | "powered-lift" | "steering" | "aquatic-propulsion" | "rudder" | "armor" | "grip" | "underwater-breathing";
  variant: string;
}>;

export type CreatureVisualIdentity = Readonly<{
  formId: string;
  palette: Readonly<{ primary: string; secondary: string; accent: string; glow: string }>;
  anatomy: Readonly<{
    body: "round" | "long" | "winged" | "serpentine" | "armored";
    detail: string;
    locomotion: "biped" | "quadruped" | "flying" | "serpentine";
    surface: string;
  }>;
  appendages: readonly FunctionalAppendage[];
  morphology: Readonly<{ head: number; torso: number; limb: number; symmetry: number }>;
  cadenceMs: number;
  fingerprint: string;
}>;
```

Remove `p.archetype === "bird" || p.archetype === "dragon"` as a wing-render condition. Render functional wings, glide membranes, fins, frills, and tails from explicit projected appendages with separate markup/data attributes. Make `projectCardKaiAppearance` delegate to the canonical projection instead of independently interpreting the genome.

- [ ] **Step 4: Run focused tests and typecheck to verify GREEN**

Run: `pnpm exec tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wilds-creature-visual-identity.test.js .test-build/tests/wildz-creature-thumbnails.test.js && pnpm exec tsc --noEmit`

Expected: PASS; pseudo-wing fixtures show frills/fins instead of wings while true-wing fixtures retain wings.

- [ ] **Step 5: Commit**

```bash
git add src/features/play/creature-visual-identity.ts src/features/play/card-kai-appearance.ts src/features/play/heartbound-anime-shapes.ts src/features/play/WildsCreatureActor.tsx tests/wilds-creature-visual-identity.test.ts tests/wildz-creature-thumbnails.test.ts
git commit -m "fix: unify canonical creature appearance"
```

### Task 2: Exact Wild-to-Captured Appearance Continuity

**Files:**
- Modify: `src/features/play/creature-visual-identity.ts`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `src/features/play/game-state.ts`
- Test: `tests/wildz-discovery-identity.test.ts`
- Test: `tests/play-game-state.test.ts`

**Interfaces:**
- Consumes: `projectCardCreatureVisualIdentity` from Task 1 and encounter `LivingCreatureIdentityV3`.
- Produces: `projectEncounterCreatureVisualIdentity(input)` with the same `CreatureVisualIdentity` output.

- [ ] **Step 1: Write a failing capture-boundary equality test**

```ts
const before = projectEncounterCreatureVisualIdentity({ identity: revealed.encounter.discoveryIdentity!, formId: revealed.encounter.formId! });
const captured = applyWildsInput(revealed, { type: "seal-capture", at, ownerReceizId });
const after = projectCardCreatureVisualIdentity(captured.inventory.at(-1)!);
assert.deepEqual(after, before);
```

- [ ] **Step 2: Run focused tests to verify RED**

Expected: FAIL because the wild actor currently omits genome-derived appendages, surface, and locomotion.

- [ ] **Step 3: Implement encounter projection and actor integration**

Derive the exact future birth genome from the already-deterministic encounter identity and form before capture. Pass the complete visual identity to the encounter `WildsCreatureActor`. Do not duplicate appearance logic inside `WildsWorldCanvas`.

- [ ] **Step 4: Add save/reconstruction and legacy encounter assertions**

```ts
assert.deepEqual(
  projectEncounterCreatureVisualIdentity(restoredEncounter),
  projectEncounterCreatureVisualIdentity(originalEncounter)
);
```

- [ ] **Step 5: Run focused tests, full typecheck, and commit**

Commit: `fix: preserve exact creature appearance through capture`

### Task 3: Structured Individual Capability Identity

**Files:**
- Create: `src/features/play/creature-capability-identity.ts`
- Modify: `src/features/play/wilds-traversal-capabilities.ts`
- Modify: `src/features/play/living-card-dossier.ts`
- Modify: `src/features/play/WildsCard.tsx`
- Test: `tests/wilds-creature-capability-identity.test.ts`
- Test: `tests/wilds-traversal-capabilities.test.ts`

**Interfaces:**
- Consumes: `CreatureVisualIdentity`, admitted asset proof/revision, stable `AdventureCardCondition`.
- Produces: `CreatureCapabilityIdentityV1`, `CreatureRuntimeCapabilities`, `projectCreatureCapabilityIdentity(asset)`, and `projectCreatureRuntimeCapabilities(identity, condition)`.

- [ ] **Step 1: Write failing deterministic differentiation tests**

```ts
const a = projectCreatureCapabilityIdentity(cardA);
const b = projectCreatureCapabilityIdentity(cardB);
assert.deepEqual(a, projectCreatureCapabilityIdentity(cardA));
assert.notDeepEqual(a.specialties, b.specialties);
assert.equal(a.digestInput.proofDigest, cardA.proof.digest);
```

Assert absent or vestigial wings never grant glide/flight, functional fins grant only the explicit aquatic potential, and existing proof JSON remains byte-identical.

Also assert the inverse invariant: every functional powered-lift or glide wing renders the same paired wing anatomy in `WildsCreatureActor`; no flight-capable canonical card may render a wingless gameplay actor.

- [ ] **Step 2: Verify RED**

Expected: FAIL because traversal is boolean/regex-derived and individual structured abilities do not exist.

- [ ] **Step 3: Implement immutable capability identities**

```ts
export type CreatureSpecialty = Readonly<{
  id: string;
  family: "flight" | "glide" | "swim" | "dive" | "current" | "climb" | "burrow" | "balance" | "light" | "camouflage" | "track" | "break" | "resist" | "anchor" | "rescue";
  potential: number;
  control: number;
  endurance: number;
}>;

export type CreatureAbilityDescriptor = Readonly<{
  id: string;
  name: string;
  action: string;
  tags: readonly string[];
  traversalGrant?: WildsTraversalCapability;
  powerCurve: readonly number[];
}>;
```

Derive one family ability and one individual signature ability using integer hashing over admitted sealed inputs. Replace regex grants with explicit functional anatomy or structured descriptors. Preserve bounded WeakMap and canonical caches.

- [ ] **Step 4: Apply progression and condition once per identity change**

Level/bond/mastery unlock and scale capabilities; fatigue and injuries suppress but never create them. Update Card and dossier UI to show current revision ability descriptors instead of catalog-only display abilities.

- [ ] **Step 5: Run determinism/cache tests and commit**

Commit: `feat: add individualized creature capability identities`

### Task 4: Shared Aquatic Presentation and Waterline Authority

**Files:**
- Create: `src/features/play/wilds-aquatic-presentation.ts`
- Modify: `src/features/play/wilds-terrain-rendering.ts`
- Modify: `src/features/play/WildsEnvironment.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Test: `tests/wilds-aquatic-presentation.test.ts`
- Test: `tests/wilds-terrain-rendering.test.ts`

**Interfaces:**
- Produces: `WILDS_WATERLINE_ELEVATION` and `projectWildsAquaticPresentation(input)`.

- [ ] **Step 1: Write failing land/wade/blocked/swim/depth tests**

```ts
assert.equal(projectWildsAquaticPresentation({ terrain: deep, canSwim: false, airborne: false }).mode, "blocked");
assert.equal(projectWildsAquaticPresentation({ terrain: deep, canSwim: true, airborne: false }).mode, "swim");
assert.ok(swimming.actorLocalY > 0);
assert.ok(swimming.actorWorldY < WILDS_WATERLINE_ELEVATION);
```

- [ ] **Step 2: Verify RED**

Expected: FAIL because waterline and aquatic presentation are not shared authorities.

- [ ] **Step 3: Implement the pure projection**

```ts
export type WildsAquaticPresentation = Readonly<{
  mode: "land" | "wade" | "blocked" | "swim";
  terrainElevation: number;
  waterSurfaceY: number;
  waterDepth: number;
  actorLocalY: number;
  cameraSubmersionAllowed: boolean;
  scubaVisible: boolean;
}>;
```

Compute it once from memoized player x/z, selected runtime capability, and aerial state. Pass the result through Canvas and controls. Replace duplicate per-frame terrain elevation calls.

- [ ] **Step 4: Make water surfaces consume the shared waterline and render their underside**

Use `THREE.DoubleSide` on water materials and verify both deep and shallow geometry use the exported constant.

- [ ] **Step 5: Run focused tests and commit**

Commit: `feat: add shared aquatic presentation authority`

### Task 5: True Swim Pose, Scuba Kit, and Underwater Camera

**Files:**
- Create: `src/features/play/WildsUnderwaterAtmosphere.tsx`
- Create: `src/features/play/wilds-underwater-camera.ts`
- Modify: `src/features/play/WildsExplorer.tsx`
- Modify: `src/features/play/WildsCreatureActor.tsx`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `src/features/play/WildzWorldControls.tsx`
- Modify: `app/globals.css`
- Test: `tests/wilds-underwater-camera.test.ts`
- Test: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Consumes: `WildsAquaticPresentation` from Task 4 and runtime capability from Task 3.
- Produces: `projectUnderwaterCameraTarget`, transient `locomotion="swim"`, `swimKitVisible`, and persistent swim status.

- [ ] **Step 1: Write failing camera and pose tests**

Assert swim target/camera descend below the exact waterline with hysteresis; land restores the preserved offset; the local explorer renders swim kit and not walk foot-plant motion in swim mode.

- [ ] **Step 2: Verify RED**

Expected: FAIL because the camera remains above water and the explorer walks on the bed.

- [ ] **Step 3: Implement true suspended swimming**

Move the explorer/active companion group to `presentation.actorLocalY`, damp transitions, pitch the explorer forward, replace stride with arm strokes and fin kicks, and disable ground bob/foot planting. Add pre-mounted mask, tank, and fins whose group visibility follows `scubaVisible`.

Add a pre-mounted backpack aerial harness to `WildsExplorer`. On takeoff, deploy paired luminous wings using the active creature palette; during powered flight use restrained asymmetric flap articulation, during glide hold a broad soaring pose, during ascent/descent adjust sweep and pitch, and on landing fold both wings fully into the backpack. Reduced motion switches discretely between open/spread/fold poses without continuous flapping.

Replace grounded animation while airborne: hover/takeoff is upright with feet down; horizontal forward velocity smoothly pitches powered flight belly-down with legs extended behind; releasing forward input smoothly returns upright with feet down and a hovering flap; glide is belly-down and streamlined; descent/landing raises the torso, lowers the feet, and flares the wings. Disable stride, foot planting, and walking bob in all aerial modes.

- [ ] **Step 4: Implement underwater camera and atmosphere**

Preserve orbit offset while translating camera and target beneath the surface. Mutate preallocated fog/background/light colors and one bounded particle group. Add no postprocessing pass and no React setter in `useFrame`.

- [ ] **Step 5: Add persistent status and verify UI accessibility**

Show `Swimming with <name> · <specialty>` and blocked/wading alternatives in the existing mutually exclusive traversal slot.

- [ ] **Step 6: Run focused tests, mobile build, and commit**

Commit: `feat: make deep water fully swimmable underwater`

### Task 6: Vertical Depth and Altitude Controls

**Files:**
- Create: `src/features/play/wilds-vertical-traversal.ts`
- Modify: `src/features/play/wilds-grounded-movement.ts`
- Modify: `src/features/play/wilds-terrain-obstacles.ts`
- Modify: `src/features/play/WildzWorldControls.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Test: `tests/wilds-vertical-traversal.test.ts`
- Test: `tests/wilds-aerial-integration.test.ts`

**Interfaces:**
- Produces: transient `WildsVerticalTraversalState` with `layer`, `offset`, `intent`, `safeMin`, and `safeMax`.

- [ ] **Step 1: Write failing bounded ascent/descent tests**

Assert dive depth respects seabed, water surface, pressure potential, and recovery; altitude respects ground clearance, stamina, lift, and landing. Assert admitted airborne movement cannot be snagged by tree trunks or small ground clutter, passes above canopies with sufficient clearance, and remains blocked by mountains, ceilings, structures, and aerial hazards.

- [ ] **Step 2: Implement allocation-free vertical stepping**

Use fixed scalar state in an existing ref, explicit up/down intent, and the shared terrain projection. Keep save compatibility by deriving a safe default on reload.

Make obstacle admission consume actual vertical clearance. Remove tree/rock collision only after takeoff clears the grounded layer; preserve large physical obstacles and choose a collision-free analytical landing point.

- [ ] **Step 3: Add one coherent vertical control**

Expose context-aware ascend/descend controls only while swimming/flying. Show exact depth/altitude and safe band. Do not add controls during ordinary walking.

- [ ] **Step 4: Run tests and commit**

Commit: `feat: add bounded aquatic and aerial depth control`

### Task 7: Deterministic Underwater and Aerial Encounters

**Files:**
- Create: `src/features/play/wilds-layered-encounters.ts`
- Modify: `src/features/play/hidden-hotspots.ts`
- Modify: `src/features/play/game-state.ts`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `src/features/play/WildsBattle.tsx`
- Test: `tests/wilds-layered-encounters.test.ts`
- Test: `tests/play-game-state.test.ts`

**Interfaces:**
- Produces: `WildsEncounterLayer = "ground" | "surface" | "water-column" | "seabed" | "air"` and deterministic vertical placement.

- [ ] **Step 1: Write failing layer determinism and progression-gate tests**

Assert same region/slot produces the same layer/height after cache eviction; first swimmer is shore-reachable; early aerial award is reachable without powered flight; deeper/high-altitude encounters require explicit capability.

- [ ] **Step 2: Implement physical layer selection**

Select habitat, layer, and vertical coordinate from integer-hashed region/slot plus actual terrain. Preserve legacy captured slot identity and never use `Math.sin` at extreme coordinates.

- [ ] **Step 3: Integrate scan, reveal, battle, capture, and restore**

Search filters candidates by the player's current vertical interaction band. Encounter actor, targeting, telemetry, and capture preserve the same vertical placement. Sealed creature visual identity remains equal to the revealed actor.

- [ ] **Step 4: Run focused determinism/capture tests and commit**

Commit: `feat: add underwater and aerial creature encounters`

### Task 8: Persistent Discoverable World Sites

**Files:**
- Create: `src/features/play/wilds-discovery-sites.ts`
- Create: `src/features/play/wilds-excavation.ts`
- Create: `src/features/play/WildsDiscoverySites.tsx`
- Modify: `src/features/play/WildsEnvironment.tsx`
- Modify: `src/features/play/game-state.ts`
- Modify: `src/features/play/wilds-exploration-atlas.ts`
- Test: `tests/wilds-discovery-sites.test.ts`
- Test: `tests/wilds-excavation.test.ts`
- Test: `tests/play-game-state.test.ts`

**Interfaces:**
- Produces: `WildsDiscoverySiteProjection` for caves, mountain interiors/passes, valleys, canyons, grottos, reefs, trenches, ruins, canopy routes, springs, caverns, and sky islands; plus an append-only sparse `WildsExcavationGraph` for player-authored burrows.

- [ ] **Step 1: Write failing deterministic persistence and approach tests**

Generate representative sites at ordinary and extreme coordinates, evict caches, regenerate, and assert exact equality. Advance the player from far LOD through the entrance and assert the same site identity remains visible and physical. Assert ability-gated branches never block the ordinary route or the first source of their required capability.

Cover hill, mountain, and massive-massif scale classes; route-fed waterfalls with persistent pools/entrances; shallow caves, branching caverns, and bounded underground-world interiors. Assert altitude affects camera/horizon/atmosphere, exposed ledges admit deterministic falls, and flight/glide/grip/rescue recovery remains capability-gated.

Add RED tests for player-authored excavation: a qualified soil digger opens a persistent soil tunnel; a rock borer opens a mountain-side passage; an unqualified creature and a soft-soil-only digger fail against hard rock with zero writes; replaying the same command is idempotent; conflicting sibling segments admit at most one head; every segment has physical clearance/colliders and at least one safe exit or rescue route; another player can discover and traverse an admitted public tunnel; protected structures and canonical routes cannot be undermined. Assert movement through a warmed tunnel performs zero proof, network, distant-remesh, or full-graph work.

Cover construction and evolving-world history: expand a mountain chamber into a home, consume or equip exact proof-native building materials atomically, install a door/light/storage/habitat element, and prove private/invited/public access modes. Connect a tunnel to a second safe surface and to an existing compatible tunnel. Build a submerged tunnel only with swimming plus required pressure/current/breath/sealing support, preserve physically flooded state where applicable, and reject impossible water/terrain intersections with zero writes. Restore on a second player and prove the admitted public feature, creator/creature provenance, repairs, expansions, and current head remain traversable without the creator online.

Assert each public entrance has at most one quality-bounded biome-native maker post/plaque; it is unobtrusive beyond approach range, exposes only verified route/home, explorer, creature, creation-Kai, and current-steward fields on interaction, respects public identity settings, and never creates floating/repeated billboard labels or advertising surfaces.

- [ ] **Step 2: Implement sparse deterministic site admission**

Use integer-hashed world regions plus actual terrain/depth/altitude constraints. Separate immutable site identity from bounded local render detail. Record only discovered site keys in exploration continuity; reconstruct geometry and inhabitants from authority.

- [ ] **Step 3: Implement entrances and bounded interiors**

Stream only nearby site geometry. Entrances, colliders, habitat layers, and exits share exact coordinates. Render ability-readable route cues for climb, light, track, break, burrow, dive, current, pressure, balance, glide, flight, cold, and storm-anchor branches.

- [ ] **Step 4: Integrate habitat-specific creatures and rewards**

Feed site layer/position into the layered encounter authority from Task 7. Keep ambient creatures distinct from catchable signals and preserve the exact wild-to-caught visual identity.

- [ ] **Step 5: Implement persistent player-authored excavation**

Represent authored tunnels as a sparse append-only graph of deterministic physical segments anchored to exact terrain coordinates and material authority. Admit each segment against the current graph head with creator, creature, capability, Kai, geometry, stability, and idempotency evidence. Project only nearby entrance/segment meshes and colliders. Specialize burrowers by soil/stone capability, width, speed, stability, ventilation, sensing, illumination, and rescue. Preserve public traversal without treating distribution as authority.

Extend the graph with proof-built chamber and structure appends: mountain homes, reinforcement, doors, bridges, stairs, ventilation, storage, habitat fixtures, lighting, water boundaries, route markers, and access policy. Bind every mutation to exact player, creature, material/tool, prior world head, geometry, and Kai evidence; update every affected subject atomically or write nothing. Preserve immutable creation history and current stewardship while allowing the shared world to evolve visibly for later explorers.

Project one optional instanced maker marker per admitted public entrance, selecting a restrained timber, stone, metal, etched, or buoy form from the biome/material authority. Reveal its verified provenance detail only within interaction range. Keep maker-marker geometry cached with the entrance and outside movement-time proof/history work.

- [ ] **Step 6: Run determinism, collision, exploration-continuity, excavation, and render tests; commit**

Commit: `feat: add persistent caves mountains and hidden world sites`

### Task 9: Proof-Native Harvesting, Creature Work, Construction, and Authored Gameplay

**Files:**
- Create: `src/features/play/wilds-resource-authority.ts`
- Create: `src/features/play/wilds-world-construction.ts`
- Create: `src/features/play/wilds-creature-work.ts`
- Create: `src/features/play/wilds-authored-experience.ts`
- Create: `src/features/play/WildsBuildMode.tsx`
- Modify: `src/features/play/WildsEnvironment.tsx`
- Modify: `src/features/play/WildzWorldControls.tsx`
- Modify: `src/features/play/game-state.ts`
- Modify: `src/lib/receiz/adapter.ts`
- Test: `tests/wilds-resource-authority.test.ts`
- Test: `tests/wilds-world-construction.test.ts`
- Test: `tests/wilds-creature-work.test.ts`
- Test: `tests/wilds-authored-experience.test.ts`
- Test: `tests/play-game-state.test.ts`

**Interfaces:**
- Produces proof-native resource objects, an append-only physical structure graph, bounded autonomous creature work plans, collaboration/damage transitions, and declarative player-authored gameplay.

- [ ] **Step 1: Write failing harvest and ecological-authority tests**

Assert only qualified creature/tool combinations fell eligible trees, quarry stone, mine seams, recover cave/mountain/underwater materials, or expose buried deposits. Admission changes the physical source once, creates exact inventory, leaves stump/debris/exhaustion state where appropriate, and replays idempotently. Protected features, incompatible materials, exhausted sources, and sibling duplicates reject with zero writes. Regrowth/replenishment follows deterministic Kai/world policy without a server loot table or timer.

- [ ] **Step 2: Implement sparse proof-native resource authority**

Bind source, terrain/material, quantity/capacity, quality, explorer, creature, tool, Kai root, world head, and idempotency identity. Commit world-source and inventory effects atomically. Project only admitted nearby state and perform zero generation, verification, or history reduction during movement.

- [ ] **Step 3: Write failing construction and collaboration tests**

Build an inhabitable foundation, room, roof, door, stair, bridge, storage, workshop, habitat, light, and water element from exact materials. Prove preview is zero-write and admitted geometry has collision, clearance, support, entrances, interior, utilities, access, provenance, and repair state. Invite another builder, contribute materials/creature labor, and require every participant, inventory, creature/job, and structure head to advance atomically or none.

- [ ] **Step 4: Implement intuitive physical build mode**

Provide touch/pointer placement, rotate, height, snap, undo-preview, confirm, and concise validity cues. Snap to terrain, tunnels, water, foundations, and structural anchors. Use a bounded component catalog, and bake/cache admitted nearby geometry, collision, and navigation without rebuilding distant structures.

- [ ] **Step 5: Implement bounded creature work while playing or offline**

Compile each blueprint into deterministic stages for exact professions: lumber, quarry, mine, haul, burrow, shape, masonry, stabilize, underwater build, illuminate, survey, rescue, and finish. Require explicit material/tool allocation and a Receiz living-subject mandate binding blueprint digest, region, resource/action budgets, creature heads/capabilities, expiry, safety, pause, and revocation. Queue/resume through the official subject-runtime job rail; admit independently verified stage additions only. Stale, exceeded, failed, paused, or revoked work writes nothing further. First paint uses carried local heads and never waits for job polling.

- [ ] **Step 6: Write failing authored-gameplay safety and replay tests**

Compose a playable structure from start/finish, checkpoint, door, switch, pressure plate, key, Kai timer, puzzle, traversal gate, habitat, battle arena, race, hazard, processor, shop, reward, score, and reset primitives. Reject arbitrary code, unreachable exits, unbounded effects/rewards, authority outside the structure/participants, nondeterminism, and missing accessibility metadata. A second player completes and restores the same experience deterministically.

- [ ] **Step 7: Implement bounded declarative gameplay experiences**

Compile authoring primitives into a pure bounded state machine with exact structure and participant heads. Validate/publish through one explicit command; previews stay zero-write. Consequences append through existing battle, inventory, creature, Φ, and world boundaries without allowing authored content to manufacture authority.

- [ ] **Step 8: Implement policy-bound damage, repair, salvage, and destruction**

Admit damage only for owner dismantling, explicitly destructible public play, consensual siege/battle, or current policy. Derive support failure from exact geometry/material/capability/environment. Preserve ruins and bounded salvage; repairs append to the same identity. Reject private/protected griefing with zero writes.

- [ ] **Step 9: Implement resource gifts and Φ sales**

Support exact capacity split/merge, gift, listing, purchase, and sale. Atomically advance seller resource custody, buyer receipt, buyer Φ subtraction, seller Φ addition, and all heads. Use local verified balance/inventory projections and event-driven unknown additions; never poll balances or treat listing/preview/API success as settlement.

- [ ] **Step 10: Run harvesting, construction, jobs, collaboration, authored-play, destruction, trade, restore, latency, and render suites; commit**

Commit: `feat: let players and creatures build the living Wildz world`

### Task 10: Quality-Bounded Ambient Aquatic and Aerial Life

**Files:**
- Create: `src/features/play/WildsAmbientLife.tsx`
- Create: `src/features/play/wilds-ambient-life.ts`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Test: `tests/wilds-ambient-life.test.ts`
- Test: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Produces cached immutable ambient projections that are visually distinct from catchable signals.

- [ ] **Step 1: Write failing bounded-cache and reality tests**

Assert repeated movement inside one region produces zero builds, all ambient paths remain physically valid, and approaching an admitted ambient creature never makes it disappear because of an LOD swap.

- [ ] **Step 2: Implement cached local schools and flight paths**

Generate only at region admission/explicit scan, cap by quality profile, freeze projections, reuse instanced geometry, and use stable LOD identity. Do not mount labels, capture rings, or signal effects on ambient life.

- [ ] **Step 3: Run cache/render tests and commit**

Commit: `feat: populate water and sky with living ambient creatures`

### Task 11: Admitted Restore and Hot-Path Freeze

**Files:**
- Create: `src/features/play/admitted-inventory.ts`
- Modify: `src/features/play/game-state.ts`
- Modify: `src/features/play/wildz-runtime-checkpoint.ts`
- Modify: `src/features/play/wilds-traversal-capabilities.ts`
- Test: `tests/wildz-full-vault-regression.test.ts`
- Test: `tests/wilds-runtime-latency.test.ts`

**Interfaces:**
- Produces an admitted-inventory restore boundary that never re-verifies already-admitted cards during runtime checkpoint hydration.

- [ ] **Step 1: Write failing verifier-call-count tests**

Warm an uploaded selected creature, restore an admitted checkpoint, then execute 10,000 move/submersion ticks. Assert zero verifier calls, fetches, slow key builds, capability builds, hotspot generations, and timers after admission.

- [ ] **Step 2: Implement admitted restore without weakening upload verification**

Explicit card/Vault/Identity upload remains the one admission boundary. Runtime checkpoint and same-session restore consume a validated admitted inventory marker/cache and normalize support selections without scanning proof verification again.

- [ ] **Step 3: Verify foreign/card-only isolation and same-owner exact restore**

Assert foreign imports never merge exploration, position, depth, selection, or identity; same-owner Identity Seal restore remains exact.

- [ ] **Step 4: Run restore, upload, latency, and full-vault suites; commit**

Commit: `perf: keep admitted creature gameplay verification-free`

### Task 12: Atlas Scale Invariance as Discovery Grows

**Files:**
- Modify: `src/features/play/wilds-world-atlas.ts`
- Modify: `src/features/play/wilds-atlas-camera.ts`
- Modify: `src/features/play/WildsAtlasCanvas.tsx`
- Modify: `src/features/play/WildsWorldMap.tsx`
- Test: `tests/wilds-world-atlas.test.ts`
- Test: `tests/wilds-atlas-camera.test.ts`
- Test: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Preserves one constant World-view region scale while Fit discoveries changes camera framing only.

- [ ] **Step 1: Write failing scale-invariance tests**

Project the starting atlas, add distant sparse discoveries, and assert identical `regionUnit` plus identical terrain-cell, route, landmark, building, label, presence, and marker scale factors. Assert bounds expansion does not change camera distance/target/orbit for an open atlas. Assert explicit Fit discoveries still frames the complete bounds.

- [ ] **Step 2: Verify RED**

Expected: FAIL because World projection currently reduces `regionUnit` as `maxSpan` grows and opening framing compresses all discoveries.

- [ ] **Step 3: Implement constant physical map scale**

Remove discovery-span scaling from World `regionUnit`. Convert every atlas world/local mapping and positioned object through the same constant region authority. Newly discovered coordinates extend sparse geometry and pannable coordinates without resizing existing geography.

- [ ] **Step 4: Preserve camera scale across open and bounds expansion**

Restore the prior World camera relationship when available or open near the current marker at the canonical scale. Bounds/presence refreshes never refit. Keep You as translation without zoom and Fit discoveries as the only whole-bounds framing action.

- [ ] **Step 5: Run atlas projection/camera/render tests and commit**

Commit: `fix: keep atlas geography scale invariant`

### Task 13: Full Mobile Visual and Release Verification

**Files:**
- Modify: `tests/wilds-render-contract.test.ts`
- Modify: `docs/releases/v8.0.0.md` if the release ledger requires the new capability slice.
- Create: `output/playwright/wilds-underwater-mobile.png`
- Create: `output/playwright/wilds-aerial-encounter-mobile.png`

**Interfaces:**
- Consumes every prior task; produces release evidence only.

- [ ] **Step 1: Run deterministic and compatibility gates**

Run: `pnpm test`

Expected: all suites pass with zero failures.

- [ ] **Step 2: Run type, build, and diff gates**

Run: `pnpm exec tsc --noEmit && pnpm build && git diff --check`

Expected: exit 0; only existing documented dependency warnings may remain.

- [ ] **Step 3: Perform real mobile browser paths**

Verify: shore capture of a first swimmer; enter deep water; swim above the bed; descend to the visible floor; orbit underwater; capture a water-column and seabed creature; ascend and return to shore; take off; intersect and capture an aerial creature; land; inspect the identical caught cards; approach and enter representative cave, mountain, grotto, trench, and sky-island sites; leave and return to prove each site persists.

- [ ] **Step 4: Capture diagnostics and screenshots**

Record frame median/p95, long tasks, draw calls, memory, capability/cache counters, console errors, page errors, and nonblank canvas pixels for dry, underwater, and aerial states.

- [ ] **Step 5: Run the complete release freeze and commit**

Run project release gates applicable to v8.0.0, then commit verified evidence and any release-note update with:

```bash
git commit -m "feat: ship living creature traversal worlds"
```
