# Wildz Living Exploration Atlas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a persistent player-owned atlas that paints exact terrain as the explorer travels, freely pans across all discovered geography, restores through every full-state artifact, and places catchable aquatic creatures around real water without adding movement latency.

**Architecture:** A pure sparse range authority records discovered multiplayer regions and is integrated into `PlayState` only at admitted region-boundary movement or Rift arrival. Atlas projection consumes that authority to exclude hidden facts, calculate discovered bounds, and normalize full-world coordinates for bounded adaptive rendering; mobile map controls use map gestures rather than orbit defaults. Aquatic hotspot projection samples the existing deterministic terrain authority only during explicit searches and reuses the existing cached proof-derived swimming capability.

**Tech Stack:** TypeScript, React 19, Next.js 15, Three.js, React Three Fiber, Drei MapControls, Node test runner, Receiz/Wildz PlayState serialization

**Spec:** `docs/superpowers/specs/2026-08-21-wildz-living-exploration-atlas-design.md`

## Global Constraints

- The starting revealed atlas is exactly regions `x = -4…4` and `z = -4…4`.
- Entering a new region reveals that region and its eight immediate neighbors.
- Exploration is monotonic, owner-scoped, proof-backed local game state; no server is exploration authority.
- World zoom contains the complete sparse discovered atlas; Region and Landmark zoom remain bounded around the explorer.
- One-finger/primary-pointer drag pans without a World-view boundary; pinch zooms; no gesture springs back to origin.
- Only revealed terrain may be selected for Rift travel.
- Terrain, water, route, and elevation facts come from the existing deterministic authorities at exact world coordinates.
- Aquatic hotspot generation occurs only during an explicit search and never during ordinary movement or rendering.
- Existing proof verification, ownership, fatigue, injury, and retirement behavior must not change.
- No new dependency, background polling loop, card reverification, Vault reverification, or identity reverification is permitted.
- Existing saves migrate safely; runtime checkpoints, Vaults, Receiz ID Cards, and Identity Seals restore the atlas.
- Every task uses test-first development and ends in a focused commit.

---

### Task 1: Sparse Exploration Authority

**Files:**
- Create: `src/features/play/wilds-exploration-atlas.ts`
- Create: `tests/wilds-exploration-atlas.test.ts`

**Interfaces:**
- Consumes: `WILDS_REGION_SIZE`, `regionForPosition`, and released world coordinate bounds.
- Produces:
  - `type WildsExplorationRange = Readonly<{ minX: number; maxX: number }>`
  - `type WildsExplorationRow = Readonly<{ z: number; ranges: readonly WildsExplorationRange[] }>`
  - `type WildsExplorationAtlas = Readonly<{ version: 1; rows: readonly WildsExplorationRow[] }>`
  - `createInitialWildsExplorationAtlas(): WildsExplorationAtlas`
  - `normalizeWildsExplorationAtlas(value: unknown, currentPosition: { x: number; z: number }): WildsExplorationAtlas`
  - `revealWildsExplorationAt(atlas: WildsExplorationAtlas, position: { x: number; z: number }): WildsExplorationAtlas`
  - `mergeWildsExplorationAtlases(left: WildsExplorationAtlas, right: WildsExplorationAtlas): WildsExplorationAtlas`
  - `wildsExplorationContainsRegion(atlas, regionX, regionZ): boolean`
  - `wildsExplorationContainsWorld(atlas, position): boolean`
  - `wildsExplorationBounds(atlas): { minX: number; maxX: number; minZ: number; maxZ: number; count: number }`
  - `wildsExplorationRegions(atlas): Iterable<{ x: number; z: number }>`

- [ ] **Step 1: Write failing authority tests**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createInitialWildsExplorationAtlas,
  mergeWildsExplorationAtlases,
  normalizeWildsExplorationAtlas,
  revealWildsExplorationAt,
  wildsExplorationBounds,
  wildsExplorationContainsRegion
} from "../src/features/play/wilds-exploration-atlas.js";

test("a new explorer begins with the exact original nine by nine atlas", () => {
  const atlas = createInitialWildsExplorationAtlas();
  assert.deepEqual(wildsExplorationBounds(atlas), { minX: -4, maxX: 4, minZ: -4, maxZ: 4, count: 81 });
  assert.equal(wildsExplorationContainsRegion(atlas, 4, -4), true);
  assert.equal(wildsExplorationContainsRegion(atlas, 5, 0), false);
});

test("crossing into distant terrain reveals only its sight fringe and is idempotent", () => {
  const initial = createInitialWildsExplorationAtlas();
  const revealed = revealWildsExplorationAt(initial, { x: 245, z: -1433 });
  assert.equal(wildsExplorationContainsRegion(revealed, 5, -30), true);
  assert.equal(wildsExplorationContainsRegion(revealed, 4, -31), true);
  assert.equal(wildsExplorationContainsRegion(revealed, 0, -15), false);
  assert.equal(revealWildsExplorationAt(revealed, { x: 245, z: -1433 }), revealed);
});

