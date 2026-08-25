# Persistent Cooperative Construction V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a refresh-safe place, contribute, companion-work, and complete loop for Trail Shelters and Trail Bridges.

**Architecture:** Add one content-addressed construction-site domain object and project its three causal transitions through the existing Wilds world event service. Keep preview state disposable, reserve exact contributed lots until terminal work atomically converts them into the existing completed structure and settlement proofs, then render and control the projection through the existing Steward UI and Three.js environment.

**Tech Stack:** TypeScript, React 19, Next.js App Router, Three.js/React Three Fiber, Node test runner, existing Receiz V124.0.2 proof and world checkpoint rails.

**Spec:** `docs/superpowers/specs/2026-08-25-persistent-cooperative-construction-v1-design.md`

## Global Constraints

- Receiz ID and source proof objects remain authority; SDK/API distribution cannot outrank them.
- Preview and placement UI consume no lots and issue no Φ.
- Exact lots may be loose, stored, reserved, or consumed, never more than one.
- Only terminal admitted work issues bounded construction Φ and completed collision.
- No new animation loop, physics engine, polling, or movement-time proof computation.
- Legacy checkpoints and historical instant-build events remain replay-compatible.
- Mobile controls remain at least 44 CSS pixels, safe-area aware, wrapping, and non-truncating.

---

### Task 1: Construction Site Proof Object

**Files:**
- Create: `src/features/play/wilds-construction-site.ts`
- Create: `tests/wilds-construction-site.test.ts`

**Interfaces:**
- Consumes: `WildsMaterialLotV1`, `WildsStructureV1`, `createWildsTrailShelter`, `createWildsTrailBridge`, canonical hashing, and terrain validation.
- Produces: `WildsConstructionSiteV1`, `createWildsConstructionSite`, `contributeWildsConstructionSite`, `completeWildsConstructionSite`, and `verifyWildsConstructionSite`.

- [ ] Write failing tests with literal expectations for deterministic placement, exact remaining counts, revision/parent advancement, stale-parent failure, over-contribution failure, terminal irreversibility, and terminal structure lineage.
- [ ] Run `npx tsx --test tests/wilds-construction-site.test.ts` and confirm failure because the module does not exist.
- [ ] Implement the minimal immutable domain functions and content-addressed verifier.
- [ ] Re-run the focused test and confirm every case passes.
- [ ] Refactor only duplicated canonical validation while retaining the passing focused test.

### Task 2: Event Projection and Checkpoint Compatibility

**Files:**
- Modify: `src/features/play/wilds-world-event.ts`
- Modify: `src/features/play/wilds-world-state.ts`
- Modify: `tests/wilds-world-state.test.ts`

**Interfaces:**
- Consumes: verified construction-site transitions from Task 1.
- Produces: `constructionSites`, `reservedMaterialLots`, and reducers for `construction.site_placed`, `construction.site_contributed`, and `construction.site_worked`.

- [ ] Write failing reducer tests proving placement adds no reservation, contribution reserves each exact lot once, stale/divergent transitions write nothing, completion moves reservations to consumption and adds one structure, and legacy checkpoints hydrate empty maps.
- [ ] Run the focused world-state tests and confirm expected missing-kind/projection failures.
- [ ] Add event kinds, projection maps, reducer validation, and legacy hydration.
- [ ] Re-run the focused tests and preserve existing historical `structure.built` behavior.

### Task 3: Authoritative World Commands

**Files:**
- Modify: `src/features/play/wilds-world-service.ts`
- Modify: `src/features/play/wilds-world-authority.ts`
- Modify: `src/lib/receiz/wilds-world-server.ts`
- Modify: `tests/wilds-steward-world-service.test.ts`

**Interfaces:**
- Consumes: site domain and event projection from Tasks 1-2 plus existing mandate, operation, emission, and Φ proofs.
- Produces: `construction.site.place`, `construction.site.contribute`, and `construction.site.work` command handling.

- [ ] Write one failing end-to-end service test for place → refresh restore → contribute exact lots → refresh restore → companion work → completed structure and Φ.
- [ ] Add failing atomicity cases for stored/reserved/consumed lots, foreign lots, stale site heads, unreachable actors, unqualified mandates, replayed command IDs, and Φ before completion.
- [ ] Run the focused service test and confirm command-kind failures.
- [ ] Implement server-side recomputation and exact validation for all three commands; never trust client-shaped terminal structures or economy proofs.
- [ ] Re-run focused service and world-state tests until green.

### Task 4: Client Command Adapter

**Files:**
- Modify: `src/features/play/use-wilds-world.ts`
- Modify: `src/features/play/wilds-world-outbox.ts`
- Modify: `tests/wilds-world-outbox.test.ts`

**Interfaces:**
- Consumes: exact site heads and current local projection.
- Produces: `placeConstructionSite`, `contributeConstructionSite`, and `workConstructionSite` methods using the existing post/outbox path.

- [ ] Write failing outbox tests proving all site commands use the same canonical optimistic/reconciliation boundary and cannot bypass snapshot heads.
- [ ] Implement client proof preparation, stable exact-lot selection inputs, and command posting.
- [ ] Re-run focused outbox tests and typecheck.

### Task 5: Natural Steward UI

**Files:**
- Modify: `src/features/play/WildsStewardCraftPanel.tsx`
- Modify: `src/features/play/WildsStewardPlacementHud.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `app/globals.css`
- Modify: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Consumes: nearest admitted site, current exact loose lots, active companion state, and Task 4 actions.
- Produces: place-site confirmation, nearby site material/work meter, contribute action, work action, and exact completion feedback.

- [ ] Write failing render tests for “Place site,” exact site meters, one clear next action, disabled reasons, 44px targets, safe-area placement, wrapping, and no tutorial copy.
- [ ] Change shelter/bridge confirmation to admit a site without consuming lots.
- [ ] Project the nearest six-meter site and wire stable exact-lot contribution followed by companion work.
- [ ] Add responsive, premium partial-build controls without overlaying gameplay or truncating values.
- [ ] Re-run render and PlayCampaign contract tests.

### Task 6: Admitted Partial World Geometry

**Files:**
- Modify: `src/features/play/WildsStewardEnvironment.tsx`
- Modify: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Consumes: `livingWorld.constructionSites` only.
- Produces: bounded nearby partial-site geometry; completed geometry remains owned by existing `structures` rendering.

- [ ] Write a failing render contract proving partial geometry is sourced from admitted construction sites and has no collision authority.
- [ ] Add shared survey/foundation/material geometry whose visible pieces derive from admitted material/work progress.
- [ ] Confirm ordinary movement adds no state writes, timers, or new geometry allocation paths.
- [ ] Re-run render contracts.

### Task 7: Release Verification and Integration

**Files:**
- Modify only files required by failures found during verification.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: a committed, merge-ready progressive construction slice.

- [ ] Run focused construction, service, state, outbox, and render suites.
- [ ] Run `pnpm test` and require zero failures.
- [ ] Run `pnpm run build` and require exit code 0.
- [ ] Load the production build at a mobile viewport, execute place → contribute → work, refresh between stages, check canvas pixels and console errors, and capture screenshots.
- [ ] Run `git diff --check`, inspect the final diff, remove temporary test artifacts, and commit the complete feature.

