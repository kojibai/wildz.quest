# Continuous Sovereign Construction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace full-cost, companion-gated prefab construction with locally authoritative, plan-first, partially funded, solo-completable, continuously expandable construction using renewable hay, timber, and stone.

**Architecture:** Preserve exact material-lot conservation and the current source-authority/outbox model, but add immutable construction projects, paged region chunks, components, and append-only material/work contribution proofs. Every construction command seals and projects at the Receiz ID edge before returning; network transport only replicates admitted proofs. The existing preview catalog supplies deterministic placement vocabulary while a new production recipe/component layer supplies authority, stage geometry, collision, function, persistence, collaboration, and renovation.

**Tech Stack:** TypeScript 5.6, React 19, Next.js 15, Three.js 0.182, React Three Fiber 9, Node test runner, Receiz SDK 124.0.3, existing deterministic proof-object and IndexedDB/outbox utilities.

**Spec:** `docs/superpowers/specs/2026-08-26-continuous-sovereign-construction-design.md`

## Global Constraints

- A valid component plan is locally admitted with zero materials and shows stakes immediately.
- Hay, timber, and stone are renewable exact lots; no UI or reducer may manufacture them.
- The owner can place, fund, work, finish, renovate, and expand every ordinary component without a creature, another player, a network, a level, a timer, or an entitlement.
- Creatures and players add append-only contribution proofs and throughput only; they never authorize ordinary owner progress.
- Construction commands must use the local source-authority projection first and synchronize after paint; no construction surface may display network-pending state or wait for a response.
- Legacy sites, structures, checkpoints, lots, and event history remain replay-compatible with unchanged heads.
- No player-facing project, component, room, or radius cap; use 64-reference chunk pages and distance streaming internally.
- Preview geometry is not authority. Production placement revalidates catalog kind, transform, anchors, support, collision, and digest.
- Planned pieces have no blocking collision; framed pieces expose only admitted solids; function begins only at the functional stage.
- Build controls retain 44px minimum touch targets, keyboard focus, reduced-motion support, and portrait/landscape safe-area fit.
- No new runtime dependency is permitted.

## File Structure

- `src/features/play/wilds-construction-recipes.ts`: stable per-kind stage recipes, customization schemas, and functional definition IDs.
- `src/features/play/wilds-construction-project.ts`: project and 64-reference region-chunk proof objects plus automatic paging.
- `src/features/play/wilds-construction-component.ts`: component, material-contribution, work-contribution, and progress verification/reduction; later tasks extend it with renovation.
- `src/features/play/wilds-construction-function.ts`: pure projections for traversal, cover, storage, workshop, hearth, light, habitat, garden, and water behavior.
- `src/features/play/WildsContinuousBuilderPanel.tsx`: mounted palette, resource strip, selected-component inspector, contribution/work/edit controls.
- `src/features/play/WildsContinuousConstruction.tsx`: staged Three.js construction geometry sourced from admitted proofs.
- Existing resource, world-event, world-state, service, save/merge, campaign, canvas, collision, support, and CSS files integrate these focused modules without duplicating their authority.

## Recipe Matrix

Each stage cell is `hay/timber/stone · work`. These exact integers seed `WILDS_CONSTRUCTION_RECIPES`; later balancing must create a new catalog revision rather than mutating admitted definitions.

| Kind | Framed | Functional | Finished | Function ID |
| --- | --- | --- | --- | --- |
| foundation | 0/0/2 · 1 | 0/1/1 · 1 | 1/0/0 · 1 | support |
| floor | 0/2/1 · 1 | 1/1/0 · 1 | 1/1/0 · 1 | floor |
| room | 0/3/1 · 2 | 3/1/0 · 2 | 2/1/0 · 1 | shelter |
| wall | 0/2/1 · 1 | 2/1/0 · 1 | 1/1/0 · 1 | cover |
| roof | 0/2/0 · 1 | 4/1/0 · 2 | 2/0/0 · 1 | cover |
| door | 0/1/0 · 1 | 0/1/0 · 1 | 1/0/0 · 1 | traversal |
| window | 0/1/0 · 1 | 1/1/0 · 1 | 1/0/0 · 1 | daylight |
| column | 0/1/1 · 1 | 0/1/1 · 1 | 1/0/0 · 1 | support |
| stair | 0/2/1 · 1 | 0/2/0 · 2 | 1/0/0 · 1 | traversal |
| bridge | 0/3/2 · 2 | 0/3/1 · 2 | 2/1/0 · 1 | traversal |
| platform | 0/2/1 · 1 | 0/2/1 · 2 | 1/1/0 · 1 | traversal |
| path | 0/0/2 · 1 | 1/0/1 · 1 | 1/0/1 · 1 | traversal |
| storage | 0/2/0 · 1 | 1/1/0 · 1 | 1/0/0 · 1 | storage |
| workshop | 0/2/1 · 1 | 0/2/1 · 2 | 1/1/0 · 1 | workshop |
| habitat | 0/2/1 · 1 | 3/1/0 · 2 | 2/0/0 · 1 | habitat |
| bed | 1/1/0 · 1 | 2/1/0 · 1 | 1/0/0 · 1 | rest |
| hearth | 0/0/2 · 1 | 1/1/1 · 2 | 1/0/1 · 1 | rest |
| light | 0/1/1 · 1 | 1/0/0 · 1 | 1/0/0 · 1 | light |
| garden | 1/1/1 · 1 | 2/1/1 · 2 | 1/0/0 · 1 | garden |
| water | 0/0/2 · 1 | 1/1/2 · 2 | 1/0/1 · 1 | water |
| trim | 1/1/0 · 1 | 1/1/0 · 1 | 1/0/0 · 1 | none |
| railing | 0/2/0 · 1 | 1/1/0 · 1 | 1/0/0 · 1 | safety |
| partition | 1/1/0 · 1 | 2/1/0 · 1 | 1/0/0 · 1 | cover |

---

### Task 1: Renewable Hay and Construction Resource Coverage

**Files:**
- Modify: `src/features/play/wilds-resource-authority.ts`
- Modify: `src/features/play/wilds-steward-construction.ts`
- Modify: `src/features/play/wilds-source-work-authority.ts`
- Test: `tests/wilds-resource-lot-world.test.ts`
- Test: `tests/wilds-steward-construction.test.ts`

**Interfaces:**
- Consumes: existing `WildsResourceSource`, `WildsMaterialLotV1`, source-state, harvest, emission, and custody functions.
- Produces: `WildsBuildMaterialKind = "hay" | "timber" | "stone"`; canonical region slots 6/7/8 that guarantee hay/timber/stone; solo-valid hay harvest lots.