test("normalization merges ranges and same-owner union never removes discovery", () => {
  const restored = normalizeWildsExplorationAtlas({
    version: 1,
    rows: [{ z: 7, ranges: [{ minX: 4, maxX: 5 }, { minX: 1, maxX: 3 }] }]
  }, { x: 0, z: 0 });
  assert.deepEqual(restored.rows.find((row) => row.z === 7)?.ranges, [{ minX: 1, maxX: 5 }]);
  const merged = mergeWildsExplorationAtlases(createInitialWildsExplorationAtlas(), restored);
  assert.equal(wildsExplorationContainsRegion(merged, -4, -4), true);
  assert.equal(wildsExplorationContainsRegion(merged, 5, 7), true);
});

test("malformed legacy exploration falls back to start plus current sight", () => {
  const restored = normalizeWildsExplorationAtlas({ version: 1, rows: "invalid" }, { x: 245, z: -1433 });
  assert.equal(wildsExplorationContainsRegion(restored, -4, -4), true);
  assert.equal(wildsExplorationContainsRegion(restored, 5, -30), true);
  assert.equal(wildsExplorationContainsRegion(restored, 0, -15), false);
});
```

- [ ] **Step 2: Run the focused test and verify the missing module failure**

Run:

```bash
pnpm exec tsc -p tsconfig.test.json
```

Expected: FAIL because `wilds-exploration-atlas.ts` does not exist.

- [ ] **Step 3: Implement normalized sparse ranges with identity-preserving no-op reveal**

```ts
import { regionForPosition, WILDS_REGION_SIZE } from "./multiplayer-core";

export const WILDS_EXPLORATION_VERSION = 1 as const;
const START_MIN = -4;
const START_MAX = 4;
const REGION_LIMIT = Math.ceil(500_000_000 / WILDS_REGION_SIZE);

export type WildsExplorationRange = Readonly<{ minX: number; maxX: number }>;
export type WildsExplorationRow = Readonly<{ z: number; ranges: readonly WildsExplorationRange[] }>;
export type WildsExplorationAtlas = Readonly<{ version: 1; rows: readonly WildsExplorationRow[] }>;

function boundedRegion(value: unknown) {
  if (!Number.isSafeInteger(value)) return null;
  return Math.max(-REGION_LIMIT, Math.min(REGION_LIMIT, value as number));
}

function normalizeRanges(values: unknown): WildsExplorationRange[] {
  if (!Array.isArray(values)) return [];
  const sorted = values.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const range = value as { minX?: unknown; maxX?: unknown };
    const minX = boundedRegion(range.minX);
    const maxX = boundedRegion(range.maxX);
    return minX === null || maxX === null ? [] : [{ minX: Math.min(minX, maxX), maxX: Math.max(minX, maxX) }];
  }).sort((a, b) => a.minX - b.minX || a.maxX - b.maxX);
  return sorted.reduce<WildsExplorationRange[]>((ranges, range) => {
    const previous = ranges.at(-1);
    if (previous && range.minX <= previous.maxX + 1) {
      ranges[ranges.length - 1] = { minX: previous.minX, maxX: Math.max(previous.maxX, range.maxX) };
    }
    else ranges.push({ ...range });
    return ranges;
  }, []);
}
```

Implement rows through a `Map<number, WildsExplorationRange[]>`, sort by `z`, and have `revealWildsExplorationAt` add the 3×3 sight square. Compare normalized rows before allocating a new atlas so an already-known position returns the original object reference. Normalization must always union the deterministic initial atlas and current-position sight square with any valid restored rows; missing or invalid input therefore migrates to that safe baseline.

- [ ] **Step 4: Compile and run the focused authority tests**

Run:

```bash
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wilds-exploration-atlas.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit the exploration authority**

```bash
git add src/features/play/wilds-exploration-atlas.ts tests/wilds-exploration-atlas.test.ts
git commit -m "feat: add sparse Wildz exploration authority"
```

---

### Task 2: PlayState, Movement, Rift, and Legacy Migration

**Files:**
- Modify: `src/features/play/game-state.ts`
- Modify: `tests/play-game-state.test.ts`
- Modify: `tests/wildz-runtime-checkpoint.test.ts`
- Modify: `tests/wildz-proof-object-continuity.test.ts`

**Interfaces:**
- Consumes: Task 1 exploration helpers.
- Produces: `PlayState.explorationAtlas: WildsExplorationAtlas`; movement and admitted Rift arrival reveal current sight regions.

- [ ] **Step 1: Write failing state integration tests**

Add tests proving region-boundary-only mutation:

```ts
it("reveals exploration only when admitted movement enters a new sight area", () => {
  const player = { x: 245, z: -1433 };
  const migrated = {
    ...initialPlayState,
    player,
    explorationAtlas: revealWildsExplorationAt(initialPlayState.explorationAtlas, player)
  };
  const inside = applyWildsInput(migrated, { type: "move-vector", x: .1, z: 0 });
  assert.equal(inside.explorationAtlas, migrated.explorationAtlas);

  const edge = { ...migrated, player: { x: 287.9, z: -1433 } };
  const crossed = applyWildsInput(edge, { type: "move-vector", x: 1, z: 0 });
  assert.notEqual(crossed.explorationAtlas, edge.explorationAtlas);
  assert.equal(wildsExplorationContainsWorld(crossed.explorationAtlas, crossed.player), true);
});

it("an admitted Rift reveals only destination sight and not its corridor", () => {
  const destination = { x: 4_800, z: -9_600 };
  const result = authorizeRiftTravel({
    idempotencyKey: "rift-exploration-test",
    source: initialPlayState.player,
    destination
  }, { playerId: "player-1", coordinationPulse: "42", locked: false });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const next = applyWildsInput(initialPlayState, { type: "apply-rift-grant", grant: result.grant, playerId: "player-1" });
  assert.equal(wildsExplorationContainsWorld(next.explorationAtlas, destination), true);
  assert.equal(wildsExplorationContainsWorld(next.explorationAtlas, { x: 2_400, z: -4_800 }), false);
});
```

