# Wildz Large Created Environments and Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support streamed extensive architecture, consequential terrain/water/heat features, connected explorable worlds, and the approved gameplay performance requirement.

**Architecture:** Bounded spatial chunks and authored-space links extend the same definitions/instances/source operations. Worker generation and progressive render uploads follow existing device budgets; terrain/physics/navigation consume the same admitted fields. Dormant objects use bounded analytical catch-up rather than individual frame loops.

**Tech Stack:** Prior plans, existing world-address/terrain/burrow contracts, Three.js instancing/merged geometry, transfer-buffer workers, quality governor, sparse source indexes.

**Spec:** [Approved design](../specs/2026-10-05-wildz-prompt-creation-design.md); [global constraints](2026-10-05-wildz-prompt-creation.md); requires Plans 1–3 for shared admitted state.

## Global Constraints

- “Creative scale is separate from per-device active detail.”
- “Detail never replaces an active walkable surface with incompatible geometry.”
- “Space creation defines topology and permitted procedural generation; it does not mint arbitrary creatures, rarity, materials, or currency.”
- “Dormant remote creations do not each have a frame loop.”
- “HUD feedback should occur on the next available paint and never wait for planning or network.”
- “The release fails if normal gameplay latency/frame time regresses beyond measured run-to-run noise, existing device budgets are exceeded, or creation work introduces sustained stalls.”

## Review Focus

- A huge graph or teleport must not enumerate the entire creation/universe: Tasks 1,4.
- LOD/collider swaps and collapsed portals must not drop/strand an occupant: Tasks 1–2,4.
- Water/heat event loops must not create infinite energy or unbounded updates: Task 3.
- Authored worlds cannot mint chosen rarity/resources or overwrite other places: Tasks 2,4.
- Worker interruption, GPU upload/shader load, and mobile memory pressure must preserve input: Tasks 1,5.

---

### Task 1: Paged large creation plans and progressive residency

**Files:** Create `creation/chunks.ts`, `residency.ts`, `upload-scheduler.ts`; extend `creation/compiler.ts`, `worker-client.ts`, `projection.ts`, and `WildsCreationPreview.tsx`; modify `wilds-quality-profile.ts`, `wilds-quality-governor.ts`, and `wilds-world-geometry-selector.ts` through bounded residency adapters; create `tests/wilds-creation-streaming.test.ts`.

**Interfaces:** `CreationPageRef={pageId:string;head:string;bounds:CreationBounds;nodeIds:readonly string[];dependencies:readonly string[]}` with at most 128 nodes per plan page. `CreationResidencyBudget` derives active chunk/vertex/draw/texture limits from the existing quality profile and available scene allowance. `selectCreationPages(refs:CreationSpatialIndex,query:CreationNeighborhoodQuery,budget:CreationResidencyBudget):readonly CreationPageRef[]`; query contains world/space/position, view-distance and active occupant/support dependencies. `createCreationUploadScheduler({budget,upload,dispose})` enqueues compiled chunk buffers and activates only complete compatible physics/render bundles within per-paint allowance. Declarations live in `creation/chunks.ts`; scheduler callbacks are typed `(chunk:CreationChunk)=>CreationResidentChunk` and `(chunk:CreationResidentChunk)=>void`.

Residency budget field names are `maximumPages`, `maximumVertices`, `maximumDrawCalls`, `maximumTextureBytes`, and `maximumUploadBytesPerPaint`. Choose their actual device-profile values from measured available scene allowance and record them in the quality adapter; exceeding a budget defers detail instead of expanding the scene's total cost. Occupied collision/support pages remain pinned independently of cosmetic detail.

- [ ] Test enormous paginated plans without enumerating all pages, near/far deterministic selection, dependency pinning, cancelled late worker outputs, texture/material sharing, disposal after travel, active-collider compatibility, and upload backpressure/worker failure. Primary test: `test("a distant page request stays within the residency budget", ...)` with `assert.ok(residentPages.length <= budget.maximumPages); assert.equal(allPagesEnumerated, false)`; construct the stated input in this task's fixture/double setup.
- [ ] Run streaming tests and confirm missing bounded selection/upload behavior fails.
- [ ] Implement indexed page discovery, bounded progressive jobs, instancing/merging by material, shared residency and paced GPU uploads. A first usable admitted base can precede optional visual refinement; an unbuilt area remains unbuilt. Avoid raw React state updates per actor/chunk per frame.
- [ ] Run tests and browser-traverse an extensive multi-room/multi-storey palace while generating nearby sections; collect movement/frame/memory comparisons.
- [ ] Commit: `feat: stream extensive creations within scene budgets`.

