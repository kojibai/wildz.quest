# Wildz Grounded Movement And Collision Implementation Plan

> **Execution:** Complete test-first in bounded commits; preserve all existing two-dimensional save and proof contracts.

**Goal:** Make walking follow deterministic terrain and slide around visible physical obstacles without introducing a physics engine, background verification, or gameplay latency.

**Architecture:** A pure analytical movement resolver consumes the released terrain and obstacle authorities. Physical scenery is rendered from the exact same records, preventing invisible or mismatched collision. Player saves remain `{x,z}`; elevation is projected at runtime. Small stepable rocks and foliage remain pass-through, while trunks, large rocks, deep water, and climb-grade slopes constrain ordinary walking.

**Tech Stack:** TypeScript, React Three Fiber, Three.js, Node test runner.

## Reference ledger

- `docs/superpowers/specs/2026-08-21-wildz-three-dimensional-world-design.md`: approved collision, traversal, latency, and compatibility contract.
- `src/features/play/wilds-terrain-authority.ts`: sole ground/surface/traversal authority.
- `src/features/play/wilds-terrain-obstacles.ts`: deterministic physical obstacle records and spatial indexing.
- `src/features/play/wilds-terrain-compatibility.ts`: safe restored-position projection.
- `src/features/play/game-state.ts`: released movement input and save coordinate contract.
- `src/features/play/WildsEnvironment.tsx`: physical scenery rendering.

## Task 1: Analytical grounded movement resolver

**Files:**

- Create: `src/features/play/wilds-grounded-movement.ts`
- Create: `tests/wilds-grounded-movement.test.ts`

- [x] Write failing tests for unobstructed travel, deterministic replay, trunk collision, sliding, stepable rocks, deep-water gates, steep-slope gates, and shallow-water slowdown.
- [x] Confirm the focused test fails because the resolver does not exist.
- [x] Implement bounded local obstacle lookup with a small deterministic tile cache.
- [x] Implement capsule-circle pushout and stable slide resolution.
- [x] Implement terrain traversal gates and surface speed projection.
- [x] Run focused tests and confirm they pass.
- [x] Commit the analytical resolver.

## Task 2: Bind visible physical scenery to obstacle authority

**Files:**

- Modify: `src/features/play/WildsEnvironment.tsx`
- Modify: `src/features/play/wilds-terrain-obstacles.ts`
- Modify: `tests/wilds-terrain-obstacles.test.ts`

- [x] Add failing assertions that every physical render placement retains its authoritative obstacle id, world position, and kind.
- [x] Expose explicit tree/rock kind and deterministic visual scale on obstacle records.
- [x] Render trunks and rocks from obstacle records rather than a second placement algorithm.
- [x] Keep bushes, grass, and flowers cosmetic and pass-through.
- [x] Ensure every blocking obstacle remains visible at every quality tier.
- [x] Run focused tests, typecheck, and lint.
- [x] Commit physical scenery alignment.

## Task 3: Integrate terrain movement without changing saves

**Files:**

- Modify: `src/features/play/game-state.ts`
- Modify: `tests/play-game-state.test.ts`
- Modify: `tests/wilds-context-action.test.ts`

- [ ] Add regression tests proving ordinary movement uses the resolver while unchanged `{x,z}` saves round-trip exactly.
- [ ] Route digital and analog movement through the analytical resolver.
- [ ] Preserve input cadence, energy, discovery proximity, milestones, growth events, world bounds, and movement modes.
- [ ] Keep movement entirely synchronous and local; add no network, proof verification, timers, or persistence work.
- [ ] Run focused tests, typecheck, and lint.
- [ ] Commit grounded movement integration.

## Task 4: Ground actors and smooth camera framing

**Files:**

- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `src/features/play/WildsEnvironment.tsx`
- Modify: `tests/wilds-terrain-rendering.test.ts`

- [ ] Add pure projection coverage for actor-relative ground height.
- [ ] Ground remote explorers, trainers, encounters, bosses, and ecology actors against the same player-relative elevation.
- [ ] Keep the local explorer at the released local origin while terrain moves beneath it.
- [ ] Smooth camera target height only; do not seize orbit control or add per-frame React state.
- [ ] Run focused tests, typecheck, and lint.
- [ ] Commit grounded actors and camera framing.

## Task 5: Qualification

**Files:**

- Modify: `docs/superpowers/plans/2026-08-21-wildz-grounded-movement-collision.md`

- [ ] Run full tests and production build.
- [ ] Verify mobile WebKit walking, sustained trackpad input, collision slide, terrain streaming, search, console, canvas, and renderer budget.
- [ ] Confirm proof/save/player schemas remain unchanged.
- [ ] Record evidence, mark every step complete, and run `git diff --check`.
- [ ] Commit Phase 3 qualification evidence.