Extend the runtime checkpoint test:

```ts
assert.deepEqual(restored.explorationAtlas, moved.explorationAtlas);
```

Extend proof-object continuity to assert the exploration rows survive `serializePlayState` → artifact payload → `restorePlayState`.

- [ ] **Step 2: Run focused tests and verify missing field failures**

Run:

```bash
pnpm exec tsc -p tsconfig.test.json
```

Expected: FAIL because `PlayState` has no `explorationAtlas`.

- [ ] **Step 3: Add the state field, deterministic genesis, migration, movement, and Rift updates**

Add to `PlayState`:

```ts
explorationAtlas: WildsExplorationAtlas;
```

Add to `initialPlayState`:

```ts
explorationAtlas: createInitialWildsExplorationAtlas(),
```

In `restorePlayState`, normalize after validating the saved player:

```ts
explorationAtlas: normalizeWildsExplorationAtlas(saved.explorationAtlas, saved.player),
```

In the Rift branch:

```ts
const player = { ...input.grant.destination };
return {
  ...state,
  activeAction: "explore",
  player,
  explorationAtlas: revealWildsExplorationAt(state.explorationAtlas, player),
  lastEvent: "Rift complete. Walk the surrounding world to reach the landmark entrance."
};
```

In movement, compare regions after resolving physical movement and only call reveal on a region change:

```ts
const previousRegion = regionForPosition(state.player);
const nextRegion = regionForPosition(nextPlayer);
const explorationAtlas = previousRegion.x === nextRegion.x && previousRegion.z === nextRegion.z
  ? state.explorationAtlas
  : revealWildsExplorationAt(state.explorationAtlas, nextPlayer);
```

Assign `explorationAtlas` into `moved`. Do not call terrain sampling, serialization, verification, or network code in this branch.

- [ ] **Step 4: Run state, checkpoint, and continuity tests**

Run:

```bash
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/play-game-state.test.js .test-build/tests/wildz-runtime-checkpoint.test.js .test-build/tests/wildz-proof-object-continuity.test.js
```

Expected: PASS, including object-identity no-op movement.

- [ ] **Step 5: Commit PlayState integration**

```bash
git add src/features/play/game-state.ts tests/play-game-state.test.ts tests/wildz-runtime-checkpoint.test.ts tests/wildz-proof-object-continuity.test.ts
git commit -m "feat: persist exploration through Wildz travel"
```

---

### Task 3: Same-Owner Atlas Union and Foreign-Owner Isolation

**Files:**
- Modify: `src/features/play/wilds-player-vault.ts`
- Modify: `tests/wildz-owner-continuity.test.ts`
- Modify: `tests/wildz-full-vault-regression.test.ts`
- Modify: `tests/wildz-vault-login-coordinator.test.ts`

**Interfaces:**
- Consumes: `mergeWildsExplorationAtlases` and normalized `PlayState.explorationAtlas`.
- Produces: same-owner reconciliation unions discovery; identity replacement restores the incoming owner's exact atlas; card-only import leaves atlas unchanged.

- [ ] **Step 1: Write failing continuity tests**

```ts
test("same-owner Vault reconciliation unions sparse exploration", () => {
  const baseline = createOwnerBoundInitialPlayState(SESSION.actorId);
  const local = { ...baseline, explorationAtlas: revealWildsExplorationAt(baseline.explorationAtlas, { x: 900, z: 0 }) };
  const restoredState = { ...baseline, explorationAtlas: revealWildsExplorationAt(baseline.explorationAtlas, { x: 0, z: -1_400 }) };
  const restored = createWildsPlayerVault({
    playerId: SESSION.actorId,
    exportedAt: "2026-08-21T12:00:00.000Z",
    playState: restoredState,
    character: null,
    settings: { avatarStyle: null, movementMode: "walk", audio: {}, cardOrder: "rarity" },
    personalEvents: [],
    canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null },
    receipts: []
  });
  const result = reconcileWildsPlayerVault({ local, restored, canonical: initialWildsWorldProjection(), actorId: SESSION.actorId });
  assert.equal(wildsExplorationContainsWorld(result.state.explorationAtlas, { x: 900, z: 0 }), true);
  assert.equal(wildsExplorationContainsWorld(result.state.explorationAtlas, { x: 0, z: -1_400 }), true);
});

```

In `one standalone card upload preserves the original Vault card and adds exactly one card`, reveal a distant area in `currentPlayState` before restore and add:

```ts
const baseline = createOwnerBoundInitialPlayState(session.actorId, session.createdAt);
const currentPlayState = {
  ...baseline,
  explorationAtlas: revealWildsExplorationAt(baseline.explorationAtlas, { x: 1_400, z: 0 })
};
```

After the existing restore call, add:

