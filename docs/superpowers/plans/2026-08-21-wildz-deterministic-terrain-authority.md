# Wildz Deterministic Terrain Authority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build Phase 1 of the approved three-dimensional world: one pure, versioned authority for terrain samples, authored clearances, seamless tile data, physical obstacle records, and safe projection of existing horizontal coordinates.

**Architecture:** Pure TypeScript modules calculate all world facts from absolute `x`/`z` coordinates and immutable authored geography. The modules have no React, Three.js, network, storage, clock, or proof-verification dependency; later rendering and movement phases will consume these exact interfaces. Phase 1 deliberately leaves the visible world and current movement reducer unchanged.

**Tech Stack:** TypeScript 5.6, Node test runner, existing Next.js/React Three Fiber project, custom analytical terrain and collision data with no physics-engine dependency.

**Spec:** `docs/superpowers/specs/2026-08-21-wildz-three-dimensional-world-design.md`

## Global Constraints

- Existing `x` and `z` coordinates retain their exact meaning and are never rescaled.
- The proof object remains authority; terrain code performs no proof or server verification.
- Terrain version `wildz.terrain.v1` is immutable after release.
- Tile size remains exactly `12` world units for compatibility with current biome streaming.
- Tile borders sample absolute coordinates so adjacent edge positions and normals are identical.
- Ordinary queries are pure, finite, deterministic, and bounded.
- No new physics dependency is added; later movement uses custom analytical capsule collision.
- Phase 1 changes no rendered geometry, movement result, save schema, or player-facing behavior.

## Reference Ledger

| Reference | Required | Loaded | Decision |
|---|---:|---:|---|
| `threejs-gameplay-systems/references/gameplay-workflows.md` | yes | yes | Keep update order explicit and hot paths allocation-light. |
| `threejs-gameplay-systems/references/physics-engine-selection.md` | yes | yes | Use custom analytical collision; no rigid bodies, Rapier, cannon-es, Jolt, or Ammo. |
| `test-driven-development/writing-good-tests.md` | yes | yes | Assert real pure behavior with hand-derived literals and mutation-sensitive boundaries. |

## File Structure

- Create `src/features/play/wilds-terrain-authority.ts`: terrain version, sample types, deterministic elevation field, authored route/landmark flattening, surface classification, normals, slopes, and region identity.
- Create `src/features/play/wilds-terrain-tiles.ts`: absolute tile coordinates, quality-independent vertex samples, shared-edge data, and stable tile keys.
- Create `src/features/play/wilds-terrain-obstacles.ts`: deterministic physical obstacle records, stable ids, semantic collision material, spatial indexing, and bounded swept-area queries.
- Create `src/features/play/wilds-terrain-compatibility.ts`: ground existing coordinates, test clearance, and perform a deterministic bounded safe-position search.
- Create `tests/wilds-terrain-authority.test.ts`: authority determinism, finite bounds, authored clearances, surface behavior, and query purity.
- Create `tests/wilds-terrain-tiles.test.ts`: stable keys, exact adjacent-edge equality, and quality-independent authority values.
- Create `tests/wilds-terrain-obstacles.test.ts`: deterministic obstacle generation, arrival/landmark/route clearance, stable spatial query order, and soft-decoration exclusion.
- Create `tests/wilds-terrain-compatibility.test.ts`: exact horizontal preservation, grounded elevation, deterministic obstruction recovery, and bounded failure behavior.

---

### Task 1: Pure Terrain Samples and Authored Clearances

**Files:**
- Create: `src/features/play/wilds-terrain-authority.ts`
- Test: `tests/wilds-terrain-authority.test.ts`

**Interfaces:**
- Consumes: `WILDS_FLAGSHIP_LANDMARKS`, `WILDS_MAJOR_ROUTES`, and `WILDS_NAMED_REGIONS` from existing geography modules.
- Produces:
  - `WILDS_TERRAIN_VERSION = "wildz.terrain.v1"`
  - `WILDS_TERRAIN_TILE_SIZE = 12`
  - `type WildsTerrainSurface`
  - `type WildsTraversalRequirement`
  - `type WildsTerrainSample`
  - `sampleWildsTerrain(x: number, z: number): WildsTerrainSample`
  - `wildsTerrainElevation(x: number, z: number): number`
  - `distanceToWildsMajorRoute(x: number, z: number): number`

- [x] **Step 1: Write failing authority tests**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WILDS_TERRAIN_VERSION,
  distanceToWildsMajorRoute,
  sampleWildsTerrain,
  wildsTerrainElevation
} from "../src/features/play/wilds-terrain-authority";

