# Steward Tools, Workbench, and Storage V1 Implementation Plan

**Goal:** Ship an authoritative gather → workstation → tool → improved work → storage loop with persistent world state and production UI.

**Architecture:** Extend the existing steward construction proof objects and shared-world event reducer. Keep all mutations command-driven and replayable; project UI and Three.js geometry only from the resulting world projection.

**Tech Stack:** TypeScript, React, Next.js App Router, Three.js, node:test.

---

### Task 1: Proof objects

**Files:** modify `src/features/play/wilds-steward-construction.ts`; create `tests/wilds-steward-tools.test.ts`.

1. Write failing tests for workbench/cache exact costs and deterministic tool creation, verification, durability revision, and quality improvement.
2. Run the focused test and observe failure.
3. Add structure variants and proof-bound tool functions.
4. Run the focused test green.

### Task 2: Shared-world authority

**Files:** modify `wilds-world-event.ts`, `wilds-world-state.ts`, `wilds-world-service.ts`, `wilds-world-authority.ts`; create `tests/wilds-steward-tool-world-service.test.ts`.

1. Write failing service/replay tests for workbench build, tool craft/equip/use, cache deposit/withdraw, double-spend rejection, and checkpoint recovery.
2. Add commands, events, reducer maps, validation, and compatibility defaults.
3. Keep harvest and tool durability revision atomic.
4. Run focused service/replay tests green.

### Task 3: Client command and UI loop

**Files:** modify `use-wilds-world.ts`, `wilds-steward-craft.ts`, `WildsStewardCraftPanel.tsx`, `PlayCampaign.tsx`; add a focused workshop component if needed.

1. Add failing contract tests for catalog costs, workstation/tool states, and storage actions.
2. Add client-side exact command construction using current projection heads.
3. Surface structures, tools, equip state, durability, and cache contents with responsive controls.
4. Run contract tests green.

### Task 4: World projection and rendering

**Files:** modify `WildsStewardEnvironment.tsx` and related renderer contracts/tests.

1. Write failing renderer contract assertions for workbench/cache static geometry.
2. Add memoized, culled geometry with distinct natural silhouettes.
3. Verify no frame-loop/polling additions.

### Task 5: Release verification and integration

1. Run focused tests after every task.
2. Run full test suite, typecheck, lint/build.
3. Run mobile browser verification for the complete loop and responsive HUD.
4. Remove temporary workspace links, inspect diff, commit, and merge the verified branch into `main`.
