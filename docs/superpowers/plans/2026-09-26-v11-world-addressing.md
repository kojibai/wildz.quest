# Wildz v11 World Addressing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Make the Wildz world addressable beyond the v10 coordinate caps while retaining stable nearby gameplay and old saves.

**Architecture:** A canonical BigInt region address and fixed-point local offset replace large floating-point world positions at persistence and authority boundaries. Terrain and simulation project only a bounded local window into number coordinates. Existing v10 positions convert exactly where representable.

**Tech Stack:** TypeScript, Next.js 15, React Three Fiber, Node test runner, Receiz portable state.

**Spec:** docs/superpowers/specs/2026-09-26-wildz-v11-unbounded-world-creatures-rarity-design.md

## Global Constraints

- Region size: 24 world units; regionX and regionZ serialize as canonical signed decimal strings.
- No designed last region; finite resource guards must be disclosed and must never silently clamp a location.
- V10 terrain and save coordinates keep their previous meaning.
- Active terrain, physics, audio, presence, and cache work stay bounded around the player.
- V11 encounter and proof work consumes the address interface from Task 1.

## Review Focus

- Negative-region boundaries normalize to the correct neighbor rather than rounding toward zero; Task 1 test.
- Enormous decimal coordinates never become Number or 32-bit seeds; Task 2 test.
- Malformed or oversized address input fails clearly without moving a player; Task 3 test.
- Sparse faraway atlas discoveries never allocate intervening regions; Task 3 test.
- Rift arrival and multiplayer presence show the same local region after restore; Task 4 test.

---

### Task 1: Canonical region address

**Files:** Create src/features/play/wilds-world-address.ts; Test tests/wilds-world-address.test.ts.

**Interfaces:** Produce WildsWorldAddress = { worldVersion: 11; regionX: string; regionZ: string; localX: number; localZ: number }; parseWildsWorldAddress(value: unknown): WildsWorldAddress; offsetWildsWorldAddress(address, dxMicro: bigint, dzMicro: bigint): WildsWorldAddress; wildsAddressDistanceSquared(address): bigint; v10PositionToWildsAddress(x: number, z: number): WildsWorldAddress. localX/localZ are integer micro-units in [0, 24,000,000).

- [ ] Step 1: Write tests for canonical zero/negative strings, local overflow to neighbor, negative-region crossing, exact v10 conversion, and rejection of fractional or noncanonical region strings.
- [ ] Step 2: Run pnpm test; expect the new address tests to fail.
- [ ] Step 3: Implement the exported interface with BigInt quotient/remainder and no Number conversion of region coordinates.
- [ ] Step 4: Run pnpm test and pnpm typecheck; expect both to pass.
- [ ] Step 5: Commit the address module and test.

### Task 2: Versioned region generation

**Files:** Create src/features/play/wilds-region-generator-v11.ts; Modify src/features/play/wilds-terrain-authority.ts, src/features/play/wilds-discovery-sites.ts, src/features/play/wilds-resource-authority.ts, src/features/play/wilds-ambient-life.ts, src/features/play/hidden-hotspots.ts; Test tests/wilds-region-generator-v11.test.ts.

**Interfaces:** Consume WildsWorldAddress. Produce generateWildsRegionV11(regionX: string, regionZ: string): WildsRegionV11 with bounded terrain, site, resource, and ambient seeds; projectWildsLocalRegion(region, origin): number-space local coordinates. Retain v10 generator entry points for old geography.

- [ ] Step 1: Test identical output after replay, distinct output at region values beyond 2^53, fixed six encounter slots where eligible, and preservation of v10 central fixtures.
- [ ] Step 2: Run pnpm test; expect new generation tests to fail.
- [ ] Step 3: Add domain-separated SHA-256 seeds and v11 adapters at existing authorities; remove numeric clamps only on the v11 path.
- [ ] Step 4: Run pnpm test and pnpm typecheck; expect both to pass.
- [ ] Step 5: Commit region generation and tests.

