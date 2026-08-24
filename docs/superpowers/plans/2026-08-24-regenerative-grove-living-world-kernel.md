# Regenerative Grove and Living-World Kernel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first production-playable regenerative Grove loop on one reusable proof-native operation kernel, with cooperative creature work, deterministic Kai seasons and regional weather, persistent shared consequences, and bounded atomic Phi issuance.

**Architecture:** Pure TypeScript domain modules compile intentions into immutable operation plans and deterministically reduce admitted outcomes. The existing Wildz world event log remains the local projection boundary, while Receiz 124.0.2 plans and executes exact multi-participant operations against source proof-object heads. React and Three.js consume warmed projections only; no proof, network, climate-generation, or world-history work enters the frame loop.

**Tech Stack:** TypeScript 5.6, React 19, Next.js 15 App Router, Three.js 0.182, React Three Fiber 9, Node test runner, Receiz SDK/MCP/AI Skills 124.0.2.

**Spec:** `docs/superpowers/specs/2026-08-24-wildz-regenerative-living-world-design.md`

## Global Constraints

- The source proof object is authority; APIs, caches, projections, receipts, and meshes cannot outrank it.
- Pin `@receiz/sdk`, `@receiz/mcp-server`, and `@receiz/ai-skills` to exactly `124.0.2`.
- Preview is deterministic and zero-write; admission advances every exact participant atomically or writes nothing.
- A Receiz ID is the player's edge authority and wallet; global services synchronize admitted additions.
- Phi uses non-negative integer micro-Phi strings and can issue only from remaining World Emission capacity.
- Base creature abilities work at level one; progression improves duration, range, control, efficiency, and mastery.
- Passive offline absence never harms or kills a creature.
- Kai Month 1 Day 1 begins spring; Kai Month 8 Day 42 ends winter.
- The gameplay/render hot path performs zero network, proof verification, history scan, wallet reduction, subscription setup, and world generation work.
- New UI is diegetic, mobile-first, non-tutorial, non-zooming, and cannot overlap or truncate at supported viewport sizes.

## File Structure

- `src/features/play/wilds-living-operation.ts` — universal immutable intention, participant, consequence, and operation-plan contracts.
- `src/features/play/wilds-world-emission.ts` — bounded emission genesis, contribution scoring, preview, and admitted successor reduction.
- `src/features/play/wilds-kai-season.ts` — exact eight-month seasonal projection.
- `src/features/play/wilds-regional-weather.ts` — deterministic regional weather and Grove consequence projection.
- `src/features/play/wilds-creature-mandate.ts` — creature consent and bounded cooperative work mandates.
- `src/features/play/wilds-regenerative-grove.ts` — Grove genesis, actions, resources, structures, discoveries, and reducer.
- `src/features/play/wilds-grove-operation.ts` — compilation of a Grove action into the universal operation and Receiz registered-operation inputs.
- `src/lib/receiz/wilds-living-world-v124-runtime.ts` — durable stage/execute/resolve adapter for exact Receiz 124 operations.
- `src/features/play/WildsRegenerativeGroveEnvironment.tsx` — warmed Three.js Grove projection with no frame-time authority work.
- `src/features/play/WildsRegenerativeGroveExperience.tsx` — natural mobile interaction surface for observing and committing cooperative work.
- Existing world event/state/service/client files — add Grove commands and admitted projections without creating a parallel world store.

---

### Task 1: Pin and qualify the Receiz 124.0.2 runtime

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `scripts/receiz-v124-check.mjs`
- Modify: `src/lib/receiz/adapter.ts`
- Modify: `src/lib/receiz/v124-runtime-policy.ts`
- Test: `tests/receiz-v124-runtime-policy.test.ts`
- Create: `tests/receiz-v124-0-2-material-runtime.test.ts`

**Interfaces:**
- Consumes: official `@receiz/sdk@124.0.2` exports.
- Produces: adapter methods for material capsule/composite transport and complete living-world operation qualification.

- [ ] **Step 1: Write the failing 124.0.2 boundary test**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RECEIZ_SDK_VERSION,
  buildReceizMaterialCompositeTransport,
  encodeReceizMaterialCapsuleBytes,
  readReceizMaterialCompositePackageDigest
} from "@receiz/sdk";

