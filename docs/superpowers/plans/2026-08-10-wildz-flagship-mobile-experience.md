# Wildz Flagship Mobile Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify the flagship mobile journey from responsive world exploration through direct trainer interaction, cinematic real-time combat, visible consequences, and return to the living world.

**Architecture:** Add a pure gesture interpreter and companion-command model beneath focused React components, then integrate them through the existing `WildzSocialDeck`, `PlayCampaign`, Mortal Arena, presentation, and persistence boundaries. Keep immediate feedback local, publish semantic events to the existing deterministic and save/outbox systems, and make the resulting responsive shell reusable by later location-specific plans.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.6, React Three Fiber, Three.js 0.182, CSS, Web Audio, Vibration API, Node test runner, Playwright CLI.

## Global Constraints

- Preserve Receiz v118 proof, custody, ownership, publication, settlement, and fail-closed market authority.
- Primary gesture feedback must require zero network round trips.
- Pressed-state visual feedback must appear within one rendered frame; hold and drawer recognition must begin within 100 ms.
- Support 320, 360, 390, and 430 px portrait, representative phone landscape, tablet, and desktop layouts.
- Primary touch targets must be at least 44 CSS pixels and respect safe-area insets.
- Target stable 60 FPS on capable phones and an authored stable 30 FPS low-power tier.
- Haptics and audio must never be the only confirmation channel.
- Do not call the flagship slice premium while any automatic failure in the approved design remains.
- Do not extend this plan into full content authoring for every location; later place-specific plans consume the shared contracts produced here.

---

## File structure

- `src/features/play/companion-command-gesture.ts`: pure pointer/gesture state machine and semantic outputs.
- `src/features/play/companion-command-model.ts`: roster ordering, neighboring portrait projection, cycling, and field-power selection.
- `src/features/play/wilds-haptics.ts`: capability-safe haptic patterns and semantic feedback mapping.
- `src/features/play/WildsCompanionCommand.tsx`: active portrait, peek portraits, hold-slide ability wheel, and gesture surface.
- `src/features/play/WildzCreatureDrawer.tsx`: controlled snap request and partial/full roster drawer projection.
- `src/features/play/WildzSocialDeck.tsx`: coordination of movement, companion command, drawer, and compact secondary navigation.
- `src/features/play/WildzReferenceHud.tsx`: compact companion/objective/orientation HUD.
- `src/features/play/trainer-encounter.ts`: pure trainer encounter phase machine.
- `src/features/play/WildsTrainerEncounter.tsx`: in-world challenge and transition presentation.
- `src/features/play/PlayCampaign.tsx`: integration with selection, trainer proximity, persistence, and world return.
- `src/features/games/mortal-arena/MortalArenaExperience.tsx`: purposeful combat zones and encounter callbacks.
- `src/features/play/wilds-quality-governor.ts`: runtime frame-sample quality adjustment.
- `src/features/play/use-wilds-quality-profile.ts`: responsive quality hook for resize, orientation, visibility, and runtime samples.
- `src/features/shell/proof-session-retry.ts`: bounded remote-session retry policy.
- `next.config.mjs`: development-compatible and production-strict CSP construction.
- `app/globals.css`: responsive world, drawer, trainer, transition, and combat visual contracts.
- `tests/companion-command-gesture.test.ts`: gesture classification and collision prevention.
- `tests/companion-command-model.test.ts`: roster cycle and portrait-peek projections.
- `tests/wilds-haptics.test.ts`: semantic pattern mapping and capability fallback.
- `tests/trainer-encounter.test.ts`: trainer encounter state transitions.
- `tests/wilds-quality-governor.test.ts`: adaptive-quality hysteresis.
- `tests/wildz-flagship-mobile-ui.test.ts`: source/CSS accessibility and responsive contracts.
- `tests/proof-session-retry.test.ts`: bounded retry behavior.
- `output/playwright/flagship-*`: ignored browser evidence.
- `docs/release/flagship-mobile-experience.md`: before/after scorecard and verification record.

---

### Task 1: Reliable local startup and bounded proof-session retries

**Files:**
- Create: `src/features/shell/proof-session-retry.ts`
- Create: `tests/proof-session-retry.test.ts`
- Modify: `src/features/shell/WildzApp.tsx`
- Modify: `next.config.mjs`
- Modify: `tests/security-headers.test.ts`

