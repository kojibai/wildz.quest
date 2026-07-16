# Wildz Games Kernel and Living Creature Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the lightweight deterministic game kernel and artifact-first creature lifecycle shared by Mortal Arena and every later Wildz game.

**Architecture:** Game modules operate on admitted immutable creature snapshots through a fixed-timestep reducer and emit proposed life events. A separate lifecycle authority validates and atomically appends those events to the card and proof-sealed Vault revision chains. Offline play uses the same artifacts and causal merge rules as online verification.

**Tech Stack:** TypeScript 5.6, React 19, Next.js 15, Receiz SDK 104, Web Crypto, IndexedDB, Node test runner.

## Global Constraints

- One living creature truth is shared by all games; modules cannot fork card state.
- Game simulation is deterministic, bounded, replayable, versioned, and independent of Three.js rendering.
- Offline progress is saved inside the card artifact and Vault artifact before UI success is shown.
- Retirement is canonical and irreversible; stale living branches can never resurrect a retired card.
- Ownership and settlement conflicts fail closed.
- Cosmetic presentation cannot affect competitive results.
- No new runtime dependency and no monolithic game bundle.

---

### Task 1: Deterministic Game Module Contract

**Files:**
- Create: `src/features/games/kernel/game-module.ts`
- Create: `src/features/games/kernel/fixed-step.ts`
- Create: `src/features/games/kernel/deterministic-number.ts`
- Test: `tests/wildz-game-kernel.test.ts`

**Interfaces:**
- Produces: `WildzGameModule<Setup, State, Input, Result, Event>`, `WildzInputFrame<Input>`, `WildzGameSnapshot<State>`, `runFixedSteps`, `toFixed`, and `fromFixed`.

- [ ] **Step 1: Write failing determinism and cap tests**

```ts
test("replay produces an identical digest on repeated runs", async () => {
  const left = replayGame(testModule, setup, frames);
  const right = replayGame(testModule, setup, frames);
  assert.equal(left.snapshot.digest, right.snapshot.digest);
  assert.throws(() => replayGame(testModule, setup, tooManyFrames), /input cap/i);
});
```

- [ ] **Step 2: Implement the contract and fixed-point helpers**

```ts
export type WildzGameModule<S, State, Input, Result, Event> = {
  id: string; rulesVersion: string; tickRate: number;
  limits: { maxTicks: number; maxInputs: number; maxEntities: number };
  create(setup: S): State;
  step(state: Readonly<State>, frames: readonly WildzInputFrame<Input>[]): State;
  complete(state: Readonly<State>): Result | null;
  propose(result: Result): readonly Event[];
};
```

Use signed integer fixed-point values at scale 1,000 inside authoritative state. Sort actors and inputs by stable IDs and sequence before every step.

- [ ] **Step 3: Verify and commit**

Run: `pnpm test && pnpm typecheck`
Expected: kernel tests pass.

```bash
git add src/features/games/kernel tests/wildz-game-kernel.test.ts
git commit -m "feat: add deterministic Wildz game kernel"
```

### Task 2: Admitted Creature Runtime Snapshot

**Files:**
- Create: `src/features/games/creature/creature-runtime.ts`
- Create: `src/features/games/creature/creature-collision.ts`
- Modify: `src/features/play/living-card-types.ts`
- Test: `tests/wildz-creature-runtime.test.ts`

**Interfaces:**
- Produces: `WildzCreatureRuntimeSnapshot`, `admitCreatureRuntime(card, proof)`, and `projectCreatureCollision(snapshot)`.

- [ ] **Step 1: Write failing card projection tests**

```ts
test("projects the same playable body from the same verified card revision", () => {
  const one = admitCreatureRuntime(card, proof);
  const two = admitCreatureRuntime(structuredClone(card), proof);
  assert.deepEqual(one, two);
  assert.equal(one.sourceRevisionDigest, proof.revisionDigest);
});
```

- [ ] **Step 2: Implement immutable projection**

```ts
export type WildzCreatureRuntimeSnapshot = {
  creatureId: string; sourceRevisionDigest: string; retired: boolean;
  stats: { vitality: number; maxVitality: number; power: number; guard: number; speed: number; focus: number };
  body: { mass: number; reach: number; radius: number; height: number; aerialControl: number };
  abilities: readonly [WildzRuntimeAbility, WildzRuntimeAbility];
  affinity: string; temperament: string; conditionTags: readonly string[];
};
```

