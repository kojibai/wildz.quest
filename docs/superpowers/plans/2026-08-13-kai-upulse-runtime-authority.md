# Kai uPulse Runtime Authority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make exact Kai `uPulse` the runtime authority for current Kai and chapter-scoped world progression so stale persisted chapters or absent scheduler ticks cannot reject valid gameplay.

**Architecture:** Introduce a pure monotonic Kai runtime clock that stores an integer `uPulse`, construct exact Kai temporal roots at the client command boundary, and reconcile saga projections from the command root before executing chapter actions. Preserve ISO fields as descriptive compatibility metadata and leave economy/session timers unchanged.

**Tech Stack:** TypeScript, React 19, Next.js 15, Node test runner, deterministic Wildz domain services.

## Global Constraints

- Exact non-negative safe-integer `uPulse` is the sole gameplay temporal authority.
- Kai moments used for gameplay are derived with `deriveKaiKlokMomentFromUPulse`.
- ISO timestamps remain descriptive interoperability metadata and cannot order or veto gameplay.
- Persisted world cursors order admitted events but never represent current Kai.
- Receiz persists and proves transitions; it does not choose the active Kai chapter.
- Existing immutable card bases and admitted histories are not rewritten.
- Animation clocks, input cadence, network retries, payment, authentication, reservations, presence, and leases remain outside this pass.

---

### Task 1: Monotonic Kai Runtime Clock

**Files:**
- Modify: `src/features/play/wilds-kai-runtime.ts`
- Modify: `src/features/play/PlayCampaign.tsx`
- Test: `tests/wilds-kai-runtime.test.ts`

**Interfaces:**
- Produces: `createWildsKaiRuntimeClock(input)` with `read(elapsedMs, observedUPulse?)` and a non-rewind floor.
- Produces: `resolveWildsRuntimeKaiMoment({ mode, uPulse, cursor })` deriving through `deriveKaiKlokMomentFromUPulse`.
- Consumes: existing exact Genesis arithmetic only at the observation boundary.

- [ ] **Step 1: Write failing runtime-clock tests**

Add real behavior tests proving monotonic elapsed time advances `uPulse`, a re-anchor cannot rewind it, a later observation advances it, and current Kai ignores a stale world cursor.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx tsx --test tests/wilds-kai-runtime.test.ts`

Expected: FAIL because the clock API and exact `uPulse` resolver do not exist.

- [ ] **Step 3: Implement the pure clock and migrate PlayCampaign**

Keep baseline arithmetic and monotonic elapsed-time handling inside `wilds-kai-runtime.ts`. Store `kaiUPulse` in React state, schedule integer pulse changes, and derive the complete moment from that integer. Do not store current Kai as an ISO string.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npx tsx --test tests/wilds-kai-runtime.test.ts tests/wildz-kai-klok-moment.test.ts tests/kai-temporal-root.test.ts`

Run: `pnpm typecheck`

- [ ] **Step 5: Commit**

```bash
git add src/features/play/wilds-kai-runtime.ts src/features/play/PlayCampaign.tsx tests/wilds-kai-runtime.test.ts
git commit -m "feat: make Kai uPulse the runtime clock"
```

### Task 2: Exact Kai Roots on World Commands

**Files:**
- Modify: `src/features/play/wilds-world-service.ts`
- Modify: `src/features/play/use-wilds-world.ts`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/lib/receiz/wilds-world-server.ts`
- Test: `tests/wilds-world-client.test.ts`
- Test: `tests/wilds-world-authority.test.ts`

**Interfaces:**
- Produces: every gameplay `WildsWorldCommand` carries `kai: KaiTemporalRoot`.
- Produces: `verifyWildsWorldCommandKai(command)` returning an exact verified root.
- Consumes: current runtime moment supplied by PlayCampaign.

- [ ] **Step 1: Write failing command-boundary tests**

Prove command builders preserve the exact safe-integer `uPulse`, reject malformed roots, and do not replace a command root with server `new Date()` state.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx tsx --test tests/wilds-world-client.test.ts tests/wilds-world-authority.test.ts`

- [ ] **Step 3: Add the exact command root and server verification**

Construct the root in `use-wilds-world.ts`, verify it at the service boundary, and use its `uPulse` for event creation and saga derivation. Retain `occurredAt` only as descriptive metadata, sourced from `kai.observedAt` when present or a canonical compatibility value otherwise.

- [ ] **Step 4: Run focused world-command suites and typecheck**

Run: `npx tsx --test tests/wilds-world-client.test.ts tests/wilds-world-authority.test.ts tests/wilds-world-event.test.ts tests/wilds-world-outbox.test.ts`

Run: `pnpm typecheck`

- [ ] **Step 5: Commit**

```bash
git add src/features/play/wilds-world-service.ts src/features/play/use-wilds-world.ts src/features/play/PlayCampaign.tsx src/lib/receiz/wilds-world-server.ts tests/wilds-world-client.test.ts tests/wilds-world-authority.test.ts
git commit -m "feat: root world commands in Kai uPulse"
```