**Interfaces:**
- Produces: `proofSessionRetryDecision(input: ProofSessionRetryInput): ProofSessionRetryDecision`.
- Produces: `contentSecurityPolicy(environment: "development" | "production"): string`.
- Consumes: `connectWildzProofSession` and existing `WildzIdentitySession.localAuthority`.

- [ ] **Step 1: Write failing retry-policy tests**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { proofSessionRetryDecision } from "../src/features/shell/proof-session-retry";

test("terminal local admission failures wait for an explicit trigger", () => {
  assert.deepEqual(proofSessionRetryDecision({ attempt: 1, online: true, code: "wildz_proof_admission_failed" }), { retry: false, delayMs: null });
});

test("temporary failures back off once and cap at one minute", () => {
  assert.deepEqual(proofSessionRetryDecision({ attempt: 0, online: true, code: "wildz_proof_challenge_unavailable" }), { retry: true, delayMs: 5_000 });
  assert.deepEqual(proofSessionRetryDecision({ attempt: 9, online: true, code: "wildz_proof_challenge_unavailable" }), { retry: true, delayMs: 60_000 });
  assert.deepEqual(proofSessionRetryDecision({ attempt: 2, online: false, code: "wildz_proof_challenge_unavailable" }), { retry: false, delayMs: null });
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `pnpm test -- tests/proof-session-retry.test.ts tests/security-headers.test.ts`

Expected: FAIL because the policy and environment-aware CSP do not exist.

- [ ] **Step 3: Implement the pure retry policy**

```ts
export type ProofSessionRetryInput = { attempt: number; online: boolean; code: string };

export function proofSessionRetryDecision(input: ProofSessionRetryInput) {
  if (!input.online || input.code === "wildz_proof_admission_failed") return { retry: false, delayMs: null } as const;
  return { retry: true, delayMs: Math.min(60_000, 5_000 * 2 ** Math.max(0, input.attempt)) } as const;
}
```

- [ ] **Step 4: Apply one-flight retry state in `WildzApp`**

Use refs for `attempt`, `connecting`, and the single timer. Extract the error code with `error instanceof Error ? error.message : "wildz_proof_unknown"`; call `proofSessionRetryDecision`; schedule only when `retry` is true. Reset attempts after connection, identity change, or the browser `online` event. Preserve the existing cleanup and remote-session identity checks.

- [ ] **Step 5: Make the CSP strict in production and compatible in development**

```js
export function contentSecurityPolicy(environment) {
  const scripts = environment === "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";
  return `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self' https:; ${scripts}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; worker-src 'self' blob:; manifest-src 'self'; media-src 'self' blob:`;
}
```

Update the security test to assert development contains `'unsafe-eval'`, production does not, and all existing directives remain.

- [ ] **Step 6: Verify startup reliability**

Run: `pnpm test -- tests/proof-session-retry.test.ts tests/security-headers.test.ts && pnpm typecheck`

Expected: PASS. A local development browser must reach the explorer/world instead of remaining on the preparation status, and an unconnected local identity must not issue duplicate session requests every five seconds.

- [ ] **Step 7: Commit**

```bash
git add next.config.mjs src/features/shell/WildzApp.tsx src/features/shell/proof-session-retry.ts tests/proof-session-retry.test.ts tests/security-headers.test.ts
git commit -m "fix: make local world startup reliable"
```

---

### Task 2: Collision-proof companion gesture interpreter

**Files:**
- Create: `src/features/play/companion-command-gesture.ts`
- Create: `tests/companion-command-gesture.test.ts`

**Interfaces:**
- Produces: `createCompanionGesture(origin, at): CompanionGestureState`.
- Produces: `moveCompanionGesture(state, point, at): CompanionGestureState`.
- Produces: `releaseCompanionGesture(state, point, at): CompanionGestureResult`.
- Semantic results: `tap-power`, `cycle-previous`, `cycle-next`, `open-drawer`, `open-ability-wheel`, `select-ability`, `cancel`.

- [ ] **Step 1: Write failing classification tests**

```ts
test("short tap activates the equipped power", () => {
  const state = createCompanionGesture({ x: 100, y: 600 }, 0);
  assert.equal(releaseCompanionGesture(state, { x: 103, y: 598 }, 70).kind, "tap-power");
});

test("horizontal movement locks cycling and cannot open the drawer", () => {
  const moved = moveCompanionGesture(createCompanionGesture({ x: 100, y: 600 }, 0), { x: 156, y: 591 }, 45);
  assert.equal(releaseCompanionGesture(moved, { x: 170, y: 588 }, 90).kind, "cycle-next");
});

test("upward movement locks the drawer", () => {
  const moved = moveCompanionGesture(createCompanionGesture({ x: 100, y: 600 }, 0), { x: 106, y: 520 }, 70);
  assert.equal(releaseCompanionGesture(moved, { x: 106, y: 500 }, 100).kind, "open-drawer");
});

test("hold enters the ability wheel before sliding", () => {
  const held = advanceCompanionGesture(createCompanionGesture({ x: 100, y: 600 }, 0), 100);
  assert.equal(held.mode, "ability-wheel");
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm test -- tests/companion-command-gesture.test.ts`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement explicit thresholds and direction locking**

```ts
export const COMPANION_HOLD_MS = 96;
export const COMPANION_TAP_SLOP_PX = 10;
export const COMPANION_AXIS_LOCK_PX = 18;
export const COMPANION_CYCLE_PX = 44;
export const COMPANION_DRAWER_PX = 54;

export type CompanionGestureMode = "pending" | "horizontal" | "vertical" | "ability-wheel" | "cancelled";
```

Store origin, last point, start time, mode, and active ability sector. Once horizontal or vertical mode locks, never change axes for that pointer. `advanceCompanionGesture` enters the ability wheel only while movement remains inside tap slop.

- [ ] **Step 4: Add cancellation and ability-sector tests**

Verify pointer cancellation always returns `cancel`, returning to the wheel center clears the active sector, and releasing in sectors 0–3 returns `select-ability` with the exact index.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `pnpm test -- tests/companion-command-gesture.test.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/play/companion-command-gesture.ts tests/companion-command-gesture.test.ts
git commit -m "feat: add companion command gestures"
```

---

### Task 3: Companion carousel model and haptic language

**Files:**
- Create: `src/features/play/companion-command-model.ts`
- Create: `src/features/play/wilds-haptics.ts`
- Create: `tests/companion-command-model.test.ts`
- Create: `tests/wilds-haptics.test.ts`

**Interfaces:**
- Produces: `companionCarousel(cards, activeId): CompanionCarouselProjection`.
- Produces: `cycleCompanion(cards, activeId, direction): string`.
- Produces: `wildsHapticPattern(event): readonly number[]`.
- Produces: `playWildsHaptic(event, vibrate?): boolean`.

- [ ] **Step 1: Write failing carousel tests**

```ts
test("carousel wraps and exposes tasteful neighboring peeks", () => {
  const cards = [{ id: "a" }, { id: "b" }, { id: "c" }] as PortableCardAsset[];
  assert.deepEqual(companionCarousel(cards, "a"), { activeId: "a", previousId: "c", nextId: "b", position: 1, total: 3 });
  assert.equal(cycleCompanion(cards, "c", 1), "a");
});
```

- [ ] **Step 2: Write failing semantic-haptic tests**

```ts
assert.deepEqual(wildsHapticPattern("wheel-open"), [8]);
assert.deepEqual(wildsHapticPattern("wheel-detent"), [5]);
assert.deepEqual(wildsHapticPattern("confirm"), [14, 18, 24]);
assert.deepEqual(wildsHapticPattern("cancel"), [7, 22, 7]);
assert.equal(playWildsHaptic("confirm", undefined), false);
```

- [ ] **Step 3: Run tests and confirm failure**

Run: `pnpm test -- tests/companion-command-model.test.ts tests/wilds-haptics.test.ts`

- [ ] **Step 4: Implement deterministic carousel and safe vibration adapter**

Filter out retired or ineligible cards before projection. When only one eligible card exists, previous and next are `null`. `playWildsHaptic` accepts an injected vibrate function for tests and otherwise uses `navigator.vibrate` only when available.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `pnpm test -- tests/companion-command-model.test.ts tests/wilds-haptics.test.ts && pnpm typecheck`

- [ ] **Step 6: Commit**

```bash
git add src/features/play/companion-command-model.ts src/features/play/wilds-haptics.ts tests/companion-command-model.test.ts tests/wilds-haptics.test.ts
git commit -m "feat: model the living companion carousel"
```

---

### Task 4: Active portrait command, ability wheel, and controlled roster drawer

**Files:**
- Create: `src/features/play/WildsCompanionCommand.tsx`
- Modify: `src/features/play/WildzCreatureDrawer.tsx`
- Modify: `src/features/play/WildzSocialDeck.tsx`
- Modify: `app/globals.css`
- Create: `tests/wildz-companion-command-ui.test.ts`

**Interfaces:**
- Consumes: gesture interpreter, carousel model, `WildsCreatureThumbnail`, `onSelectCard(assetId)`, and `onAction()`.
- Produces: `WildsCompanionCommand` props `{ cards, activeCard, fieldPowers, onSelectCard, onUsePower, onRequestDrawer }`.
- Extends drawer props with `requestedSnap?: CreatureDrawerSnap | null` and `onRequestedSnapHandled?: () => void`.

- [ ] **Step 1: Write failing UI contract tests**

Assert that the component imports `WildsCreatureThumbnail`, exposes previous and next portrait peeks with `aria-hidden`, sets pointer capture, consumes semantic gesture results, and renders an accessible ability list while the wheel is open. Assert CSS contains a 72–94 px command target, safe-area positioning, direction-aware peek transforms, and reduced-motion rules.

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm test -- tests/wildz-companion-command-ui.test.ts`

- [ ] **Step 3: Implement the command with immediate local feedback**

Use a ref for the pure gesture state, React state only for rendered mode/sector/preview, and `requestAnimationFrame` for pointer-move rendering. On semantic results:

```ts
if (result.kind === "tap-power") onUsePower();
if (result.kind === "cycle-next") onSelectCard(cycleCompanion(cards, activeCard.id, 1));
if (result.kind === "cycle-previous") onSelectCard(cycleCompanion(cards, activeCard.id, -1));
if (result.kind === "open-drawer") onRequestDrawer("preview");
if (result.kind === "select-ability") onSelectAbility(result.index);
```

Play haptics on wheel open, sector change, confirmation, cycle snap, and cancellation. Pair each with portrait motion, visible copy, and existing audio cues.

- [ ] **Step 4: Add controlled drawer requests**

When `requestedSnap` changes to `preview` or `expanded`, call the existing `commitSnap`, then call `onRequestedSnapHandled`. Preserve drawer drag, virtualization, focus, memorial behavior, and selection.

- [ ] **Step 5: Replace duplicate lower rails in `WildzSocialDeck`**

Keep `WildzDpad` on the left. Put `WildsCompanionCommand` on the right. Move camp, walk/run, mission, profile, market, Vault, guide, and satchel into a compact two-button utility entry plus the existing `WildsCommandDock`; do not render twelve persistent action buttons.

- [ ] **Step 6: Verify tests, typecheck, and keyboard alternatives**

Run: `pnpm test -- tests/wildz-companion-command-ui.test.ts tests/wildz-creature-drawer.test.ts tests/wildz-creature-drawer-ui.test.ts && pnpm typecheck`

Expected: Enter/Space activates the field power, arrow keys cycle creatures while the command is focused, ArrowUp opens the drawer, and Escape closes wheel/drawer state.

- [ ] **Step 7: Commit**

```bash
git add src/features/play/WildsCompanionCommand.tsx src/features/play/WildzCreatureDrawer.tsx src/features/play/WildzSocialDeck.tsx app/globals.css tests/wildz-companion-command-ui.test.ts
git commit -m "feat: add the active companion command"
```

---

### Task 5: Contextual world HUD and direct trainer tapping

**Files:**
- Modify: `src/features/play/WildzReferenceHud.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `app/globals.css`
- Create: `tests/wildz-contextual-world-ui.test.ts`

**Interfaces:**
- Consumes: active `PortableCardAsset`, `WildzHudModel`, trainer projections, and `onSelectTrainer`.
- Produces: compact HUD props including `activeCard`, objective copy, and map action.
- Preserves: canvas trainer tap callback and terrain search callback.

- [ ] **Step 1: Write failing contextual-world tests**

Assert the HUD renders `WildsCreatureThumbnail` for the active card, one vitality capsule, one objective chip, and map/orientation. Assert `PlayCampaign` no longer renders the legacy `.wilds-hud-top`, `.wilds-resource-strip`, `.runner-card`, duplicate mission meter, or persistent trainer navigator when a trainer is outside interaction range.

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm test -- tests/wildz-contextual-world-ui.test.ts tests/wilds-living-world-hud.test.ts`

- [ ] **Step 3: Implement the compact HUD**

Pass `activeAsset` to `WildzReferenceHud`. Use the real creature thumbnail, condition/vitality, active objective, and map. Keep detailed XP, resources, coordinates, and social state in their existing secondary panels.

- [ ] **Step 4: Make trainer prompts target-local**

Keep the Three.js/HTML nameplate directly tappable. When distance is at most 12 m, show a compact target-local challenge prompt beside the trainer. When farther away, expose the trainer through map/objective navigation without a persistent screen-width button.

- [ ] **Step 5: Remove redundant world chrome and add responsive CSS**

At 320–430 px, reserve the lower corners for the D-pad and companion command, the top corners for vitality/map, and the top-center lane for one objective. Ensure no persistent element covers the trainer prompt or player avatar.

- [ ] **Step 6: Verify focused tests and typecheck**

Run: `pnpm test -- tests/wildz-contextual-world-ui.test.ts tests/wilds-living-world-hud.test.ts tests/wildz-in-world-onboarding.test.ts && pnpm typecheck`

- [ ] **Step 7: Commit**

```bash
git add src/features/play/WildzReferenceHud.tsx src/features/play/PlayCampaign.tsx src/features/play/WildsWorldCanvas.tsx app/globals.css tests/wildz-contextual-world-ui.test.ts
git commit -m "feat: make the living world contextual"
```

---

### Task 6: Trainer encounter director and uninterrupted battle transition

**Files:**
- Create: `src/features/play/trainer-encounter.ts`
- Create: `src/features/play/WildsTrainerEncounter.tsx`
- Create: `tests/trainer-encounter.test.ts`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/games/mortal-arena/MortalArenaExperience.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: phases `idle | recognized | challenge | transition | combat | result | returning`.
- Produces: `advanceTrainerEncounter(state, event): TrainerEncounterState`.
- Consumes: `WildsTrainerProjection`, active card, roster, `projectCampaignOpponentFromTrainer`, and Arena settlement.

- [ ] **Step 1: Write failing deterministic phase tests**

```ts
let state = createTrainerEncounter(trainer.id);
state = advanceTrainerEncounter(state, { type: "recognize" });
state = advanceTrainerEncounter(state, { type: "open-challenge" });
state = advanceTrainerEncounter(state, { type: "accept", rosterIds: ["card:a"] });
assert.equal(state.phase, "transition");
state = advanceTrainerEncounter(state, { type: "transition-complete" });
assert.equal(state.phase, "combat");
```

Also test cancel-to-world, repeat-intro compression, settlement-before-result, and return preserving trainer/world position.

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm test -- tests/trainer-encounter.test.ts`

- [ ] **Step 3: Implement the pure director**

Reject invalid events by returning the current state with a semantic error code. Store trainer ID, selected roster IDs, repeat flag, transition start time, settlement ID, and result. Do not store React nodes or Three.js objects.

- [ ] **Step 4: Build the in-world challenge sheet**

Render trainer portrait/silhouette, dialogue, level, affinity, estimated difficulty, roster preview, Battle, Talk, and close. Use a bottom sheet on phones and a target-anchored panel on larger layouts. The scene remains mounted beneath it.

- [ ] **Step 5: Add the 0.8–1.2 second transition**

Preload the opponent and arena while the challenge sheet is open. On accept, animate camera/overlay/VS copy and creature portraits, then mount `MortalArenaExperience` at `transition-complete`. Repeat encounters expose Skip and use the compressed transition.

- [ ] **Step 6: Route settlement through result and world return**

Do not show result until `commitArenaSettlement` succeeds locally. Present XP, bond/condition, trainer memory, Arena Path, Continue, Rematch, and Review. Continue enters `returning`, closes the arena, restores world focus, and updates the objective/trainer state visibly.

- [ ] **Step 7: Verify tests and typecheck**

Run: `pnpm test -- tests/trainer-encounter.test.ts tests/wilds-saga-trainers.test.ts tests/mortal-arena-flagship.test.ts && pnpm typecheck`

- [ ] **Step 8: Commit**

```bash
git add src/features/play/trainer-encounter.ts src/features/play/WildsTrainerEncounter.tsx src/features/play/PlayCampaign.tsx src/features/games/mortal-arena/MortalArenaExperience.tsx app/globals.css tests/trainer-encounter.test.ts
git commit -m "feat: direct cinematic trainer encounters"
```

---

### Task 7: Purposeful Mortal Arena combat zones

**Files:**
- Modify: `src/features/games/mortal-arena/MortalArenaExperience.tsx`
- Modify: `src/features/games/mortal-arena/MortalArenaScene.tsx`
- Modify: `app/globals.css`
- Modify: `tests/mortal-arena-ui.test.ts`
- Create: `tests/mortal-arena-mobile-controls.test.ts`

**Interfaces:**
- Consumes: existing `useMortalArena` actions and deterministic simulation.
- Produces: left movement zone; primary Strike; adjacent Guard and Ability; contextual Focus, Swap, and Flee.
- Preserves: covenant, retirement, settlement, vitality, warning, and NPC legality.

- [ ] **Step 1: Write failing control-hierarchy tests**

Assert the footer contains `.mortal-arena-movement-zone`, `.mortal-arena-primary-strike`, `.mortal-arena-guard`, and `.mortal-arena-ability`; assert Focus, Swap, and Flee render inside `.mortal-arena-context-actions`; assert portrait CSS never uses a six-column footer and every primary control has at least 56 px touch geometry.

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm test -- tests/mortal-arena-mobile-controls.test.ts tests/mortal-arena-ui.test.ts`

- [ ] **Step 3: Implement combat hierarchy without changing simulation arithmetic**

Map Strike to `{ light: true }`, Guard hold to the current `arena.hold`, active ability to the admitted card's first legal arena ability or declared Focus fallback, and movement to the existing trackpad. Put Swap and Flee in a reachable contextual cluster with full labels during learning.

- [ ] **Step 4: Improve battle readability**

Keep both fighters and intent/tell in the camera-safe center. Use compact creature portraits in vitality capsules. Add readable wind-up/impact/recovery presentation from existing arena state and `impactTick`; do not add non-deterministic damage.

- [ ] **Step 5: Add synchronized feedback**

Publish strike, guard, danger, swap, flee, victory, and defeat events to presentation/audio/haptics. Respect reduced motion and muted settings. Keep hit pause and shake presentation-only.

- [ ] **Step 6: Verify arena suites**

Run: `pnpm test -- tests/mortal-arena-mobile-controls.test.ts tests/mortal-arena-ui.test.ts tests/mortal-arena-flagship.test.ts tests/mortal-arena-simulation.test.ts && pnpm typecheck`

- [ ] **Step 7: Commit**

```bash
git add src/features/games/mortal-arena/MortalArenaExperience.tsx src/features/games/mortal-arena/MortalArenaScene.tsx app/globals.css tests/mortal-arena-mobile-controls.test.ts tests/mortal-arena-ui.test.ts
git commit -m "feat: rebuild Mortal Arena mobile controls"
```

---

### Task 8: Runtime adaptive quality and progressive loading

**Files:**
- Create: `src/features/play/wilds-quality-governor.ts`
- Create: `src/features/play/use-wilds-quality-profile.ts`
- Create: `tests/wilds-quality-governor.test.ts`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/games/mortal-arena/MortalArenaExperience.tsx`
- Modify: `src/features/play/WildsWorldCanvas.tsx`

**Interfaces:**
- Produces: `updateWildsQualityGovernor(state, sample): WildsQualityGovernorState`.
- Produces: `useWildsQualityProfile(): { profile, reportFrameSample }`.
- Consumes: existing `selectWildsQualityProfile` and renderer budgets.

- [ ] **Step 1: Write failing hysteresis tests**

```ts
test("sustained slow frames lower quality without oscillation", () => {
  let state = createWildsQualityGovernor("high");
  for (let index = 0; index < 120; index += 1) state = updateWildsQualityGovernor(state, { frameMs: 25, visible: true });
  assert.equal(state.tier, "medium");
  state = updateWildsQualityGovernor(state, { frameMs: 8, visible: true });
  assert.equal(state.tier, "medium");
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm test -- tests/wilds-quality-governor.test.ts tests/wilds-presentation.test.ts`

- [ ] **Step 3: Implement measured adaptation**

Use a bounded rolling frame average, 120 slow visible frames to step down, 600 healthy visible frames to step up, a 30-second cooldown, and no sampling while hidden. Reduced motion remains an independent particle cap.

- [ ] **Step 4: Replace one-time profile selection**

Use the hook in world and Arena. Recompute base tier on resize/orientation, then let the governor adjust. Preserve authored 30 FPS low tier and renderer budgets.

- [ ] **Step 5: Split non-critical overlays and encounter code**

Use `next/dynamic` for market, full map, settlement, Hearttree, ecology, raid, and Mortal Arena surfaces so the initial world route does not eagerly include every game. Preload trainer/Arena chunks when a trainer enters the near radius or challenge sheet opens.

- [ ] **Step 6: Verify quality and bundle evidence**

Run: `pnpm test -- tests/wilds-quality-governor.test.ts tests/wilds-presentation.test.ts tests/wildz-mobile-performance.test.ts && pnpm build`

Record the new route sizes in `docs/release/flagship-mobile-experience.md`. The first-load JavaScript must be lower than the baseline 836 KB and all dynamic surfaces must still open.

- [ ] **Step 7: Commit**

```bash
git add src/features/play/wilds-quality-governor.ts src/features/play/use-wilds-quality-profile.ts src/features/play/PlayCampaign.tsx src/features/play/WildsWorldCanvas.tsx src/features/games/mortal-arena/MortalArenaExperience.tsx tests/wilds-quality-governor.test.ts docs/release/flagship-mobile-experience.md
git commit -m "perf: adapt world quality at runtime"
```

---

### Task 9: Signature trainer visual and audio asset integration

**Files:**
- Create: `public/game/trainers/lanternforge-keeper-portrait.webp`
- Create: `public/game/trainers/lanternforge-emblem.webp`
- Create: `public/audio/wildz/trainer-challenge.mp3`
- Create: `public/audio/wildz/companion-detent.mp3`
- Modify: `public/audio/wildz/catalog.json`
- Modify: `src/features/play/WildsTrainerEncounter.tsx`
- Modify: `src/features/play/wilds-audio-catalog.ts`
- Modify: `docs/release/flagship-mobile-experience.md`

**Interfaces:**
- Consumes: image/3D/audio generator skill outputs and existing audio catalog loader.
- Produces: one externally evidenced high-value trainer surface and two responsive audio cues.

- [ ] **Step 1: Load required generator skills and probe credentials**

Run:

```bash
bash /Users/bjklock/.codex/skills/threejs-game-director/scripts/probe_asset_credentials.sh
```

Record literal SET/MISSING markers in the release record. Follow the loaded image, 3D, and audio generator workflows; do not expose secret values.

- [ ] **Step 2: Generate the signature trainer portrait and emblem**

Create an original Lanternforge Keeper: warm forged-lantern materials, readable silhouette at 64 px, no copyrighted character resemblance, transparent or clean dark background, and a matching emblem. Export optimized WebP files to the exact paths above and record task IDs or generator evidence.

- [ ] **Step 3: Generate or author responsive audio cues**

Create a short challenge sting under 1.2 seconds and a subtle detent cue under 120 ms. Normalize for mobile playback, avoid harsh high-frequency transients, and add both to `catalog.json` and the typed audio catalog.

- [ ] **Step 4: Integrate assets with fallbacks**

Use the trainer portrait in recognition, challenge, VS transition, and result at appropriate responsive sizes. If an asset fails, fall back to the existing procedural trainer silhouette and semantic audio cue without blocking the encounter.

- [ ] **Step 5: Verify asset budgets and playback**

Run: `find public/game/trainers public/audio/wildz -type f -maxdepth 2 -print0 | xargs -0 ls -lh` and `pnpm test -- tests/wilds-audio-catalog.test.ts tests/wilds-audio-integration.test.ts && pnpm typecheck`.

Record file sizes, sources, license/generation evidence, and fallbacks in the release record.

- [ ] **Step 6: Commit**

```bash
git add public/game/trainers public/audio/wildz src/features/play/WildsTrainerEncounter.tsx src/features/play/wilds-audio-catalog.ts docs/release/flagship-mobile-experience.md
git commit -m "feat: give trainer encounters a signature identity"
```

---

### Task 10: Full flagship browser QA and experience scorecard

**Files:**
- Create: `tests/wildz-flagship-mobile-ui.test.ts`
- Modify: `docs/release/flagship-mobile-experience.md`
- Create ignored artifacts: `output/playwright/flagship-*`

**Interfaces:**
- Consumes: the completed flagship slice, approved design verification matrix, and game-director scorecard.
- Produces: reproducible browser evidence, before/after rating, remaining automatic failures, and follow-on location priorities.

- [ ] **Step 1: Add source-level responsive and accessibility contracts**

Test that primary controls use semantic buttons, companion gestures have keyboard alternatives, trainer challenge and results have dialog/status semantics, safe-area CSS is present, touch targets meet the declared minimum, and reduced-motion rules cover carousel, drawer, transition, and combat effects.

- [ ] **Step 2: Run the complete automated baseline**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: zero failures. Document warnings separately; do not hide them.

- [ ] **Step 3: Play the production build at required viewports**

Use Playwright CLI at 320×568, 360×800, 390×844, 430×932, 844×390 landscape, 768×1024 tablet, and 1440×900 desktop. For each phone width complete: first entry, move, tap terrain, tap trainer, open challenge, cycle creatures, hold-slide an ability, open/close drawer, enter combat, strike, guard, finish or flee, view result, and return to world.

- [ ] **Step 4: Capture interaction and rendering evidence**

Save screenshots for world resting, carousel preview, ability wheel, drawer preview, trainer challenge, VS transition, active combat, danger state, result, and world return. Capture console errors, nonblank canvas pixels, renderer calls/triangles, frame timing, and input-to-visual response.

- [ ] **Step 5: Exercise recovery and accessibility**

Repeat with network offline during a drawer action and after a result, resize/orientation during world and combat, page background/resume, reduced motion, muted audio, unavailable vibration, keyboard-only navigation, 200% text, and a screen-reader semantics snapshot.

- [ ] **Step 6: Fill the comparative experience rating**

Score current baseline and rebuilt slice from 0–10 for all eighteen approved categories. Support every number with observed evidence. Include the exact ten-category game-director visual scorecard, average, performance evidence, and automatic failures remaining.

- [ ] **Step 7: Run the premium report audit**

Run:

```bash
python3 /Users/bjklock/.codex/skills/threejs-game-director/scripts/audit_reference_report.py --premium --audio docs/release/flagship-mobile-experience.md
```

Expected: PASS. If it fails, repair missing evidence or explicitly mark the affected phase blocked; do not claim premium completion.

- [ ] **Step 8: Run the repository release gate**

Run: `pnpm release:check`

Expected: PASS or an exact documented external-capability blocker unrelated to the local flagship build.

- [ ] **Step 9: Commit**

```bash
git add tests/wildz-flagship-mobile-ui.test.ts docs/release/flagship-mobile-experience.md
git commit -m "test: qualify the flagship mobile journey"
```

---

## Follow-on program plans

After this plan passes its browser and release gates, write separate implementation plans for:

1. wild encounters and capture;
2. Arena of Echoes campaign, practice, tournaments, and spectators;
3. Hearttree Sanctum traversal, trials, ritual presentation, and consequences;
4. Prism Arcade racing, rhythm, score, and seasonal variations;
5. settlements, districts, residents, crafting, social memory, and commerce presentation;
6. raids, bosses, rifts, cooperative roles, phase changes, and aftermath;
7. PvP and multiplayer challenge/battle presentation;
8. collection, progression, profile, market, social, and remaining overlay polish.

Each plan must consume the shared gesture, companion, encounter, feedback, responsive, performance, location-quality, and verification contracts established here.