describe("Receiz 124.0.2 material runtime", () => {
  it("pins 124.0.2 and carries exact material bytes beneath proof authority", async () => {
    assert.equal(RECEIZ_SDK_VERSION, "124.0.2");
    const capsuleBytes = encodeReceizMaterialCapsuleBytes({
      exactArtifactBytes: new Uint8Array([1, 2, 3]),
      filename: "grove-seed.receiz",
      mimeType: "application/vnd.receiz.proof+json"
    });
    const carried = await buildReceizMaterialCompositeTransport({
      capsuleBytes,
      sealedArtifactSha256: "a".repeat(64),
      sealedArtifactByteLength: 3,
      sealedFilename: "grove-seed.receiz",
      sealedMimeType: "application/vnd.receiz.proof+json",
      verifyPath: "/v/grove-seed",
      issuedAtKaiPulse: "1",
      issuedAtKaiUPulse: "1000000"
    });
    assert.equal(readReceizMaterialCompositePackageDigest(carried.token), carried.manifest.packageDigest);
    assert.equal(carried.manifest.authority.strongerTruth, "sealed-receiz-proof-object");
  });
});
```

- [ ] **Step 2: Run the test and verify the old SDK fails the import/version assertion**

Run: `npx tsx --test tests/receiz-v124-0-2-material-runtime.test.ts`

Expected: FAIL because 124.0.1 does not export the material transport primitives.

- [ ] **Step 3: Upgrade all three Receiz packages and expose only exact SDK forwards**

Run: `pnpm add @receiz/sdk@124.0.2 --save-exact`

Run: `pnpm add -D @receiz/mcp-server@124.0.2 @receiz/ai-skills@124.0.2 --save-exact`

Add adapter signatures by referencing `ReceizClient` or imported SDK function types; do not fork material encoding logic in Wildz. Extend `WILDZ_V124_WORLD_OPERATIONS` only with official operation identifiers already exported by 124.0.2.

- [ ] **Step 4: Run focused tests and the SDK checker**

Run: `npx tsx --test tests/receiz-v124-0-2-material-runtime.test.ts tests/receiz-v124-runtime-policy.test.ts`

Run: `pnpm receiz:check`

Expected: PASS with all packages reporting `124.0.2`.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml scripts/receiz-v124-check.mjs src/lib/receiz/adapter.ts src/lib/receiz/v124-runtime-policy.ts tests/receiz-v124-0-2-material-runtime.test.ts tests/receiz-v124-runtime-policy.test.ts
git commit -m "chore: upgrade Receiz runtime to 124.0.2"
```

### Task 2: Project exact Kai seasons and deterministic regional weather

**Files:**
- Create: `src/features/play/wilds-kai-season.ts`
- Create: `src/features/play/wilds-regional-weather.ts`
- Create: `tests/wilds-kai-season.test.ts`
- Create: `tests/wilds-regional-weather.test.ts`

**Interfaces:**
- Consumes: `KaiKlokMoment`, `WildsBiome`, region coordinates, elevation, water proximity, and admitted ecology head.
- Produces: `projectWildsKaiSeason(moment)` and `projectWildsRegionalWeather(input)`.

- [ ] **Step 1: Write failing season-boundary tests with hand-derived expectations**

```ts
assert.deepEqual(projectWildsKaiSeason({ month: 1, day: 1 }), {
  season: "spring", seasonIndex: 0, dayOfSeason: 1, daysInSeason: 84, progress: 0
});
assert.equal(projectWildsKaiSeason({ month: 8, day: 42 }).season, "winter");
assert.equal(projectWildsKaiSeason({ month: 8, day: 42 }).dayOfSeason, 84);
assert.throws(() => projectWildsKaiSeason({ month: 9, day: 1 }), /kai_calendar_invalid/);
```

- [ ] **Step 2: Run season tests and verify the module-not-found failure**

Run: `npx tsx --test tests/wilds-kai-season.test.ts`

Expected: FAIL because the projection does not exist.

- [ ] **Step 3: Implement the pure seasonal projection**

```ts
export type WildsSeason = "spring" | "summer" | "autumn" | "winter";
export function projectWildsKaiSeason(input: Readonly<{ month: number; day: number }>): WildsKaiSeasonProjection;
```

