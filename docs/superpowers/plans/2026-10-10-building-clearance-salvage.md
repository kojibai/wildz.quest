# Adaptive Building Placement and Shared Salvage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Place paid buildings on adapted natural terrain and preserve cleared resources as finite shared wood stacks, stone piles, and food baskets.

**Architecture:** Extend the existing typed construction and resource admission flows with an explicitly versioned clearance consequence. Derive display from admitted source heads; use native source compare-and-swap for reservation and pickup. Qualify the source composition first: no application projection or receipt substitutes for SDK-opened source evidence, and no existing source law coordinates are silently changed.

**Tech Stack:** TypeScript, React, Three.js, the existing world worker/continuity store, Receiz SDK/MCP/AI skills 128.0.0, Node test runner, pnpm.

**Spec:** [Approved design](../specs/2026-10-10-building-clearance-salvage-design.md), approved by the user on 2026-10-10.

## Global Constraints

- This work stays in Wildz and uses the installed Receiz 128.0.0 SDK and its released source, replay, proof-object, and custody primitives.
- It introduces no Receiz core changes, database, wallet connection changes, or new work on movement frames.
- It does not change historical construction or resource laws.
- Existing player structures retain their space, including the builder's own structures.
- Preview and local persistence provide no shared custody authority.
- Newly admitted clearance reserves the exact original portions and stops regrowth; reload, evolution, demolition, and transfer never refill piles.
- Do not ship scenery removal alone as a completed salvage feature. Commit activation only after collection and inventory qualification pass.

## Review Focus

- Backdated and concurrent claims must not bypass a source retired by clearance; test in Task 3.
- A construction evolution, partial paid component, or demolition must neither lose nor duplicate an earlier pile; test in Task 2.
- An offset wing, rotated footprint, or neighbor's graded base must keep its space and ground; test in Task 2.
- A full satchel, owner switch, or interrupted admission must retain the pending exact portion without crediting another identity; test in Task 4.
- A large property and many unrelated world updates must reuse immutable projections rather than replay proofs during preview or movement; test in Tasks 2 and 5.

---

### Task 1: Qualify the native source composition

**Files:**
- Test: `tests/wilds-clearance-source-v128.test.ts`
- Read: `src/lib/receiz/wilds-resource-journal-v128.ts`
- Read: `src/lib/receiz/wilds-resource-exchange-v128.ts`
- Read: `src/lib/receiz/wilds-resource-source-v128.ts`
- Read: `src/lib/receiz/wilds-resource-source-client-v128.ts`
- Document evidence: `docs/release/2026-10-10-building-clearance-salvage-qa.md`

**Interfaces:**
- Consumes: `prepareWildsResourceSourcePageV128({authority, page})`, `createWildsResourceSourceClientV128({sdk, authority, session, recoveryStore})`, `verifyWildsResourceSourceProofV128(sdk, proof, {applicationId})`.
- Native boundary: released `assets.createProofObject`, exact artifact hashing/opening, `domains.restoreVerifiedReplayProofObjectV124`, `sources.publishSealedSourceV124`, authenticated current domain heads.
- Produces: evidence that an explicit clearance consequence can reserve original resource frontiers and advance pickup in the same admitted source family while exact historical reads remain valid.

- [ ] Write a failing qualification test using the existing native source fixture and independently opened source bytes. Assert one construction clearance reservation followed by two competing pickups has exactly one admitted winner, and altered resource quantities or expected heads fail without writes.
- [ ] Include historical fixtures: assert `WILDS_RESOURCE_LAW_V128`, registry/reducer/genesis digests, and old event outputs remain byte-identical. The new clearance rule must carry explicit versioned rule coordinates; do not disguise changed reducer semantics behind the old digest.
- [ ] Run the qualification test after the normal test compilation; record the initial failure.
- [ ] Pin the native composition before production code: use the existing source adapter when its immutable law already authorizes the composition. If a new application reducer/source is necessary, qualify the new coordinates and causal handoff with native atomic source retirement first. An unsupported or unqualified handoff stops implementation; record the exact API/schema evidence and obtain the capability-gap review required by `ai-skills/wildz-builder-skill/SKILL.md` before any alternative.
- [ ] Run the qualification against SDK-supported testing ports. Mark production host admission separately; mocked SDK acceptance is not production readiness.
- [ ] Commit the qualified source test and evidence. No application activation in this task.

### Task 2: Derive exact clearance and preserve the landscape