```ts
assert.deepEqual(outcome.playState.explorationAtlas, currentPlayState.explorationAtlas);
```

Give `regressionArtifact().playerState` a discovered extension at `{ x: 0, z: -1_400 }`. In `Profile activation of a Wildz continuity seal replaces the prior account with its exact saved player`, give `previousState` an extension at `{ x: 1_400, z: 0 }` and add:

```ts
assert.equal(wildsExplorationContainsWorld(outcome.playState.explorationAtlas, { x: 0, z: -1_400 }), true);
assert.equal(wildsExplorationContainsWorld(outcome.playState.explorationAtlas, { x: 1_400, z: 0 }), false);
```

- [ ] **Step 2: Run focused Vault tests and verify union failure**

Run:

```bash
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-owner-continuity.test.js .test-build/tests/wildz-full-vault-regression.test.js .test-build/tests/wildz-vault-login-coordinator.test.js
```

Expected: FAIL because generic object spread selects one atlas instead of unioning same-owner histories.

- [ ] **Step 3: Merge exploration explicitly after precedence spreads**

In `reconcileWildsPlayerVault`, add:

```ts
explorationAtlas: mergeWildsExplorationAtlases(
  input.local.explorationAtlas,
  restoredPlayState.explorationAtlas
),
```

Keep `prepareWildzPlayerPlayState` as an exact incoming identity restoration, and keep card-only `importAssets` based on the current state. Do not add exploration to card manifests or inventory merge logic.

- [ ] **Step 4: Run the focused restore suite**

Run the command from Step 2.

Expected: PASS for union, replacement, and card-only isolation.

- [ ] **Step 5: Commit owner-safe continuity**

```bash
git add src/features/play/wilds-player-vault.ts tests/wildz-owner-continuity.test.ts tests/wildz-full-vault-regression.test.ts tests/wildz-vault-login-coordinator.test.ts
git commit -m "feat: reconcile owner-scoped atlas history"
```

---

### Task 4: Discovered-Only Atlas Projection

**Files:**
- Modify: `src/features/play/wilds-world-atlas.ts`
- Modify: `src/features/play/WildsWorldMap.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `tests/wilds-world-atlas.test.ts`
- Modify: `tests/wilds-ecology-atlas.test.ts`
- Modify: `tests/wilds-boss-atlas.test.ts`

**Interfaces:**
- Consumes: `WildsExplorationAtlas`, its bounds/contains/region iterator helpers, and `state.explorationAtlas` from `PlayCampaign`.
- Produces additions to `WildsAtlasProjection`:
  - `bounds: { minX: number; maxX: number; minZ: number; maxZ: number; count: number }`
  - `regionUnit: number`
  - `isWorldCoordinateKnown(position): boolean` is kept as a pure imported helper at call sites rather than a serialized closure in projection.
  - `nodes` contains only discovered regions for World zoom.

- [ ] **Step 1: Replace origin-fixed tests with discovered-bounds tests**

```ts
const baseInput = {
  center: { x: 245, z: -1433 },
  missionProgress: 38,
  worldMastery: 11,
  discoveredLandmarkIds: ["hearttree-sanctum"],
  selfId: "self",
  players: [] as WildsPresence[],
  now: Date.parse("2026-08-21T12:00:00.000Z")
};

it("centers World view on all discovered territory instead of the origin", () => {
  const explorationAtlas = revealWildsExplorationAt(createInitialWildsExplorationAtlas(), { x: 245, z: -1433 });
  const world = projectWildsAtlas({ ...baseInput, zoom: "world", explorationAtlas });
  assert.deepEqual(world.bounds, { minX: -4, maxX: 6, minZ: -31, maxZ: 4, count: 90 });
  assert.deepEqual(world.centerRegion, { x: 1, z: -13.5 });
  assert.equal(world.nodes.some((node) => node.regionX === 5 && node.regionZ === -30), true);
  assert.equal(world.nodes.some((node) => node.regionX === 0 && node.regionZ === -15), false);
});

