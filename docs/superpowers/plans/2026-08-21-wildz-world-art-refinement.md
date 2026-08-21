# Wildz World Art Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the deterministic Wildz terrain read as a large authored world through stronger mountain silhouettes, legible routes, landmark approaches, and desirable traversal discoveries without changing movement authority or mobile latency.

**Architecture:** Exact terrain, water, routes, landmarks, and collision derive from fixed world coordinates. The final renderer expands the authoritative terrain footprint by quality tier, renders deterministic shallow/deep water above its physical bed, and keeps only fixed authored route guides as instanced decoration. A production QA correction removed the experimental player-relative ridge impostors because visible physical geography may never relocate or disappear on approach.

**Tech Stack:** TypeScript, React 19, React Three Fiber, Three.js, Node test runner, Playwright WebKit.

**Spec:** `docs/superpowers/specs/2026-08-21-wildz-three-dimensional-world-design.md`

## Global Constraints

- Rendering and gameplay consume the same deterministic terrain authority.
- Existing horizontal coordinates, saves, proof objects, discoveries, encounters, routes, and progression remain compatible.
- No proof verification, network fetch, persistence, timers, or React state may enter the pure art projection.
- Ordinary movement remains the existing bounded analytical path.
- Added visible detail must stay below 160 draw calls and 180,000 triangles on the supported quality profiles.
- Generated asset credentials are unavailable; repeated environment support surfaces use custom shared procedural geometry and instancing.

---

### Task 1: Deterministic world-art projection

**Files:**
- Create: `src/features/play/wilds-world-art.ts`
- Create: `tests/wilds-world-art.test.ts`

**Interfaces:**
- Consumes: `sampleWildsTerrain`, `WILDS_MAJOR_ROUTES`, and `WildsQualityTier`.
- Produces: `projectWildsHorizonAnchors(player, tier)` and `projectWildsRouteGuides(player, radius)`.

- [x] **Step 1: Write failing deterministic projection tests**

  Assert stable ids and byte-identical output, quality-bounded horizon counts, terrain-authority elevation, bounded radii, nearby route-guide projection, and a source audit rejecting network, React, storage, timers, proof verification, and `Math.random`.

- [x] **Step 2: Run the focused test and observe the missing-module failure**

  Run: `pnpm exec tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wilds-world-art.test.js`

- [x] **Step 3: Implement the minimal pure projection**

  Use deterministic scalar hashing, fixed ring counts by quality tier, exact terrain sampling, precomputed authored-route arc-length guides, radius filtering, stable sorting, and a fixed maximum result count.

- [x] **Step 4: Re-run focused tests and typecheck**

  Run: `pnpm exec tsc --noEmit && pnpm exec tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wilds-world-art.test.js`

- [x] **Step 5: Commit**

  `git commit -m "feat: project deterministic Wildz world art"`

### Task 2: Layered horizon and route renderer

> Historical implementation note: the route renderer remains. The experimental horizon ridge instances completed in this task were removed by Task 4 after approach QA proved that player-relative silhouettes violated the physical-visibility covenant.

**Files:**
- Create: `src/features/play/WildsWorldArt.tsx`
- Modify: `src/features/play/WildsEnvironment.tsx`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Consumes: Task 1 projection functions, player position, biome trail palette, and quality profile.
- Produces: `WildsWorldArt`, `WorldScaleSilhouettes`, and `RouteWaystones` scene groups.

- [x] **Step 1: Add failing render-contract tests**

  Require a dedicated world-art component, custom faceted ridge geometry, instanced route guides, terrain-relative placement, shared material roles, quality-tier counts, and quality-aware fog depth.

- [x] **Step 2: Run the render-contract test and observe failure**

  Run: `pnpm exec tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wilds-render-contract.test.js`

- [x] **Step 3: Implement shared custom geometry and instanced rendering**

  Build three asymmetric faceted ridge families with custom `BufferGeometry`; instance only the deterministic anchors for each family. Build route waystones from two shared instanced parts. Place every instance from exact projected elevation relative to the player and perform no per-frame React updates.

- [x] **Step 4: Integrate quality-aware view depth**

  Retain the existing camera far plane and renderer pipeline. Expand fog depth by quality tier only enough to reveal the streamed terrain and horizon layer; do not add post-processing, dynamic shadow lights, or a new render loop.

- [x] **Step 5: Run focused tests and typecheck**

  Run: `pnpm exec tsc --noEmit && node --test .test-build/tests/wilds-render-contract.test.js .test-build/tests/wildz-mobile-performance.test.js`

- [x] **Step 6: Commit**

  `git commit -m "feat: render layered Wildz world art"`

### Task 3: Traversal-discovery and landmark silhouette refinement