Use two 42-day months per season and compute `progress = (dayOfSeason - 1) / 83`, so the first day is exactly `0` and final day exactly `1`.

- [ ] **Step 4: Write failing regional-weather tests**

Cover same-input byte equality, simultaneous mountain snow/coastal rain, biome-specific seasonal expression, weather moving only when the Kai bucket changes, and no use of `Date.now`, `fetch`, timers, or mutable random state.

- [ ] **Step 5: Run weather tests and verify the missing behavior failure**

Run: `npx tsx --test tests/wilds-regional-weather.test.ts`

Expected: FAIL because `projectWildsRegionalWeather` is absent.

- [ ] **Step 6: Implement weather as a frozen deterministic projection**

```ts
export function projectWildsRegionalWeather(input: Readonly<{
  moment: KaiKlokMoment;
  region: Readonly<{ x: number; z: number }>;
  biome: WildsBiome;
  elevation: number;
  waterProximity: number;
  ecologyHead: string;
}>): WildsRegionalWeather;
```

Derive a stable weather-cell digest from exact input, then project temperature band, precipitation, wind vector/strength, visibility, soil moisture delta, pollination multiplier, flight modifier, current modifier, hazard cues, and the next change uPulse.

- [ ] **Step 7: Run both test files and commit**

Run: `npx tsx --test tests/wilds-kai-season.test.ts tests/wilds-regional-weather.test.ts`

```bash
git add src/features/play/wilds-kai-season.ts src/features/play/wilds-regional-weather.ts tests/wilds-kai-season.test.ts tests/wilds-regional-weather.test.ts
git commit -m "feat: add Kai seasonal regional weather authority"
```

### Task 3: Build the universal living-world operation compiler

**Files:**
- Create: `src/features/play/wilds-living-operation.ts`
- Create: `tests/wilds-living-operation.test.ts`

**Interfaces:**
- Produces: `compileWildsLivingOperation(input)`, `verifyWildsLivingOperationPlan(plan)`, `WildsLivingOperationPlanV1`, `WildsContributionVectorV1`.
- Consumed by: emission, Grove, Receiz execution, and future construction/excavation plans.

- [ ] **Step 1: Write failing compiler tests**

```ts
const plan = compileWildsLivingOperation({
  operationId: "grove:pollinate:one",
  category: "ecology",
  intention: { kind: "grove.pollinate", regionId: "region:0:0", featureId: "grove:one" },
  participants: [
    { id: "player:one", kind: "player", expectedHead: "a".repeat(64), role: "steward" },
    { id: "creature:bee", kind: "creature", expectedHead: "b".repeat(64), role: "pollinator" }
  ],
  stages: [{ id: "stage:pollinate", profession: "pollinate", participantIds: ["player:one", "creature:bee"] }],
  consequences: { usefulOutput: 2, ecologicalRenewal: 5, publicBenefit: 1, cooperation: 2, durability: 1, extraction: 0, damage: 0, waste: 0, restorationDebt: 0 },
  kaiUPulse: 1_000_000,
  expiresAtKaiUPulse: 2_000_000,
  semanticIdempotencyKey: "wildz:grove:pollinate:one"
});
assert.equal(plan.participants.length, 2);
assert.equal(plan.netContribution, 11);
assert.equal(verifyWildsLivingOperationPlan(plan).ok, true);
```

Also prove participant order cannot change the digest, duplicate IDs fail, a missing stage participant fails, non-integer consequence values fail, expiry must follow issue time, and the input objects remain unchanged.

- [ ] **Step 2: Run and verify RED**

Run: `npx tsx --test tests/wilds-living-operation.test.ts`

Expected: FAIL because the compiler is missing.

- [ ] **Step 3: Implement the immutable compiler**

```ts
export type WildsContributionVectorV1 = Readonly<{
  usefulOutput: number;
  ecologicalRenewal: number;
  publicBenefit: number;
  cooperation: number;
  durability: number;
  extraction: number;
  damage: number;
  waste: number;
  restorationDebt: number;
}>;

export function compileWildsLivingOperation(input: WildsLivingOperationInputV1): WildsLivingOperationPlanV1;
export function verifyWildsLivingOperationPlan(value: unknown): Readonly<{ ok: boolean; errors: readonly string[] }>;
```

