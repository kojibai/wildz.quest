# Wildz Creature Execution and Usable Creations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn validated prompts into genuinely constructed inhabited places, usable tools/weapons, finite gardens, and recoverable consequential state.

**Architecture:** Versioned instance/component state advances through deterministic source operations. A qualified admission port executes exact participant transitions; a separate crew batch coordinator retains bounded mandates and durable worker/job fences. Existing renderer/navigation and inventory consume admitted projections.

**Tech Stack:** Plan 1 interfaces, installed Receiz SDK/transaction wrappers, IndexedDB crew/outbox storage, Three.js/R3F, Node tests.

**Spec:** [Approved design](../specs/2026-10-05-wildz-prompt-creation-design.md); [global constraints](2026-10-05-wildz-prompt-creation.md); requires Plan 1.

## Global Constraints

- “An admitted operation either advances every required participant or produces a verified zero-write result.”
- “No repeated manual ‘work’ clicks are required by this flow.”
- “Existing mandates from the old steward lose authority at transfer.”
- “No absence-based destructive simulation is introduced.”
- “Old revisions remain historical, not usable duplicate assets.”
- Current source-object proof/ownership/mandate verification is required; a sealed local digest or a caller's `canonical:true` does not grant execution authority.

## Review Focus

- Mutable/tampered graph, source, or receipt cannot create physical state: Tasks 1–2.
- Recall during awaited authorization and multi-worker partial fencing cannot dispatch unapproved work: Task 3.
- Removing stairs/supports around occupants must not strand them: Tasks 4,7.
- Finite lots, carried equipment, and garden harvests cannot duplicate on retry: Tasks 2,5–6.
- Imported old saves, unknown schemas, and missing asset bytes preserve recoverable source data: Task 8.

---

### Task 1: Versioned instance/component state and action registry

**Files:** Create `creation/instance.ts`, `state.ts`, `actions.ts`, `behavior.ts`; extend `creation/types.ts`, `registry.ts`; create `tests/wilds-creation-instance.test.ts`, `tests/wilds-creation-behavior.test.ts`.

**Interfaces:** `CreationInstance` has schema `wildz.creation-instance.v1`, instance/definition IDs, creator/owner/steward IDs, world/space IDs, pose, `revision`, `parentHead`, `head`, node-state map, embedded-resource references, access policy, and stage `planned|building|functional|finished|destroyed`. `CreationNodeState` is a discriminated union for condition/support, storage, bed/habitat, equipment, garden, joint/actuator/sensor/logic, and later environment/space components. `CreationAccessPolicy` maps visit/inhabit/use/harvest/edit/demolish permissions to owner/public/invited subject grants. `CreationState` stores definitions, instances, exact resource sources/custody/reservations, operation receipts, and event references. `CreationCommand` variants bind operation ID, expected instance/participant heads, Kai, actor, and action-specific exact inputs. Export `verifyCreationInstance(value:unknown):boolean`, `reduceCreationOperation(state:CreationState,command:CreationCommand,context:CreationAuthorityContext):CreationTransition`, and `stepCreationBehavior(instance:CreationInstance,events:readonly CreationBehaviorEvent[],maximumSteps:number):CreationBehaviorProposal`. `CreationTransition` contains successor sources, exact consequences, and receipts, or a zero-write rejection; authority context carries verified sources/mandates/rules, not a truthy permission flag.

Core map field names are `CreationState.definitions`, `.instances`, `.resources`, `.custody`, `.reservations`, `.receipts`, and `.events`; `.instances` is a readonly record keyed by instance ID. Instance fields include `definitionDigest`, `ownerId`, `stewardId`, `creatorId`, `worldId`, `spaceId`, `nodeStates`, and `access`. A rejected `CreationTransition` is `{status:"rejected";state:CreationState;reason:string;writes:0}` and retains the exact input state. A valid deterministic candidate is `{status:"proposed";state:CreationState;successorSources;consequences}` and still needs authenticated admission; successful reducer output alone is not a physical result.