Reject invalid proof, owner mismatch, incompatible schema, and retired cards. Derive numbers only from canonical card fields with declared bounds.

- [ ] **Step 3: Verify and commit**

Run: `pnpm test && pnpm typecheck`
Expected: runtime projection tests pass.

```bash
git add src/features/games/creature src/features/play/living-card-types.ts tests/wildz-creature-runtime.test.ts
git commit -m "feat: project verified cards into game creatures"
```

### Task 3: Condition, Recovery, Evolution, and Visible History

**Files:**
- Create: `src/features/games/lifecycle/creature-life-event.ts`
- Create: `src/features/games/lifecycle/creature-condition.ts`
- Create: `src/features/games/lifecycle/creature-appearance.ts`
- Modify: `src/features/play/heartbound-anime-genome.ts`
- Test: `tests/wildz-creature-lifecycle.test.ts`

**Interfaces:**
- Produces: `WildzCreatureLifeEvent`, `applyCreatureLifeEvent`, `projectCreatureCondition`, and `projectCreatureAppearanceHistory`.

- [ ] **Step 1: Write failing injury/recovery tests**

```ts
test("recovery restores function but preserves earned visible history", () => {
  const injured = applyCreatureLifeEvent(baseLife, injuryEvent);
  const recovered = applyCreatureLifeEvent(injured, recoveryEvent);
  assert.ok(recovered.condition.vitality > injured.condition.vitality);
  assert.ok(projectCreatureAppearanceHistory(recovered).marks.some((mark) => mark.kind === "repaired-scar"));
});
```

- [ ] **Step 2: Implement ordered life events**

```ts
export type WildzCreatureLifeEvent = {
  eventId: string; creatureId: string; sourceGameId: string; sourceReceiptDigest: string;
  sequence: number; occurredAt: string;
  kind: "xp" | "bond" | "injury" | "recovery" | "evolution" | "scar" | "victory" | "loss" | "retreat" | "retirement";
  payload: Readonly<Record<string, string | number | boolean>>;
};
```

Clamp healing to declared maximum, require resources and elapsed rest when specified, preserve scar and achievement append history, and project changes into modular anatomy parameters rather than storing rendered geometry.

- [ ] **Step 3: Verify and commit**

Run: `pnpm test && pnpm typecheck`
Expected: lifecycle and genome tests pass.

```bash
git add src/features/games/lifecycle src/features/play/heartbound-anime-genome.ts tests/wildz-creature-lifecycle.test.ts
git commit -m "feat: make creature history physically visible"
```

### Task 4: Canonical Retirement and Memorial Projection

**Files:**
- Create: `src/features/games/lifecycle/creature-retirement.ts`
- Create: `src/features/games/lifecycle/creature-memorial.ts`
- Modify: `src/features/play/living-card-proof.ts`
- Test: `tests/wildz-creature-retirement.test.ts`

**Interfaces:**
- Produces: `proposeRetirement`, `sealRetirement`, `assertCreaturePlayable`, and `projectCreatureMemorial`.

- [ ] **Step 1: Write failing irreversible retirement tests**

```ts
test("retirement dominates every stale living revision", () => {
  const retired = sealRetirement(livingCard, proposal, witness);
  assert.throws(() => assertCreaturePlayable(retired.card), /canonically retired/i);
  assert.equal(mergeCreatureBranches(retired.card, staleLivingCard).status, "retired");
});
```

- [ ] **Step 2: Implement the sealed append**

```ts
export type WildzRetirementRecord = {
  creatureId: string; finalRevisionDigest: string; matchReceiptDigest: string;
  cause: "mortal-arena-zero-vitality"; teamOutcome: "victory" | "defeat" | "draw";
  honor: "fallen" | "victorious-sacrifice"; retiredAt: string;
  previousRevisionDigest: string; sealDigest: string;
};
```

The living card remains in the Vault with `playable: false`, a memorial appearance, immutable history, and no revive path. Only a verified zero-Vitality mortal result can produce this record.

- [ ] **Step 3: Verify and commit**

Run: `pnpm test && pnpm typecheck`
Expected: retirement tests pass.

```bash
git add src/features/games/lifecycle src/features/play/living-card-proof.ts tests/wildz-creature-retirement.test.ts
git commit -m "feat: seal canonical creature retirement"
```

### Task 5: Atomic Card and Vault Artifact Store

