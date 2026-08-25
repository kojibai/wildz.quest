# Steward Bridge V124 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Let a player and willing companion turn exact harvested timber and stone into a persistent, walkable public trail bridge whose world, inventory, creature-work, and bounded Phi consequences admit atomically through Receiz V124.

**Architecture:** Extend the existing source-authoritative steward construction proof rather than activating the old preview-only blueprint graph wholesale. A bridge is one immutable `wildz.structure.v1` successor built from exact material lots, validated against deterministic water-and-bank evidence, executed through the existing living-operation/emission transaction, projected from admitted world events, and reduced into cached render, collision, and traversal-support geometry outside the frame-critical path.

**Tech Stack:** TypeScript, React 19, Next.js App Router, Three.js / React Three Fiber, Node test runner, Receiz SDK 124.0.2.

**Spec:** `docs/superpowers/specs/2026-08-24-wildz-regenerative-living-world-design.md`

## Global Constraints

- The source proof object is authority; no API response, cache, mesh, receipt, or SDK projection may outrank it.
- Preview and placement inspection write nothing.
- Material lots, player, creature, world emission, and structure advance atomically or all remain unchanged.
- A creature mandate must be current, willing, owner-bound, head-bound, region-bound, and explicitly permit `build`.
- Gameplay movement, camera, animation, collision, and rendering perform no network request, proof verification, history scan, or wallet work.
- The bridge must restore from world events/checkpoints and must not be duplicated by command replay or repeated refresh.
- The mobile HUD adds only one contextual build choice and must shrink/reflow without overlap or browser zoom.

---

### Task 1: Exact bridge proof and physical placement law

**Files:**
- Modify: `src/features/play/wilds-steward-construction.ts`
- Test: `tests/wilds-steward-construction.test.ts`

**Interfaces:**
- Consumes: `WildsMaterialLotV1`, deterministic `sampleWildsTerrain` evidence supplied by the caller, and current admitted `WildsStructureV1[]`.
- Produces: `createWildsTrailBridge(input): WildsStructureV1`, generalized `verifyWildsStructure`, and `createWildsStewardStructureOperation` support for both admitted blueprints.

- [x] **Step 1: Write failing proof tests**

Add tests that construct four timber and two stone lots, then assert a bridge proof has `blueprint: "trail-bridge"`, six sorted consumed lot identities, exact bank endpoints, a complete stage, and a valid content-addressed head. Assert invalid material counts, dry center, submerged banks, excessive bank height delta, overlap, duplicate lots, and a changed head all reject.

- [x] **Step 2: Run the focused test and confirm red**

Run: `pnpm test -- --test-name-pattern="source-authoritative steward construction"`

Expected: FAIL because `createWildsTrailBridge` and bridge verification do not exist.

- [x] **Step 3: Implement the bridge proof**

Use this public shape:

```ts
type WildsStructureBlueprint = "trail-shelter" | "trail-bridge";

type WildsBridgePhysicalEvidenceV1 = Readonly<{
  centerSurface: "shallow-water" | "deep-water";
  start: Readonly<{ x: number; y: number; z: number; surface: string }>;
  end: Readonly<{ x: number; y: number; z: number; surface: string }>;
  deckY: number;
  halfWidth: 1.5;
  halfLength: 4;
}>;

function createWildsTrailBridge(input: Readonly<{
  ownerReceizId: string;
  position: Readonly<{ x: number; y: number; z: number }>;
  rotationQuarterTurns: number;
  lots: readonly WildsMaterialLotV1[];
  builder: Readonly<{ creatureSubjectId: string; creatureHead: string }>;
  existingStructures: readonly WildsStructureV1[];
  physical: WildsBridgePhysicalEvidenceV1;
  kaiUPulse: number;
}>): WildsStructureV1;
```

Derive the identity from blueprint, owner, transform, physical evidence, and sorted lot heads. Require exact `timber: 4`, `stone: 2`, water at the center, non-water banks, bank rise at most 1.25 m, and no structure envelope overlap.