Canonicalize participant and stage lists, bind every byte into `planDigest`, freeze recursively, and retain `writes: 0` plus `authority: "source-proof-objects"` on the preview.

- [ ] **Step 4: Run tests, mutation-check digest/participant validation, and commit**

Run: `npx tsx --test tests/wilds-living-operation.test.ts`

```bash
git add src/features/play/wilds-living-operation.ts tests/wilds-living-operation.test.ts
git commit -m "feat: add universal living-world operation compiler"
```

### Task 4: Implement bounded World Emission authority

**Files:**
- Create: `src/features/play/wilds-world-emission.ts`
- Create: `tests/wilds-world-emission.test.ts`

**Interfaces:**
- Consumes: verified living-operation plans and exact emission heads.
- Produces: `createWildsWorldEmissionGenesis`, `previewWildsEmission`, `admitWildsEmission`, and immutable successor proof objects.

- [ ] **Step 1: Write failing emission-law tests**

Use literal fixtures to prove:

```ts
assert.deepEqual(previewWildsEmission({ emission, operation: regenerativePlan }), {
  eligible: true,
  amountPhiMicro: "110000",
  sourceHead: emission.head,
  reason: null,
  writes: 0
});
```

Also prove extraction-only work issues `0`, artificial damage-and-repair issues `0`, repetition against one causal state issues once, region/class/global ceilings bind, restoration debt reduces the award, cooperative credit requires two necessary distinct participants, and admission advances both remaining capacity and consumed operation IDs exactly once.

- [ ] **Step 2: Run and verify RED**

Run: `npx tsx --test tests/wilds-world-emission.test.ts`

Expected: FAIL because emission authority is missing.

- [ ] **Step 3: Implement integer-only emission genesis, preview, and reducer**

```ts
export function createWildsWorldEmissionGenesis(input: Readonly<{
  epochId: string;
  epochEndsAtKaiUPulse: number;
  globalCapacityPhiMicro: string;
  regionCapacityPhiMicro: Readonly<Record<string, string>>;
  classCapacityPhiMicro: Readonly<Record<WildsContributionClass, string>>;
  policyDigest: string;
}>): WildsWorldEmissionProofV1;

export function previewWildsEmission(input: Readonly<{
  emission: WildsWorldEmissionProofV1;
  operation: WildsLivingOperationPlanV1;
  contributionClass: WildsContributionClass;
}>): WildsEmissionPreviewV1;
```

Use BigInt micro-Phi arithmetic. Preview returns no successor. `admitWildsEmission` requires the exact preview, re-verifies its digest and source head, and produces one frozen append-only successor.

- [ ] **Step 4: Run tests and commit**

Run: `npx tsx --test tests/wilds-world-emission.test.ts tests/wilds-living-operation.test.ts`

```bash
git add src/features/play/wilds-world-emission.ts tests/wilds-world-emission.test.ts
git commit -m "feat: add bounded World Emission proof authority"
```

### Task 5: Add sovereign creature consent and cooperative mandates

**Files:**
- Create: `src/features/play/wilds-creature-mandate.ts`
- Modify: `src/features/play/wilds-creature-work.ts`
- Create: `tests/wilds-creature-mandate.test.ts`
- Modify: `tests/wilds-creature-work.test.ts`

**Interfaces:**
- Consumes: creature head, condition, bond, preferences, capabilities, safety, work stages, bounds, and current Kai uPulse.
- Produces: `evaluateWildsCreatureConsent`, `createWildsCreatureMandate`, `reverifyWildsCreatureMandate`, and team-stage assignments.

- [ ] **Step 1: Write failing consent and mandate tests**

Prove a rested bonded pollinator accepts safe Grove work, an exhausted creature pauses, an afraid creature refuses unsafe fire work, revoked/expired/stale mandates cannot execute, a mandate cannot expand its area/actions/resources, and offline elapsed time alone changes no condition.

```ts
assert.equal(evaluateWildsCreatureConsent(safePollination).decision, "accept");
assert.equal(evaluateWildsCreatureConsent({ ...safePollination, condition: { ...condition, energy: 4 } }).decision, "pause");
assert.equal(reverifyWildsCreatureMandate(revokedMandate, exactHeads).ok, false);
```