- [x] **Step 1: Write failing hay authority tests**

```ts
it("guarantees renewable hay timber and stone without changing legacy region slots", () => {
  const sources = projectWildsResourceRegion(0, 0);
  assert.deepEqual(sources.slice(6, 9).map((source) => source.kind), ["hay", "timber", "stone"]);
  assert.equal(isCanonicalWildsResourceSource(sources[6]!), true);
  assert.ok(sources[6]!.replenishment.capacityPerInterval > 0);
});

it("harvests one exact hay lot with Receiz ID authority and no creature", () => {
  const source = projectWildsResourceRegion(0, 0)[6]!;
  const result = createWildsMaterialHarvest({
    source,
    current: initialWildsHarvestedSourceState(source),
    ownerReceizId: OWNER,
    actorPosition: source.position,
    kaiUPulse: 2_000_000
  });
  assert.equal(result.lot.kind, "hay");
  assert.match(result.lot.lotId, /^wildz:material:hay:/);
  assert.equal(verifyWildsMaterialLot(result.lot), true);
});
```

- [x] **Step 2: Run the tests and verify the missing hay failure**

Run: `npx tsx --test tests/wilds-resource-lot-world.test.ts tests/wilds-steward-construction.test.ts`

Expected: FAIL because `hay` is not a valid resource/material kind and region slots 6-8 do not exist.

- [x] **Step 3: Extend canonical sources without mutating legacy slots**

```ts
export type WildsResourceKind = "hay" | "timber" | "stone" | "ore" | "fiber" | "aquatic" | "buried";

const LEGACY_SOURCES_PER_REGION = 6;
const CONSTRUCTION_KINDS = ["hay", "timber", "stone"] as const;
const SOURCES_PER_REGION = LEGACY_SOURCES_PER_REGION + CONSTRUCTION_KINDS.length;

function guaranteedConstructionKind(slot: number) {
  return slot < LEGACY_SOURCES_PER_REGION ? null : CONSTRUCTION_KINDS[slot - LEGACY_SOURCES_PER_REGION] ?? null;
}
```

Keep the existing source algorithm byte-identical for slots 0-5. For slots 6-8, deterministically scan bounded candidate coordinates inside the region until dry terrain is found, use the fixed construction kind, and retain the existing canonical ID/hash and replenishment rules. Add hay requirements `{ creature: "gather", tool: "shears" }`.

- [x] **Step 4: Admit hay material and harvest operations**

```ts
export type WildsBuildMaterialKind = "hay" | "timber" | "stone";

function harvestProfession(kind: WildsBuildMaterialKind): WildsResourceWorkFamily {
  return kind === "timber" ? "lumber" : kind === "stone" ? "quarry" : "gather";
}
```

Update material-lot ID verification, source-kind admission, operation intention/stage/consequence selection, and optional tool matching so hay works with no creature or tool while a compatible optional helper remains creditable.

- [x] **Step 5: Run focused tests**

Run: `npx tsx --test tests/wilds-resource-lot-world.test.ts tests/wilds-steward-construction.test.ts tests/wilds-steward-phi.test.ts`

Expected: PASS with legacy timber/stone hashes and harvest behavior unchanged.

- [x] **Step 6: Commit**

```bash
git add src/features/play/wilds-resource-authority.ts src/features/play/wilds-steward-construction.ts src/features/play/wilds-source-work-authority.ts tests/wilds-resource-lot-world.test.ts tests/wilds-steward-construction.test.ts
git commit -m "feat: add renewable hay construction authority"
```

### Task 2: Live Hay Discovery, Gathering, and Resource UI

**Files:**
- Modify: `src/features/play/WildsStewardEnvironment.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/WildzWorldControls.tsx`
- Modify: `src/features/play/wilds-steward-craft.ts`
- Modify: `src/features/play/WildsStewardCraftPanel.tsx`
- Modify: `app/globals.css`
- Test: `tests/wilds-steward-craft.test.ts`
- Test: `tests/wilds-render-contract.test.ts`
- Test: `tests/wilds-steward-hud-loop.test.ts`

**Interfaces:**
- Consumes: Task 1 guaranteed sources and hay lots.
- Produces: visible renewable hay patches, nearest-source selection across canonical region sources, and live hay/timber/stone counts everywhere construction is opened.

- [x] **Step 1: Write failing projection and render-contract tests**

```ts
assert.deepEqual(projection.materials, { hay: 1, timber: 1, stone: 1 });
assert.match(environment, /hay-source-manifestation/);
assert.match(campaign, /projectWildsResourceRegion/);
assert.match(controls, /materialCounts\.hay/);
assert.match(panel, /Living hay/);
```

- [x] **Step 2: Run the focused tests and verify missing hay UI**

Run: `npx tsx --test tests/wilds-steward-craft.test.ts tests/wilds-render-contract.test.ts tests/wilds-steward-hud-loop.test.ts`

Expected: FAIL because craft projection and live world expose only timber and stone.

- [x] **Step 3: Add canonical source-neighborhood projection**

```ts
function constructionSourcesNear(position: { x: number; z: number }) {
  const region = wildsResourceRegionForPosition(position);
  return [-1, 0, 1].flatMap((dx) => [-1, 0, 1].flatMap((dz) =>
    projectWildsResourceRegion(region.x + dx, region.z + dz)
      .filter((source) => source.kind === "hay" || source.kind === "timber" || source.kind === "stone")
  ));
}
```

Merge generic construction sources with existing tree/rock sources by `sourceId`, sort by distance and ID, and use the same list for world manifestation and nearest-source actions.

- [x] **Step 4: Render hay and add three-resource counts**

Add shared tuft/ring geometry and a hay material in `WildsStewardEnvironment`. Extend satchel, quick construction control, craft projection, labels, and CSS to three resources. Do not disable the construction entry point when a count is zero.

- [x] **Step 5: Run focused tests**