test("terrain samples are deterministic finite world facts", () => {
  const first = sampleWildsTerrain(83.25, -61.75);
  assert.deepEqual(first, sampleWildsTerrain(83.25, -61.75));
  assert.equal(first.version, WILDS_TERRAIN_VERSION);
  assert.ok(Number.isFinite(first.elevation));
  assert.ok(Number.isFinite(first.slope));
  assert.ok(Object.values(first.normal).every(Number.isFinite));
  assert.ok(first.normal.y > 0);
});

test("authored arrival and landmark footprints remain level and walkable", () => {
  for (const point of [{ x: 0, z: 0 }, { x: 96, z: 144 }, { x: -144, z: 96 }, { x: 72, z: 40 }]) {
    const sample = sampleWildsTerrain(point.x, point.z);
    assert.equal(sample.slope, 0);
    assert.notEqual(sample.surface, "deep-water");
    assert.deepEqual(sample.traversal, []);
  }
});

test("major route centers are flattened by the same authority", () => {
  assert.equal(distanceToWildsMajorRoute(0, 0), 0);
  assert.ok(Math.abs(wildsTerrainElevation(0, 0) - wildsTerrainElevation(0.25, 0.1)) < 0.08);
});

test("terrain changes across distant geography without exceeding released bounds", () => {
  const values = [
    sampleWildsTerrain(220, 190).elevation,
    sampleWildsTerrain(-310, 125).elevation,
    sampleWildsTerrain(48, -286).elevation
  ];
  assert.ok(new Set(values).size > 1);
  assert.ok(values.every((value) => value >= -8 && value <= 28));
});
```

- [x] **Step 2: Run the authority test and verify RED**

Run: `npx tsx --test tests/wilds-terrain-authority.test.ts`

Expected: compilation fails because `wilds-terrain-authority.ts` does not exist.

- [x] **Step 3: Implement the minimal pure authority**

Create the declared types and functions. Use integer-coordinate value noise with smooth interpolation at broad, regional, and local frequencies. Clamp final elevation to `[-8, 28]`, calculate the normal from central differences at `0.25` world units, and quantize public numeric values to six decimal places.

Apply authored masks in this exact order:

1. calculate the unmasked deterministic elevation;
2. blend major route centers toward a locally continuous route grade inside `1.1` units;
3. blend each landmark footprint toward its center elevation inside `landmark.radius + 3` units;
4. force the inner `landmark.radius + 1` apron to its center elevation;
5. calculate normal and slope from the masked elevation.

Classify `trail` when route distance is at most `0.55`, `deep-water` below `-2.4`, `shallow-water` below `-1.1`, `rock` for slope at least `0.62`, `soil` below elevation `0.25`, and `grass` otherwise. Deep water returns `[{ kind: "swim" }]`; rock at slope `0.78` or greater returns `[{ kind: "climb" }]`; all other samples return no traversal requirement.

- [x] **Step 4: Run authority tests and verify GREEN**

Run: `npx tsx --test tests/wilds-terrain-authority.test.ts`

Expected: all four tests pass with no warnings.

- [x] **Step 5: Commit Task 1**

```bash
git add src/features/play/wilds-terrain-authority.ts tests/wilds-terrain-authority.test.ts
git commit -m "feat: add deterministic terrain authority"
```

---

### Task 2: Seamless Quality-Independent Tile Data

**Files:**
- Create: `src/features/play/wilds-terrain-tiles.ts`
- Test: `tests/wilds-terrain-tiles.test.ts`

**Interfaces:**
- Consumes: `WILDS_TERRAIN_TILE_SIZE`, `WILDS_TERRAIN_VERSION`, and `sampleWildsTerrain` from Task 1.
- Produces:
  - `type WildsTerrainTileCoordinate`
  - `type WildsTerrainTileVertex`
  - `type WildsTerrainTileData`
  - `wildsTerrainTileCoordinate(x: number, z: number): WildsTerrainTileCoordinate`
  - `wildsTerrainTileKey(tileX: number, tileZ: number): string`
  - `buildWildsTerrainTile(tileX: number, tileZ: number, segments: number): WildsTerrainTileData`

- [x] **Step 1: Write failing seam tests**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildWildsTerrainTile, wildsTerrainTileCoordinate, wildsTerrainTileKey } from "../src/features/play/wilds-terrain-tiles";

test("negative and positive world coordinates resolve to stable absolute tiles", () => {
  assert.deepEqual(wildsTerrainTileCoordinate(0, 0), { tileX: 0, tileZ: 0 });
  assert.deepEqual(wildsTerrainTileCoordinate(-0.01, -12.01), { tileX: -1, tileZ: -2 });
  assert.equal(wildsTerrainTileKey(-1, 2), "wildz.terrain.v1:-1:2");
});

test("adjacent terrain tiles share byte-identical edge samples", () => {
  const left = buildWildsTerrainTile(3, -2, 8);
  const right = buildWildsTerrainTile(4, -2, 8);
  const authority = ({ x, z, elevation, normal, surface }: WildsTerrainTileVertex) => ({ x, z, elevation, normal, surface });
  const leftEdge = left.vertices.filter((vertex) => vertex.gridX === 8).map(authority);
  const rightEdge = right.vertices.filter((vertex) => vertex.gridX === 0).map(authority);
  assert.deepEqual(leftEdge, rightEdge);
});

test("visual tessellation changes density without changing authority samples", () => {
  const coarse = buildWildsTerrainTile(1, 1, 4);
  const detailed = buildWildsTerrainTile(1, 1, 8);
  const detailedCorners = detailed.vertices.filter((vertex) => vertex.gridX % 2 === 0 && vertex.gridZ % 2 === 0)
    .map(({ x, z, elevation, normal, surface }) => ({ x, z, elevation, normal, surface }));
  const coarseValues = coarse.vertices.map(({ x, z, elevation, normal, surface }) => ({ x, z, elevation, normal, surface }));
  assert.deepEqual(detailedCorners, coarseValues);
});
```

