# Wildz Prompt Creation Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a player select creatures/resources, converse about an original creation, refine it, and place a persistent validated world preview.

**Architecture:** Immutable definitions feed a worker compiler; a qualified planner proposes graphs/patches through an isolated provider port. One lazy HUD panel orchestrates the flow and feeds small previews to the existing world renderer. Execution is connected in Plan 2.

**Tech Stack:** Existing TypeScript/React/Three.js stack, Web Workers, IndexedDB, Receiz conversation transport, Node tests.

**Spec:** [Approved design](../specs/2026-10-05-wildz-prompt-creation-design.md); [global constraints and execution order](2026-10-05-wildz-prompt-creation.md).

## Global Constraints

- “Existing manual construction remains available and compatible.”
- “Planning does not spend or reserve them.”
- “The planner never silently turns a requested working mechanism into decoration or claims completion from dialogue.”
- HUD label: **Create with creatures**. Desktop width: at most 400 px, constrained to the available viewport.
- Initial material budget keys are `hay`, `timber`, `stone`; later resource kinds enter through the versioned resource registry, without loosening legacy lot verification.
- No eager planner request, per-frame hashing, new timer for a closed panel, or large synchronous worker fallback.

## Review Focus

- Cyclic/duplicate graph IDs and prototype keys must reject before compilation: Task 1.
- Slender openings, rotated stairs, and rooms under roofs must remain reachable: Task 2.
- Provider failure or unsupported mechanics must preserve the draft and explain the blocker: Task 4.
- Owner/space/creature changes during streaming must fence stale responses: Tasks 3–5.
- Phone keyboards, focus routing, and worker failure must preserve usable movement: Tasks 2,5–6.

---

### Task 1: Versioned definitions, patches, and fixture contract

**Files:** Create `src/features/play/creation/types.ts`, `definition.ts`, `patch.ts`, `registry.ts`; create `tests/support/creation-fixtures.ts` and `tests/wilds-creation-definition.test.ts`.

**Interfaces:** Export `CreationPoint={x:number;y:number;z:number}`, `CreationPose={position:CreationPoint;yaw:number}`, and `CreationResourceBudget=Readonly<Record<string,number>>`. `CreationDefinition` has `schema:"wildz.creation-definition.v1"`, `grammarVersion:1`, `seed:string`, `creatorId:string`, `nodes:readonly CreationNode[]`, `assets:readonly CreationAssetRef[]`, and `digest:string`. A node has stable `id`, nullable `parentId`, pose, typed shape/material, attachment/support IDs, and typed behaviors. Shapes initially include catalog pieces, box/shell, extrusion, sweep, and arch; require bounded positive dimensions and finite coordinates. `CreationAssetRef` carries immutable digest, media kind, byte/geometry bounds, and retrieval reference. Register behavior descriptors by ID/version; unknown behavior blocks compilation rather than dropping it. Export `parseCreationDefinition(value:unknown):CreationDefinition`, `verifyCreationDefinition(value:unknown):boolean`, and `applyCreationPatch(definition:CreationDefinition,patch:CreationPatch):CreationDefinition`; patches bind `baseDigest` and ordered add/update/remove operations. Fixtures export `creationDefinitionFixture(overrides?:Partial<CreationDefinition>):CreationDefinition` and `creationContextFixture(overrides?:Partial<CreationCompileContext>):CreationCompileContext` after Task 2 introduces that type.

Shared commit contract lives in `creation/types.ts` from this task: `CreationInstanceRef={instanceId:string;head:string;definitionDigest:string}` and `CreationCommitResult={status:"admitted";instance:CreationInstanceRef}|{status:"rejected";reason:string;writes:0}|{status:"unknown";operationId:string}`. Plan 2's full instance implements this reference; the foundation compiles without depending on a future module.