it("does not project presence outside known territory", () => {
  const world = projectWildsAtlas({
    ...baseInput,
    zoom: "world",
    explorationAtlas: createInitialWildsExplorationAtlas(),
    players: [presence(1, { x: 9_000, z: 9_000 })]
  });
  assert.equal(world.exactPlayers.length, 0);
});
```

In `wilds-ecology-atlas.test.ts` and `wilds-boss-atlas.test.ts`, add `explorationAtlas` to the existing base inputs. Reveal each canonical site/boss position for the existing visibility tests. Add one assertion per file using an unrevealed atlas and an object copy positioned at `{ x: 9_000, z: 9_000 }`; require the projected ecology/boss array to be empty.

- [ ] **Step 2: Run atlas tests and verify input/type failures**

Run:

```bash
pnpm exec tsc -p tsconfig.test.json
```

Expected: FAIL because `WildsAtlasInput` has no exploration authority.

- [ ] **Step 3: Project sparse discovery and dynamic normalized scale**

Add to `WildsAtlasInput`:

```ts
explorationAtlas: WildsExplorationAtlas;
```

For World zoom:

```ts
const bounds = wildsExplorationBounds(input.explorationAtlas);
const centerRegion = {
  x: (bounds.minX + bounds.maxX) / 2,
  z: (bounds.minZ + bounds.maxZ) / 2
};
const maxSpan = Math.max(bounds.maxX - bounds.minX + 1, bounds.maxZ - bounds.minZ + 1);
const DEFAULT_ATLAS_REGION_UNIT = 1.35;
const regionUnit = Math.min(DEFAULT_ATLAS_REGION_UNIT, 11.5 / Math.max(9, maxSpan));
const regions = wildsExplorationRegions(input.explorationAtlas);
```

For Region and Landmark zoom, retain the existing radius windows but filter every region through `wildsExplorationContainsRegion`. Filter landmarks, exact players, clusters, exact sites, ecology positions, bosses, and trainers by known world coordinate before returning them. Rumor-only facts without an admitted position remain hidden until their owning region is known.

Pass `state.explorationAtlas` from `PlayCampaign` to `WildsWorldMap`, then into every `projectWildsAtlas` call and dependency list.

- [ ] **Step 4: Run all atlas-focused tests**

Run:

```bash
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wilds-world-atlas.test.js .test-build/tests/wilds-ecology-atlas.test.js .test-build/tests/wilds-boss-atlas.test.js
```

Expected: PASS with sparse nodes and hidden facts absent.

- [ ] **Step 5: Commit discovered-only projection**

```bash
git add src/features/play/wilds-world-atlas.ts src/features/play/WildsWorldMap.tsx src/features/play/PlayCampaign.tsx tests/wilds-world-atlas.test.ts tests/wilds-ecology-atlas.test.ts tests/wilds-boss-atlas.test.ts
git commit -m "feat: project the player's discovered Wildz atlas"
```

---

### Task 5: Adaptive Sparse 1:1 Terrain Rendering

**Files:**
- Create: `src/features/play/wilds-atlas-render-tiles.ts`
- Create: `tests/wilds-atlas-render-tiles.test.ts`
- Modify: `src/features/play/WildsAtlasCanvas.tsx`
- Modify: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Consumes: projection `nodes`, `centerRegion`, `regionUnit`, exact terrain samples, and discovered bounds.
- Produces:
  - `buildWildsAtlasRenderTiles(nodes: readonly Pick<WildsAtlasNode, "regionX" | "regionZ">[], options): WildsAtlasRenderTile[]`
  - `clipWildsAtlasRouteSegments(points, nodes): Array<readonly { x: number; z: number }[]>`
  - tiles preserve sparse gaps while merging only fully contiguous discovered rectangles;
  - canvas coordinate helpers use `projection.regionUnit`, never the removed fixed `ATLAS_SCALE`.

- [ ] **Step 1: Write failing sparse tile and render contracts**

```ts
test("render tiles preserve an undiscovered gap between distant atlas extensions", () => {
  const squareNodes = (minX: number, maxX: number, minZ: number, maxZ: number) => {
    const nodes: Array<{ regionX: number; regionZ: number }> = [];
    for (let z = minZ; z <= maxZ; z += 1) {
      for (let x = minX; x <= maxX; x += 1) nodes.push({ regionX: x, regionZ: z });
    }
    return nodes;
  };
  const tileContainsRegion = (tile: WildsAtlasRenderTile, x: number, z: number) => (
    x >= tile.minRegionX && x <= tile.maxRegionX && z >= tile.minRegionZ && z <= tile.maxRegionZ
  );
  const nodes = [
    ...squareNodes(-4, 4, -4, 4),
    ...squareNodes(4, 6, -31, -29)
  ];
  const tiles = buildWildsAtlasRenderTiles(nodes, { maxVertices: 16_384 });
  assert.equal(tiles.some((tile) => tileContainsRegion(tile, 0, -15)), false);
  assert.ok(tiles.reduce((sum, tile) => sum + tile.vertexBudget, 0) <= 16_384);
});
```

Update source contracts:

```ts
assert.match(canvas, /projection\.regionUnit/);
assert.match(canvas, /buildWildsAtlasRenderTiles/);
assert.doesNotMatch(canvas, /const ATLAS_SCALE = 1\.35/);
assert.doesNotMatch(canvas, /Math\.sqrt\(nodes\.length\).*span/);
assert.doesNotMatch(canvas, /function AtlasBackdrop/);
```

- [ ] **Step 2: Run focused tests and verify missing tile builder failure**

Run:

```bash
pnpm exec tsc -p tsconfig.test.json
```

Expected: FAIL because `wilds-atlas-render-tiles.ts` does not exist.

- [ ] **Step 3: Implement bounded quadtree-style contiguous tiles**

Build a region key set. Start from discovered bounds and recursively split a rectangle until it is either fully discovered or a single region; emit no tile for an empty rectangle. Allocate each emitted tile a subdivision count from its projected screen extent, then reduce subdivisions deterministically until total vertices fit `maxVertices`. Split route polylines whenever their sampled segment enters a region absent from that same key set, so a route cannot disclose or bridge hidden geography. The public tile shape is:

```ts
export type WildsAtlasRenderTile = Readonly<{
  minRegionX: number;
  maxRegionX: number;
  minRegionZ: number;
  maxRegionZ: number;
  segmentsX: number;
  segmentsZ: number;
  vertexBudget: number;
}>;
```

In `WildsAtlasCanvas`, generate one geometry per tile. Convert local/world coordinates only through projection values:

```ts
function atlasWorldCoordinate(local: number, centerRegion: number, regionUnit: number) {
  return (centerRegion + local / regionUnit) * WILDS_REGION_SIZE;
}