- [ ] **Step 2: Run and verify RED**

Run: `npx tsx --test tests/wilds-creature-mandate.test.ts`

Expected: FAIL because the mandate module is missing.

- [ ] **Step 3: Implement deterministic consent and mandate sealing**

```ts
export function evaluateWildsCreatureConsent(input: WildsCreatureConsentInputV1): WildsCreatureConsentProjectionV1;
export function createWildsCreatureMandate(input: WildsCreatureMandateInputV1): WildsCreatureMandateV1;
export function reverifyWildsCreatureMandate(mandate: WildsCreatureMandateV1, current: WildsCreatureMandateCurrentHeads): WildsCreatureMandateVerification;
```

The result must distinguish `accept`, `pause`, `request-help`, and `refuse`, with physical/relational reasons suitable for diegetic presentation. It may not use wall-clock absence as a negative input.

- [ ] **Step 4: Adapt work-plan compilation to consume accepted mandates without removing preview compatibility**

Add an optional exact mandate to the work-plan input. When supplied, require matching creature heads, professions, region, action budget, and expiry; keep legacy preview tests green until live Grove callers migrate.

- [ ] **Step 5: Run tests and commit**

Run: `npx tsx --test tests/wilds-creature-mandate.test.ts tests/wilds-creature-work.test.ts`

```bash
git add src/features/play/wilds-creature-mandate.ts src/features/play/wilds-creature-work.ts tests/wilds-creature-mandate.test.ts tests/wilds-creature-work.test.ts
git commit -m "feat: add sovereign creature work mandates"
```

### Task 6: Build the complete Regenerative Grove domain loop

**Files:**
- Create: `src/features/play/wilds-regenerative-grove.ts`
- Create: `src/features/play/wilds-grove-operation.ts`
- Create: `tests/wilds-regenerative-grove.test.ts`
- Create: `tests/wilds-grove-operation.test.ts`

**Interfaces:**
- Consumes: Kai season/weather, world/region head, player, creature mandate, exact inventory/material heads, and Grove head.
- Produces: deterministic Grove genesis, previews, operations, discoveries, structures, resource transforms, and admitted successors.

- [ ] **Step 1: Write failing Grove genesis and observation tests**

Prove identical region/head/Kai inputs produce identical Grove identity; different regions produce different identities; observation reveals soil, moisture, maturity, flowers, pollinators, nourishment, weather, and available natural actions without a write.

- [ ] **Step 2: Run genesis tests and verify RED**

Run: `npx tsx --test tests/wilds-regenerative-grove.test.ts`

Expected: FAIL because the Grove module is missing.

- [ ] **Step 3: Implement Grove genesis and frozen projection**

```ts
export type WildsGroveActionKind =
  | "observe" | "gather" | "pollinate" | "sow" | "water"
  | "compost" | "cultivate" | "transform-nectar" | "harvest-honey"
  | "build-hive" | "build-nursery" | "repair";

export function projectWildsRegenerativeGrove(input: WildsGroveProjectionInputV1): WildsRegenerativeGroveV1;
export function previewWildsGroveAction(input: WildsGroveActionInputV1): WildsGroveActionPreviewV1;
export function admitWildsGroveAction(input: WildsGroveAdmissionInputV1): WildsRegenerativeGroveV1;
```

- [ ] **Step 4: Add failing full-loop tests**

Cover the causal path `observe -> gather fallen pollen -> pollinate -> sow -> transform nectar -> build hive -> harvest honey`, including exact material conservation, creature consent, weather multipliers, ecological renewal, public benefit, unique discovery conditions, and restoration debt for overharvesting.

- [ ] **Step 5: Implement the minimal full loop and operation compilation**

Each action returns a `WildsLivingOperationPlanV1`. A qualifying operation receives a `WildsEmissionPreviewV1`; a nonqualifying useful action remains admissible with `amountPhiMicro: "0"`. No action mutates its inputs.

- [ ] **Step 6: Run domain tests and commit**

Run: `npx tsx --test tests/wilds-regenerative-grove.test.ts tests/wilds-grove-operation.test.ts tests/wilds-world-emission.test.ts tests/wilds-creature-mandate.test.ts`