Run: `npx tsx --test tests/wilds-steward-craft.test.ts tests/wilds-render-contract.test.ts tests/wilds-steward-hud-loop.test.ts`

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/features/play/WildsStewardEnvironment.tsx src/features/play/PlayCampaign.tsx src/features/play/WildzWorldControls.tsx src/features/play/wilds-steward-craft.ts src/features/play/WildsStewardCraftPanel.tsx app/globals.css tests/wilds-steward-craft.test.ts tests/wilds-render-contract.test.ts tests/wilds-steward-hud-loop.test.ts
git commit -m "feat: surface renewable hay in living construction"
```

### Task 3: Stage Recipes and Production Placement Contracts

**Files:**
- Create: `src/features/play/wilds-construction-recipes.ts`
- Modify: `src/features/play/wilds-world-construction.ts`
- Create: `tests/wilds-construction-recipes.test.ts`
- Modify: `tests/wilds-world-construction.test.ts`

**Interfaces:**
- Consumes: existing `WildsConstructionKind`, catalog dimensions, anchors, collision solids, and preview placement digests.
- Produces: the extended 23-kind catalog, `WILDS_CONSTRUCTION_RECIPES`; `wildsConstructionRecipe(kind)`; `verifyWildsProductionPlacement(preview, physical)`; cumulative resource/work helpers.

- [x] **Step 1: Write failing recipe and placement tests**

```ts
it("defines planned framed functional and finished requirements for every catalog kind", () => {
  for (const entry of WILDS_CONSTRUCTION_CATALOG) {
    const recipe = wildsConstructionRecipe(entry.kind);
    assert.deepEqual(recipe.stages.map((stage) => stage.stage), ["framed", "functional", "finished"]);
    assert.ok(recipe.stages.every((stage) => stage.work > 0));
  }
});

it("revalidates a preview against production physical evidence", () => {
  const placement = previewWildsBlueprintPlacement(validFoundationInput());
  assert.equal(verifyWildsProductionPlacement(placement, validFoundationInput().physical), true);
  assert.equal(verifyWildsProductionPlacement({ ...placement, placementDigest: `sha256:${"0".repeat(64)}` }, validFoundationInput().physical), false);
});
```

- [x] **Step 2: Run tests and verify missing recipe failure**

Run: `npx tsx --test tests/wilds-construction-recipes.test.ts tests/wilds-world-construction.test.ts`

Expected: FAIL because the production recipe module and verifier do not exist.

- [x] **Step 3: Implement stable stage recipes**

```ts
export type WildsConstructionKind =
  | "foundation" | "floor" | "room" | "wall" | "roof" | "door" | "window" | "column"
  | "stair" | "bridge" | "platform" | "path" | "storage" | "workshop" | "habitat"
  | "bed" | "hearth" | "light" | "garden" | "water" | "trim" | "railing" | "partition";
export type WildsConstructionStage = "planned" | "framed" | "functional" | "finished";
export type WildsStageCost = Readonly<{
  stage: Exclude<WildsConstructionStage, "planned">;
  materials: Readonly<{ hay: number; timber: number; stone: number }>;
  work: number;
}>;
export type WildsConstructionRecipe = Readonly<{
  kind: WildsConstructionKind;
  stages: readonly [WildsStageCost, WildsStageCost, WildsStageCost];
  functionId: string | null;
  salvagePercent: number;
}>;
```

Extend `WILDS_CONSTRUCTION_CATALOG`, anchor acceptance, authored collision solids, and placement anchors to the 23 kinds above. Define recipes exactly from the Recipe Matrix. Every stage has positive integer work, all material counts are nonnegative safe integers, ordinary function is reachable using only hay/timber/stone, and the table is deeply frozen.

- [x] **Step 4: Export a production placement verifier**

Recompute catalog geometry, anchors, source blueprint digest, placement ID/digest, support, overlap, rotation, and height from the supplied physical evidence. The verifier accepts only a valid preview whose exact content matches recomputation; it does not mutate `physical`, `publish`, `canConfirm`, or `writes` on the preview.

- [x] **Step 5: Run focused tests**

Run: `npx tsx --test tests/wilds-construction-recipes.test.ts tests/wilds-world-construction.test.ts tests/wilds-creature-work.test.ts`

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/features/play/wilds-construction-recipes.ts src/features/play/wilds-world-construction.ts tests/wilds-construction-recipes.test.ts tests/wilds-world-construction.test.ts
git commit -m "feat: define continuous construction stage recipes"
```

### Task 4: Project, Chunk, Component, and Contribution Proofs

**Files:**
- Create: `src/features/play/wilds-construction-project.ts`
- Create: `src/features/play/wilds-construction-component.ts`
- Create: `tests/wilds-construction-project.test.ts`
- Create: `tests/wilds-construction-component.test.ts`

**Interfaces:**
- Consumes: Task 3 recipes/placement and existing canonical JSON/SHA-256 helpers.
- Produces: project/chunk/component/contribution types and verifiers; `createWildsConstructionProject`; `appendWildsConstructionChunkReference`; `createWildsConstructionComponent`; `createWildsMaterialContribution`; `createWildsWorkContribution`; `projectWildsConstructionProgress`.

- [x] **Step 1: Write failing proof-object tests**

```ts
it("creates a zero-material planned component and pages its project references", () => {
  const project = createWildsConstructionProject({ ownerReceizId: OWNER, name: "Meadow Home", region: { x: 0, z: 0 }, kaiUPulse: 1 });
  const component = createWildsConstructionComponent({ project, placement: validFoundationPlacement(), ownerReceizId: OWNER, kaiUPulse: 2 });
  assert.equal(projectWildsConstructionProgress(component, [], []).stage, "planned");
  assert.equal(verifyWildsConstructionComponent(component), true);
});

it("advances only with exact material and solo work proofs", () => {
  const material = createWildsMaterialContribution({ component, lot: stoneLot(), contributorReceizId: OWNER, kaiUPulse: 3 });
  const work = createWildsWorkContribution({ component, worker: { kind: "player", receizId: OWNER }, amount: 1, kaiUPulse: 4 });
  const progress = projectWildsConstructionProgress(component, [material], [work]);
  assert.equal(progress.materials.stone.contributed, 1);
  assert.equal(progress.work.contributed, 1);
});
```

- [x] **Step 2: Run tests and verify missing module failures**

Run: `npx tsx --test tests/wilds-construction-project.test.ts tests/wilds-construction-component.test.ts`

Expected: FAIL because both modules do not exist.

- [x] **Step 3: Implement immutable project and 64-reference chunk pages**

```ts
export const WILDS_CONSTRUCTION_CHUNK_REFERENCE_LIMIT = 64;
export type WildsConstructionAccess = "private" | "invited" | "public";
export type WildsConstructionPermissions = Readonly<{
  plan: boolean; contribute: boolean; work: boolean; renovate: boolean; remove: boolean;
}>;
```

Seal every object with canonical content hashes. A full chunk returns a newly sealed continuation page; placement never throws a player-facing piece-limit error.

- [x] **Step 4: Implement immutable component and append-only contribution proofs**

```ts
export type WildsConstructionWorker =
  | Readonly<{ kind: "player"; receizId: string }>
  | Readonly<{ kind: "creature"; receizId: string; creatureSubjectId: string; creatureHead: string }>;

export function projectWildsConstructionProgress(
  component: WildsConstructionComponentV1,
  materials: readonly WildsConstructionMaterialContributionV1[],
  work: readonly WildsConstructionWorkContributionV1[]
): WildsConstructionProgress;
```