- [ ] Write tests asserting deterministic digest/replay, unchanged input bytes, wrong `baseDigest` rejection, duplicate IDs, invalid parent references, cyclic attachments, NaN/Infinity/negative quantities, prototype keys, unsupported schema, and excessive per-page complexity rejection. Whole creations may have many pages; page size is 128 nodes, not a cap on total creativity. Primary test: `test("rejects a stale definition patch", ...)` with `assert.throws(() => applyCreationPatch(definition, stalePatch), /creation_patch_stale/)`; construct the stated input in this task's fixture/double setup.
- [ ] Compile/run `wilds-creation-definition.test.ts`; confirm failures refer to missing parse/patch behavior.
- [ ] Implement the interfaces using existing canonical digest helpers and deeply frozen plain data; retain legacy proofs verbatim. Put resource/behavior parameters in versioned registry entries, not prompt parsing code.
- [ ] Run the named tests and TypeScript check; assert mutation of an imported mutable source cannot poison another cached definition.
- [ ] Commit only this task's source/tests: `feat: define composable creation graphs`.

### Task 2: Deterministic compiler and bounded worker geometry

**Files:** Create `creation/compiler.ts`, `geometry.ts`, `worker.ts`, `worker-client.ts`, `preview.ts`; create `tests/wilds-creation-compiler.test.ts`, `tests/wilds-creation-worker.test.ts`; extend fixture support.

**Interfaces:** Define `CreationCompileContext={worldId:string;spaceId:string;pose:CreationPose;sourceHead:string;budget:CreationResourceBudget;techniques:readonly string[];physical:readonly CreationPhysicalChunk[];quality:"low"|"medium"|"high"}`. `CreationPhysicalChunk` carries exact chunk/head, terrain samples, solids, walkable surfaces, and connection portals. `CreationPlan` carries definition digest, context digest, required resources/work/techniques, dependency stages, and `CreationChunk` pages; each chunk has bounds, node IDs, physical surfaces/interiors/connections, and compiled render buffers. `compileCreation(definition,context)` returns `{status:"ready";plan:CreationPlan}` or `{status:"blocked";blockers:readonly CreationBlocker[]}`. Blockers have `code`, `nodeId:string|null`, and readable `message`. `createCreationWorkerClient()` exposes `compile(requestId,definition,context):Promise<CreationCompileResult>`, `cancel(requestId):void`, and `close():void`. `CreationPreview` is `{plan:CreationPlan;physical:false;writes:0}`.

- [ ] Test stable output across reruns, volume/surface-derived resource cost, budget shortage, support cycles, overlap, multi-region paged plans, doorway traversal, rotated stairs, invalid assets, and unsupported behavior. Costs derive from registered density/surface rates; planner-provided cost or damage never overrides rules. Primary test: `test("keeps compiled previews nonphysical", ...)` with `assert.equal(preview.physical, false); assert.equal(preview.writes, 0)`; construct the stated input in this task's fixture/double setup.
- [ ] Compile/run the compiler/worker tests and confirm the intended missing compiler behavior fails.
- [ ] Implement grammar tessellation and shared physical derivation off-thread; use transferable buffers and incremental pages. Worker failure returns a blocker and preserves the draft instead of doing a large synchronous compile. Reuse existing piece geometry only through an adapter, preserving its original proof basis.
- [ ] Run the named tests; assert cancellation fences late buffers and the empty/closed feature creates no worker. Assert physical/nav openings use the compiled surface, not a gross bounding box.
- [ ] Commit: `feat: compile creation graphs in bounded workers`.

### Task 3: Current creature techniques and truthful resource planning

**Files:** Create `creation/capabilities.ts`, `resources.ts`; modify `creature-capability-identity.ts` through a versioned technique adapter; create `tests/wilds-creation-capabilities.test.ts` and `tests/wilds-creation-resources.test.ts`.

**Interfaces:** `CreationWorker={assetId:string;subjectId:string;head:string;proofDigest:string;techniques:readonly string[];ready:boolean;reasons:readonly string[]}`. Export `projectCreationWorkers(cards:readonly PortableCardAsset[],conditions:PlayState["adventureConditions"]):readonly CreationWorker[]` and `selectCreationResources(lots:readonly WildsMaterialLotV1[],budget:CreationResourceBudget,required:CreationResourceBudget,availability:CreationResourceAvailability):CreationResourceSelection`. Availability binds actor ID, current lot heads/custody, and reserved/spent/stored lot ID sets; it is planning evidence, not an authority grant. Selection contains exact lot IDs/heads and deficits; it does not mutate custody. Initial technique rules: living ready creatures can assemble supported basic pieces; masonry/forging/cultivation/excavation/water/high-altitude/space techniques require an explicit registered grant derived from current capability/progression law. Do not infer advanced grants solely from element/color/name. `CreationResourceSelection` names each exact legacy lot and any registered later lot by `{id,head,kind,quantity}`.