- [x] **Step 4: Generalize the operation contribution**

For `trail-bridge`, compile `steward.build-trail-bridge` with stages `survey`, `haul`, `stabilize`, and `finish`, each binding player and creature. Use a deterministic contribution vector whose net contribution is 14 so exact eligible settlement is `140000` micro-Phi. Keep the existing shelter vector unchanged.

- [x] **Step 5: Run focused tests**

Run: `pnpm test -- --test-name-pattern="source-authoritative steward construction|source-authoritative stewardship Phi"`

Expected: PASS.

---

### Task 2: Atomic command, admission, replay, and restoration

**Files:**
- Modify: `src/features/play/wilds-world-service.ts`
- Modify: `src/features/play/wilds-world-authority.ts`
- Modify: `src/features/play/use-wilds-world.ts`
- Test: `tests/wilds-steward-world-service.test.ts`
- Test: `tests/wilds-steward-phi.test.ts`

**Interfaces:**
- Consumes: `createWildsTrailBridge`, current world projection, current exact material lots, current creature mandate, and current World Emission head.
- Produces: `structure.trail-bridge.build` command and `buildTrailBridge(...)` hook action returning the admitted `WildsWorldProjection`.

- [x] **Step 1: Write failing atomic-service tests**

Build six exact lots through admitted harvest commands. Submit one bridge command and assert one `structure.built` event advances the bridge, consumes all six lots once, records `140000` micro-Phi, advances the emission proof once, and restores byte-identically from checkpoint plus tail events. Assert stale/consumed lots, dry placement, invalid mandate, stale operation, forged emission, and replay-spend write no state.

- [x] **Step 2: Run the service test and confirm red**

Run: `pnpm test -- --test-name-pattern="shared-world steward commands"`

Expected: FAIL because the bridge command is not accepted.

- [x] **Step 3: Add the canonical bridge command path**

Add:

```ts
| {
    type: "structure.trail-bridge.build";
    position: { x: number; z: number };
    actorPosition: { x: number; z: number };
    rotationQuarterTurns: number;
    lotIds: string[];
    mandate: WildsCreatureMandateV1;
    cardProofDigest: string;
    operation?: WildsLivingOperationPlanV1;
    emission?: WildsWorldEmissionProofV1;
    amountPhiMicro?: string;
    phiAward?: WildsStewardPhiAwardV1;
    commandId: string;
  }
```

Derive bank samples 4 m from the center along the quarter-turn axis. Recompute the bridge, operation, emission successor, and Phi award on both client preparation and world service execution; canonical-json equality must be exact before append.

- [x] **Step 4: Preserve idempotency and outbox recovery**

Include the bridge command in steward outbox re-preparation. Keep the stable command ID on ambiguous retries and resolve the original before issuing another. Do not add polling or frame-time fetches.

- [x] **Step 5: Run focused world/economy tests**

Run: `pnpm test -- --test-name-pattern="shared-world steward commands|source-authoritative stewardship Phi|world bootstrap"`

Expected: PASS.

---

### Task 3: Cached physical bridge projection and traversal support