- [ ] Test deterministic lineage, incompatible schema/unknown component rejection, destroy-state use rejection, immutable replay, forbidden event targets, cycles over the behavior budget, repeated economic trigger prevention, and no simulation event from animation/viewing. Primary test: `test("rejects use of a destroyed instance", ...)` with `assert.equal(transition.status, "rejected"); assert.deepEqual(transition.state, beforeState)`; construct the stated input in this task's fixture/double setup.
- [ ] Run instance/behavior tests and confirm the missing reducers fail for their intended behavior.
- [ ] Implement reducers and a 64-step maximum behavior batch; model event connections declaratively. Each registered action declares participant kinds, costs, effects, and deterministic verifier. Do not modify legacy construction proof digests or reinterpret existing tool/card schemas.
- [ ] Run named tests; assert source-state equality after every rejected command and unchanged repeated replay output.
- [ ] Commit: `feat: add persistent creation instances and deterministic behaviors`.

### Task 2: Atomic creation admission, material consumption, and recovery

**Files:** Create `creation/operation.ts`, `src/lib/receiz/wilds-creation-admission.ts`, `wilds-creation-execution.ts`; modify `wilds-world-service.ts`, `wilds-world-state.ts`, `wilds-world-event.ts`, `wilds-world-constitution.ts`, and `wilds-world-outbox.ts` through focused creation adapters; create `tests/wilds-creation-admission.test.ts`.

**Interfaces:** `CreationOperation` binds `operationId`, semantic idempotency key, expected participant heads, definition/plan/rule digests, selected worker mandates, exact resource lots, spatial bounds, causal parents, and command. `CreationAdmissionPort.execute(operation:CreationOperation):Promise<CreationAdmissionOutcome>` and `.lookup(operationId:string):Promise<CreationAdmissionOutcome>` return `admitted` with authenticated source successors/events, `rejected` with verified zero writes, or `unknown`. Use the shared `CreationCommitResult` from Plan 1, with the full `CreationInstance` as a structural extension of `CreationInstanceRef`; do not redeclare an incompatible result. Export `prepareCreationOperation(plan:CreationPlan,context:CreationOperationContext):CreationOperation`, `verifyCreationAdmission(operation:CreationOperation,outcome:unknown):CreationAdmissionOutcome`, and `commitCreation(operation:CreationOperation,port:CreationAdmissionPort,journal:CreationOperationJournal):Promise<CreationCommitResult>`; journal stores immutable exact candidate bytes, phase, source heads, reservation references, and result, with compare-and-set fencing.

- [ ] Test exact resource conservation, stale source/instance heads, over-ceiling quantity/work, wrong owner/capability, duplicate material lots, forged receipt, identical replay, same ID with different bytes, unknown outcome lookup without redispatch, and durable-completion-write failure retaining reservations. Primary test: `test("recovers unknown work without a second dispatch", ...)` with `assert.equal(dispatchCalls, 1); assert.equal(lookupCalls, 1); assert.equal(result.status, "admitted")`; construct the stated input in this task's fixture/double setup.
- [ ] Run admission tests and confirm intended missing atomic admission/recovery behavior fails.
- [ ] Implement versioned creation laws and source reducers; use the installed SDK's supported typed participant transaction/recovery boundary through `wilds-v122-world.ts` where operationally qualified. Add the creation projection/events/outbox support without pretending a generated graph is an existing component proof. Bind the resource state, creature work/condition, and creation outputs in the same atomic transition.
- [ ] Run tests and perform authenticated disposable live admission/recovery qualification only within user-authorized test scope. If the rail/reducer/mandate is unsupported, return an explicit unavailable blocker and continue other tasks; no mock receipt or public-store write substitutes for admission.
- [ ] Commit: `feat: admit creation operations with exact resource and recovery semantics`.

### Task 3: Multi-creature task graph and durable batch fencing

**Files:** Create `creation/crew.ts`, `scheduler.ts`, `src/lib/receiz/wilds-creation-crew-execution.ts`; modify `wilds-crew-journal.ts`, `wilds-crew-jobs.ts`, `src/lib/receiz/wilds-crew-mandate.ts` using a separately versioned creation-batch path; create `tests/wilds-creation-crew.test.ts`.

