# Wildz Hearttree Full Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Hearttree four-button sequence with a proof-pinned, deterministic, mobile-playable expedition using the already-imported Receiz v105 runtime while preserving the approved Wildz modal, controls language, audio catalog, and mobile performance profile.

**Architecture:** Keep the pure v105 Hearttree director/runtime/replay/consequence modules as the rules authority. Add a thin Wildz presentation/controller layer, persist verified receipts and shared card conditions through `PlayState`, and use the current analytic collision model at 60 Hz without a physics dependency. Connected results are server-replayed before adoption; offline/practice results never invent canonical consequences.

**Tech Stack:** TypeScript, React 19, Next.js 15 App Router, Three.js via React Three Fiber, Node test runner, Receiz SDK/MCP/AI skills v105.

## Global Constraints

- Do not change, add, replace, or retune any audio or music file, catalog entry, mix, or playback behavior.
- Preserve the current `wilds-landmark-experience` surface, header, visual language, and button design.
- Use only existing dependencies; keep deterministic analytic collision and add no external physics engine.
- One to three verified living cards may enter; dead or retired cards remain visible in the Vault but cannot play.
- Network, publication, replay, browser, or storage failure can never injure or kill a card.
- Permanent consequences require verified replay and matching explicit Mortal consent.
- Follow red-green-refactor TDD for every behavior change.

## Reference Ledger

- `threejs-gameplay-systems/references/gameplay-workflows.md`: yes; runtime/input/camera/game-feel workflow applies.
- `threejs-gameplay-systems/references/physics-engine-selection.md`: yes; custom analytic collision selected because the imported deterministic runtime uses bounded arcade proxies and mobile size is critical.

---

### Task 1: Restore a Green v105 Baseline

**Files:**
- Modify: `src/features/play/wilds-ecology-activity.ts`
- Test: `tests/wilds-ecology-activity.test.ts`

**Interfaces:**
- Consumes: `generateMarketBoard({ pulse })`, where `pulse` is an ISO timestamp.
- Produces: `createWildsMarketActivity(site, card)` with deterministic contract content.

- [ ] Run the existing failing test and confirm `market_pulse_invalid`.
- [ ] Pass canonical `site.spawnedAt` rather than `site.seedDigest` to `generateMarketBoard`.
- [ ] Run `tests/wilds-ecology-activity.test.ts` and confirm the Wayfarer adapter passes.

### Task 2: Persist Hearttree Conditions, Squads, and Verified Receipts

**Files:**
- Modify: `src/features/play/game-state.ts`
- Create: `tests/hearttree-play-state.test.ts`

**Interfaces:**
- Consumes: `HearttreeReceipt`, `verifyHearttreeReceipt`, `applyHearttreeConsequences`.
- Produces: `PlayState.adventureConditions`, `hearttreeConditions`, `hearttreeReceipts`, `hearttreeSquadAssetIds`; inputs `hearttree-admit` and `hearttree-select-squad`.

- [ ] Write failing tests proving old saves migrate, exact receipts apply atomically, duplicates are idempotent, dead cards remain in inventory, and dead cards cannot be selected.
- [ ] Run the focused tests and confirm the missing state fields/actions fail.
- [ ] Add save-schema migration and bounded receipt/squad restoration without removing current owner binding or support slots.
- [ ] Add centralized playable-card guards and receipt adoption.
- [ ] Run focused game-state and Hearttree tests until green.

### Task 3: Add Server Replay Admission Without New Audio

**Files:**
- Create: `src/lib/receiz/wilds-hearttree-server.ts`
- Create: `app/api/wilds/hearttree/route.ts`
- Create: `tests/wilds-hearttree-server.test.ts`

**Interfaces:**
- Consumes: proof-pinned cards, prior conditions, expedition definition, transcript, Mortal consent, and Receiz adapter dependencies.
- Produces: `executeHearttreeAdmission(request, body, dependencies?)` returning a verified receipt only after replay/publication succeeds.

- [ ] Write failing tests for proof mismatch, transcript tamper, normal live publication, practice replay, idempotency, and publication failure with zero adopted consequence.
- [ ] Run focused tests and confirm the server module is missing.
- [ ] Port the v105 replay-admission service and adapt it to current Wildz actor/session rails.
- [ ] Add the no-store App Router endpoint.
- [ ] Run server, authority, and Receiz contract tests until green.

### Task 4: Build the Existing-Surface Hearttree Runtime Controller