**Files:**
- Create: `src/features/play/wilds-structure-support.ts`
- Modify: `src/features/play/wilds-terrain-obstacles.ts`
- Modify: `src/features/play/wilds-grounded-movement.ts`
- Modify: `src/features/play/game-state.ts`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/WildsStewardEnvironment.tsx`
- Test: `tests/wilds-grounded-movement.test.ts`
- Test: `tests/wilds-steward-world-service.test.ts`
- Test: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Consumes: admitted nearby `WildsStructureV1[]` only.
- Produces: `projectWildsStructureSupports(world)`, `wildsStructureSupportAt(point, supports)`, bridge posts/rails as collision obstacles, and one shared immutable support array passed with movement inputs.

- [x] **Step 1: Write failing traversal and render tests**

Assert a non-swimming player crosses an admitted bridge footprint as `walk` at deck elevation, the same deep-water coordinate without support remains blocked by `swim`, bridge rails block leaving the deck sideways, structure support projection is deterministic, and rendering contains deck, rails, and bank footings with no generic shelter geometry.

- [x] **Step 2: Run the focused movement/render tests and confirm red**

Run: `pnpm test -- --test-name-pattern="bridge|production collision projection"`

Expected: FAIL because support surfaces do not exist.

- [x] **Step 3: Implement immutable support projection**

Use:

```ts
type WildsStructureSupport = Readonly<{
  id: string;
  structureId: string;
  deckY: number;
  center: Readonly<{ x: number; z: number }>;
  halfWidth: number;
  halfLength: number;
  rotationQuarterTurns: 0 | 1 | 2 | 3;
}>;
```

Projection runs only when the admitted snapshot changes. Point lookup is pure and bounded over nearby supports. The movement resolver treats a valid start/target bridge footprint as walkable support and returns `deckY`; it does not grant `swim` outside the exact footprint.

- [x] **Step 4: Bind support to deterministic movement input**

Extend move inputs with `structureSupports?: readonly WildsStructureSupport[]`. `dispatchWorldInput` passes the memoized projection, and `applyWildsInput` forwards it to ground movement. The reducer therefore receives the exact admitted support representation used for that move instead of reading a mutable network cache.

- [x] **Step 5: Render one physical bridge from the same dimensions**

Add reusable deck/plank, footing, post, and rail geometry to `WildsStewardEnvironment`. Use the proof-carried `deckY`, half width/length, and quarter-turn rotation. The rendered and collision projections must share constants from `wilds-structure-support.ts`.

- [x] **Step 6: Run focused tests**

Run: `pnpm test -- --test-name-pattern="bridge|grounded movement|shared-world steward commands"`

Expected: PASS.

---

### Task 4: Natural mobile build action and release verification

**Files:**
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `app/globals.css`
- Modify: `docs/receiz-decisions/2026-08-21-wilds-resource-construction-preview-boundary.md`
- Test: `tests/wilds-play-shell.test.ts`
- Test: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Consumes: exact material counts, `buildTrailBridge`, and the existing world-point placement interaction.
- Produces: a compact `Place Trail Bridge` Satchel action and one natural placement cue.

- [x] **Step 1: Write failing HUD contract tests**

Assert the Satchel exposes both shelter and bridge choices, bridge copy names exact `4 timber · 2 stone`, placement uses the existing world-point affordance, and mobile CSS uses wrapping/shrinking rather than truncation or fixed overflow.

- [x] **Step 2: Run HUD tests and confirm red**

Run: `pnpm test -- --test-name-pattern="Foraging Satchel|Trail Bridge|mobile HUD"`

Expected: FAIL because no bridge action exists.

- [x] **Step 3: Add the live bridge action**

Select the first four available timber lots and first two available stone lots in stable lot-ID order. Create the same current `build` mandate used by the shelter. Arm one placement mode at a time; selecting a nearby water crossing submits once, closes placement mode, and reports the exact settled Phi receipt. Physical failures use concise in-world causes such as “Both banks need firm ground” or “This crossing is too steep.”

- [x] **Step 4: Update the release boundary**

Record that V124 admits the narrow trail-shelter and trail-bridge steward structures through the universal kernel while the general blueprint catalog, full homesteads, excavation, and authored experiences remain preview-only.

- [x] **Step 5: Run complete verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm receiz:architecture-lock
pnpm receiz:check
pnpm secret:scan
```

Expected: all commands exit 0; test summary reports 0 failures; production build succeeds; architecture checks retain source-first authority and no hot-path network work.

- [x] **Step 6: Commit**

```bash
git add docs/superpowers/plans/2026-08-25-steward-bridge-v124.md docs/receiz-decisions/2026-08-21-wilds-resource-construction-preview-boundary.md src/features/play tests app/globals.css
git commit -m "feat: build persistent steward bridges"
```