- [x] **Step 2: Run seam tests and verify RED**

Run: `npx tsx --test tests/wilds-terrain-tiles.test.ts`

Expected: compilation fails because `wilds-terrain-tiles.ts` does not exist.

- [x] **Step 3: Implement tile projection**

Validate `segments` as an integer from `1` through `64`. Iterate grid rows in `gridZ` order and columns in `gridX` order, including both edges. Derive every vertex world coordinate from the absolute tile origin plus `grid / segments * 12`; never increment a floating accumulator. Store the complete authority normal and surface with each vertex.

- [x] **Step 4: Run seam and authority tests**

Run: `npx tsx --test tests/wilds-terrain-authority.test.ts tests/wilds-terrain-tiles.test.ts`

Expected: all tests pass.

- [x] **Step 5: Commit Task 2**

```bash
git add src/features/play/wilds-terrain-tiles.ts tests/wilds-terrain-tiles.test.ts
git commit -m "feat: add seamless terrain tile data"
```

---

### Task 3: Deterministic Physical Obstacles and Spatial Queries

**Files:**
- Create: `src/features/play/wilds-terrain-obstacles.ts`
- Test: `tests/wilds-terrain-obstacles.test.ts`

**Interfaces:**
- Consumes: tile size and terrain samples from Tasks 1–2, `projectWildsBiome`, authored landmarks, and major routes.
- Produces:
  - `type WildsObstacleMaterial = "solid" | "stepable" | "soft" | "conditional"`
  - `type WildsObstacleShape = { kind: "cylinder"; radius: number; height: number } | { kind: "box"; halfX: number; halfY: number; halfZ: number }`
  - `type WildsTerrainObstacle`
  - `wildsTerrainObstaclesForTile(tileX: number, tileZ: number): readonly WildsTerrainObstacle[]`
  - `buildWildsObstacleIndex(obstacles: readonly WildsTerrainObstacle[], cellSize?: number): WildsObstacleIndex`
  - `queryWildsObstacles(index: WildsObstacleIndex, bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): readonly WildsTerrainObstacle[]`

- [x] **Step 1: Write failing obstacle tests**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { WILDS_FLAGSHIP_LANDMARKS } from "../src/features/play/wilds-landmarks";
import { distanceToWildsMajorRoute, WILDS_TERRAIN_TILE_SIZE } from "../src/features/play/wilds-terrain-authority";
import { WILDS_MAJOR_ROUTES } from "../src/features/play/wilds-world-geography";
import { buildWildsObstacleIndex, queryWildsObstacles, wildsTerrainObstaclesForTile, type WildsTerrainObstacle } from "../src/features/play/wilds-terrain-obstacles";

function obstacle(id: string, x: number, z: number, radius: number): WildsTerrainObstacle {
  return {
    id,
    material: "solid",
    position: { x, y: 0, z },
    radius,
    shape: { kind: "cylinder", radius, height: 3 }
  };
}