### Task 3: Command-Driven Chapter Reconciliation

**Files:**
- Modify: `src/features/play/wilds-world-service.ts`
- Modify: `src/features/play/wilds-world-state.ts`
- Test: `tests/wilds-saga-world-service.test.ts`
- Test: `tests/wilds-saga-world-state.test.ts`

**Interfaces:**
- Produces: `reconcileSagaAt(authority, causeId, events)` materializing deterministic chapter state from the command `uPulse`.
- Consumes: existing saga director, chapter settlement, trainer projection, tournament projection, and append-only world events.

- [ ] **Step 1: Write the failing no-tick and rollover tests**

Test that a current-chapter contribution succeeds on an empty service without `tick()`, and that a next-day command settles the old chapter, opens the derived chapter, then applies the command in causal sequence. Test that a genuinely wrong day ID still fails.

- [ ] **Step 2: Run saga service tests and verify RED**

Run: `npx tsx --test tests/wilds-saga-world-service.test.ts tests/wilds-saga-world-state.test.ts`

Expected: FAIL with `wilds_story_chapter_inactive` for the no-tick command.

- [ ] **Step 3: Reconcile from Kai before chapter commands**

Reuse the existing deterministic `advanceSaga` logic from both ticks and commands. The command path appends missing settlement/open/trainer/tournament events before validating the chapter-scoped payload. Replace stale-cache checks with comparison against the saga derived from the command root.

- [ ] **Step 4: Verify replay and idempotency**

Run: `npx tsx --test tests/wilds-saga-world-service.test.ts tests/wilds-saga-world-state.test.ts tests/wilds-world-event.test.ts tests/wilds-world-replay.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/features/play/wilds-world-service.ts src/features/play/wilds-world-state.ts tests/wilds-saga-world-service.test.ts tests/wilds-saga-world-state.test.ts
git commit -m "fix: derive active chapters from Kai uPulse"
```

### Task 4: Player-Facing Continuity and Temporal Audit Guard

**Files:**
- Modify: `src/features/play/PlayCampaign.tsx`
- Create: `src/features/play/wilds-temporal-errors.ts`
- Create: `tests/wilds-temporal-authority.test.ts`
- Modify: `tests/wilds-saga-ui.test.ts`

**Interfaces:**
- Produces: `friendlyWildsTemporalError(cause)` for bounded player copy.
- Produces: an executable audit test classifying remaining wall-clock uses as presentation, animation, network/session, or an explicitly tracked gameplay migration boundary.

- [ ] **Step 1: Write failing presentation and audit tests**

Prove raw `wilds_story_chapter_inactive` never reaches the HUD and that current chapter actions use the runtime Kai root. Add behavior-level checks for the migrated runtime/world path while maintaining an explicit allowlist for deferred economy/session timers.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx tsx --test tests/wilds-temporal-authority.test.ts tests/wilds-saga-ui.test.ts`

- [ ] **Step 3: Add friendly temporal errors and close discovered gameplay leaks**

Map impossible/stale internal chapter errors to actionable continuity copy, and replace any ISO-only decision found inside the migrated current-Kai/chapter command path. Do not modify operational timers.

- [ ] **Step 4: Run the complete focused continuity matrix**

Run: `npx tsx --test tests/wilds-kai-runtime.test.ts tests/kai-temporal-root.test.ts tests/wilds-world-client.test.ts tests/wilds-world-authority.test.ts tests/wilds-world-event.test.ts tests/wilds-world-outbox.test.ts tests/wilds-saga-world-service.test.ts tests/wilds-saga-world-state.test.ts tests/wilds-saga-ui.test.ts tests/wilds-temporal-authority.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/features/play/PlayCampaign.tsx src/features/play/wilds-temporal-errors.ts tests/wilds-temporal-authority.test.ts tests/wilds-saga-ui.test.ts
git commit -m "fix: keep Kai continuity errors out of gameplay UI"
```

### Task 5: Full Verification and Rendered Chapter Flow

**Files:**
- Modify only if a verified regression requires a scoped fix.

**Interfaces:**
- Consumes all earlier task outputs.
- Produces fresh test, type, and rendered-flow evidence.

- [ ] **Step 1: Run static and full automated verification**

Run: `pnpm typecheck`

Run: `pnpm test`

- [ ] **Step 2: Run local rendered QA**

Open the Wilds world at mobile and desktop sizes, open Living Story, perform a current chapter action without manually invoking the tick endpoint, and verify the action changes state without a raw temporal error. Check page identity, nonblank content, framework overlays, console warnings/errors, and screenshot evidence.

- [ ] **Step 3: Inspect repository state**

Run: `git diff --check`

Run: `git status --short`

- [ ] **Step 4: Commit any final verified integration-only correction**

Use a scoped commit only if Step 2 reveals a reproducible defect. Otherwise leave the already verified task commits unchanged.