Material contributions bind exact lot ID/head/kind/custodian and component lineage. Work contributions bind worker identity, integer amount, component lineage, and optional creature proof. The fold sorts by contribution ID, deduplicates IDs/lots, fills stages in order, applies work only where stage material is complete, and derives percentage/stage without an independently writable progress field.

- [x] **Step 5: Add tamper, duplicate-lot, excess-material, and multi-worker tests**

Prove invalid heads fail, one lot cannot fill two stages, compatible excess moves to the next stage, player work succeeds without creature fields, and two creature proofs add throughput without changing access.

- [x] **Step 6: Run focused tests**

Run: `npx tsx --test tests/wilds-construction-project.test.ts tests/wilds-construction-component.test.ts tests/wilds-construction-recipes.test.ts`

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add src/features/play/wilds-construction-project.ts src/features/play/wilds-construction-component.ts tests/wilds-construction-project.test.ts tests/wilds-construction-component.test.ts
git commit -m "feat: add sovereign construction proof objects"
```

### Task 5: World Events, Projection, and Component-Level Conservation

**Files:**
- Modify: `src/features/play/wilds-world-event.ts`
- Modify: `src/features/play/wilds-world-state.ts`
- Modify: `tests/wilds-construction-world-state.test.ts`
- Modify: `tests/wilds-world-bootstrap.test.ts`

**Interfaces:**
- Consumes: Task 4 proof objects and existing material lifecycle maps.
- Produces: projection maps for projects/chunks/components/material contributions/work contributions and reducers for create/place/contribute/work events.

- [x] **Step 1: Write failing reducer tests**

```ts
assert.equal(placed.constructionComponents[component.componentId]?.head, component.head);
assert.equal(placed.reservedMaterialLots[lot.lotId], undefined);
assert.equal(contributed.reservedMaterialLots[lot.lotId], component.componentId);
assert.equal(worked.consumedMaterialLots[lot.lotId], component.componentId);
assert.equal(projectWildsConstructionProgressFromWorld(worked, component.componentId).stage, "framed");
```

Also test that component placement with zero lots succeeds, a second use of the same lot fails atomically, player work has no card/mandate dependency, and absent maps hydrate as empty.

- [x] **Step 2: Run tests and verify missing projection fields**

Run: `npx tsx --test tests/wilds-construction-world-state.test.ts tests/wilds-world-bootstrap.test.ts`

Expected: FAIL on missing event kinds and projection maps.

- [x] **Step 3: Add event kinds and projection maps**

```ts
type ContinuousConstructionEventKind =
  | "construction.project_created"
  | "construction.component_placed"
  | "construction.material_contributed"
  | "construction.work_contributed";
```

Add typed maps to `WildsWorldProjection`, initialize them empty, and default them during checkpoint hydration without changing the projection schema or legacy digest path.

- [x] **Step 4: Implement strict reducers**

Validate every proof, project/component relationship, permission, region chunk, actor/custodian, exact lot disposition, contribution uniqueness, and local causal head. Reserve deposited lots and consume only lots embedded by a newly completed stage. Export `projectWildsConstructionProgressFromWorld(world, componentId)` as the single projection helper used by rendering, collision, functions, saves, and tests. Append an event only after every validation succeeds.

- [x] **Step 5: Run focused state tests**

Run: `npx tsx --test tests/wilds-construction-world-state.test.ts tests/wilds-world-bootstrap.test.ts tests/wilds-construction-site.test.ts`

Expected: PASS, including legacy V1 site reducers.

- [x] **Step 6: Commit**

```bash
git add src/features/play/wilds-world-event.ts src/features/play/wilds-world-state.ts tests/wilds-construction-world-state.test.ts tests/wilds-world-bootstrap.test.ts
git commit -m "feat: project continuous construction world history"
```

### Task 6: Local Receiz Edge Commands With No Network-Pending Construction

**Files:**
- Modify: `src/features/play/wilds-world-service.ts`
- Modify: `src/features/play/wilds-world-authority.ts`
- Modify: `src/features/play/use-wilds-world.ts`
- Modify: `src/features/play/wilds-world-outbox.ts`
- Modify: `tests/wilds-steward-world-service.test.ts`
- Modify: `tests/wilds-world-outbox.test.ts`
- Create: `tests/wilds-continuous-construction-edge.test.ts`

**Interfaces:**
- Consumes: Task 5 reducers and Task 4 constructors.
- Produces: component project/create/place/deposit/work/revise/replace/salvage commands and hook methods; `isWildsEdgeImmediateConstructionCommand`.

- [x] **Step 1: Write failing edge-first tests**

```ts
assert.equal(worldCommandRequiresCard(placeCommand), false);
assert.equal(isWildsEdgeImmediateConstructionCommand(placeCommand), true);
const local = admitWildsWorldOutboxEntry(initialWildsWorldProjection(), entry(placeCommand));
assert.ok(Object.values(local.constructionComponents).length === 1);
assert.equal(Object.values(local.constructionComponents)[0]?.kind, "foundation");
```

Add service tests executing project creation, zero-material placement, partial deposit, and player work using `{ actorId, canonical: true, pulse, occurredAt, uPulse }` with no card and no mandate.

- [x] **Step 2: Run tests and verify command/type failures**

Run: `npx tsx --test tests/wilds-continuous-construction-edge.test.ts tests/wilds-steward-world-service.test.ts tests/wilds-world-outbox.test.ts`

Expected: FAIL because continuous construction commands do not exist.

- [x] **Step 3: Add command union and service branches**

```ts
type ContinuousConstructionCommand =
  | { type: "construction.project.create"; name: string; region: { x: number; z: number }; commandId: string }
  | { type: "construction.component.place"; projectId: string; placement: WildsBlueprintPlacement; actorPosition: { x: number; z: number }; commandId: string }
  | { type: "construction.component.deposit"; componentId: string; componentHead: string; lotIds: string[]; actorPosition: { x: number; z: number }; commandId: string }
  | { type: "construction.component.work"; componentId: string; componentHead: string; actorPosition: { x: number; z: number }; creature?: { subjectId: string; head: string }; commandId: string };
```

Add revision/replacement/salvage commands in Task 11. The service must recompute every proof from current local projection and reject client-supplied successors.

- [x] **Step 4: Route construction through source authority before paint**

```ts
export function isWildsEdgeImmediateConstructionCommand(command: Pick<WildsWorldCommand, "type">) {
  return command.type === "construction.project.create" || command.type.startsWith("construction.component.");
}