**Files:**
- Modify: `src/features/play/WildsEnvironment.tsx`
- Modify: `tests/wilds-aerial-integration.test.ts`
- Modify: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Consumes: existing authored overlook and landmark projections.
- Produces: a recognizable sightglass overlook form and an authored entrance crown while preserving current interaction labels and distances.

- [x] **Step 1: Add failing source/interaction contracts**

  Require named `overlook-sightglass`, `overlook-compass-inlay`, and `landmark-approach-crown` forms while retaining the exact accessible vista action and camera-restoration contract.

- [x] **Step 2: Observe focused failures**

  Run: `pnpm exec tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wilds-aerial-integration.test.js .test-build/tests/wilds-render-contract.test.js`

- [x] **Step 3: Implement the authored forms**

  Upgrade only already-streamed overlooks and entrances. Reuse materials and merge repeated compass/stone parts where practical; keep HTML labels within their existing short-distance gates and preserve exact click semantics.

- [x] **Step 4: Run focused gates and typecheck**

  Run: `pnpm exec tsc --noEmit && node --test .test-build/tests/wilds-aerial-integration.test.js .test-build/tests/wilds-render-contract.test.js`

- [x] **Step 5: Commit**

  `git commit -m "feat: refine Wildz traversal landmarks"`

### Task 4: Physical water, continuous geography, and legible flight endurance

**Files:**
- Modify: `src/features/play/wilds-terrain-authority.ts`
- Modify: `src/features/play/wilds-terrain-rendering.ts`
- Modify: `src/features/play/WildsEnvironment.tsx`
- Modify: `src/features/play/WildsWorldArt.tsx`
- Modify: `src/features/play/wilds-aerial-traversal.ts`
- Modify: `src/features/play/WildzWorldControls.tsx`
- Modify: associated focused contracts

- [x] **Step 1: Render water from the exact terrain surface classification**

  Project bounded shallow/deep meshes at the authoritative waterline with deterministic ripple relief, distinct materials, and no land-colored deep-water gate.

- [x] **Step 2: Preserve walker-scale world breadth**

  Expand the authoritative terrain render footprint by quality tier and lift major-route centers into dry causeways through low terrain. The procedural authority and released coordinate range remain unchanged at ±500,000,000.

- [x] **Step 3: Remove nonphysical horizon impostors**

  Delete the player-relative ridge projection and renderer. Terrain-scale forms now come only from the same terrain mesh that controls elevation and movement.

- [x] **Step 4: Make flight exhaustion understandable and recoverable**

  Retain bounded flight endurance, publish low-energy and exhausted states, recharge deterministically while grounded, block relaunch only below the visible 20% threshold, and update the flight control in 5% buckets outside the per-frame React path.

- [x] **Step 5: Pass focused authority, rendering, integration, and mobile-performance contracts**

  Result: 60/60 focused behavior and rendering tests passed, followed by the dedicated 12/12 mobile hot-path contract.

### Task 5: Production qualification and evidence

**Files:**
- Modify: `docs/superpowers/plans/2026-08-21-wildz-world-art-refinement.md`

**Interfaces:**
- Consumes: completed Tasks 1–4.
- Produces: full verification, before/after evidence, renderer metrics, scorecard, and final qualification commit.

- [x] **Step 1: Run full automated and production gates**

  Run: `pnpm test && pnpm build`

  Result: 1,379 tests across 127 suites passed with zero failures. The optimized production build passed; only the pre-existing `web-worker` dynamic-import warning from the Receiz/snark verifier chain remained.

- [x] **Step 2: Run production mobile WebKit playtests**

  Verified sustained running and flight across more than 200 world meters at 390×844, visible 5% flight warning, grounded recovery state, responsive safe-area controls, and zero console warnings/errors. Evidence: `output/playwright/world-deep-water-final-mobile-production.png` and `output/playwright/world-water-reality-mobile.png`.

- [x] **Step 3: Capture renderer and frame diagnostics**

  Production WebKit, 390×844: 300 frames, median 16.66 ms, p95 18.58 ms, p99 18.78 ms, max 32.20 ms, two canvases, and zero console warnings/errors. The earlier renderer diagnostic before the physical-water correction remained 97 calls and 69,204 triangles, below the 160/180,000 budgets; the correction removes three ridge draw calls and adds two water draw calls, so draw-call headroom does not regress.

- [x] **Step 4: Record the honest visual boundary**

  The pass establishes coherent physical terrain, clear water roles, fixed geography, authored routes, flight feedback, and production-mobile smoothness. It does not claim final AAA asset fidelity: external hero asset generation remained unavailable because Tripo, Gemini, and ElevenLabs credentials were absent.

- [x] **Step 5: Record evidence and run final repository checks**

  `git diff --check`, full tests, typecheck, focused contracts, optimized build, mobile production play, frame sampling, and console audit all passed.