function atlasLocalCoordinate(world: number, centerRegion: number, regionUnit: number) {
  return (world / WILDS_REGION_SIZE - centerRegion) * regionUnit;
}
```

At each vertex call `sampleWildsTerrain(worldX, worldZ)` and retain existing surface coloring. Generate decorative trees/rocks only for emitted nodes, with a quality-aware instance cap. Render only clipped known route segments and named-region labels whose coordinate belongs to a projected node. Convert routes, labels, markers, player lights, and click intersections through `projection.regionUnit`. Remove the finite `AtlasBackdrop` plane and use the scene background/fog as the visually unbounded uncharted field. Do not render a hidden mesh under sparse gaps.

- [ ] **Step 4: Run render tile and contract tests**

Run:

```bash
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wilds-atlas-render-tiles.test.js .test-build/tests/wilds-render-contract.test.js
```

Expected: PASS with no fixed origin span or hidden gap mesh.

- [ ] **Step 5: Commit adaptive atlas rendering**

```bash
git add src/features/play/wilds-atlas-render-tiles.ts src/features/play/WildsAtlasCanvas.tsx tests/wilds-atlas-render-tiles.test.ts tests/wilds-render-contract.test.ts
git commit -m "feat: render sparse discovered Wildz terrain"
```

---

### Task 6: Free Mobile Pan, Fit-All Framing, and Deliberate Recenter

**Files:**
- Create: `src/features/play/wilds-atlas-camera.ts`
- Modify: `src/features/play/WildsAtlasCanvas.tsx`
- Modify: `src/features/play/WildsWorldMap.tsx`
- Modify: `app/globals.css`
- Modify: `tests/wilds-render-contract.test.ts`
- Create: `tests/wilds-atlas-camera.test.ts`

**Interfaces:**
- Consumes: projection bounds/region scale and current position.
- Produces:
  - `atlasCameraFrame(input: { bounds: WildsAtlasProjection["bounds"]; centerRegion: WildsAtlasProjection["centerRegion"]; regionUnit: number }, viewport: { width: number; height: number }): { target: [number, number, number]; position: [number, number, number]; minDistance: number; maxDistance: number }`
  - `WildsAtlasCanvas.recenterRequest: number`
  - `WildsAtlasCanvas.fitRequest: number`
  - visible, accessible `Center map on your current location` and `Fit all discovered territory` controls.

- [ ] **Step 1: Write failing camera and interaction tests**

```ts
test("fit-all framing includes both origin and a distant discovered extension", () => {
  const frame = atlasCameraFrame({
    bounds: { minX: -4, maxX: 6, minZ: -31, maxZ: 4, count: 90 },
    centerRegion: { x: 1, z: -13.5 },
    regionUnit: 0.319
  }, { width: 390, height: 844 });
  assert.deepEqual(frame.target, [0, 0, 0]);
  assert.ok(frame.position.every(Number.isFinite));
  assert.ok(frame.maxDistance > frame.minDistance);
});
```

Update rendering contracts:

```ts
assert.match(canvas, /MapControls/);
assert.match(canvas, /mouseButtons=\{\{[^}]*LEFT:\s*THREE\.MOUSE\.PAN/);
assert.match(canvas, /touches=\{\{[^}]*ONE:\s*THREE\.TOUCH\.PAN/);
assert.doesNotMatch(canvas, /<OrbitControls/);
assert.doesNotMatch(canvas, /minPan|maxPan|clamp.*target|target.*clamp/);
assert.match(map, /aria-label="Center map on your current location"/);
assert.match(map, /aria-label="Fit all discovered territory"/);
```

- [ ] **Step 2: Run focused tests and verify missing camera helper/contract failures**

Run:

```bash
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wilds-atlas-camera.test.js .test-build/tests/wilds-render-contract.test.js
```

Expected: FAIL because the canvas still uses OrbitControls and has no recenter action.

- [ ] **Step 3: Implement map-native gestures and framing**

Replace `OrbitControls` with Drei `MapControls` and a ref:

```tsx
<MapControls
  enableDamping={!reducedMotion}
  enablePan
  enableRotate
  mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
  touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }}
  screenSpacePanning
  zoomToCursor
/>
```

Implement `atlasCameraFrame` as a pure helper using projection-normalized width/depth and portrait FOV. On mount or zoom change, set camera and controls target once. On ordinary projection refresh, preserve the user's current target unless bounds expanded beyond the prior bounds. Do not configure target clamping, pan bounds, an origin constraint, or a per-frame camera correction in World view.

In `WildsWorldMap`, add:

```tsx
const [recenterRequest, setRecenterRequest] = useState(0);
const [fitRequest, setFitRequest] = useState(0);

<button
  aria-label="Center map on your current location"
  className="wilds-atlas-recenter"
  onClick={() => setRecenterRequest((value) => value + 1)}
  type="button"
>
  <Icons.home aria-hidden="true" size={16} />
  You
</button>

<button
  aria-label="Fit all discovered territory"
  className="wilds-atlas-fit"
  onClick={() => setFitRequest((value) => value + 1)}
  type="button"