export function shouldSynchronizeWildsWorldCommandAfterPaint(command: Pick<WildsWorldCommand, "type">) {
  return command.type === "resource.material.harvest" || isWildsEdgeImmediateConstructionCommand(command);
}
```

Do not set `pendingCommand`, `receiz_recovery_pending`, or network status copy for these commands. Locally admit, update the snapshot, enqueue publication after paint, and return the local projection. A transport error remains a background replication concern and does not change construction UI state.

- [x] **Step 5: Add `useWildsWorld` methods**

Expose `createConstructionProject`, `placeConstructionComponent`, `depositConstructionMaterial`, and `workConstructionComponent`. They require an actor/session and exact current projection, but never `activeCard` or a creature mandate for owner work.

- [x] **Step 6: Run focused tests**

Run: `npx tsx --test tests/wilds-continuous-construction-edge.test.ts tests/wilds-steward-world-service.test.ts tests/wilds-world-outbox.test.ts tests/wilds-world-authority.test.ts`

Expected: PASS and no regression to card-gated historical commands.

- [x] **Step 7: Commit**

```bash
git add src/features/play/wilds-world-service.ts src/features/play/wilds-world-authority.ts src/features/play/use-wilds-world.ts src/features/play/wilds-world-outbox.ts tests/wilds-continuous-construction-edge.test.ts tests/wilds-steward-world-service.test.ts tests/wilds-world-outbox.test.ts
git commit -m "feat: admit construction at the receiz edge"
```

### Task 7: Offline Save, Owned Additions, Merge, and Legacy Hydration

**Files:**
- Modify: `src/features/play/game-state.ts`
- Modify: `src/features/play/wilds-player-world-additions.ts`
- Modify: `src/features/play/use-wilds-world.ts`
- Modify: `tests/play-game-state.test.ts`
- Modify: `tests/wilds-player-world-additions.test.ts`

**Interfaces:**
- Consumes: Task 5 projection maps and verifiers.
- Produces: V10 local save fields and deterministic merge rules for owned projects/components plus actor-authored contributions.

- [ ] **Step 1: Write failing save/restore/merge tests**

```ts
assert.equal(restored.ownedWorldAdditions.constructionProjects[project.projectId]?.head, project.head);
assert.equal(restored.ownedWorldAdditions.constructionComponents[component.componentId]?.head, component.head);
assert.equal(restored.ownedWorldAdditions.constructionMaterialContributions[material.contributionId]?.head, material.head);
assert.equal(restored.ownedWorldAdditions.constructionWorkContributions[work.contributionId]?.head, work.head);
```

Test full offline serialization/restoration and merging a remote collaborator contribution without replacing the locally newer owner component.

- [ ] **Step 2: Run tests and verify missing owned fields**

Run: `npx tsx --test tests/play-game-state.test.ts tests/wilds-player-world-additions.test.ts`

Expected: FAIL because V9 additions omit continuous construction.

- [ ] **Step 3: Extend owned additions and bump the save schema**

Add project/chunk/component/material-contribution/work-contribution maps to `WildsOwnedWorldAdditions`; set `PLAY_SAVE_SCHEMA` to `receiz.wilds.save.v10`; retain V2-V9 in the legacy schema set. Normalize only verified objects owned by the Receiz ID or actor-authored contributions addressed to an owned project/component.

- [ ] **Step 4: Implement deterministic merge laws**

Projects/components choose the verified descendant or higher lawful revision; chunk pages union exact references; append-only contribution maps union by ID/head; material lifecycle precedence remains consumed > stored > reserved > loose. Never allow a network snapshot with absent new maps to erase saved local maps.

- [ ] **Step 5: Run focused persistence tests**

Run: `npx tsx --test tests/play-game-state.test.ts tests/wilds-player-world-additions.test.ts tests/wilds-world-outbox.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/play/game-state.ts src/features/play/wilds-player-world-additions.ts src/features/play/use-wilds-world.ts tests/play-game-state.test.ts tests/wilds-player-world-additions.test.ts
git commit -m "feat: persist continuous construction offline"
```

### Task 8: Mount the Continuous Builder and Plan With Zero Resources

**Files:**
- Create: `src/features/play/WildsContinuousBuilderPanel.tsx`
- Modify: `src/features/play/WildsBuildMode.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `src/features/play/WildsStewardPlacementHud.tsx`
- Modify: `src/features/play/WildzWorldControls.tsx`
- Modify: `app/globals.css`
- Modify: `tests/wilds-render-contract.test.ts`
- Modify: `tests/wilds-steward-hud-loop.test.ts`

**Interfaces:**
- Consumes: Task 6 hook methods, Task 3 catalog/preview, Task 4 progress projection.
- Produces: approved in-world palette/resource strip/inspector; direct zero-material planning; partial deposit and solo work actions.

- [ ] **Step 1: Write failing UI contract tests**

```ts
assert.match(panel, /Add what I carry/);
assert.match(panel, /Build here/);
assert.match(panel, /Hay/);
assert.doesNotMatch(panel, /network|pending|wait for|partner required/i);
assert.doesNotMatch(panel, /materials\.hay.*disabled/s);
assert.match(campaign, /placeConstructionComponent/);
assert.match(campaign, /workConstructionComponent/);
assert.doesNotMatch(campaign, /createStewardMandate\(\["build"\]/);
```

- [ ] **Step 2: Run tests and verify builder is unmounted**

Run: `npx tsx --test tests/wilds-render-contract.test.ts tests/wilds-steward-hud-loop.test.ts`

Expected: FAIL because only prefab craft is mounted.

- [ ] **Step 3: Implement the approved panel contract**

```ts
type WildsContinuousBuilderPanelProps = Readonly<{
  materials: Readonly<{ hay: number; timber: number; stone: number }>;
  selectedKind: WildsConstructionKind;
  selectedProgress: WildsConstructionProgress | null;
  onSelectKind(kind: WildsConstructionKind): void;
  onAddCarried(): void;
  onWork(): void;
  onRotate(delta: number): void;
  onHeight(delta: number): void;
  onUndo(): void;
}>;
```

Render structural/living/finish groups, three exact resource counts, four stage labels, remaining recipe, and local edit/actions. Palette buttons remain enabled at zero resources. All controls are real buttons with 44px minimum targets.

- [ ] **Step 4: Wire planning and world selection**

Replace the separate prefab-only placement branch with a continuous Build Mode state holding active project, blueprint preview, selected kind, rotation, height, and selected component. A valid world click builds a preview; confirm locally creates the project if necessary and places the component with no lot IDs. Keep preview collision/function non-authoritative.

- [ ] **Step 5: Wire partial contribution and solo work**