**Files:**
- Create: `src/features/play/wilds-building-clearance.ts`
- Modify: `src/features/play/wilds-build-scenery.ts`
- Modify: `src/features/play/wilds-construction-terrain.ts`
- Modify: `src/features/play/wilds-construction-placement.ts`
- Modify: `src/features/play/wilds-continuous-builder.ts`
- Modify: `src/features/play/creation/ground-placement.ts`
- Modify: `src/features/play/creation/world-source.ts`
- Modify: `src/features/play/wilds-world-event.ts`
- Modify: `src/features/play/wilds-world-service.ts`
- Modify: `src/features/play/wilds-world-state.ts`
- Test: `tests/wilds-building-clearance.test.ts`
- Test: `tests/wilds-mountain-building.test.ts`

**Interfaces:**
- Consumes: Task 1's qualified rule coordinates, existing canonical terrain obstacles/food sources, admitted paid construction, original source checkpoints, and exact Kai `uPulse`.
- Produces: `WildsBuildingClearanceV1` containing `clearanceId`, `ruleHead`, construction source ID/head, admission Kai, oriented footprints, original resource IDs/heads, frozen remaining portions, and deterministic side positions.
- Produces: `deriveWildsBuildingClearance({world, buildingId, buildingHead, sourceCheckpoints, kaiUPulse}): WildsBuildingClearanceV1` and `verifyWildsBuildingClearance(value, exactInputs): boolean`.
- Produces: `projectWildsBuildingClearancePiles(clearances, depletion): readonly WildsClearancePile[]`, a disposable display projection; no function accepts caller-supplied yield as authority.

- [ ] Write failing tests for an actual procedural tree with fruit, an already partially harvested tree, a food source exhausted before construction, a rock, a vegetable source, a rotated paid compound, and an established neighbor's offset wing.
- [ ] Assert frozen yields equal original remaining capacities, not fresh capacity; no missed crop accumulation. Assert failed placement creates no clearance. Assert retry, evolution, move, demolition, and transfer preserve the same finite clearance history.
- [ ] Run tests and record the failures.
- [ ] Derive candidate sources by bounded tile enumeration and oriented footprint intersection. Use exact canonical source IDs and checkpoints. Deduplicate all pads from the same construction consequence; never clear an already reserved original source again.
- [ ] Bind the clearance event to the paid construction result and explicit new rule head. Keep old terrain-support/command branches unchanged; portable equipment and underground construction cannot clear surface sources.
- [ ] Choose side positions in stable source order. Keep piles outside walls/doorways, reachable on adapted ground, and outside established structures. Use other sides and available natural ground when the nearest side is occupied.
- [ ] Reuse placement projections by immutable construction/custody collections. A temporary preview project must not force full creation proof verification and mountain rebuilding on every drag. Mutable imported inputs must not retain stale authority indexes.
- [ ] Run the new tests plus mountain, continuous-construction, compile-environment, and creation source tests; commit inert model/admission changes after qualification.

### Task 3: Admit finite reservations and shared pickups

**Files:**
- Create: `src/lib/receiz/wilds-clearance-admission-v128.ts`
- Modify only after Task 1 qualification: `src/lib/receiz/wilds-resource-journal-v128.ts`
- Modify: `src/lib/receiz/wilds-resource-gameplay-v128.ts`
- Modify: `src/lib/receiz/wilds-resource-exchange-v128.ts`
- Modify: `src/features/play/wilds-resource-application-world-v128.ts`
- Modify: `src/features/play/wilds-steward-construction.ts`
- Modify: `src/features/play/wilds-nourishment.ts`
- Test: `tests/wilds-clearance-source-v128.test.ts`
- Test: `tests/wilds-clearance-inventory.test.ts`

**Interfaces:**
- Consumes: Task 2's exact clearance and independently SDK-admitted current source plus Task 1's pinned composition.
- Produces: `planWildsClearancePickupV128({source, clearanceId, pileId, expectedHead, ownerReceizId, gameplayOwnerId, player, spaceId, kaiUPulse, commandId})`, a zero-write exact proposal with actual player pose.
- Produces: `admitWildsClearancePickupV128(proposal, nativePort)`, returning admitted ordinary inventory members or a pending/zero-write result; a receipt alone is never an inventory input.
- Produces: frozen food source receipts compatible with food consumption, restore, resource packages, and the existing food kinds; material pickup remains finite ordinary material lots.