```bash
git add src/features/play/wilds-regenerative-grove.ts src/features/play/wilds-grove-operation.ts tests/wilds-regenerative-grove.test.ts tests/wilds-grove-operation.test.ts
git commit -m "feat: add the regenerative Grove causal loop"
```

### Task 7: Admit Grove consequences into the existing shared world projection

**Files:**
- Modify: `src/features/play/wilds-world-event.ts`
- Modify: `src/features/play/wilds-world-state.ts`
- Modify: `src/features/play/wilds-world-service.ts`
- Modify: `src/features/play/wilds-world-authority.ts`
- Modify: `src/features/play/wilds-world-outbox.ts`
- Modify: `src/features/play/use-wilds-world.ts`
- Modify: `tests/wilds-world-event.test.ts`
- Modify: `tests/wilds-world-service.test.ts`
- Create: `tests/wilds-grove-world-integration.test.ts`

**Interfaces:**
- Adds commands: `grove.observe`, `grove.act`.
- Adds event kinds: `grove.discovered`, `grove.operation_admitted`.
- Adds projection maps: `groves`, `livingOperations`, `worldEmission`.

- [ ] **Step 1: Write failing replay/integration tests**

Construct a world service, discover one Grove, admit one pollination operation, checkpoint/replay, and assert byte-identical Grove, operation, emission, cursor, and contribution history. Re-submit the same `commandId` and prove revision/material/Phi do not advance twice.

- [ ] **Step 2: Run and verify RED**

Run: `npx tsx --test tests/wilds-grove-world-integration.test.ts`

Expected: FAIL because the event and command kinds are unknown.

- [ ] **Step 3: Extend event validation and the pure world reducer**

```ts
type GroveDiscoveredPayload = Readonly<{ grove: WildsRegenerativeGroveV1 }>;
type GroveOperationAdmittedPayload = Readonly<{
  operation: WildsLivingOperationPlanV1;
  grove: WildsRegenerativeGroveV1;
  emission: WildsWorldEmissionProofV1;
  amountPhiMicro: string;
}>;
```

Reject a payload whose successor heads/digests do not match deterministic re-admission. Keep the projection schema backward-readable by defaulting absent Grove fields during legacy checkpoint hydration.

- [ ] **Step 4: Add service commands and client/outbox methods**

```ts
discoverGrove(regionId: string, position: { x: number; z: number }): Promise<WildsWorldProjection>;
actInGrove(input: WildsGroveClientAction): Promise<WildsWorldProjection>;
```

All commands carry exact Kai temporal roots and stable command IDs. Optimistic projection may show a staged action but cannot show issued Phi before committed admission.

- [ ] **Step 5: Run world, replay, hydration, and outbox tests**

Run: `npx tsx --test tests/wilds-grove-world-integration.test.ts tests/wilds-world-event.test.ts tests/wilds-world-service.test.ts tests/wilds-world-hydration.test.ts tests/wilds-world-outbox.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/features/play/wilds-world-event.ts src/features/play/wilds-world-state.ts src/features/play/wilds-world-service.ts src/features/play/wilds-world-authority.ts src/features/play/wilds-world-outbox.ts src/features/play/use-wilds-world.ts tests/wilds-world-event.test.ts tests/wilds-world-service.test.ts tests/wilds-grove-world-integration.test.ts
git commit -m "feat: persist Grove operations in the shared world"
```

### Task 8: Execute exact Grove operations through Receiz 124

**Files:**
- Create: `src/lib/receiz/wilds-living-world-v124-runtime.ts`
- Create: `src/lib/receiz/wilds-world-emission-source.ts`
- Modify: `src/lib/receiz/wilds-world-server.ts`
- Modify: `app/api/wilds/world/command/route.ts`
- Create: `tests/wilds-living-world-v124-runtime.test.ts`
- Modify: `tests/wilds-world-bootstrap.test.ts`

**Interfaces:**
- Consumes: exact Grove operation preview, World Emission source, player/creature/material/world heads, proof-session actor, and Receiz V124 execution rail.
- Produces: committed admitted world projection, verified zero-write outcome, or resolvable unknown outcome keyed by semantic idempotency.

