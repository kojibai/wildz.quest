# Living Work and Construction V1 Implementation Plan

> Execute this plan in the isolated `kojib/living-work-crafting-v1` worktree with test-driven development.

**Goal:** Make lawful stewardship physically legible: the bonded creature performs the work, the exact source visibly changes and recovers from admitted state, and persistent structures assemble piece by piece without delaying edge settlement.

**Core loop:** Approach a marked living source, work beside a willing qualified creature, receive one exact material lot plus bounded Phi, then use conserved lots to leave a persistent useful structure in the shared world.

**Authority boundary:** World events and proof objects remain the only authority. Work animation is a responsive projection keyed to the exact source ID; it can never create lots, Phi, or structures. Settlement begins immediately and animation reconciles to the returned projection.

## Task 1: Deterministic work presentation

**Files:**
- Create: `src/features/play/wilds-work-presentation.ts`
- Test: `tests/wilds-work-presentation.test.ts`

Define a bounded presentation contract for `approach`, `work`, and `settle` phases, with source recovery projected independently from authoritative Kai availability. Project source vitality, tree crown/trunk scale, rock scale/fracture, ring intensity, creature offset, pose, and impact pulses solely from exact source state, capacity, pending source identity, and elapsed presentation time.

Tests must prove finite bounded values, exact-source isolation, depletion progression, exhausted-but-visible stump/fracture state, and monotonic recovery.

## Task 2: Wire exact-source work into active play

**Files:**
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `src/features/play/WildsStewardEnvironment.tsx`
- Modify: `src/features/play/WildsEnvironment.tsx`
- Test: `tests/wilds-render-contract.test.ts`

Track the selected source as transient presentation state before starting the already-authoritative harvest command. Pass that exact identity and position through the canvas. Move the active companion toward the source, orient it toward the work, and use a work pose while the command is in flight. Render event-driven timber chips or stone fragments only for that source. Clear the transient state after reconciliation without delaying command execution.

Project every rendered tree and rock from admitted harvested state. Trees retain a visible stump/trunk and progressively reduced crown; stones retain a visible fractured base. Recovery restores their full form from the same Kai availability projection already used by harvesting.

## Task 3: Piece-by-piece persistent construction presentation

**Files:**
- Modify: `src/features/play/WildsStewardEnvironment.tsx`
- Test: `tests/wilds-render-contract.test.ts`

Replace whole-structure vertical pop-in with deterministic assembly groups. Shelter foundations, posts, beams, and roof appear in order; bridge footings, deck, planks, posts, and rails appear in order. Keep proof-authoritative completed structures persistent while their first local presentation communicates cooperative building.

## Task 4: Verification and release

Run focused tests after each red/green cycle, then full tests, typecheck, production build, desktop and mobile active-play browser checks, console/page errors, and renderer diagnostics. Record the external generation credential blocker literally and score only the surfaces changed in this slice. Commit the verified feature, fast-forward the main branch, rerun merged verification, and remove only this task's worktree and branch.