test("physical obstacles are deterministic stable records", () => {
  const first = [
    ...wildsTerrainObstaclesForTile(20, 20),
    ...wildsTerrainObstaclesForTile(21, 20),
    ...wildsTerrainObstaclesForTile(20, 21)
  ];
  const replay = [
    ...wildsTerrainObstaclesForTile(20, 20),
    ...wildsTerrainObstaclesForTile(21, 20),
    ...wildsTerrainObstaclesForTile(20, 21)
  ];
  assert.ok(first.length > 0);
  assert.deepEqual(first, replay);
  assert.equal(new Set(first.map((obstacle) => obstacle.id)).size, first.length);
  assert.ok(first.every((obstacle) => obstacle.material === "solid" || obstacle.material === "stepable"));
});

test("arrival, routes, and landmark aprons contain no generated solid obstacle", () => {
  const routePoints: Array<{ x: number; z: number }> = WILDS_MAJOR_ROUTES.flatMap((route) => route.points.map((point) => ({ ...point })));
  const anchors: Array<{ x: number; z: number }> = [{ x: 0, z: 0 }, ...WILDS_FLAGSHIP_LANDMARKS.map((landmark) => landmark.position), ...routePoints];
  const tileKeys = new Set<string>();
  for (const anchor of anchors) {
    const centerX = Math.floor(anchor.x / WILDS_TERRAIN_TILE_SIZE);
    const centerZ = Math.floor(anchor.z / WILDS_TERRAIN_TILE_SIZE);
    for (let dz = -1; dz <= 1; dz += 1) for (let dx = -1; dx <= 1; dx += 1) tileKeys.add(`${centerX + dx}:${centerZ + dz}`);
  }
  const obstacles = [...tileKeys].flatMap((key) => {
    const [tileX, tileZ] = key.split(":").map(Number) as [number, number];
    return wildsTerrainObstaclesForTile(tileX, tileZ);
  });
  assert.equal(obstacles.some((candidate) => Math.hypot(candidate.position.x, candidate.position.z) < 15), false);
  assert.equal(obstacles.some((candidate) => distanceToWildsMajorRoute(candidate.position.x, candidate.position.z) < 1.4), false);
  assert.equal(obstacles.some((candidate) => WILDS_FLAGSHIP_LANDMARKS.some((landmark) => Math.hypot(candidate.position.x - landmark.position.x, candidate.position.z - landmark.position.z) < landmark.radius + 4)), false);
});

test("spatial queries return only intersecting records in stable id order", () => {
  const obstacles = [
    obstacle("tree:b", 4, 4, 0.8),
    obstacle("tree:a", 2, 2, 0.5),
    obstacle("tree:outside", 20, 20, 1)
  ];
  const index = buildWildsObstacleIndex(obstacles);
  const result = queryWildsObstacles(index, { minX: 1, maxX: 5, minZ: 1, maxZ: 5 });
  assert.deepEqual(result.map((candidate) => candidate.id), ["tree:a", "tree:b"]);
});
```

- [x] **Step 2: Run obstacle tests and verify RED**

Run: `npx tsx --test tests/wilds-terrain-obstacles.test.ts`

Expected: compilation fails because the obstacle module does not exist.

- [x] **Step 3: Implement obstacle records and index**

Generate quality-independent tree and rock candidates from the biome tile seed using stable integer hashing. Reject candidates inside `15` units of the origin, inside `landmark.radius + 4`, within `1.4` units of a major route, on water, or on terrain whose slope exceeds `0.62`. Trees use solid cylinders; rocks use solid cylinders when radius is at least `0.34` and stepable cylinders otherwise. Do not generate grass, flowers, bushes, or decorative debris as obstacles.

Index every obstacle into each horizontal cell touched by its radius. Query only touched cells, deduplicate by stable id, filter exact bounds, and sort by id before returning.

- [x] **Step 4: Run obstacle, tile, and authority tests**

Run: `npx tsx --test tests/wilds-terrain-authority.test.ts tests/wilds-terrain-tiles.test.ts tests/wilds-terrain-obstacles.test.ts`

Expected: all tests pass.

- [x] **Step 5: Commit Task 3**

```bash
git add src/features/play/wilds-terrain-obstacles.ts tests/wilds-terrain-obstacles.test.ts
git commit -m "feat: add deterministic world obstacles"
```

---

### Task 4: Safe Projection for Existing Horizontal Coordinates

**Files:**
- Create: `src/features/play/wilds-terrain-compatibility.ts`
- Test: `tests/wilds-terrain-compatibility.test.ts`

**Interfaces:**
- Consumes: `sampleWildsTerrain`, `WildsObstacleIndex`, and `queryWildsObstacles` from earlier tasks.
- Produces:
  - `type WildsGroundedPosition = { x: number; y: number; z: number; adjusted: boolean }`
  - `isWildsGroundPositionClear(position: { x: number; z: number }, index: WildsObstacleIndex, capsuleRadius?: number): boolean`
  - `restoreWildsGroundedPosition(position: { x: number; z: number }, index: WildsObstacleIndex, capsuleRadius?: number): WildsGroundedPosition`

- [x] **Step 1: Write failing compatibility tests**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { sampleWildsTerrain } from "../src/features/play/wilds-terrain-authority";
import { buildWildsObstacleIndex, type WildsTerrainObstacle } from "../src/features/play/wilds-terrain-obstacles";
import { restoreWildsGroundedPosition } from "../src/features/play/wilds-terrain-compatibility";

const obstacle: WildsTerrainObstacle = {
  id: "test:tree",
  material: "solid",
  position: { x: 0, y: 0, z: 0 },
  radius: 0.8,
  shape: { kind: "cylinder", radius: 0.8, height: 3 }
};

test("an unobstructed old save keeps exact horizontal coordinates", () => {
  const restored = restoreWildsGroundedPosition({ x: 0.5, z: -0.5 }, buildWildsObstacleIndex([]));
  assert.deepEqual(restored, { x: 0.5, y: sampleWildsTerrain(0.5, -0.5).elevation, z: -0.5, adjusted: false });
});

test("an obstructed old save moves through one deterministic bounded search", () => {
  const index = buildWildsObstacleIndex([obstacle]);
  const first = restoreWildsGroundedPosition({ x: 0, z: 0 }, index);
  assert.deepEqual(first, restoreWildsGroundedPosition({ x: 0, z: 0 }, index));
  assert.equal(first.adjusted, true);
  assert.ok(Math.hypot(first.x, first.z) <= 4);
});

test("safe projection fails closed when the bounded search has no clear point", () => {
  const index = buildWildsObstacleIndex([{ ...obstacle, id: "test:block", radius: 10, shape: { kind: "cylinder", radius: 10, height: 3 } }]);
  assert.throws(() => restoreWildsGroundedPosition({ x: 0, z: 0 }, index), /wilds_ground_position_unresolved/);
  assert.throws(() => restoreWildsGroundedPosition({ x: Number.NaN, z: 0 }, index), /wilds_ground_position_invalid/);
});
```