>
  <Icons.map aria-hidden="true" size={16} />
  Fit
</button>
```

Pass both request counters into the canvas. The recenter effect converts `currentPosition` to local projection coordinates, moves `controls.target` there, preserves zoom distance, and calls `controls.update()`. The fit effect reapplies `atlasCameraFrame` to show all painted discovery. Neither action installs a later constraint. Add safe-area-aware CSS without covering zoom controls or the expedition panel.

- [ ] **Step 4: Run camera/render tests and typecheck**

Run:

```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wilds-atlas-camera.test.js .test-build/tests/wilds-render-contract.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit free atlas navigation**

```bash
git add src/features/play/wilds-atlas-camera.ts src/features/play/WildsAtlasCanvas.tsx src/features/play/WildsWorldMap.tsx app/globals.css tests/wilds-atlas-camera.test.ts tests/wilds-render-contract.test.ts
git commit -m "feat: make the living atlas freely navigable"
```

---

### Task 7: Terrain-Authorized Aquatic Encounters

**Files:**
- Create: `src/features/play/wilds-creature-habitat.ts`
- Create: `tests/wilds-creature-habitat.test.ts`
- Modify: `src/features/play/hidden-hotspots.ts`
- Modify: `tests/hidden-hotspots.test.ts`
- Modify: `tests/play-game-state.test.ts`

**Interfaces:**
- Consumes: `sampleWildsTerrain`, creature form habitat/element/anatomy, existing explicit `search-point` action, and cached `projectWildsTraversalCapabilities`.
- Produces:
  - `isWildsAquaticProfile(input: { element: string; anatomy: CreatureRenderRecipe; abilityNames: readonly string[] }): boolean`
  - `isWildsAquaticForm(form): boolean`
  - `selectWildsHabitatForm(surface, seed): CreatureForm`
  - terrain-authorized `hotspotsForRegion`
  - `wildsHotspotRegionCacheSize(): number` diagnostic.

- [ ] **Step 1: Write failing habitat and no-hot-path tests**

```ts
test("water candidates select aquatic forms and land candidates do not submerge land forms", () => {
  const aquatic = selectWildsHabitatForm("deep-water", 0.42);
  const land = selectWildsHabitatForm("grass", 0.42);
  assert.equal(isWildsAquaticForm(aquatic), true);
  assert.equal(isWildsAquaticForm(land), false);
});

test("representative deep-water regions expose a shoreline-reachable aquatic hotspot", () => {
  for (const region of [{ x: -4, z: -10 }, { x: 4, z: -12 }, { x: 3, z: -11 }]) {
    const hotspots = hotspotsForRegion(region.x, region.z);
    const aquatic = hotspots.filter((hotspot) => hotspot.cover === "water");
    assert.ok(aquatic.length > 0);
    assert.ok(aquatic.some((hotspot) => hotspot.shoreReachable));
  }
});

it("ordinary movement never generates aquatic hotspots", () => {
  const before = wildsHotspotRegionCacheSize();
  let state = initialPlayState;
  for (let index = 0; index < 300; index += 1) {
    state = applyWildsInput(state, { type: "move-vector", x: 1, z: 0 });
  }
  assert.equal(wildsHotspotRegionCacheSize(), before);
});
```

Retain the existing swimming test proving a selected admitted Tide creature moves through deep water.

- [ ] **Step 2: Run focused tests and verify missing habitat authority failures**

Run:

```bash
pnpm exec tsc -p tsconfig.test.json
```

Expected: FAIL because terrain-aware habitat selection and cache diagnostics do not exist.

- [ ] **Step 3: Implement bounded explicit-scan habitat projection**

In `wilds-creature-habitat.ts`, precompute immutable stage-one aquatic and land form arrays once at module initialization. Aquatic classification must share the exact rules already used for swimming:

```ts
export function isWildsAquaticForm(form: CreatureForm) {
  return isWildsAquaticProfile({
    element: form.element,
    anatomy: form.anatomy,
    abilityNames: form.abilities.map((ability) => ability.name)
  });
}

export function isWildsAquaticProfile(input: { element: string; anatomy: CreatureRenderRecipe; abilityNames: readonly string[] }) {
  const language = input.abilityNames.join(" ").toLowerCase();
  return input.anatomy.aura === "tide"
    || input.element === "Tide"
    || /swim|aqua|current|tide/.test(language);
}
```

Have `wilds-traversal-capabilities.ts` consume this helper so habitat and swimming cannot diverge.

In `hidden-hotspots.ts`, replace arbitrary form-first placement with a fixed 6×6 candidate lattice jittered deterministically inside each 24-meter encounter region. Sample each candidate once through `sampleWildsTerrain`. Select up to six hotspots with this priority:

1. shallow-water aquatic candidate within `hintRadius` of a dry or shallow candidate;
2. deep-water aquatic candidate;
3. remaining surface-matched candidates.

Add `shoreReachable: boolean` to `HiddenHotspot`. Choose the form through `selectWildsHabitatForm(terrain.surface, seededUnit(...))`, set `cover: "water"` for shallow/deep water, and retain stable IDs based on region, slot, and selected family. Cache completed region projections in a bounded insertion-order `Map` of at most 128 regions. The cache is reached only by `nearbyHiddenHotspots`, which remains called only in the `search-point` branch.