**Files:**
- Create: `src/features/games/artifacts/wildz-artifact-store.ts`
- Modify: `src/features/play/wilds-player-vault.ts`
- Modify: `src/features/play/portable-card.ts`
- Test: `tests/wildz-artifact-store.test.ts`

**Interfaces:**
- Produces: `openWildzArtifactStore`, `commitLifeEventsAtomically`, `readCreatureArtifact`, and `readVaultArtifact`.

- [ ] **Step 1: Write failing transaction rollback tests**

```ts
test("never commits a card without its matching Vault revision", async () => {
  store.failAfterCardWrite = true;
  await assert.rejects(commitLifeEventsAtomically(store, transaction));
  assert.equal((await readCreatureArtifact(store, creatureId)).revision, beforeCard.revision);
  assert.equal((await readVaultArtifact(store)).revision, beforeVault.revision);
});
```

- [ ] **Step 2: Implement one IndexedDB transaction**

Commit card revision, Vault revision, event batch, pending receipt, and previous digests in one `readwrite` transaction. Re-read expected heads inside the transaction and abort on mismatch or quota error.

- [ ] **Step 3: Verify and commit**

Run: `pnpm test && pnpm typecheck`
Expected: atomicity tests pass.

```bash
git add src/features/games/artifacts src/features/play/wilds-player-vault.ts src/features/play/portable-card.ts tests/wildz-artifact-store.test.ts
git commit -m "feat: save card and Vault progress atomically"
```

### Task 6: Causal Offline Synchronization

**Files:**
- Create: `src/features/games/artifacts/wildz-artifact-sync.ts`
- Modify: `src/features/play/wilds-portable-reconciliation.ts`
- Create: `app/api/wilds/artifacts/sync/route.ts`
- Test: `tests/wildz-artifact-sync.test.ts`

**Interfaces:**
- Produces: `mergeArtifactBranches`, `syncArtifactHeads`, and POST `/api/wilds/artifacts/sync`.

- [ ] **Step 1: Write failing branch-rule tests**

```ts
test("merges XP but never loses injury, spending, or retirement", () => {
  const merged = mergeArtifactBranches(serverBranch, offlineBranch);
  assert.equal(merged.xp, serverBranch.xp + offlineBranch.newXp);
  assert.ok(merged.injuries.includes("fractured-horn"));
  assert.equal(merged.retired, true);
});
```

- [ ] **Step 2: Implement causal merge**

Fast-forward ancestor branches. Merge commutative XP/history by event ID. Take the stricter condition for unresolved injury and spent resource totals. Retirement wins over living state. Owner or settlement divergence returns `conflict` without mutation.

- [ ] **Step 3: Verify and commit**

Run: `pnpm test && pnpm typecheck`
Expected: reconciliation tests pass.

```bash
git add src/features/games/artifacts src/features/play/wilds-portable-reconciliation.ts app/api/wilds/artifacts/sync/route.ts tests/wildz-artifact-sync.test.ts
git commit -m "feat: reconcile offline living card history"
```

### Task 7: Module Loader and Mobile Budgets

**Files:**
- Create: `src/features/games/kernel/game-registry.ts`
- Create: `src/features/games/kernel/game-loader.ts`
- Modify: `public/sw.js`
- Test: `tests/wildz-game-loader.test.ts`

**Interfaces:**
- Produces: `WILDZ_GAME_REGISTRY`, `loadWildzGame(gameId)`, and `prefetchWildzGame(gameId)`.

- [ ] **Step 1: Write failing lazy-load tests**

```ts
test("does not import Mortal Arena until requested", async () => {
  assert.equal(loader.loaded.has("mortal-arena"), false);
  await loader.loadWildzGame("mortal-arena");
  assert.equal(loader.loaded.has("mortal-arena"), true);
});
```

- [ ] **Step 2: Implement the registry**

```ts
export const WILDZ_GAME_REGISTRY = {
  "mortal-arena": { rulesVersion: "1.0.0", load: () => import("../mortal-arena/module"), offline: true, maxInitialBytes: 420_000 }
} as const;
```

Prefetch only on Arena approach or explicit map selection. Cache versioned module assets after first load. Reject a module whose declared ID/version differs from the registry.

- [ ] **Step 3: Verify kernel release and commit**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: tests, typecheck, build, and chunk creation pass; base world does not eagerly contain the Arena module.

```bash
git add src/features/games/kernel public/sw.js tests/wildz-game-loader.test.ts
git commit -m "perf: load Wildz games on demand"
```