### Task 2: Consequential terrain fields and connected cave interiors

**Files:** Create `creation/terrain.ts`, `terrain-compiler.ts`; modify `wilds-terrain-authority.ts`, `wilds-world-geometry-selector.ts`, `wilds-burrow.ts`, `wilds-structure-support.ts`, `creation/navigation.ts`, `registry.ts`, and `src/lib/receiz/wilds-creation-admission.ts`; create `tests/wilds-creation-terrain.test.ts`.

**Interfaces:** `CreationTerrainField={fieldId:string;spaceId:string;sourceHead:string;bounds:CreationBounds;operation:"add"|"subtract";shape:CreationTerrainShape;materialId:string}`; shapes use bounded sphere/capsule/heightfield/procedural-surface parameters. `compileCreationTerrain(fields:readonly CreationTerrainField[],physical:readonly CreationPhysicalChunk[],budget:CreationTerrainBudget):CreationTerrainProposal` derives matching render surfaces, collision/support, navigation connections and affected feature/source heads. Proposal includes required material/displaced matter and ecology consequences; admission advances those sources together.

- [ ] Test mountain traversal, entrance/chamber connections, construction inside a creation space, dry/flooded routes, canonical protected route overlap, another steward's feature, displacement/resource conservation, surface consistency, stale field head, and occupant-safe connection changes. Primary test: `test("terrain render collision and navigation share an admitted field", ...)` with `assert.equal(renderFieldHead, collisionFieldHead); assert.equal(navFieldHead, collisionFieldHead)`; construct the stated input in this task's fixture/double setup.
- [ ] Run terrain tests and confirm missing field/physical agreement fails.
- [ ] Implement local bounded additive/subtractive overlays over canonical terrain, shared exact physical/nav derivation, and compatibility with existing burrow sources. Do not reinterpret current cave limits or make the pure gated authored-world module an operational rail by assumption. Unsupported physical/authority operations remain explicit blockers.
- [ ] Run terrain/physical/burrow tests and browser-create/traverse a connected cave and mountain feature; reload and confirm the same physical routes.
- [ ] Commit: `feat: create admitted terrain and connected interior spaces`.

### Task 3: Waterfalls, heat, volcanoes, and machines

**Files:** Create `creation/environment.ts`, `water.ts`, `heat.ts`, `mechanisms.ts`; extend behavior registry, source/admission/consequence adapters, and nearby visual projections; create `tests/wilds-creation-environment.test.ts`.

**Interfaces:** `CreationWaterState={inputUnits:number;storedUnits:number;outputUnits:number;routeHeads:readonly string[]}`; `CreationHeatState={fuelUnits:number;heatUnits:number;active:boolean}`. `stepCreationEnvironment(instance:CreationInstance,inputs:CreationEnvironmentInputs,kaiUPulse:number,budget:CreationEnvironmentBudget):CreationEnvironmentProposal` consumes/redistributes conserved sources and yields bounded water/heat/hazard effects. `stepCreationMechanisms(instance,events,budget)` composes registered sensor/logic/joint/actuator actions with a maximum 64 behavior steps; joint travel limits, output energy and target permissions are explicit rule parameters.

- [ ] Test water source/sink conservation, overflow/routing, drought, blocked channel, heat/fuel depletion, bounded hazard radius, neighboring eligible structure damage, infinite-feedback mechanism rejection, inactive/dormant catch-up, and stale source heads. Primary test: `test("an environmental feedback loop cannot create energy", ...)` with `assert.ok(outputEnergy <= admittedInputEnergy); assert.ok(steps <= 64)`; construct the stated input in this task's fixture/double setup.
- [ ] Run environment tests and confirm missing conserved effects fail.
- [ ] Implement water/heat source laws, deterministic bounded nearby simulation and analytical dormant catch-up, actual navigation/ecology/condition effects, and corresponding shared visual materials/effects. A volcano's hazard/eruption activity derives from the registered state; particles alone are insufficient. Route large destructive effects through bounded qualified stages with safe occupancy handling.
- [ ] Run environment/damage/resource tests; browser-use a working waterfall and a controlled volcano/heat creation, stop inputs, and observe actual finite state changes.
- [ ] Commit: `feat: build water heat and interactive environmental mechanisms`.

### Task 4: Connected worlds, galaxy hierarchy, and stable traversal