- [ ] **Step 4: Run habitat, hotspot, movement, and traversal tests**

Run:

```bash
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wilds-creature-habitat.test.js .test-build/tests/hidden-hotspots.test.js .test-build/tests/wilds-traversal-capabilities.test.js .test-build/tests/play-game-state.test.js
```

Expected: PASS; movement leaves hotspot cache size unchanged and explicit scans populate it.

- [ ] **Step 5: Commit aquatic discovery**

```bash
git add src/features/play/wilds-creature-habitat.ts src/features/play/wilds-traversal-capabilities.ts src/features/play/hidden-hotspots.ts tests/wilds-creature-habitat.test.ts tests/hidden-hotspots.test.ts tests/play-game-state.test.ts
git commit -m "feat: place aquatic creatures in physical water"
```

---

### Task 8: Mobile Verification, Latency Guard, and Release Closure

**Files:**
- Modify: `tests/wilds-render-contract.test.ts`
- Modify: `tests/wilds-aerial-integration.test.ts`
- Create: `tests/wilds-exploration-performance.test.ts`
- Modify only if verification exposes a defect: files from Tasks 1–7.

**Interfaces:**
- Consumes: all completed living-atlas and aquatic interfaces.
- Produces: explicit regression contracts and release evidence; no new production subsystem.

- [ ] **Step 1: Add deterministic latency guard tests**

```ts
test("ten thousand same-region movement steps reuse exploration and avoid hotspot work", () => {
  let state = { ...initialPlayState, player: { x: 1, z: 1 } };
  const exploration = state.explorationAtlas;
  const cacheSize = wildsHotspotRegionCacheSize();
  for (let index = 0; index < 10_000; index += 1) {
    state = applyWildsInput(state, { type: "move-vector", x: index % 2 === 0 ? 1 : -1, z: 0 });
  }
  assert.equal(state.explorationAtlas, exploration);
  assert.equal(wildsHotspotRegionCacheSize(), cacheSize);
});
```

Add source contracts that forbid verification, networking, timers, or hotspot generation inside exploration helpers and atlas rendering:

```ts
test("exploration and atlas rendering contain no verification or background work", async () => {
  const exploration = await readFile("src/features/play/wilds-exploration-atlas.ts", "utf8");
  const canvas = await readFile("src/features/play/WildsAtlasCanvas.tsx", "utf8");
  for (const source of [exploration, canvas]) {
    assert.doesNotMatch(source, /verifyAnyWildsCard|verifyPortableCard|setInterval|setTimeout|requestIdleCallback|fetch\(/);
  }
  assert.doesNotMatch(exploration, /nearbyHiddenHotspots|hotspotsForRegion|sampleWildsTerrain/);
});
```

- [ ] **Step 2: Run the complete automated test suite**

Run:

```bash
pnpm test
```

Expected: all suites and all tests PASS with zero failures.

- [ ] **Step 3: Run typecheck and production build**

Run:

```bash
pnpm exec tsc --noEmit
pnpm build
```

Expected: PASS. The pre-existing Receiz/snark `web-worker` dynamic-import warning may remain; no new warning is accepted.

- [ ] **Step 4: Verify the complete mobile interaction in production WebKit**

Start production:

```bash
pnpm start -p 3001
```

Using the Playwright mobile WebKit profile at 390×844, verify:

1. migrate a fixture/player at approximately `X 245, Z -1433`;
2. open World atlas and confirm both starting territory and distant painted extension are visible in fit-all framing;
3. one-finger drag to the distant extension;
4. release and confirm no snap back;
5. continue panning beyond every discovered edge into uncharted darkness and confirm there is no camera wall;
6. pinch zoom, then pan back across every discovered extension;
7. use the `You` control and confirm deliberate recentering;
8. pan away again, use `Fit`, and confirm all discovered territory returns to view without subsequent clamping;
9. click revealed distant terrain and confirm exact Rift selection;
10. confirm an undiscovered sparse gap has no clickable terrain;
11. perform an explicit shoreline scan and confirm an aquatic encounter signal;
12. catch/select the aquatic creature and swim in deep water;
13. capture console output and require zero errors and zero warnings;
14. capture screenshots for fit-all, distant pan, unrestricted darkness, and aquatic shoreline discovery.

- [ ] **Step 5: Profile gameplay before and after discovery/upload state**

Record at least 300 visible gameplay frames before opening/importing state and 300 after restoring a distant explored atlas and aquatic card. Require:

- median frame interval remains within 1 ms;
- p95 frame interval remains within 2 ms;
- no repeated long task attributable to exploration, atlas, hotspot, or verification code;
- hotspot cache remains unchanged during walking;
- atlas geometry builds only while the atlas is open or its discovery bounds change.

If any threshold fails, identify and fix the measured source, rerun focused tests, then repeat Steps 2–5. Do not weaken the thresholds.

- [ ] **Step 6: Commit final regression gates**

```bash
git add tests/wilds-render-contract.test.ts tests/wilds-aerial-integration.test.ts tests/wilds-exploration-performance.test.ts
git commit -m "test: freeze living atlas performance and navigation"
```

- [ ] **Step 7: Verify a clean handoff**

Run:

```bash
git status --short
git log -8 --oneline
```

Expected: clean worktree and eight focused implementation commits after the design commits.
