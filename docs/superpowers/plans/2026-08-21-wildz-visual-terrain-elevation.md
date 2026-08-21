# Wildz Visual Terrain Elevation Implementation Plan

> **Execution:** Follow the repository's test-driven workflow and complete every checked step before advancing to grounded movement.

**Goal:** Render the deterministic terrain authority as a seamless elevated world while preserving the existing two-dimensional save and gameplay coordinate contract.

**Architecture:** Build framework-independent mesh projections from absolute terrain tiles, then let Three.js consume those immutable projections. Geometry changes only when the streamed tile coordinate or quality tier changes. The rendered world is translated by the current authoritative player elevation, so the local explorer remains at the existing zero-height contract until grounded movement ships.

**Tech Stack:** TypeScript, React 19, React Three Fiber, Three.js, Node test runner.

## Reference ledger

- `docs/superpowers/specs/2026-08-21-wildz-three-dimensional-world-design.md`: approved world architecture and compatibility constraints.
- `src/features/play/wilds-terrain-authority.ts`: sole elevation, normal, surface, and traversal authority.
- `src/features/play/wilds-terrain-tiles.ts`: seamless absolute tile sampling and tessellation limits.
- `src/features/play/WildsEnvironment.tsx`: current streamed ground, routes, landmarks, ecology, and distant scenery.
- `src/features/play/wilds-ecology-placement.ts`: framework-independent ecology projection seam.

## Task 1: Pure visual mesh projection

**Files:**

- Create: `src/features/play/wilds-terrain-rendering.ts`
- Create: `tests/wilds-terrain-rendering.test.ts`

- [x] Write failing tests for vertex/index counts, authority elevations, stable normals, and byte-identical neighboring edges.
- [x] Confirm the focused test fails because the projection module does not exist.
- [x] Implement an immutable indexed mesh projection over `buildWildsTerrainTile`.
- [x] Add a pure relative-elevation projection for player-local rendering.
- [x] Run the focused tests and confirm they pass.
- [x] Commit the pure rendering projection.

## Task 2: Elevated streamed ground

**Files:**

- Modify: `src/features/play/WildsEnvironment.tsx`
- Modify: `tests/wilds-terrain-rendering.test.ts`

- [ ] Add a regression assertion that player-local ground height remains zero while absolute terrain varies.
- [ ] Replace the decorative sine plane with the deterministic indexed terrain projection.
- [ ] Select tessellation by existing quality tier and rebuild only at tile boundaries or tier changes.
- [ ] Preserve the current texture, materials, search click surface, shadows, and five-by-five stream footprint.
- [ ] Run focused tests, typecheck, and lint.
- [ ] Commit elevated streamed ground.

## Task 3: Ground world dressing and authored paths

**Files:**

- Modify: `src/features/play/wilds-ecology-placement.ts`
- Modify: `src/features/play/WildsEnvironment.tsx`
- Modify: `tests/wilds-ecology-placement.test.ts`
- Modify: `tests/wilds-terrain-rendering.test.ts`

- [ ] Write failing tests that ecology and authored ribbon vertices use the same relative terrain authority.
- [ ] Ground trees, bushes, rocks, flowers, landmarks, living sites, and flagship entrances.
- [ ] Drape major routes and watercourses over deterministic elevation.
- [ ] Replace flat local trail planes with sampled terrain ribbons.
- [ ] Keep render quality cosmetic; no quality tier may alter authoritative positions.
- [ ] Run focused tests, typecheck, and lint.
- [ ] Commit grounded world dressing.

## Task 4: Visual and repository verification

**Files:**

- Modify: `docs/superpowers/plans/2026-08-21-wildz-visual-terrain-elevation.md`

- [ ] Run the full test suite.
- [ ] Build the production application.
- [ ] Verify `/world` in a mobile WebKit viewport: nonblank canvas, no console errors, terrain under the explorer, visible elevation, no cracks or obvious floating scenery.
- [ ] Confirm existing save/proof/player coordinate types remain unchanged.
- [ ] Mark every plan step complete and run `git diff --check`.
- [ ] Commit Phase 2 qualification evidence.