**Files:** Create `creation/spaces.ts`, `space-generation.ts`, `portals.ts`; modify `wilds-site-runtime.ts`, `wilds-rift-travel.ts`, `wilds-party-transport.ts`, `creation/index.ts`, `persistence.ts`, `registry.ts`, and `src/lib/receiz/wilds-creation-admission.ts`; create `tests/wilds-creation-spaces.test.ts`. Reuse the current world address type through the site/travel adapters; introduce no parallel coordinate arithmetic.

**Interfaces:** `CreationSpace={spaceId:string;parentSpaceId:string|null;definitionDigest:string;seed:string;generationLawDigest:string;ownerId:string;stewardId:string;head:string}`. `CreationSpaceLink={linkId:string;from:{spaceId:string;nodeId:string};to:{spaceId:string;nodeId:string};access:CreationAccessPolicy;head:string}`. `deriveCreationSpaceRegion(space:CreationSpace,address:CreationRegionAddress,rules:CreationSpaceGenerationRules):CreationPhysicalChunk` uses only the requested bounded region and explicit generation laws. Address carries signed region coordinates and space identity compatible with the existing addressing representation. `prepareCreationSpaceTravel(actor:CreationTravelActor,link:CreationSpaceLink,context:CreationAuthorityContext):CreationOperation` binds source/destination/arrival, accompanying crew, access, and pending travel state.

- [ ] Test sparse galaxy/world creation, deterministic requested-region generation, very distant coordinates, cyclic space/link rejection, stable portal return, public/invited/private entry, parent stewardship transfer, restored crew travel, changed/destroyed destination head, and no selected rarity/free material or currency issuance. Primary test: `test("galaxy travel generates only the destination neighborhood", ...)` with `assert.equal(allDescendantsEnumerated, false); assert.equal(arrival.spaceId, destination.spaceId)`; construct the stated input in this task's fixture/double setup.
- [ ] Run space tests and confirm missing sparse generation/travel behavior fails.
- [ ] Implement space topology and bounded region generation under versioned source/genesis laws; add real enterable/explorable worlds and stable links. Use rendered hierarchy/sky as distant presentation while loading playable neighborhoods on entry; do not claim a backdrop is an explorable galaxy. Preserve nested creation histories and access under source restoration.
- [ ] Run space/terrain/persistence tests and actual two-player entry/build/return/export/import flows. Confirm travel does not materialize every descendant or reset other workers' independent jobs.
- [ ] Commit: `feat: create connected explorable worlds and galaxy spaces`.

### Task 5: Complete-world performance and production qualification

**Files:** Extend `scripts/benchmark-creation-work.mjs`, creation browser fixture, applicable existing benchmark scripts only where new hot paths require coverage, and qualification report; create `tests/wilds-creation-performance-boundaries.test.ts`.

**Interfaces:** Qualification report retains the protocol and baseline from Plan 1 and adds the spec's eight acceptance scenarios, authenticated admission evidence, device data and unresolved limits. Runtime counters expose bounded generation requests, active pages/instances, simulated behavior steps, collider updates, draw/triangle/texture residency, upload tasks, and discarded obsolete responses; counters never hash histories or mutate authority in render callbacks.

- [ ] Test zero closed-feature generation/network calls, bounded nearby behavior with many dormant instances, no synchronous compile on worker failure, no whole-universe enumeration after travel, reused immutable physical cache on movement, and bounded upload queue under cancellation. Primary test: `test("worker failure never compiles synchronously in movement", ...)` with `assert.equal(synchronousCompileCalls, 0); assert.equal(movementProgressed, true)`; construct the stated input in this task's fixture/double setup.
- [ ] Run named boundary tests and CPU/hot-path benchmarks, keeping their evidence distinct from browser/device frame time.
- [ ] Collect repeated real hardware samples for closed feature, streaming conversation, small creation, palace streaming, terrain/water/heat, gardens, destruction, global deltas, and rapid space travel. Compare input/frame p50/p95/p99, long tasks, budgets, memory and residency against the same baseline protocol; record the predeclared run-to-run noise range.
- [ ] Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, applicable Receiz/release checks, actual multi-player/recovery acceptance scenarios, and accessible mobile/desktop HUD verification. Fix new regression causes and rerun only affected checks before final broad qualification. Unavailable physical-device or production-rail evidence prevents a blanket “no lag”/full completion claim.
- [ ] Commit: `test: qualify consequential prompt worlds and gameplay performance`.