**Interfaces:** `CreationTask={taskId:string;nodeIds:readonly string[];workerId:string;technique:string;dependencyTaskIds:readonly string[];resources:CreationResourceSelection;work:number}`. Export `planCreationTasks(plan:CreationPlan,workers:readonly CreationWorker[]):readonly CreationTask[]`, `prepareCreationCrewBatch(tasks:readonly CreationTask[],context:CreationCrewContext):Promise<CreationCrewBatch>`, and `createCreationScheduler(input:{journal:CreationOperationJournal;admission:CreationAdmissionPort;authorize:CreationCrewAuthorize})`. Context binds exact current job/worker/owner heads, consent, mandate, arrival/navigation and condition evidence. Batch contains all expected worker/job heads and operation identities; dispatch fences the batch in one local IndexedDB transaction and rechecks production authority before execution. Preserve the existing one-worker restriction in `createWildsCrewExecution`; do not weaken it to accept a multi-worker batch accidentally.

- [ ] Test complementary technique assignment, deterministic dependencies, shared-lot contention, one unready/revoked worker, ownership change during authorization, recall at the final fence, two-tab job contention, partial batch-fence failure, and pending recall retaining exact reservations until recovery. Primary test: `test("recall wins before the final batch dispatch fence", ...)` with `assert.equal(dispatchCalls, 0); assert.equal(batch.phase, "cancelled")`; construct the stated input in this task's fixture/double setup.
- [ ] Run crew tests and confirm missing coordinator/fence behavior fails.
- [ ] Implement immediate bounded scheduling, fresh authorization at every stage, visible real work/navigation, exact causal contribution records, and cancellation of only undispatched tasks. Small qualified builds can admit one aggregate batch; larger builds use resumable stage batches without artificial timers or repetitive work buttons.
- [ ] Run crew/admission tests and existing journal/job/mandate tests; use the real browser IndexedDB in competing tabs to exercise the atomic fence.
- [ ] Commit: `feat: coordinate creation crews with bounded atomic work`.

### Task 4: Inhabitable geometry, interactions, and actual Build here

**Files:** Create `creation/projection.ts`, `navigation.ts`, `interactions.ts`; modify `WildsCreationPreview.tsx`, `WildsWorldCanvas.tsx`, `wilds-world-geometry-selector.ts`, `wilds-structure-support.ts`, `wilds-construction-function.ts`, `use-creation-conversation.ts`, and `PlayCampaign.tsx`; create `tests/wilds-creation-physical.test.ts`.

**Interfaces:** `projectCreationPhysical(instance:CreationInstance,definition:CreationDefinition,plan:CreationPlan):CreationPhysicalProjection` returns admitted collision, walkable surfaces, entrances, connected interiors, and interactable node handles. `resolveCreationInteraction(state:CreationState,instanceId:string,nodeId:string,actor:CreationInteractionActor):readonly CreationActionDescriptor[]` returns permitted current actions only. `CreationPhysicalProjection` exposes chunk/space/head keys for existing cached neighborhood selection. Plug Plan 2's `commitCreation` into the HUD commit callback.

- [ ] Test room entry/exit, stairs and upper floors, cave-space isolation, nonphysical previews, duplicate projection prevention, nonfunctional bed/workshop use rejection, storage lot custody, sensor-controlled door/actuator transitions, and safe exit after a support/connection change. Primary test: `test("admits connected stairs and inhabitable upper floors", ...)` with `assert.equal(route.reachable, true); assert.equal(projection.spaceId, instance.spaceId)`; construct the stated input in this task's fixture/double setup.
- [ ] Run physical tests and confirm the missing world integration fails.
- [ ] Implement admitted instance rendering/support/navigation integration and real use affordances. Retain legacy workshop/storage/bed adapters; new sources verify as creation sources, never fabricated legacy structures. Assembly effects follow actual admitted stage results; no success text precedes usable state.
- [ ] Run named tests and browser-play a prompt-built house, enter every floor, use furniture/storage, refine it by prompt, and reload. If live execution is unavailable, record the unresolved dependency separately from fixture evidence.
- [ ] Commit: `feat: make prompt-built creations inhabitable and interactive`.

