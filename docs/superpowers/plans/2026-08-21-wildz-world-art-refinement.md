# Wildz World Art Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the deterministic Wildz terrain read as a large authored world through stronger mountain silhouettes, legible routes, landmark approaches, and desirable traversal discoveries without changing movement authority or mobile latency.

**Architecture:** A new pure projection module derives bounded horizon anchors and route guides from exact world coordinates, authored route data, terrain elevation, and quality tier. A focused React Three Fiber renderer consumes those projections with shared custom geometries, instancing, distance bounds, and quality-aware fog; existing overlook and landmark forms receive a small authored silhouette pass.

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

**Files:**
- Create: `src/features/play/WildsWorldArt.tsx`
- Modify: `src/features/play/WildsEnvironment.tsx`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Consumes: Task 1 projection functions, player position, biome trail palette, and quality profile.
- Produces: `WildsWorldArt`, `WorldScaleSilhouettes`, and `RouteWaystones` scene groups.

- [ ] **Step 1: Add failing render-contract tests**

  Require a dedicated world-art component, custom faceted ridge geometry, instanced route guides, terrain-relative placement, shared material roles, quality-tier counts, and quality-aware fog depth.

- [ ] **Step 2: Run the render-contract test and observe failure**

  Run: `pnpm exec tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wilds-render-contract.test.js`

- [ ] **Step 3: Implement shared custom geometry and instanced rendering**

  Build three asymmetric faceted ridge families with custom `BufferGeometry`; instance only the deterministic anchors for each family. Build route waystones from two shared instanced parts. Place every instance from exact projected elevation relative to the player and perform no per-frame React updates.

- [ ] **Step 4: Integrate quality-aware view depth**

  Retain the existing camera far plane and renderer pipeline. Expand fog depth by quality tier only enough to reveal the streamed terrain and horizon layer; do not add post-processing, dynamic shadow lights, or a new render loop.

- [ ] **Step 5: Run focused tests and typecheck**

  Run: `pnpm exec tsc --noEmit && node --test .test-build/tests/wilds-render-contract.test.js .test-build/tests/wildz-mobile-performance.test.js`

- [ ] **Step 6: Commit**

  `git commit -m "feat: render layered Wildz world art"`

### Task 3: Traversal-discovery and landmark silhouette refinement

**Files:**
- Modify: `src/features/play/WildsEnvironment.tsx`
- Modify: `tests/wilds-aerial-integration.test.ts`
- Modify: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Consumes: existing authored overlook and landmark projections.
- Produces: a recognizable sightglass overlook form and an authored entrance crown while preserving current interaction labels and distances.

- [ ] **Step 1: Add failing source/interaction contracts**

  Require named `overlook-sightglass`, `overlook-compass-inlay`, and `landmark-approach-crown` forms while retaining the exact accessible vista action and camera-restoration contract.

- [ ] **Step 2: Observe focused failures**

  Run: `pnpm exec tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wilds-aerial-integration.test.js .test-build/tests/wilds-render-contract.test.js`

- [ ] **Step 3: Implement the authored forms**

  Upgrade only already-streamed overlooks and entrances. Reuse materials and merge repeated compass/stone parts where practical; keep HTML labels within their existing short-distance gates and preserve exact click semantics.

- [ ] **Step 4: Run focused gates and typecheck**

  Run: `pnpm exec tsc --noEmit && node --test .test-build/tests/wilds-aerial-integration.test.js .test-build/tests/wilds-render-contract.test.js`

- [ ] **Step 5: Commit**

  `git commit -m "feat: refine Wildz traversal landmarks"`

### Task 4: Production qualification and evidence

**Files:**
- Modify: `docs/superpowers/plans/2026-08-21-wildz-world-art-refinement.md`

**Interfaces:**
- Consumes: completed Tasks 1–3.
- Produces: full verification, before/after evidence, renderer metrics, scorecard, and final qualification commit.

- [ ] **Step 1: Run full automated and production gates**

  Run: `pnpm test && pnpm build`

- [ ] **Step 2: Run production desktop and mobile WebKit playtests**

  Verify sustained movement, canvas health, console errors, profile/Slate overlays, route visibility, landmark/overlook readability, and responsive safe-area fit. Capture active-play screenshots.

- [ ] **Step 3: Capture renderer and frame diagnostics**

  Record calls, triangles, geometries, textures, median/p95 frame timing, viewport, DPR, quality tier, and compare against the 160/180,000 budgets and Phase 5 baseline.

- [ ] **Step 4: Fill the visual scorecard honestly**

  Score all ten required categories before/after and list remaining automatic failures or asset blockers. Do not claim premium/AAA if any category is below 2 or if external hero surfaces remain blocked.

- [ ] **Step 5: Record evidence, run the report audit, and commit**

  Run `git diff --check`, document exact evidence in this plan, audit the report with the director script, then commit with `git commit -m "docs: qualify Wildz world art refinement"`.