Select compatible loose lots in stable lot-ID order up to total remaining cost, allow any nonempty subset, and call `depositConstructionMaterial`. Call `workConstructionComponent` with no creature by default. Remove partner readiness and `pendingCommand` from builder enablement/copy.

- [ ] **Step 6: Run focused UI tests**

Run: `npx tsx --test tests/wilds-render-contract.test.ts tests/wilds-steward-hud-loop.test.ts tests/wilds-steward-craft.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/play/WildsContinuousBuilderPanel.tsx src/features/play/WildsBuildMode.tsx src/features/play/PlayCampaign.tsx src/features/play/WildsWorldCanvas.tsx src/features/play/WildsStewardPlacementHud.tsx src/features/play/WildzWorldControls.tsx app/globals.css tests/wilds-render-contract.test.ts tests/wilds-steward-hud-loop.test.ts
git commit -m "feat: mount the continuous in-world builder"
```

### Task 9: Staged Geometry, Exact Collision, and Traversal

**Files:**
- Create: `src/features/play/WildsContinuousConstruction.tsx`
- Modify: `src/features/play/WildsStewardEnvironment.tsx`
- Modify: `src/features/play/wilds-terrain-obstacles.ts`
- Modify: `src/features/play/wilds-structure-support.ts`
- Modify: `tests/wilds-render-contract.test.ts`
- Create: `tests/wilds-construction-physics.test.ts`
- Create: `tests/wilds-structure-support.test.ts`

**Interfaces:**
- Consumes: Task 4 world progress and Task 3 catalog collision solids.
- Produces: nearby staged construction rendering; `projectWildsConstructionObstacles`; expanded `projectWildsStructureSupports` for functional stairs/platforms/bridges.

- [ ] **Step 1: Write failing render and physics tests**

```ts
assert.equal(projectWildsConstructionObstacles(worldWithPlannedRoom()).length, 0);
assert.ok(projectWildsConstructionObstacles(worldWithFramedRoom()).length > 0);
assert.ok(projectWildsConstructionObstacles(worldWithFunctionalDoor()).every((obstacle) => obstacle.id !== "door:interior"));
assert.ok(projectWildsStructureSupports(worldWithFunctionalBridge()).length > 0);
assert.match(renderSource, /construction-stage-planned/);
assert.match(renderSource, /construction-stage-functional/);
```

- [ ] **Step 2: Run tests and verify missing staged projection**

Run: `npx tsx --test tests/wilds-construction-physics.test.ts tests/wilds-render-contract.test.ts`

Expected: FAIL because component geometry/collision is not projected.

- [ ] **Step 3: Render exact admitted stages**

Create shared stake, rope, material-pile, foundation, floor, room, wall/opening, door, window, column, roof, stair, bridge, platform, path, storage, workshop, habitat, bed, hearth, light, garden, water, trim, railing, and partition geometries. Planned shows stakes only; partial deposits show exact hay/timber/stone piles; framed, functional, and finished groups derive exclusively from `projectWildsConstructionProgress`. Memoize nearby sorted components and shared resources; do not create proof work in `useFrame`.

- [ ] **Step 4: Project physical solids and supports from the same catalog**

Use component placement collision solids filtered by stage-specific solid IDs. Convert only admitted solids to `WildsTerrainObstacle`. Project bridge/platform/stair support elevations at functional stage. Preserve room air and door openings; do not emit one gross room box.

- [ ] **Step 5: Run focused render/physics tests**

Run: `npx tsx --test tests/wilds-construction-physics.test.ts tests/wilds-render-contract.test.ts tests/wilds-terrain-obstacles.test.ts tests/wilds-structure-support.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/play/WildsContinuousConstruction.tsx src/features/play/WildsStewardEnvironment.tsx src/features/play/wilds-terrain-obstacles.ts src/features/play/wilds-structure-support.ts tests/wilds-construction-physics.test.ts tests/wilds-render-contract.test.ts
git commit -m "feat: render physical construction stage by stage"
```

### Task 10: Functional Components at the Functional Stage

**Files:**
- Create: `src/features/play/wilds-construction-function.ts`
- Modify: `src/features/play/wilds-world-service.ts`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/WildsContinuousConstruction.tsx`
- Create: `tests/wilds-construction-function.test.ts`
- Modify: `tests/wilds-steward-tools.test.ts`

**Interfaces:**
- Consumes: Task 3 function IDs and Task 4 progress.
- Produces: pure `projectWildsConstructionFunctions(world)` and service validation for storage/workshop/hearth/light/habitat/garden/water plus traversal already supplied by Task 9.

- [ ] **Step 1: Write failing functional-stage tests**

```ts
assert.equal(projectWildsConstructionFunctions(worldWithFramedWorkshop()).workshops.length, 0);
assert.equal(projectWildsConstructionFunctions(worldWithFunctionalWorkshop()).workshops.length, 1);
assert.equal(projectWildsConstructionFunctions(worldWithFunctionalStorage()).storage.length, 1);
assert.equal(projectWildsConstructionFunctions(worldWithFunctionalHabitat()).habitats.length, 1);
assert.equal(projectWildsConstructionFunctions(worldWithFunctionalLight()).lights.length, 1);
```

- [ ] **Step 2: Run tests and verify missing function projector**

Run: `npx tsx --test tests/wilds-construction-function.test.ts tests/wilds-steward-tools.test.ts`

Expected: FAIL because functional construction components are not recognized.

- [ ] **Step 3: Implement trusted functional projections**

```ts
export type WildsConstructionFunctions = Readonly<{
  shelter: readonly WildsConstructionFunction[];
  storage: readonly WildsConstructionFunction[];
  workshops: readonly WildsConstructionFunction[];
  hearths: readonly WildsConstructionFunction[];
  lights: readonly WildsConstructionFunction[];
  habitats: readonly WildsConstructionFunction[];
  gardens: readonly WildsConstructionFunction[];
  water: readonly WildsConstructionFunction[];
}>;