### Task 5: Forged tools, weapons, equipment, and action integration

**Files:** Create `creation/equipment.ts`, `combat.ts`; modify `game-state.ts`, `battle-engine.ts`, `pvp-battle-engine.ts`, `arena/combat.ts`, `wilds-world-service.ts`, and `inventory-detail-selection.ts` through focused adapters; create `tests/wilds-creation-equipment.test.ts`.

**Interfaces:** `CreationEquipmentState={kind:"tool"|"weapon";capabilityId:string;durability:number;capacity:number;mass:number;actionProfileId:string}`. `equipCreation(state:CreationState,command:CreationCommand,context:CreationAuthorityContext):CreationTransition`; `resolveCreationEquipmentAction(instance:CreationInstance,request:CreationEquipmentActionRequest,rules:CreationEquipmentRules):CreationActionProposal`. Requests bind exact equipped instance/head, target/head, position, Kai, action ID, and optional ammo/energy source. Profiles derive damage/range/recovery/wear from versioned material/shape/work rules, not generated free stats. Initial forge supports timber/stone composite tool/weapon shapes using actual lots; further materials get new explicit resource laws.

- [ ] Test insufficient forging skill/materials, incompatible equip slot, nonexistent target, range/recovery, spent durability/ammo, generated overpowering parameters, duplicate attack, stale equipped head, repair conservation, and old-owner equipment invalidation on transfer. Primary test: `test("invalidates equipped custody after a transfer", ...)` with `assert.equal(oldOwnerEquipment, null); assert.equal(instance.ownerId, recipientId)`; construct the stated input in this task's fixture/double setup.
- [ ] Run equipment tests and confirm missing equip/action behavior fails.
- [ ] Implement physical/item display and forging/equip/use/repair commands with consistent action hooks in each relevant combat mode. Existing creatures keep their proven stats; equipment contributes only through its defined profile/action rules. Harvest tools consume durability and produce admitted resource changes.
- [ ] Run equipment and existing battle tests; browser-forge/equip/use/repair a tool and weapon, recording exact effects rather than just appearance.
- [ ] Commit: `feat: forge and use persistent creation equipment`.

### Task 6: Finite functional gardens and resource provenance

**Files:** Create `creation/garden.ts`, `resource-registry.ts`, `resource-source.ts`; extend `creation/resources.ts`, `registry.ts`, and source admission adapters; create `tests/wilds-creation-garden.test.ts`.

**Interfaces:** `CreationGardenState={planted:number;waterUnits:number;fertility:number;produce:number;lastGrowthKaiUPulse:number}` with safe integer nonnegative quantities. Define new versioned `CreationResourceLot` for `seed|water|produce` containing ID, head, quantity, owner, and exact admitted source/operation lineage; leave legacy living-honey verification unchanged. `advanceCreationGarden(state:CreationGardenState,kaiUPulse:number,inputs:CreationGardenInputs,rules:CreationGardenRules):CreationGardenProposal`. Initial law: one admitted seed and one water unit yield at most one produce unit after the registered Kai growth interval; harvest decrements actual ready produce and creates one causally bound lot. Define discoverable seed/water source capacity and extraction rules in `resource-source.ts`; prompt text never supplies free inputs.

- [ ] Test finite input conservation, repeat/cross-player harvest, no water/seed, regressed time, huge offline jump capped by planted/input quantities, plant/harvest replay, ecological effects, and immutable produce provenance. Primary test: `test("one seed and water input cannot yield two harvests", ...)` with `assert.equal(totalProducedQuantity, 1); assert.equal(garden.produce, 0)`; construct the stated input in this task's fixture/double setup.
- [ ] Run garden tests and confirm missing production/harvest behavior fails.
- [ ] Implement planting, watering, bounded analytical growth, shared harvest permission, produced-lot custody, and useful consumption effects for existing care/gameplay. Add garden visuals from the admitted growth state and cached local projections, without a timer/frame loop per dormant garden.
- [ ] Run garden/resource/admission tests; browser-have a second permitted player harvest and consume finite produce. Maker-benefit settlement connects in Plan 3.
- [ ] Commit: `feat: create finite shared gardens with real resource effects`.