The selection shape is `{lots:readonly CreationSelectedLot[];deficits:CreationResourceBudget}`, with `CreationSelectedLot={id:string;head:string;kind:string;quantity:number}`. Add later resource kinds through an overload accepting verified `CreationResourceLot` alongside legacy lots; no later task reinterprets a legacy material lot as a garden input.

- [ ] Test complementary multi-creature skills, stale proof/condition, deceased/transferred/unready creatures, negative/over-carried budgets, duplicate/spent/stored/reserved lots, and selection remaining zero-write. Primary test: `test("rejects a previously consumed resource lot", ...)` with `assert.equal(selection.lots.length, 0); assert.ok(selection.deficits.timber > 0)`; construct the stated input in this task's fixture/double setup.
- [ ] Run the capability/resource tests and confirm the missing projection/selection fails.
- [ ] Implement cached per-proof/per-condition projections and deterministic lot selection; compute on revisions, never movement. Keep unavailable advanced techniques legible until their grant laws are implemented.
- [ ] Run the named tests and existing capability identity tests; verify roster switching leaves other workers unchanged.
- [ ] Commit: `feat: plan creation work from current creature skills and materials`.

### Task 4: Qualified structured conversation planner

**Files:** Create `creation/planner.ts`, `src/lib/receiz/wilds-creation-planner.ts`, `app/api/wilds/creation/propose/route.ts`; create `tests/wilds-creation-planner.test.ts`.

**Interfaces:** `CreationPlannerRequest={requestId:string;actorId:string;message:string;selected:CreationDefinition|null;workers:readonly CreationWorker[];context:CreationCompileContext}`. `CreationPlannerProposal={requestId:string;reply:string;definition:CreationDefinition}|{requestId:string;reply:string;patch:CreationPatch}`. `CreationPlannerPort.propose(request,signal:AbortSignal):Promise<unknown>`; `planCreation(request,port,signal)` returns a validated proposal or `{status:"unavailable"|"blocked";reason:string}`. The server authenticates ownership using the same actor/current-card admission family as the observer route; never trust client `actorId`, skills, or budget evidence. Adapter uses the existing qualified `receiz.world.message` path and validates bounded structured output; no invented SDK method is required.

The exact orchestration signature is `planCreation(request:CreationPlannerRequest,port:CreationPlannerPort,signal:AbortSignal):Promise<CreationPlannerResult>`, where `CreationPlannerResult={status:"proposed";proposal:CreationPlannerProposal}|{status:"unavailable"|"blocked";reason:string}`. The port signature consumes the same typed request; the server reconstructs authenticated request fields before using it.

- [ ] Test malformed/partial JSON, unsupported behavior, over-budget requests, incorrect selected digest, ownership mismatch, stale request IDs, bounded provider timeout/cancellation, and outage preserving the original draft. Successful fake-port tests prove parsing only, not live model qualification. Primary test: `test("preserves a draft when generation is unavailable", ...)` with `assert.equal(result.status, "unavailable"); assert.deepEqual(originalDefinition, beforeDefinition)`; construct the stated input in this task's fixture/double setup.
- [ ] Run the planner tests and confirm the missing validation/route behavior fails.
- [ ] Implement the port, exact request authentication, bounded streaming/reply parsing, and schema/patch/compile checks. Do not route structured graphs through the autobiographical dialogue fallback or substitute regex blueprint selection. Return a natural blocker when no qualified generator is available.
- [ ] Run the named tests and perform a read-only authenticated capability/generation qualification with secrets excluded; record whether structured proposals actually work. A provider outage leaves manual building and saved creations usable.
- [ ] Commit: `feat: add grounded structured creation proposals`.

### Task 5: Tasteful HUD, conversation state, and placement integration