export type WildsConstructionFunction = Readonly<{
  componentId: string;
  componentHead: string;
  projectId: string;
  ownerReceizId: string;
  position: Readonly<{ x: number; y: number; z: number }>;
}>;
```

Return only verified functional/finished components and catalog-defined behavior. Bind each function to project/component/head/owner and exact physical position.

- [ ] **Step 4: Reuse existing storage and workshop commands**

Allow tool crafting and exact-lot storage to target either legacy complete structures or matching functional construction components. Add shelter/rest, light, habitat assignment, garden stewardship, and water interaction projections to campaign behavior without accepting arbitrary scripts.

- [ ] **Step 5: Run focused function tests**

Run: `npx tsx --test tests/wilds-construction-function.test.ts tests/wilds-steward-tools.test.ts tests/wilds-steward-world-service.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/play/wilds-construction-function.ts src/features/play/wilds-world-service.ts src/features/play/PlayCampaign.tsx src/features/play/WildsContinuousConstruction.tsx tests/wilds-construction-function.test.ts tests/wilds-steward-tools.test.ts
git commit -m "feat: activate functional construction components"
```

### Task 11: Editing, Renovation, Salvage, and Personal Blueprints

**Files:**
- Modify: `src/features/play/wilds-construction-component.ts`
- Modify: `src/features/play/wilds-world-event.ts`
- Modify: `src/features/play/wilds-world-service.ts`
- Modify: `src/features/play/wilds-world-state.ts`
- Modify: `src/features/play/WildsContinuousBuilderPanel.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Create: `src/features/play/wilds-personal-blueprint.ts`
- Create: `tests/wilds-construction-renovation.test.ts`
- Create: `tests/wilds-personal-blueprint.test.ts`

**Interfaces:**
- Consumes: existing component/project proof lineage.
- Produces: revise/replace/salvage commands and events, planned revision, renovation successor, atomic replacement, bounded salvage, undo/redo planning, and material-free reusable blueprint definitions.

- [ ] **Step 1: Write failing edit and renovation tests**

```ts
assert.equal(reviseWildsPlannedComponent(component, newPlacement).parentHead, component.head);
assert.equal(beginWildsRenovation(finished, replacement).predecessorHead, finished.head);
assert.equal(projectWildsConstructionFunctions(worldBeforeReplacement).workshops[0]?.componentId, finished.componentId);
assert.equal(projectWildsConstructionFunctions(worldAfterReplacement).workshops[0]?.componentId, replacement.componentId);
assert.ok(salvage.recoveredLotHeads.length <= finished.embeddedLotHeads.length);
```

Blueprint tests must prove relative transforms are deterministic and application creates planned components with no resource/work contribution IDs.

- [ ] **Step 2: Run tests and verify missing revision functions**

Run: `npx tsx --test tests/wilds-construction-renovation.test.ts tests/wilds-personal-blueprint.test.ts`

Expected: FAIL because revision/blueprint modules do not exist.

- [ ] **Step 3: Implement lawful revision and renovation proofs**

Add `construction.component_revised`, `construction.component_replaced`, and `construction.component_salvaged` event kinds plus `construction.component.revise`, `construction.component.replace`, and `construction.component.salvage` commands. Planned revision may change supported customization/transform and releases no consumed material because none exists. Unfinished revision releases unembedded reserved lots and binds embedded lineage. Finished renovation keeps predecessor collision/function active until the replacement reaches functional and `construction.component.replace` atomically switches the active head. Salvage creates bounded recovered lots according to recipe `salvagePercent` and exact predecessor lot heads.

- [ ] **Step 4: Implement personal blueprint proofs and local undo/redo**

```ts
export type WildsPersonalBlueprintV1 = Readonly<{
  schema: "wildz.personal-blueprint.v1";
  blueprintId: string;
  ownerReceizId: string;
  name: string;
  pieces: readonly Readonly<{
    kind: WildsConstructionKind;
    variant: string;
    customization: WildsConstructionComponentV1["customization"];
    relativeTransform: Readonly<{ x: number; y: number; z: number; rotationQuarterTurns: 0 | 1 | 2 | 3 }>;
  }>[];
  head: string;
}>;
```

Blueprints store only catalog kinds, variants, customization, and relative transforms. Applying one creates independent planned components. Undo/redo stays in Build Mode until commands are confirmed.

- [ ] **Step 5: Wire inspector actions and run tests**

Run: `npx tsx --test tests/wilds-construction-renovation.test.ts tests/wilds-personal-blueprint.test.ts tests/wilds-render-contract.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/play/wilds-construction-component.ts src/features/play/wilds-world-event.ts src/features/play/wilds-world-service.ts src/features/play/wilds-world-state.ts src/features/play/WildsContinuousBuilderPanel.tsx src/features/play/PlayCampaign.tsx src/features/play/wilds-personal-blueprint.ts tests/wilds-construction-renovation.test.ts tests/wilds-personal-blueprint.test.ts
git commit -m "feat: add construction renovation and blueprints"
```

### Task 12: Collaboration, Automatic Paging, Cross-Region Expansion, and Streaming

**Files:**
- Modify: `src/features/play/wilds-construction-project.ts`
- Modify: `src/features/play/wilds-construction-component.ts`
- Modify: `src/features/play/wilds-world-state.ts`
- Modify: `src/features/play/wilds-world-service.ts`
- Modify: `src/features/play/WildsContinuousConstruction.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Create: `tests/wilds-construction-collaboration.test.ts`
- Create: `tests/wilds-construction-scaling.test.ts`

**Interfaces:**
- Consumes: Tasks 4-11 full component lifecycle.
- Produces: permission-checked append-only multi-player/creature contributions, automatic unlimited chunk paging, cross-region continuity anchors, and bounded active rendering.

- [ ] **Step 1: Write failing collaboration and scale tests**

```ts
assert.equal(projectWildsConstructionProgress(component, materialsFromTwoPlayers, soloWork).stage, "framed");
assert.equal(projectWildsConstructionProgress(component, materialsFromTwoPlayers, workFromThreeCreatures).work.contributed, 3);
assert.equal(appendSixtyFiveComponents(project).chunks.length, 2);
assert.equal(appendSixtyFiveComponents(project).chunks[0]?.componentIds.length, 64);
assert.ok(projectNearConstruction(worldWithTenThousandComponents(), player, 110).length < 500);
```

Prove removing all collaborators leaves owner work valid and that a component split across adjacent region chunks preserves continuity anchors.

- [ ] **Step 2: Run tests and verify paging/collaboration gaps**

Run: `npx tsx --test tests/wilds-construction-collaboration.test.ts tests/wilds-construction-scaling.test.ts`

Expected: FAIL before automatic paging, permission merge, and near projection exist.

- [ ] **Step 3: Implement permission and contribution convergence**

Owner geometry/removal/renovation commands require exact current component heads. Contributor material/work commands verify project access and specific permissions but append independent proof IDs. Union valid contribution proofs by ID/head; deduplicate lots; carry compatible excess forward; never require a shared network lock.

- [ ] **Step 4: Implement automatic chunk paging and region continuity**

When a region page reaches 64 component references, create and seal the next page automatically. Cross-region spanning pieces compile into linked region-local components with matching continuity anchor IDs. No command rejects growth because the current page, region, or project is large.

- [ ] **Step 5: Implement bounded near projection and batching**

Add `projectNearWildsConstruction(world, position, radius)` that selects referenced chunks first, filters components by exact bounds, sorts stably, and memoizes by chunk heads. Render repeated finished pieces with instancing/batching while retaining a component selection map. Keep collision selection on the same bounded near set.

- [ ] **Step 6: Run focused collaboration/scale tests**

Run: `npx tsx --test tests/wilds-construction-collaboration.test.ts tests/wilds-construction-scaling.test.ts tests/wilds-construction-component.test.ts tests/wilds-construction-physics.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/play/wilds-construction-project.ts src/features/play/wilds-construction-component.ts src/features/play/wilds-world-state.ts src/features/play/wilds-world-service.ts src/features/play/WildsContinuousConstruction.tsx src/features/play/PlayCampaign.tsx tests/wilds-construction-collaboration.test.ts tests/wilds-construction-scaling.test.ts
git commit -m "feat: scale collaborative construction without caps"
```

### Task 13: Legacy Migration and Player-Facing Cutover

**Files:**
- Create: `src/features/play/wilds-construction-migration.ts`
- Modify: `src/features/play/wilds-world-state.ts`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/WildsStewardCraftPanel.tsx`
- Modify: `docs/receiz-decisions/2026-08-21-wilds-resource-construction-preview-boundary.md`
- Create: `tests/wilds-construction-migration.test.ts`
- Modify: `tests/wilds-construction-site.test.ts`
- Modify: `tests/wilds-steward-world-service.test.ts`

