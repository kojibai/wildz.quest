# Wildz Prompt Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved prompt-based creation system from its compact HUD through usable objects, creature work, shared consequences, commerce, and streamed worlds.

**Architecture:** Four ordered plans share an immutable creation graph and exact-head operation contract. Interpretation proposes; deterministic compilation derives; source-object admission changes state; bounded projections make the result playable. Existing manual construction remains compatible.

**Tech Stack:** TypeScript, React 19, Next.js 15, React Three Fiber/Three.js, Web Workers, IndexedDB, the installed Receiz SDK 128.0.0, and the repository's Node test harness.

**Spec:** [Approved design](../specs/2026-10-05-wildz-prompt-creation-design.md).

## Global Constraints

- “Existing manual construction remains available and compatible.”
- “Planning does not spend or reserve them.”
- “The planner never silently turns a requested working mechanism into decoration or claims completion from dialogue.”
- “An admitted operation either advances every required participant or produces a verified zero-write result.”
- “Never redispatch uncertain work, release its material reservation prematurely, invent a completed creation, or debit a second time.”
- “No creation graph interpretation, history replay, whole-roster capability derivation, or network request runs inside a movement/render callback.”
- “The release fails if normal gameplay latency/frame time regresses beyond measured run-to-run noise, existing device budgets are exceeded, or creation work introduces sustained stalls.”
- Preserve unrelated existing working-tree edits. Use a managed worktree at execution if isolation is needed; preserve the user's current changes. Do not install dependencies or introduce a parallel authority database merely to bypass unsupported Receiz operations.

## Review Focus

- Obsolete streaming responses after a selection/owner/space change cannot replace the current draft: Plan 1, Tasks 4–5.
- Compound geometry with an attractive exterior must still have reachable interiors: Plan 1, Task 2; Plan 2, Task 4.
- Multi-device recovery and revoked work must preserve pending resource ownership: Plan 2, Tasks 2–3; Plan 3, Tasks 1–2.
- Sale of an occupied or equipped creation must leave one valid custody and intact grants/history: Plan 3, Tasks 2–3.
- Huge nested spaces and worker/GPU failures must not stall movement or invent physical state: Plan 4, Tasks 1–5.

---

## Execution order and scope

- [ ] Before any product-code task, capture the existing game/browser/device performance baseline and current regression status in the qualification report. Preserve the pre-creation checkout/snapshot, device/profile/scene inputs, and declared measurement noise range. Do not wait until the feature is implemented to collect its baseline.

1. [Creation graph, compiler, prompt planner, and HUD](2026-10-05-wildz-prompt-creation-01-foundation.md). Independently testable output: a real prompt produces a validated, placed, saved preview; it is explicitly a proposal until execution is connected.
2. [Creature execution and usable instances](2026-10-05-wildz-prompt-creation-02-objects.md). Independently testable output: prompt-built inhabited architecture, equipped tools/weapons, finite gardens, consequential use/damage, and restore.
3. [Shared ownership, commerce, and maker benefit](2026-10-05-wildz-prompt-creation-03-sharing.md). Independently testable output: two players discover/use the same creation, transfer it, and settle permitted benefit without duplicate spending or lost edits.
4. [Large environments, connected spaces, and performance](2026-10-05-wildz-prompt-creation-04-worlds.md). Independently testable output: streamed palaces/caves, terrain/water/heat features, connected explorable worlds, and measured release qualification.

Native execution in this chat is recommended because the plans share compiler, source, state, and admission interfaces and the repository already contains unrelated local edits. Product implementation awaits review of these plans. This is not authorization to deploy or publish a release.

## Runtime evidence to collect during execution

- Prove structured generation through the existing qualified `receiz.world.message` transport, or use the explicit planner port with a configured provider. A keyword parser or local autobiographical response is not a substitute for open-ended generation.
- Prove current ownership/capability/mandate verification and exact participant transaction admission using installed SDK methods and authenticated operational qualification. Capability method existence is insufficient.
- Prove durable conditional append/lookup for creation transitions across independent clients/server instances. The existing world public projection's known overwrite limitation cannot satisfy this requirement.
- Prove creation asset custody/settlement and emission-benefit admission before enabling those controls.

When one capability is unavailable, preserve that capability's concrete adapter and tests, report the exact missing qualification, and continue independent implementation. Do not replace it with a mock success, make a preview physical, or claim the full system shipped.

## Common verification commands

Each task uses the relevant named test files. Compile targeted tests using the existing harness: `pnpm exec tsc -p tsconfig.test.json`, then `node scripts/patch-test-imports.mjs`, then `node --test .test-build/tests/<named-test>.test.js`. A first failing test must fail for the intended missing behavior, not an unrelated compiler failure. Record any unrelated baseline failure separately.

File notation is explicit: `creation/` and unqualified newly created creation module names resolve under `src/features/play/creation/`. Existing creation modules retain that location in later plans. Other unqualified existing play module names resolve under `src/features/play/`; server files use explicit `src/lib/receiz/` or `app/api/` paths. All test paths are repository-relative. Types named in a task's Interfaces block are exported from that task's listed module (shared creation types from `creation/types.ts`); do not add an unowned type or duplicate an earlier declaration.

At each completed plan, run `pnpm typecheck` and targeted ESLint on changed source files. At final integration, run `pnpm test`, `pnpm lint`, `pnpm build`, and the applicable existing Receiz/release checks. Do not repeatedly rerun broad checks after they pass unless a new edit or concern warrants it. Browser/multi-client and device performance checks remain separate from automated correctness tests.

## Spec coverage

| Spec requirement | Owning plan/tasks |
| --- | --- |
| Tasteful conversation, roster, resource allocation, follow-up prompts | 1/3–5 |
| Original composed geometry, graph identity, supported mechanics | 1/1–2; 2/1,4–7 |
| Actual creature work, resource ceilings, reservations, recovery | 2/1–3 |
| Physical interiors, use, tools/weapons, gardens, damage/repair | 2/4–7 |
| Access, occupancy, transfer, sale/license, public benefit | 3/2–5 |
| Durable global coordination and discovery | 3/1,6 |
| Vault/source restoration and compatibility | 1/1; 2/8; 3/6; 4/4 |
| Terrain, caves, mountains, water, heat, galaxies | 4/2–4 |
| Declarative sensors, logic, joints, bounded effects | 2/1,4–7; 4/3 |
| No unearned resource/rarity/currency generation | 2/2,6; 3/5; 4/4 |
| No gameplay performance regression | 1/2,5–6; 4/1,5 |

## Final completion evidence

- [ ] Run the eight acceptance scenarios in the approved spec through the actual game, not only fixtures.
- [ ] Record operational receipts, exact-head contention and lookup-only recovery evidence with secrets excluded.
- [ ] Record baseline and final performance on representative physical phone and desktop hardware with the same scenes/inputs.
- [ ] Save results and limits in `docs/release/2026-10-05-prompt-creation-qualification.md`; date later execution evidence accurately if work continues on another day.
- [ ] Mark only delivered/qualified capabilities complete, retain clear pending status for anything unresolved, and present the resulting local diff and tests for review.