- [x] **Step 2: Run compatibility tests and verify RED**

Run: `npx tsx --test tests/wilds-terrain-compatibility.test.ts`

Expected: compilation fails because the compatibility module does not exist.

- [x] **Step 3: Implement bounded safe projection**

Reject non-finite input with `wilds_ground_position_invalid`. Test the exact coordinate first. If blocked, test radii `[0.75, 1.5, 2.25, 3, 4]` with eight stable compass/intercardinal offsets in clockwise order beginning north. Accept only clear samples whose surface is not deep water and whose traversal list is empty. If no candidate succeeds, fail closed with `wilds_ground_position_unresolved`; Phase 3 will supply a last-safe runtime checkpoint before this boundary becomes player-facing.

- [x] **Step 4: Run all Phase 1 tests**

Run: `npx tsx --test tests/wilds-terrain-authority.test.ts tests/wilds-terrain-tiles.test.ts tests/wilds-terrain-obstacles.test.ts tests/wilds-terrain-compatibility.test.ts`

Expected: all Phase 1 tests pass.

- [x] **Step 5: Run the repository release gate**

Run: `pnpm typecheck && pnpm lint && pnpm test`

Expected: TypeScript and ESLint exit successfully; the complete Node test suite reports zero failures.

- [x] **Step 6: Commit Task 4 and Phase 1 qualification**

```bash
git add src/features/play/wilds-terrain-compatibility.ts tests/wilds-terrain-compatibility.test.ts docs/superpowers/plans/2026-08-21-wildz-deterministic-terrain-authority.md
git commit -m "feat: qualify deterministic terrain authority"
```

## Phase 1 Exit Gate

- The terrain authority is pure and deterministic across exact coordinates.
- Every public sample is finite, bounded, and versioned.
- Landmark and major-route clearances derive from the same authority.
- Adjacent tile edges are byte-identical at multiple tessellation levels.
- Physical obstacles are quality-independent, stable, spatially indexed, and exclude soft foliage.
- Existing unobstructed horizontal coordinates remain exact.
- Obstructed coordinates use one deterministic bounded recovery sequence.
- No renderer, movement, proof, upload, Vault, profile, save-schema, or server behavior changes.
- Full repository typecheck, lint, and tests pass before Phase 2 begins.