**Interfaces:**
- Consumes: complete continuous construction subsystem and legacy V1 sites/structures.
- Produces: non-mutating compatibility projections and a live UI cutover that no longer offers full-cost/companion-gated prefab placement.

- [ ] **Step 1: Write failing migration tests**

```ts
const migrated = projectLegacyConstruction(legacyWorld);
assert.equal(migrated.legacyHead, site.head);
assert.equal(migrated.progress.materials.timber.contributed, site.contributedLots.filter((lot) => lot.kind === "timber").length);
assert.equal(projectLegacyConstruction(completedWorld).renovationPredecessorHead, structure.head);
assert.equal(verifyWildsConstructionSite(site), true);
assert.equal(verifyWildsStructure(structure), true);
```

- [ ] **Step 2: Run tests and verify missing compatibility projector**

Run: `npx tsx --test tests/wilds-construction-migration.test.ts tests/wilds-construction-site.test.ts tests/wilds-steward-world-service.test.ts`

Expected: FAIL only on the missing migration module; all historical verifiers must remain green.

- [ ] **Step 3: Implement read-only legacy projections**

Project incomplete V1 sites as single legacy-prefab continuous components without changing site/lot heads. Project complete shelter/bridge/workbench/cache structures as immutable finished predecessors eligible for renovation. Never rewrite historical events or checkpoints.

- [ ] **Step 4: Remove the old player-facing gate**

Remove full-cost prefab selection and `Work together`/mandatory build-mandate actions from the live construction UI. Retain command/reducer/verifier support for replay and old clients. Direct every new player placement through continuous components.

- [ ] **Step 5: Update the Receiz boundary decision and run tests**

Document that the production component catalog is admitted through edge-authoritative proofs, that preview remains non-authoritative, and that network transport is replication only.

Run: `npx tsx --test tests/wilds-construction-migration.test.ts tests/wilds-construction-site.test.ts tests/wilds-steward-world-service.test.ts tests/wilds-render-contract.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/play/wilds-construction-migration.ts src/features/play/wilds-world-state.ts src/features/play/PlayCampaign.tsx src/features/play/WildsStewardCraftPanel.tsx docs/receiz-decisions/2026-08-21-wilds-resource-construction-preview-boundary.md tests/wilds-construction-migration.test.ts tests/wilds-construction-site.test.ts tests/wilds-steward-world-service.test.ts
git commit -m "feat: cut over to continuous construction"
```

### Task 14: Full Verification and Release Evidence

**Files:**
- Modify: `scripts/receiz-architecture-lock.mjs`
- Modify: `docs/release/verification.md`
- Create: `docs/release/evidence/continuous-construction/verification.md`
- Modify: focused test files only if verification exposes defects.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: architecture locks, full automated verification, browser evidence, performance diagnostics, and release-ready documentation.

- [ ] **Step 1: Add architecture locks**

Reject construction code that introduces frame-time fetch/proof work, `Math.random`, network-gated construction copy, active-card/mandate requirements in continuous component work, writable progress percentages, direct preview publication, or a player-facing component cap.

- [ ] **Step 2: Run the focused continuous-construction suite**

Run:

```bash
npx tsx --test tests/wilds-resource-lot-world.test.ts tests/wilds-construction-recipes.test.ts tests/wilds-construction-project.test.ts tests/wilds-construction-component.test.ts tests/wilds-construction-world-state.test.ts tests/wilds-continuous-construction-edge.test.ts tests/wilds-player-world-additions.test.ts tests/wilds-construction-physics.test.ts tests/wilds-construction-function.test.ts tests/wilds-construction-renovation.test.ts tests/wilds-personal-blueprint.test.ts tests/wilds-construction-collaboration.test.ts tests/wilds-construction-scaling.test.ts tests/wilds-construction-migration.test.ts tests/wilds-render-contract.test.ts
```

Expected: PASS with zero skipped construction tests.

- [ ] **Step 3: Run repository verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm receiz:architecture-lock
pnpm build
```

Expected: every command exits 0.

- [ ] **Step 4: Run desktop and mobile browser playthroughs**

Verify at 390×844, 844×390, tablet, and desktop:

1. Go offline before opening construction.
2. Enter Build Mode with zero materials and admit foundation stakes.
3. Gather hay, timber, and stone without selecting a creature.
4. Deposit one lot at a time and capture each visible change.
5. Perform solo work through framed, functional, and finished stages.
6. Walk through the admitted doorway and across a functional bridge/stair.
7. Store a lot, craft at a workshop, rest at a hearth, assign a habitat, and observe a light.
8. Renovate a finished piece while the predecessor remains functional.
9. Place more than 64 components and cross one region boundary.
10. Reload offline, then reconnect and confirm immediate synchronization without a pending construction surface.

Record console errors, page errors, failed requests, nonblank canvas evidence, screenshots, active chunk/component/draw-call/collider counts, and measured frame time.

- [ ] **Step 5: Write release evidence and run release check**

Document exact commands, commits, device sizes, screenshots, offline/online transitions, source-proof heads, renderer diagnostics, and remaining risks in `docs/release/evidence/continuous-construction/verification.md`.

Run: `pnpm release:check`

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/receiz-architecture-lock.mjs docs/release/verification.md docs/release/evidence/continuous-construction/verification.md
git commit -m "test: verify continuous sovereign construction"
```