### Task 3: Save, atlas, construction, and world-service migration

**Files:** Modify src/features/play/game-state.ts, src/features/play/wilds-exploration-atlas.ts, src/features/play/wilds-world-service.ts, src/features/play/wilds-world-construction.ts, src/features/play/wilds-excavation.ts; Test tests/wilds-world-v11-restore.test.ts and tests/wilds-exploration-atlas.test.ts.

**Interfaces:** Consume WildsWorldAddress; produce a versioned v11 player address and sparse atlas entries in serialized PlayState. Restore v10 numeric positions through v10PositionToWildsAddress without rewriting exact historical card proofs.

- [ ] Step 1: Test v10 save restore, v11 far-address round trip, sparse two-region atlas, malformed address rejection, and construction/resource anchors after restore.
- [ ] Step 2: Run pnpm test; expect migration tests to fail.
- [ ] Step 3: Add schema-aware serialization, restoration, and world-service adapters with explicit v10 compatibility.
- [ ] Step 4: Run pnpm test and pnpm typecheck; expect both to pass.
- [ ] Step 5: Commit migration and tests.

### Task 4: Travel, multiplayer, and bounded rendering

**Files:** Modify src/features/play/wilds-rift-travel.ts, src/features/play/multiplayer-core.ts, src/lib/receiz/wilds-multiplayer-server.ts, app/api/wilds/atlas/route.ts, app/api/wilds/rift/route.ts, src/features/play/WildsWorldCanvas.tsx; Test tests/wilds-world-v11-travel.test.ts and tests/wilds-multiplayer.test.ts.

**Interfaces:** Consume canonical v11 addresses at API and travel boundaries; publish region-room keys from canonical strings; pass only local number offsets into Three.js.

- [ ] Step 1: Test distant Rift arrival, local camera origin, same-room presence after save/restore, malformed API address denial, and stable v10 travel.
- [ ] Step 2: Run pnpm test; expect new travel tests to fail.
- [ ] Step 3: Migrate the travel/presence adapters and rebase camera-relative rendering when the active region changes.
- [ ] Step 4: Run pnpm test, pnpm typecheck, and pnpm build; expect all to pass.
- [ ] Step 5: Measure near and distant region frame time/object counts against v10.1.0 and commit the working world slice.

### Task 5: Coordinate-cap closure

**Files:** Modify src/features/play/wilds-site-runtime.ts, src/features/play/wilds-steward-construction.ts, src/features/play/wilds-steward-craft.ts, src/features/play/wilds-regional-weather.ts, src/features/play/wilds-roaming-presence.ts, src/features/play/wilds-atlas-render-tiles.ts, src/features/play/wilds-terrain-tiles.ts, src/features/play/wilds-terrain-obstacles.ts; Test tests/wilds-v11-coordinate-cap-closure.test.ts. If the inventory test identifies another active authority, amend this file list before changing that code.

**Interfaces:** Every active v11 world-position entry point accepts WildsWorldAddress or a bounded local projection; v10 numeric caps remain in the v10 branch only. An inventory in the test identifies each reachable coordinate-limited subsystem and exercises one address beyond the old ±500,000,000 and ±1,000,000 limits.

- [ ] Step 1: Write a failing integration matrix for terrain, discovery, resource, site, construction, excavation, weather, atlas, multiplayer, Rift, and world rendering at a far v11 address; include a v10 fixture per preserved path.
- [ ] Step 2: Run pnpm test; expect the matrix to reveal remaining clamps, rejection, or precision aliasing.
- [ ] Step 3: Migrate each reachable path through the address adapter and record the exact files audited in a test inventory.
- [ ] Step 4: Run pnpm test, pnpm typecheck, and pnpm build; expect no far-address failure.
- [ ] Step 5: Commit cap-closure changes and the audit test.