### Task 7: Destruction, structural effects, salvage, and repair

**Files:** Create `creation/damage.ts`, `repair.ts`; extend `creation/combat.ts`, `state.ts`, `navigation.ts`, and constitutional consequence adapters; create `tests/wilds-creation-damage.test.ts`.

**Interfaces:** `resolveCreationDamage(instance:CreationInstance,attack:CreationAttack,context:CreationAuthorityContext):CreationTransition` and `prepareCreationRepair(instance:CreationInstance,resources:CreationResourceSelection,context:CreationAuthorityContext):CreationOperation`. Attack binds exact eligible target/node and versioned damage profile. Salvage contains only recoverable embedded matter under registered material salvage rates; spent/previously salvaged resources cannot be recovered again. Structural dependency effects and admitted occupant relocation are participants in the same bounded transition; a larger unsupported effect requires staged qualified handling, not partial unsafe mutation.

- [ ] Test owner demolition, contested/opted-in target damage, protected public target rejection, support cascade, occupied interior relocation, safe restore of destroyed objects, repeated salvage, repair underbudget, and persistent ecological/restoration consequences. Primary test: `test("rejects duplicate salvage from a destroyed support", ...)` with `assert.equal(secondSalvage.status, "rejected"); assert.equal(totalSalvagedQuantity, allowedQuantity)`; construct the stated input in this task's fixture/double setup.
- [ ] Run damage tests and confirm missing damage/conservation behavior fails.
- [ ] Implement actual condition/use/traversal changes, bounded destruction debris presentation, lawful salvage/custody and repair lineage. No purely visual destruction or unbounded physics/debris spawning; remote absence does not cause destructive simulation.
- [ ] Run damage/equipment/physical tests and browser-damage a permitted structure, observe usable/traversal changes, repair, then reload.
- [ ] Commit: `feat: persist creation damage salvage and restoration`.

### Task 8: Vault, outbox, and end-to-end object qualification

**Files:** Create `creation/persistence.ts`; modify `wilds-player-world-additions.ts`, `wilds-construction-persistence.ts`, `wilds-world-outbox.ts`, `wilds-player-vault.ts`, `src/lib/receiz/wildz-prepared-player-vault.ts`, `src/lib/receiz/wildz-proof-sealed-vault.ts`, and the creation fixture; create `tests/wilds-creation-persistence.test.ts`; update qualification report. Preserve unrelated restore/search edits while connecting the verified source adapters.

**Interfaces:** `CreationPersistence` retains definitions/assets, instance heads/state, operation history/receipts, contribution attribution, grants/custody, task references, and paginated spatial/source indexes. Export `exportCreationPersistence(state:CreationState):CreationPersistence` and `restoreCreationPersistence(value:unknown,verifySource:CreationSourceVerifier):Promise<CreationRestoreResult>`. Result preserves unsupported original bytes separately and marks unusable entries without replacing identities or losing valid legacy data.

- [ ] Test old save without creation fields, offline pending restoration, altered graph/assets, missing referenced asset bytes, unsupported future schema, duplicate source replay, current damage/contents/occupancy, and independent restoration without a planner request. Primary test: `test("restores creation identity without a planner request", ...)` with `assert.equal(restored.instanceId, original.instanceId); assert.equal(plannerCalls, 0)`; construct the stated input in this task's fixture/double setup.
- [ ] Run persistence tests and confirm missing retention/replay behavior fails.
- [ ] Implement append-only source retention and additive migrations without touching unrelated Vault/search edits. Reuse the existing worker serialization/source recovery boundaries and exact source references.
- [ ] Run Plan 2 tests, full `pnpm test`, typecheck, targeted lint, and browser prompt→build→inhabit/use→damage→repair→export/import scenarios. Record real-runtime and fixture evidence distinctly.
- [ ] Commit: `feat: preserve playable creation state through Vault recovery`.