- [ ] Write failing tests: builder and second explorer collect different remaining portions; two explorers race for one portion; backdating does not bypass retirement; a normal harvest cannot regrow a retired tree or future food crop.
- [ ] Assert conservation across original source, piles, food/material inventory, consumed members, sent packages, and marketplace selection. Assert forged building JSON, invented manifests, changed source heads, and fake original-tree poses cannot authorize pickup.
- [ ] Run tests and record failures.
- [ ] At the qualified source boundary, reserve the frozen original portions and retire their standing-source access. Update only new explicitly versioned source consequences; historical admitted commands remain valid and exact.
- [ ] Admit pickup against the current native source head using actual side-pile reach. Use exact command identity and existing durable preparation/Original retention. On uncertainty, resolve the retained native attempt before retry; do not reseal a different semantic request.
- [ ] Create ordinary finite material/food members from the exact admitted portion. A frozen food crop must remain restorable and consumable after the calendar advances; it cannot acquire a new regrowth cycle. Keep all legacy food behavior identical when no clearance receipt is present.
- [ ] Preserve existing wallet connection, resource source bootstrap, market loading, Phi sending, and package custody. No new source coordinate replaces an old one without Task 1's qualified handoff.
- [ ] Run historical replay, inventory, transfer, food consumption, package, and source recovery tests; commit the qualified adapter and resource compatibility changes.

### Task 4: Render and collect through the existing controls

**Files:**
- Create: `src/features/play/WildsBuildingClearancePiles.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/WildsEnvironment.tsx`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `src/features/play/wilds-grounded-movement.ts`
- Modify: `src/features/play/creation/ranged-occlusion.ts`
- Modify: `src/features/play/game-state.ts`
- Modify: `src/features/play/useWildsResourceGameplayCapture.ts`
- Test: `tests/wilds-building-clearance-interaction.test.ts`

**Interfaces:**
- Consumes: admitted clearance/depletion projections, Task 3's pickup planner/admission result, existing hand/gather control dispatch, and owner-bound capture.
- Produces: instanced wood stacks, stone piles, and food baskets plus ordinary pickup feedback and exact pending attempt recovery.

- [ ] Write failing interaction tests for actual side reach, partial/empty contents, a full satchel, identity change during a request, pending native admission, and reload after each phase.
- [ ] Run tests and record failures.
- [ ] Render piles from the compact admitted projection with shared geometry/materials and a bounded mesh count. Cull outside the existing neighborhood. Use remaining quantities for appearance without allocating one mesh per portion.
- [ ] Route existing hand/gather controls to the nearest accessible pile. Keep movement, aim, jumping, camera, and food controls independent. Show pending collection feedback without blocking the world renderer or crediting spendable inventory prematurely.
- [ ] Remove retired scenery consistently from rendering, movement, ray occlusion, and original-source interaction. Include natural waterfall rock parts where they intersect, but preserve authored structures and established player property.
- [ ] Apply admitted pickup inventory through the existing qualified world/nourishment merge. Recover exact pending attempts through the existing continuity store; no new storage subsystem or per-frame network/proof work.
- [ ] Run interaction and control tests; commit UI integration together with activation, only after Tasks 1–3 pass.

### Task 5: Verify the entire experience and release evidence

**Files:**
- Test: browser fixture following the existing `src/features/play/*BrowserFixture.tsx` and `scripts/` pattern
- Update: `docs/release/2026-10-10-building-clearance-salvage-qa.md`

- [ ] Use the existing runtime guard to start one local build/browser process. Test a mountain compound, an ordinary foundation, actual trees/fruit under the footprint, a neighbor, and two simulated explorers claiming the same pile.
- [ ] Verify base corners are flush, approach paths remain navigable, original scenery is absent, wood/baskets are visible beside the property, and quantities survive reload. Verify pickup contents appear in the existing wallet and can be used, packaged, sent/received, and selected for sale.
- [ ] Measure first preview, repeated drag, paid placement, pile rendering, pickup, and repeated wallet/Vault opening with small/large footprints and many structures. Confirm unrelated world/Kai updates and movement do not reverify unchanged proof history.
- [ ] Run `pnpm test` and `pnpm release:check`; inspect complete results and retain logs. A known offline sealing skip must remain explicitly reported rather than counted as verified live admission.
- [ ] Review the complete diff for source authority, history preservation, changed legacy command outputs, memory allocation, hidden per-frame work, and wallet baseline regressions.
- [ ] Commit final fixes and QA evidence. Report exact test counts and performance measurements, and distinguish local qualification from actual iPhone/production host evidence. Do not push or deploy without authorization.

## Execution recommendation

Use Native execution in this session: one implementation context maintains the
source/replay interfaces across these tightly coupled tasks. After tests pass,
have a fresh reviewer inspect the whole change before the final commit. This
recommendation awaits the user's plan review and execution choice.