- [ ] **Step 1: Write failing runtime tests against a complete in-memory port**

Test committed, stale-head, missing-participant, insufficient-emission, unknown-then-resolved, idempotent retry, and receipt/projection mismatch paths. Assert on returned world/emission/player heads, not mock call counts.

- [ ] **Step 2: Run and verify RED**

Run: `npx tsx --test tests/wilds-living-world-v124-runtime.test.ts`

Expected: FAIL because the runtime does not exist.

- [ ] **Step 3: Compile exact registered operations**

Create one operation per affected category:

```ts
const categories = ["world", "subject", "inventory", "settlement"] as const;
```

Omit `settlement` when the lawful amount is `"0"`. Derive CAS participants and heads with `deriveReceizRegisteredOperationCasV124`, then call `planAtomicOperationV124` with one semantic idempotency key and attempt ID.

- [ ] **Step 4: Implement durable stage/execute/resolve**

Use adapter forwards `stageExecutionV124`, `executeV124`, `resolveExecutionV124`, and `resolveExecutionByIdempotencyV124`. Admit only a committed outcome whose exact plan digest and committed participant heads match. Return the SDK's verified zero-write reason unchanged. Resolve an ambiguous execution before permitting retry.

- [ ] **Step 5: Bind the command route to proof-session authority and canonical publication**

For `grove.act`, execute the atomic Receiz operation before publishing its resulting world projection. If execution is zero-write or unknown, do not append a local canonical world event. Practice mode may project the loop but must show `amountPhiMicro: "0"` and cannot publish or settle.

- [ ] **Step 6: Run runtime and route tests, then commit**

Run: `npx tsx --test tests/wilds-living-world-v124-runtime.test.ts tests/wilds-world-bootstrap.test.ts tests/wilds-grove-world-integration.test.ts`

```bash
git add src/lib/receiz/wilds-living-world-v124-runtime.ts src/lib/receiz/wilds-world-emission-source.ts src/lib/receiz/wilds-world-server.ts app/api/wilds/world/command/route.ts tests/wilds-living-world-v124-runtime.test.ts tests/wilds-world-bootstrap.test.ts
git commit -m "feat: execute Grove work atomically through Receiz"
```

### Task 9: Render and play the Grove naturally on mobile