**Files:** Create `creation/conversation.ts`, `use-creation-conversation.ts`, `WildsCreationPanel.tsx`, `WildsCreationPreview.tsx`, and `creation.module.css`; modify `WildzWorldControls.tsx`, `PlayCampaign.tsx`, `WildsWorldCanvas.tsx`, `world-overlay-state.ts`, and `world-keyboard-routing.ts`; create `tests/wilds-creation-conversation.test.ts` and `tests/wilds-creation-hud.test.tsx`.

**Interfaces:** Conversation state stores owner/space, selected worker IDs, resource ceiling, draft/history, request ID, selected definition/instance reference, plan, placement, and status `idle|planning|preview|committing|recovering|blocked`. Export `reduceCreationConversation(state:CreationConversationState,event:CreationConversationEvent):CreationConversationState` and `useCreationConversation(input:{ownerId:string;spaceId:string;workers:readonly CreationWorker[];context:CreationCompileContext;planner:CreationPlannerPort;commit?:(plan:CreationPlan)=>Promise<CreationCommitResult>})`. Commit implementation is supplied in Plan 2; its result type already exists in shared types. HUD gains `onOpenCreation?:()=>void`. Preview renderer consumes only `CreationPreview`. Add an overlay owner `creation`; keyboard text entry must not trigger movement shortcuts, while closed/minimized state restores normal focus.

- [ ] Test open/close/minimize, selection/budget changes, stale streamed proposal after owner/space/worker changes, explicit binding of “it,” failed patch preserving the prior graph, and no **Build here** success while the commit port is absent. Primary test: `test("ignores a proposal after the owner changes", ...)` with `assert.equal(next.ownerId, newOwnerId); assert.equal(next.plan, null)`; construct the stated input in this task's fixture/double setup.
- [ ] Run the conversation/HUD tests and confirm intended missing UI/reducer behavior fails.
- [ ] Implement the lazy icon/panel, creature portraits, expandable budget chips, composer, one primary action, draft persistence, cancellation, and whole-creation placement. Reuse existing floating-panel/gesture patterns without mounting the entire conversation per frame. Desktop max width is 400 px; mobile sheet retains reachable movement controls. Do not fold orchestration logic into the large campaign component.
- [ ] Run the named tests, overlay/keyboard tests, targeted lint, and browser verification at desktop/phone sizes with keyboard and touch. Confirm closing, typing, rotation, and worker errors do not move the player unexpectedly or freeze movement.
- [ ] Commit: `feat: add conversational creation HUD and world previews`.

### Task 6: Foundation qualification and performance baseline

**Files:** Create `scripts/benchmark-creation-work.mjs`, `app/test-fixtures/creation/page.tsx`, `src/features/play/creation/CreationBrowserFixture.tsx`, and `docs/release/2026-10-05-prompt-creation-qualification.md`; amend the existing world-work tests if worker boundaries change.

**Interfaces:** Benchmark emits compiler/serialization/cancellation CPU figures and labels them as CPU measurements. Browser fixture uses actual planner/compiler/panel with an explicit development-only fake port when no live generator exists; fixture output must distinguish that from live generation. Baseline report records device/browser/profile, repeated scene/input protocol, p50/p95/p99, frame times, long tasks, draw/triangle/texture counts, memory, and prompt/preview durations separately.

- [ ] Add assertions that closed feature paths perform zero planner/worker calls, cancelled pages are discarded, and bounded jobs never synchronously compile after worker failure. Primary test: `test("does no generation with the creation HUD closed", ...)` with `assert.equal(plannerCalls, 0); assert.equal(workerCalls, 0)`; construct the stated input in this task's fixture/double setup.
- [ ] Run relevant worker/HUD tests, then the CPU benchmark; confirm it reports its measurement scope.
- [ ] Compare repeated foundation samples with the baseline captured before Task 1 under the main plan's prerequisite; use existing benchmark scripts for hot-path comparisons and real browser/device observations for frame timings.
- [ ] Run full foundation tests, `pnpm typecheck`, targeted lint, and the stated browser flows. Record unresolved generator qualification and device availability explicitly; do not claim completed construction from this preview-only package.
- [ ] Commit: `test: qualify creation previews and frame-path isolation`.