**Files:**
- Create: `src/features/play/hearttree/use-hearttree-expedition.ts`
- Create: `src/features/play/hearttree/HearttreeRuntimeExperience.tsx`
- Create: `src/features/play/hearttree/HearttreeControls.tsx`
- Test: `tests/hearttree-ui-contract.test.ts`

**Interfaces:**
- Consumes: inventory, conditions, saved squad IDs, world mode, existing `WildsAudioCue` callback, receipt callback, and unlock callback.
- Produces: squad gate, runtime state, movement/dodge/guard/ability/switch/interact/extract intents, pause, publication state, and result ceremony.

- [ ] Write failing UI contract tests for one-to-three-card selection, explicit Mortal confirmation, all runtime intents, real health/stamina/cooldowns, extraction, pause, receipt publication, and absence of new audio imports.
- [ ] Run the test and confirm the runtime experience is absent.
- [ ] Implement the hook using `createHearttreeRuntime`, `stepHearttreeRuntime`, and `hearttreeTranscript`; bound input cadence and clear held inputs on cancel/blur.
- [ ] Implement the experience with the current landmark header/world/footer classes and existing icon/button language.
- [ ] Run UI and type tests until green.

### Task 5: Render the Playable Mobile Hearttree Chamber

**Files:**
- Create: `src/features/play/hearttree/HearttreeScene.tsx`
- Modify: `app/globals.css`
- Modify: `tests/hearttree-ui-contract.test.ts`

**Interfaces:**
- Consumes: `HearttreeRuntimeState`, selected cards, expedition definition, reduced-motion preference.
- Produces: a lightweight R3F scene with analytic floor, hazard proxies, objective, Root Master, current card actor, smooth camera follow, and gated diagnostics.

- [ ] Add failing static/browser contracts for a real Canvas, objective/hazard/boss layers, camera outside React state, capped DPR, and diagnostics.
- [ ] Run the contracts and confirm the scene is missing.
- [ ] Implement the scene with reusable geometry/materials, no per-frame React state, and existing `WildsCreatureActor`.
- [ ] Add responsive styles that retain the existing modal footprint and safe-area controls.
- [ ] Run UI contracts and typecheck until green.

### Task 6: Connect Hearttree to the Existing Campaign and Save Loop

**Files:**
- Modify: `src/features/play/WildsLandmarkExperience.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `tests/wilds-landmark-activities.test.ts`
- Modify: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Consumes: `PlayState` conditions/squad/receipts, current world mode and actor, runtime experience callbacks.
- Produces: Hearttree routing without changing Arena or Prism; accepted receipts dispatch through the owning reducer.

- [ ] Write failing integration tests proving the Hearttree branch uses the runtime experience, Arena/Prism remain intact, and practice results cannot mutate persistent card state.
- [ ] Run tests and confirm the old trial branch fails the new contract.
- [ ] Route only `hearttree-sanctum` to `HearttreeRuntimeExperience` and thread state/callback props from `PlayCampaign`.
- [ ] Remove production use of `createHearttreeTrial` only after integration is green.
- [ ] Run landmark/render/game-state tests until green.

### Task 7: Mobile Browser, Performance, and Release Qualification

**Files:**
- Create: `tests/hearttree-release.test.ts`
- Modify only defects found in Hearttree files or `app/globals.css`.

**Interfaces:**
- Consumes: complete Hearttree vertical slice.
- Produces: verified mobile input, nonblank canvas, objective progress, extraction/result, reload-safe state, and performance evidence.

- [ ] Add failing release-contract tests for files, endpoint, reducer fields, preserved audio catalog, and no obsolete production trial import.
- [ ] Run focused release tests to RED, then finish missing wiring to GREEN.
- [ ] Run typecheck, all tests, Receiz check/conformance, and optimized production build.
- [ ] Run a real mobile WebKit path: open Hearttree, select a squad, move, guard/dodge, interact or extract, verify nonblank canvas and zero console errors.
- [ ] Confirm `git diff` contains no audio/music changes and commit the verified slice.

## Completion Review

- Full runtime inputs and deterministic replay: Tasks 4–6.
- Persistent conditions, receipts, and dead-card safety: Tasks 2–3.
- Existing-surface 3D presentation and mobile feel: Tasks 4–5.
- Offline/practice and connected authority boundary: Tasks 2–3 and 6.
- Audio preservation and release evidence: Task 7.
