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

- [x] Add a regression assertion that player-local ground height remains zero while absolute terrain varies.
- [x] Replace the decorative sine plane with the deterministic indexed terrain projection.
- [x] Select tessellation by existing quality tier and rebuild only at tile boundaries or tier changes.
- [x] Preserve the current texture, materials, search click surface, shadows, and five-by-five stream footprint.
- [x] Run focused tests, typecheck, and lint.
- [x] Commit elevated streamed ground.

## Task 3: Ground world dressing and authored paths

**Files:**

- Modify: `src/features/play/wilds-ecology-placement.ts`
- Modify: `src/features/play/WildsEnvironment.tsx`
- Modify: `tests/wilds-ecology-placement.test.ts`
- Modify: `tests/wilds-terrain-rendering.test.ts`

- [x] Write failing tests that ecology and authored ribbon vertices use the same relative terrain authority.
- [x] Ground trees, bushes, rocks, flowers, landmarks, living sites, and flagship entrances.
- [x] Drape major routes and watercourses over deterministic elevation.
- [x] Replace flat local trail planes with sampled terrain ribbons.
- [x] Keep render quality cosmetic; no quality tier may alter authoritative positions.
- [x] Run focused tests, typecheck, and lint.
- [x] Commit grounded world dressing.

## Task 4: Visual and repository verification

**Files:**

- Modify: `docs/superpowers/plans/2026-08-21-wildz-visual-terrain-elevation.md`

- [x] Run the full test suite.
- [x] Build the production application.
- [x] Verify `/world` in a mobile WebKit viewport: nonblank canvas, no console errors, terrain under the explorer, visible elevation, no cracks or obvious floating scenery.
- [x] Confirm existing save/proof/player coordinate types remain unchanged.
- [x] Mark every plan step complete and run `git diff --check`.
- [x] Commit Phase 2 qualification evidence.

## Phase 2 qualification evidence

- Full repository tests: 1,342 passed, 0 failed across 122 suites.
- Production build: passed with the pre-existing Receiz `web-worker` dynamic-import warning; route generation and type/lint gates passed.
- Production WebKit mobile: 390×844 CSS pixels, 487×1054 drawing buffer, zero console errors.
- Production WebKit desktop: 1280×720 CSS pixels, 1600×900 drawing buffer, zero console errors.
- Interaction: continuous mobile trackpad travel moved the explorer from approximately `(-2, -1)` to `(-181, -288)` and streamed terrain without errors; production terrain click advanced the scan prompt to `Signal warm. Follow the search clue.`
- Canvas variance fallback: isolated canvas RGB standard deviations were 56.92, 50.97, and 40.16; the canvas was nonblank and visually varied.
- Renderer diagnostics: 96 calls, 77,120 triangles, 93 geometries, 5 textures, DPR 1.25; within the released 160-call and 180,000-triangle budget.
- Save compatibility: no save, proof, player-coordinate, or world-record schema changed; elevation remains a deterministic projection of existing `x/z` coordinates.
- Screenshots: `output/playwright/terrain-phase2-mobile-webkit.png`, `output/playwright/terrain-phase2-mobile-elevated-active.png`, and `output/playwright/terrain-phase2-desktop-webkit.png`.

### QA reference ledger

- Yes — `threejs-qa-release/references/qa-release-checklists.md`: browser, interaction, performance, and release evidence format.
- Yes — `threejs-qa-release/references/checklists/visual-verification.md`: canvas dimensions, pixel variance, screenshots, and responsive checks.
- Yes — `threejs-qa-release/references/checklists/playtest-qa.md`: movement, streaming, and terrain-scan state changes.
- Yes — `threejs-qa-release/references/checklists/release.md`: fresh production build and production WebKit verification.
- Yes — `threejs-aaa-graphics-builder/references/checklists/aaa-game-quality-gate.md` and linked visual/performance checklists: renderer budget and honest visual-gate assessment.
- No — packaged `inspect-threejs-canvas.mjs`: unavailable because the skill runtime lacks `@playwright/test`; replaced with WebKit canvas capture plus Sharp channel statistics. This did not block equivalent canvas evidence.

### Visual gate assessment

Phase 2 passes its terrain-specific visual gate: deterministic relief, grounding, streaming, responsive framing, and performance evidence are present. It does not claim the complete AAA world gate yet; grounded collision, traversal abilities, vista composition, and the later material/detail pass remain intentionally assigned to subsequent architecture phases.
