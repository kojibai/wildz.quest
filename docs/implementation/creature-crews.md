# Creature crews: requested outcome and remaining implementation

Status: NOT IMPLEMENTED end to end. Companion movement improvements are separate.

The owner wants a tool icon beside flight and creature skills, opening a roster-wide crew panel. Every creature may have an independent assignment: follow, voluntary exploration, gathering, hauling, construction, or recall. Work must reflect the exact current genome, capability, willingness, energy and injuries. Journeys should visibly leave and return, carrying actual outcomes, discoveries and event-linked memories. Construction crews must share reserved resources without duplicate spending, coordinate dependencies, and create useful structures for owners, visitors and creatures. Recall stops new work and returns the creature; already committed work remains history.

## Existing facts

- `creature-continuity.ts` supports bounded life-while-away stories and non-value keepsakes. Its small predefined location/discovery catalog is not a physical map simulation.
- `wilds-creature-work.ts` compiles a preview only and explicitly blocks execution behind an old v122 note.
- Installed SDK/MCP/AI skills are v126. `createReceizSubjectMandateV122`, `validateReceizMandateUseV122`, and `client.subjectMandates.issue/state/revoke` exist. Method availability is not operational admission evidence.
- Receiz MCP capability inspection succeeded, but supplied no authenticated scopes and did not demonstrate a live worker transaction.
- Existing construction/harvest commands validate materials and local admission. They are not yet a physically independent multi-creature hauling/execution system.

## Required implementation sequence

1. Bind each assignment to exact current owner/worker proof objects, heads, allowed commands, world/region, resource and geometry budgets, expiry, nonce and revocation head. The panel presents the exact mandate for owner confirmation.
2. Persist independent per-creature jobs and a dependency graph. Reserve exact material lots across gather/haul/build tasks. Execute transitions atomically; a rejected command makes zero changes.
3. Add navigation for each canonical locomotion type with solids, floor support, cave/structure portals and reachability. Bound planning per tick and visible creature detail separately; avoid a React update per actor per animation frame.
4. Reverify mandate, owner, worker, limits, consent and revocation at every execution. Use SDK typed commands/transactions, exact receipt validation and idempotency recovery. Unknown outcomes require lookup, not blind reexecution.
5. Record actual world events and material custody, then derive creature memories, discovered map regions and return reports from those events. No fabricated meetings, items or map progress from generated text. Respect other players' ownership and interaction consent.
6. Add the skill-row crew icon, per-creature controls, task assignment/recall, shortage/blocker explanations, visible progress and return reports. Keep voluntary online roaming separate from life-while-away care rules.
7. Verify multi-device continuation, owner transfer/revocation, contested resources, concurrent builders, offline recovery, unreachable paths, depleted materials and real mobile performance. Do not mark complete from a mock-only executor.

## Skill and SDK evidence

Read `node_modules/@receiz/ai-skills/receiz-autonomous-mandate/SKILL.md`, its manifest and SDK/MCP/example maps. The skill requires one owner confirmation for the exact mandate digest and runtime revalidation. No live mandate was issued during this work. MCP is a tooling projection, not proof authority.

## 2026-09-12 causal and execution foundations

Implemented and unit tested, but not a live autonomous crew:

- `wilds-crew-mandate.ts` prepares SDK mandates from explicitly verified proof objects and preflights exact command consent, current ownership/heads, revocation, expiry and cumulative budgets. Production verification and issuance adapters remain required.
- `wilds-crew-navigation.ts` provides bounded deterministic paths and allocation-free movement against a caller-supplied canonical swept-segment sampler. Rendering and authoritative per-worker geometry/position integration remain required.
- `wilds-crew-reservations.ts` performs all-or-nothing scheduling allocation on a supplied snapshot. It is not material custody or a cross-device lock. Its caller must atomically persist changes and retain pending-dispatch reservations through recall and recovery.
- `wilds-crew-causality.ts` builds SDK-digested records with local observed Kai micro-pulses, monotonic causal micro-pulses, logical sequence, previous worker event, explicit dependencies and admitted world-event citations. It preserves a regressed physical clock observation instead of falsifying time. Pending work cannot become a completed dependency. Records still require a durable append-only journal and compare-and-swap worker heads. A valid digest alone is not event admission.
- Existing transaction execution/recovery now returns `writes: "unknown"` and `recoveryRequired: true` for ambiguous, malformed, unverifiable or unavailable outcomes. Exact verified zero-write outcomes still return zero. Recovery never redispatches unknown work. A previously staged identical transaction cannot dispatch through the authored activation again.

No live mandate, crew work, material movement or autonomous construction was activated by these changes. No new network work or frame-loop work was introduced. Device frame-time equivalence has not been measured for a complete crew system because that system is not yet integrated.

## Durable causal execution boundary

`wilds-crew-journal.ts` now stores individual causal events, exact transaction candidates, worker heads, command identity and lot reservations in the existing browser IndexedDB. Appends compare worker heads and update all scheduling rows in one transaction. Replays must match their transaction and lots; a previously used transaction cannot be proposed after intervening work. Display pagination does not truncate history. Undispatched proposals can be cancelled atomically; pending dispatches retain reservations.

`wilds-crew-execution.ts` connects that journal to the existing SDK transaction executor. It requires a fresh production authorization port, exact participant/mandate bindings and world-event causal parents, then records proposed/pending/admitted or rejected states. Exact recovery never redispatches. A failed local completion write keeps the runtime transaction and scheduling reservations for recovery. Approved transaction inputs are cloned and deeply frozen before SDK validation/staging/dispatch callbacks.

This boundary has contract tests using explicit authority/runtime doubles, plus a real Chrome IndexedDB test with two competing tabs and reload. It is not mounted in the gameplay UI yet. Production proof/mandate authorization, task selection, independent visible workers and actual world gather/haul/build command admission remain required. The UI/renderer has not been changed in this checkpoint. Cross-tab IndexedDB serialization does not establish cross-device authority.

## Alongside travel and local exploration integration

The crew paw control now drives real local excursions for active/support companions: bounded reachable destinations, actual physical arrival, Kai-timed inspection, recall, return and persistent visit reports. Player transport carries the accompanying party through an explicit relocation marker. Ground detours remain collision checked and are no longer reset by direct chase or timer ticks.

Durable job state and source-family/mandate adapters are implemented and tested separately. They are not yet connected to autonomous material mutations; current Roam visits do not mint materials, Phi, mission progress or shared world discoveries. Full-roster independent simulation, verified material jobs and the remaining source-binding integration described in crew-proof-source-integration.md remain outstanding.

## Recovery and source retention checkpoint

The crew execution boundary now fences the current working job atomically at dispatch after asynchronous checks. Recall cancels undispatched proposals or preserves pending recovery. Artifact proof digests and current subject execution heads have distinct fields. Production exports retain exact sealed sources with append-only paginated location indexes; restored source history is reused. The travel panel reads actual trip records on demand, while lifecycle guards prevent stale owner/proof callbacks from restarting obsolete trips. See crew-live-integration-checkpoint.md for scope and validation.