**Files:**
- Create: `src/features/play/WildsRegenerativeGroveEnvironment.tsx`
- Create: `src/features/play/WildsRegenerativeGroveExperience.tsx`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/wilds-context-action.ts`
- Modify: `app/globals.css`
- Create: `tests/wilds-regenerative-grove-ui.test.tsx`
- Modify: `tests/wilds-context-action.test.ts`
- Modify: `tests/wilds-render-hot-path.test.ts`

**Interfaces:**
- Consumes: warmed `groves` projection, current regional weather, selected creature capabilities/condition, and `useWildsWorld().actInGrove`.
- Produces: physical Grove visuals, contextual actions, zero-write previews, consent cues, cooperative progress, and committed-result presentation.

- [ ] **Step 1: Write failing SSR UI and hot-path tests**

Assert the experience presents current natural cues, participating creatures, needed help/materials, ecological consequence, and exact Phi source without tutorial/SDK jargon. Assert 16px-or-larger input text, touch targets, no fixed-width overflow, and no publish/authority work in the render/frame functions.

- [ ] **Step 2: Run and verify RED**

Run: `npx tsx --test tests/wilds-regenerative-grove-ui.test.tsx tests/wilds-render-hot-path.test.ts`

Expected: FAIL because the components are missing.

- [ ] **Step 3: Implement the warmed Three.js Grove projection**

Render trees, flowers, soil/moisture, pollinators, hive/nursery/irrigation stages, and regional weather from memoized geometry/materials and frozen projection data. Reuse mutable frame runtimes for wind/pollinator motion; dispose owned resources on unmount.

- [ ] **Step 4: Implement contextual mobile interaction**

The nearby context action opens a natural Grove surface. Show the intended result first, then creature response, other-player cooperation needs, material flow, ecological change, and possible bounded Phi. Use physical language such as “The roots need water” or “Your companion is tired,” never “permission denied” for natural constraints.

- [ ] **Step 5: Integrate committed outcomes and staged recovery**

Disable duplicate submission while one command ID is pending. A committed result closes or advances the surface and updates from the shared projection. Unknown/reconnecting state preserves the staged plan and offers resolution without fabricating success.

- [ ] **Step 6: Run UI tests and commit**

Run: `npx tsx --test tests/wilds-regenerative-grove-ui.test.tsx tests/wilds-context-action.test.ts tests/wilds-render-hot-path.test.ts`

```bash
git add src/features/play/WildsRegenerativeGroveEnvironment.tsx src/features/play/WildsRegenerativeGroveExperience.tsx src/features/play/WildsWorldCanvas.tsx src/features/play/PlayCampaign.tsx src/features/play/wilds-context-action.ts app/globals.css tests/wilds-regenerative-grove-ui.test.tsx tests/wilds-context-action.test.ts tests/wilds-render-hot-path.test.ts
git commit -m "feat: make the regenerative Grove playable"
```

### Task 10: Prove continuity, multiplayer convergence, and zero-latency release quality

**Files:**
- Create: `tests/wilds-grove-continuity.test.ts`
- Create: `tests/wilds-grove-multiplayer.test.ts`
- Create: `tests/wilds-grove-performance.test.ts`
- Modify: `scripts/receiz-architecture-lock.mjs`
- Modify: `docs/receiz-decisions/2026-08-21-wilds-resource-construction-preview-boundary.md`

**Interfaces:**
- Consumes: all completed Grove/kernel behavior.
- Produces: release gates preventing projection authority, duplicate work, refresh loss, multiplayer divergence, or frame-time latency.

- [ ] **Step 1: Write failing continuity and convergence tests**

Prove export/import, checkpoint/replay, refresh hydration, and device switching restore exact Grove, creature mandate, inventory, discovery, structure, operation, emission, and cursor heads. Prove two clients replaying the same additions converge byte-for-byte and a competing stale action writes nothing.

- [ ] **Step 2: Run and verify RED against any missing continuity behavior**

Run: `npx tsx --test tests/wilds-grove-continuity.test.ts tests/wilds-grove-multiplayer.test.ts`

Expected: FAIL on the first unimplemented persistence or convergence contract.

- [ ] **Step 3: Close only the observed persistence/convergence gaps**

Keep source proofs and event history canonical. Add only bounded indexes/checkpoints required for immediate hydration; do not add polling, a second mutable store, or server-calculated authority.

- [ ] **Step 4: Write and run the 10,000-tick performance contract**

Instrument network, verifier, history reducer, wallet/emission reducer, worker creation, timers, and subscription creation. Warm the Grove projection once, execute 10,000 movement/render updates, and assert every authority-work counter remains zero.

Run: `npx tsx --test tests/wilds-grove-performance.test.ts tests/wilds-render-hot-path.test.ts tests/wilds-runtime-latency.test.ts`

- [ ] **Step 5: Extend architecture locks and retire the preview-only boundary for the Grove only**

Update the boundary decision to state that general construction/excavation remains scoped to later plans while the Grove's exact actions are now admitted through the universal kernel. Architecture locks must reject `Math.random`, frame-time `fetch`, projection-as-authority copy, floating-point Phi, and a `blocked-receiz-v122` marker in the live Grove path.

- [ ] **Step 6: Run full verification**

Run each command independently:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm receiz:check
pnpm receiz:architecture-lock
```

Expected: every command exits `0` with no type, lint, build, Receiz, or architecture failures.

- [ ] **Step 7: Run mobile browser verification**

Verify at minimum iPhone-class 390×844 and narrow 320×568 viewports: enter a Grove, inspect weather, choose a creature, preview work, commit one action, refresh, reopen, and confirm exact state with no zoom, overlap, truncation, text-selection menu, duplicate submission, or visible geometry pop-in.

- [ ] **Step 8: Commit the release slice**

```bash
git add tests/wilds-grove-continuity.test.ts tests/wilds-grove-multiplayer.test.ts tests/wilds-grove-performance.test.ts scripts/receiz-architecture-lock.mjs docs/receiz-decisions/2026-08-21-wilds-resource-construction-preview-boundary.md
git commit -m "test: lock regenerative Grove release guarantees"
```
