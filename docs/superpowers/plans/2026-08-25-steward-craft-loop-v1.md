# Steward Craft Loop V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one seamless discover, work, gather, preview, construct, and persist loop on the existing proof-authoritative Wildz stewardship rails.

**Architecture:** Add one pure craft projection that describes the admitted blueprint catalogue and disposable placement state. Drive a focused React craft selector and placement HUD from that projection, while the mounted Three.js world renders a shared-geometry ghost and the existing world command remains the sole settlement boundary.

**Tech Stack:** TypeScript, React 19, Next.js App Router, React Three Fiber, Three.js, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-25-steward-craft-loop-v1-design.md`

## Global Constraints

- Receiz ID and its proof object remain source authority; SDK/API rails distribute and synchronize but never outrank it.
- Preview state is local, disposable, and non-authoritative.
- Ordinary movement and render loops receive no React state writes or repeated authority projections.
- Mobile controls keep 44px practical targets, safe-area spacing, and no truncation or overlap.
- Only currently admitted Trail Shelter and Trail Bridge blueprints are offered in V1.

---

### Task 1: Pure Steward Craft Projection

**Files:**
- Create: `src/features/play/wilds-steward-craft.ts`
- Create: `tests/wilds-steward-craft.test.ts`

**Interfaces:**
- Consumes: `WildsMaterialLotV1`, `WildsWorkCapabilityMeter`, `selectWildsTrailBridgeRotation`, and terrain sampling.
- Produces: `WILDS_STEWARD_BLUEPRINTS`, `projectWildsStewardCraft`, and `projectWildsStewardPlacement`.

- [ ] Write failing tests proving exact material requirements, active-partner readiness, no preview consumption, reachable shelter placement, and physical bridge validation.
- [ ] Run `pnpm test -- tests/wilds-steward-craft.test.ts` and confirm the module is missing.
- [ ] Implement immutable blueprint and placement projections with finite bounded inputs and stable reasons.
- [ ] Run the focused test and existing steward construction/resource tests.

### Task 2: Steward Craft Selector

**Files:**
- Create: `src/features/play/WildsStewardCraftPanel.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `app/globals.css`
- Modify: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Consumes: `projectWildsStewardCraft`, exact material counts, active card name/work meters, and the selected blueprint callback.
- Produces: a responsive blueprint/partner selector that enters placement without issuing a command.

- [ ] Add a failing render contract for partner identity, exact material counters, ready/locked blueprint states, and selection-only semantics.
- [ ] Implement the component and replace the two raw Satchel build buttons.
- [ ] Add stable responsive styles with disabled, pressed, and focus-visible states.
- [ ] Run the focused render and work-capability tests.

### Task 3: Two-Step Physical Placement

**Files:**
- Create: `src/features/play/WildsStewardPlacementHud.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `src/features/play/WildsStewardEnvironment.tsx`
- Modify: `app/globals.css`
- Modify: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Consumes: `projectWildsStewardPlacement`, selected blueprint, explicit terrain taps, and the existing build command functions.
- Produces: disposable preview state, confirm/cancel controls, and an in-world shared-geometry ghost.

- [ ] Add a failing render contract proving the first tap previews, confirm alone executes, cancel restores search, and the ghost is keyed to the selected blueprint.
- [ ] Change terrain taps in placement mode to set preview state instead of immediately building.
- [ ] Implement confirm/cancel and clear preview on overlay ownership changes, successful admission, active-card change, or invalidation.
- [ ] Render a valid/invalid translucent shelter or bridge ghost without per-frame React writes.
- [ ] Run focused projection/render tests and existing world-service/construction tests.

### Task 4: Verification and Integration

**Files:**
- Modify only files required by failures discovered during verification.

**Interfaces:**
- Consumes: the complete feature tree.
- Produces: verified commit on `main` and cleanup of this owned worktree.

- [ ] Run `git diff --check`, focused tests, `pnpm test`, `pnpm run typecheck`, and `pnpm run build` sequentially.
- [ ] Run production browser QA for desktop and mobile: load, move, open Satchel, select a blueprint, create/cancel a preview, check console/page errors, canvas dimensions/pixels, text fit, overlap, and renderer diagnostics.
- [ ] Commit the verified feature, fast-forward `main`, rerun the full merged test suite and typecheck, then remove only `.worktrees/steward-craft-loop-v1` and its merged branch.
