# Mountain Discovery And Living Timber Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make mountain scanning and discoveries share the exact mountain surface, and make every harvestable timber source visibly explain and execute its available action.

**Architecture:** Extend the search intent with an exact clicked surface elevation and preserve it through encounter state so the pulse never falls back to base terrain. Use the already-prepared site runtime as the shared mountain authority for search targets and resource actors. Add a pure resource-affordance projection so rendering explains proximity, companion requirements, recovery, and the available action without moving proof or network work into the frame loop.

**Tech Stack:** Next.js 15, React 19, React Three Fiber, Three.js, Node test runner, TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-24-wildz-regenerative-living-world-design.md`

## Global Constraints

- Gameplay remains local and immediate. Synchronization never enters movement, camera, animation, weather-rendering, collision, or interaction rendering.
- The Receiz ID and admitted proof object remain the authority; SDK, MCP, APIs, and URLs distribute and synchronize representations only.
- A possible action must have a visible in-world affordance and a precise reason when it cannot execute.
- No source, lot, creature consent, or settled Phi may be fabricated by presentation code.
- Mountain search, clue, creature, resource, and player projections must use one shared physical surface authority.

---

### Task 1: Exact Search Surface Contract

**Files:**
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/encounter-state.ts`
- Modify: `src/features/play/game-state.ts`
- Test: `tests/wilds-layered-encounters.test.ts`

**Interfaces:**
- Consumes: `wildsSiteRuntimeGroundY(runtime, spaceId, x, z, fallback)`.
- Produces: `onSearchPoint(point: { x: number; z: number; surfaceWorldY: number })` and persisted `searchPoint.surfaceWorldY`.

- [ ] Add a failing reducer test proving a mountain-surface search preserves `surfaceWorldY` on the active encounter.
- [ ] Run the focused layered-encounter test and confirm the new assertion fails.
- [ ] Thread the exact surface elevation from the prepared site runtime through the search intent and encounter state.
- [ ] Render `SearchPulse` from the preserved elevation for empty, hint, and hit searches.
- [ ] Run the focused test and confirm it passes.

### Task 2: Mountain-Bound World Resources

**Files:**
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `src/features/play/WildsStewardEnvironment.tsx`
- Test: `tests/wilds-steward-construction.test.ts`

**Interfaces:**
- Consumes: prepared `WildsSiteRuntimeProjection` and `wildsSiteRuntimeGroundY`.
- Produces: resource actors whose local Y equals exact outer surface Y minus the current terrain anchor.

- [ ] Add a failing projection test proving a source inside a mountain field resolves to the mountain skin rather than base terrain.
- [ ] Run the focused steward test and confirm it fails.
- [ ] Pass the prepared runtime into the steward environment and resolve source actor elevation off the hot path during memoized projection.
- [ ] Run the focused steward test and confirm it passes.

### Task 3: Obvious Living-Timber Action

**Files:**
- Create: `src/features/play/wilds-resource-affordance.ts`
- Modify: `src/features/play/WildsStewardEnvironment.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `app/globals.css`
- Create: `tests/wilds-resource-affordance.test.ts`

**Interfaces:**
- Produces: `projectWildsResourceAffordance(input)` returning label, guidance, enabled state, and presentation state.
- Consumes: source kind, distance, availability, pending state, and admitted companion work families.

- [ ] Add failing tests for approach, ready, incompatible-companion, pending, and recovering states.
- [ ] Run the focused affordance test and confirm it fails.
- [ ] Implement the pure affordance projection.
- [ ] Replace ambiguous timber logs with a managed living-timber silhouette, visible cut mark, availability-stage canopy, and a proximity action pill.
- [ ] Keep clicks routed to the existing admitted harvest command so authority and settlement behavior remain unchanged.
- [ ] Run the focused affordance and steward tests and confirm they pass.

### Task 4: Performance, Mobile, And Release Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-08-25-mountain-discovery-living-timber.md`

**Interfaces:**
- Consumes: completed Tasks 1-3.
- Produces: verified build and gameplay evidence.

- [ ] Run the focused tests, typecheck, lint, and full test suite.
- [ ] Run a production build.
- [ ] Open the game in a real browser and test a terrain search plus timber action at desktop and mobile widths.
- [ ] Check console errors, canvas diagnostics, touch target fit, and that no additional per-frame projection/network work was introduced.
- [ ] Commit the complete phase with a focused message.
