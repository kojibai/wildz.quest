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
