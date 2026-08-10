# Wildz Unified Living-World Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate bottom deck and overlapping HUD with a coordinated full-screen overlay that preserves every Wildz function, shows the active creature's real sealed name, and expands tools from meaningful thumb anchors.

**Architecture:** A pure overlay reducer becomes the single authority for creature-drawer, world-tools, panel, and exclusive encounter states. Existing drawer and command components become controlled consumers, then `PlayCampaign` mounts the unified controls inside the world stage so the Three.js canvas always remains edge-to-edge. CSS implements fixed safe-zone homes without a shared bottom chassis.

**Tech Stack:** Next.js 15, React 19, TypeScript, Three.js, CSS, Node test runner, Playwright CLI.

## Global Constraints

- The world canvas fills the entire playable viewport in portrait and landscape.
- No opaque or full-width bottom panel, deck background, footer, or second toolbar may reduce the world canvas.
- The visible active companion name is always `activeCard.manifest.name`; family, species, form, or catalog names cannot replace it.
- Preserve identity/profile, mission, map, live, share, audio, camp, walk/run, Field Guide, Satchel, Trail Pack, Card Vault, movement, field power, cycling, roster, and abilities.
- Direct world tapping remains the interaction model; do not reintroduce a generic Interact button.
- Movement and one companion gesture may run concurrently on multi-touch devices.
- Primary targets remain at least 44×44 CSS pixels; movement remains at least 68×68 CSS pixels.
- Preserve deterministic gameplay, portable-card proof data, Receiz authority, persistence, and existing panel content.
- Required verification viewports: 320×568, 360×800, 390×844, 430×932, 844×390, 768×1024, and 1440×900.

## File structure

- Create `src/features/play/world-overlay-state.ts`: pure state, events, reducer, and exclusivity rules.
- Create `src/features/play/use-world-overlay-director.ts`: React lifecycle adapter for resize, orientation, Escape, dismiss signals, and focus restoration.
- Create `src/features/play/WildzWorldControls.tsx`: one composition boundary for movement, quick utilities, companion command, roster, and world-tools fan.
- Modify `src/features/play/WildzCreatureDrawer.tsx`: controlled snap state and upward anchored surface.
- Modify `src/features/play/WildsCommandDock.tsx`: controlled fan/panel state with one minimal world-tools trigger.
- Modify `src/features/play/WildzSocialDeck.tsx`: remove independent layout ownership and expose semantic requests.
- Modify `src/features/play/WildsCompanionCommand.tsx`: render the real individual name visibly and emit director events.
- Modify `src/features/play/WildzReferenceHud.tsx`: stable top-left identity, top-center mission, top-right minimap structure.
- Modify `src/features/play/PlayCampaign.tsx`: mount controls inside `.wilds-stage` and route exclusive states.
- Modify `app/globals.css`: edge-to-edge overlay homes, fans, responsive collision rules, and removal of bottom chassis.
- Add/modify focused tests under `tests/` for state, rendering, accessibility, layout, and integration.
- Update `docs/release/flagship-mobile-experience.md`: final measurements, screenshots, diagnostics, and score delta.

---

### Task 1: Single overlay state authority

**Files:**
- Create: `src/features/play/world-overlay-state.ts`
- Create: `tests/world-overlay-state.test.ts`

**Interfaces:**
- Produces: `WorldOverlayState`, `WorldOverlayEvent`, `initialWorldOverlayState`, and `reduceWorldOverlay(state, event)`.
- Consumed by: `use-world-overlay-director.ts`, `WildzWorldControls.tsx`, and `PlayCampaign.tsx`.

- [ ] **Step 1: Write the failing reducer tests**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { initialWorldOverlayState, reduceWorldOverlay } from "../src/features/play/world-overlay-state";

describe("living-world overlay authority", () => {
  it("keeps only one bottom expansion open", () => {
    const roster = reduceWorldOverlay(initialWorldOverlayState, { type: "drawer", snap: "preview" });
    const tools = reduceWorldOverlay(roster, { type: "tools", open: true });
    assert.equal(tools.drawerSnap, "closed");
    assert.equal(tools.toolsOpen, true);
  });

  it("dismisses every expansion for trainer, map, and combat ownership", () => {
    const open = reduceWorldOverlay(initialWorldOverlayState, { type: "drawer", snap: "expanded" });
    const blocked = reduceWorldOverlay(open, { type: "exclusive", owner: "combat" });
    assert.deepEqual(blocked, { drawerSnap: "closed", toolsOpen: false, panelKey: null, exclusiveOwner: "combat" });
  });

  it("cancels ambiguous state on viewport changes without changing data", () => {
    const open = reduceWorldOverlay(initialWorldOverlayState, { type: "tools", open: true });
    assert.deepEqual(reduceWorldOverlay(open, { type: "viewport-change" }), initialWorldOverlayState);
  });
});
```

- [ ] **Step 2: Run the focused test and verify the missing module failure**

Run: `pnpm test`

Expected: FAIL because `world-overlay-state.ts` does not exist.

- [ ] **Step 3: Implement the pure reducer**

```ts
import type { CreatureDrawerSnap } from "./creature-drawer";
import type { WildsCommandKey } from "./WildsCommandDock";

export type WorldOverlayOwner = "none" | "map" | "trainer" | "combat";
export type WorldOverlayState = Readonly<{
  drawerSnap: CreatureDrawerSnap;
  toolsOpen: boolean;
  panelKey: WildsCommandKey | null;
  exclusiveOwner: WorldOverlayOwner;
}>;

export type WorldOverlayEvent =
  | { type: "drawer"; snap: CreatureDrawerSnap }
  | { type: "tools"; open: boolean }
  | { type: "panel"; key: WildsCommandKey | null }
  | { type: "exclusive"; owner: WorldOverlayOwner }
  | { type: "viewport-change" }
  | { type: "dismiss" };

export const initialWorldOverlayState: WorldOverlayState = Object.freeze({
  drawerSnap: "closed", toolsOpen: false, panelKey: null, exclusiveOwner: "none"
});

export function reduceWorldOverlay(state: WorldOverlayState, event: WorldOverlayEvent): WorldOverlayState {
  if (event.type === "dismiss" || event.type === "viewport-change") return initialWorldOverlayState;
  if (event.type === "exclusive") return { ...initialWorldOverlayState, exclusiveOwner: event.owner };
  if (state.exclusiveOwner !== "none") return state;
  if (event.type === "drawer") return { ...state, drawerSnap: event.snap, toolsOpen: false, panelKey: null };
  if (event.type === "tools") return { ...state, drawerSnap: "closed", toolsOpen: event.open, panelKey: null };
  return { ...state, drawerSnap: "closed", toolsOpen: false, panelKey: event.key };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm test && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/play/world-overlay-state.ts tests/world-overlay-state.test.ts
git commit -m "feat: coordinate living-world overlays"
```

---

### Task 2: Controlled creature roster and real-name command

**Files:**
- Modify: `src/features/play/WildzCreatureDrawer.tsx`
- Modify: `src/features/play/WildsCompanionCommand.tsx`
- Modify: `tests/wildz-creature-drawer-ui.test.ts`
- Modify: `tests/wildz-companion-command-ui.test.ts`

**Interfaces:**
- Consumes: controlled `CreatureDrawerSnap` from Task 1.
- Produces: `snap`, `onSnapChange`, and `onRequestDrawer` event paths; visible `.wilds-companion-real-name` sourced from `manifest.name`.

- [ ] **Step 1: Add failing source/render contracts**

```ts
assert.match(companionSource, /className="wilds-companion-real-name"[^>]*>\{activeCard\.manifest\.name\}/);
assert.doesNotMatch(companionSource, /wilds-companion-real-name[^\n]*(familyId|species|formId)/);
assert.match(drawerSource, /snap: CreatureDrawerSnap/);
assert.match(drawerSource, /onSnapChange: \(snap: CreatureDrawerSnap\) => void/);
assert.doesNotMatch(drawerSource, /useState<CreatureDrawerSnap>\("closed"\)/);
```

- [ ] **Step 2: Run `pnpm test` and confirm failure**

Expected: FAIL because the real name is not visible and the drawer owns local snap state.

- [ ] **Step 3: Make `WildzCreatureDrawer` controlled**

Replace local snap ownership with required props:

```ts
snap: CreatureDrawerSnap;
onSnapChange: (snap: CreatureDrawerSnap) => void;
```

Route handle clicks, drag settlement, Escape, requested snap, and card selection through `onSnapChange`. Keep only drag height, viewport metrics, virtualization, and affordance animation as local UI state.

- [ ] **Step 4: Render the sealed individual name on the command**

Inside `.wilds-companion-command`, after the active portrait:

```tsx
{activeCard ? <strong className="wilds-companion-real-name">{activeCard.manifest.name}</strong> : null}
<span className="wilds-companion-power-label">{fieldPowers[selectedAbilityIndex]?.label ?? "Power"}</span>
```

Keep `manifest.name` in the complete `aria-label`, and never derive this label from `creatureForm`.

- [ ] **Step 5: Run focused and full verification**

Run: `pnpm test && pnpm typecheck`

Expected: PASS with existing gesture, drawer, portable-card, and render-contract suites unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/features/play/WildzCreatureDrawer.tsx src/features/play/WildsCompanionCommand.tsx tests/wildz-creature-drawer-ui.test.ts tests/wildz-companion-command-ui.test.ts
git commit -m "feat: anchor the roster to the named companion"
```

---

### Task 3: Minimal world-tools fan with controlled panels

**Files:**
- Modify: `src/features/play/WildsCommandDock.tsx`
- Create: `tests/wilds-command-fan-ui.test.ts`

**Interfaces:**
- Consumes: `toolsOpen`, `panelKey`, and state-change callbacks from Task 1.
- Produces: one `.wilds-world-tools-trigger`, an expanding `.wilds-world-tools-fan`, and unchanged command sheets.

- [ ] **Step 1: Write failing command-fan contracts**

```ts
assert.match(source, /className="wilds-world-tools-trigger"/);
assert.match(source, /aria-label="Open world tools"/);
assert.match(source, /className="wilds-world-tools-fan"/);
assert.match(source, /toolsOpen: boolean/);
assert.match(source, /panelKey: WildsCommandKey \| null/);
assert.doesNotMatch(source, /useState<WildsCommandKey \| null>/);
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm test`

Expected: FAIL because the dock is always visible and panel state is local.

- [ ] **Step 3: Convert the dock to controlled state**

Use this prop contract:

```ts
toolsOpen: boolean;
panelKey: WildsCommandKey | null;
onToolsOpenChange: (open: boolean) => void;
onPanelKeyChange: (key: WildsCommandKey | null) => void;
```

Render one resting trigger. Render the existing dock buttons only inside `.wilds-world-tools-fan` when `toolsOpen`. Selecting an item calls `onPanelKeyChange(item.key)` and closes the fan. Preserve external `requestedKey`, dismiss signals, Escape, drag-to-close, focus restoration, badges, and every command sheet body.

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm test && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/play/WildsCommandDock.tsx tests/wilds-command-fan-ui.test.ts
git commit -m "feat: fan world tools from one control"
```

---

### Task 4: Unified controls composition and lifecycle director

**Files:**
- Create: `src/features/play/use-world-overlay-director.ts`
- Create: `src/features/play/WildzWorldControls.tsx`
- Modify: `src/features/play/WildzSocialDeck.tsx`
- Create: `tests/wildz-world-controls-ui.test.ts`

**Interfaces:**
- Consumes: Task 1 reducer, Task 2 controlled drawer/command, Task 3 controlled tools.
- Produces: `WildzWorldControls` and `useWorldOverlayDirector({ dismissSignal, exclusiveOwner })`.

- [ ] **Step 1: Write failing composition contracts**

```ts
assert.match(controls, /useWorldOverlayDirector/);
assert.match(controls, /className="wildz-world-controls"/);
assert.match(controls, /className="wildz-movement-home"/);
assert.match(controls, /className="wildz-tools-home"/);
assert.match(controls, /className="wildz-companion-home"/);
assert.doesNotMatch(controls, /wildz-social-deck/);
```

- [ ] **Step 2: Run tests and verify missing component failure**

Run: `pnpm test`

Expected: FAIL because the unified component does not exist.

- [ ] **Step 3: Implement the lifecycle hook**

Use `useReducer(reduceWorldOverlay, initialWorldOverlayState)`. On `resize`, `orientationchange`, and `visibilitychange` to hidden, dispatch `viewport-change`. On Escape, dispatch `dismiss`. When `dismissSignal` changes or `exclusiveOwner !== "none"`, dispatch the corresponding event. Return `{ state, dispatch }`.

- [ ] **Step 4: Build `WildzWorldControls`**

Move the existing quick utilities, `WildzDpad`, `WildsCompanionCommand`, `WildzCreatureDrawer`, and `WildsCommandDock` into semantic homes:

```tsx
<section className="wildz-world-controls" aria-label="World controls">
  <div className="wildz-movement-home">{quickUtilities}<WildzDpad {...dpadProps} /></div>
  <div className="wildz-tools-home"><WildsCommandDock {...controlledDockProps} /></div>
  <div className="wildz-companion-home">
    <WildzCreatureDrawer {...controlledDrawerProps} />
    <WildsCompanionCommand {...companionProps} />
  </div>
</section>
```

Refactor `WildzSocialDeck` into a compatibility-free export or remove it once no caller remains. Do not retain a visual wrapper.

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm test && pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/play/use-world-overlay-director.ts src/features/play/WildzWorldControls.tsx src/features/play/WildzSocialDeck.tsx tests/wildz-world-controls-ui.test.ts
git commit -m "feat: unify living-world control ownership"
```

---

### Task 5: Mount every control over the world and coordinate exclusive states

**Files:**
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/WildzReferenceHud.tsx`
- Modify: `tests/wildz-reference-layout.test.ts`
- Modify: `tests/wildz-contextual-world-ui.test.ts`

**Interfaces:**
- Consumes: `WildzWorldControls` from Task 4.
- Produces: one stage-owned overlay tree and exact exclusive-owner projection.

- [ ] **Step 1: Add failing stage-ownership tests**

```ts
assert.match(campaign, /<WildsWorldCanvas[\s\S]*<WildzReferenceHud[\s\S]*<WildzWorldControls/);
assert.doesNotMatch(campaign, /<div className="wildz-social-stack">/);
assert.match(campaign, /exclusiveOwner=\{trainerEncounter\?\.phase === "combat" \? "combat"/);
assert.match(hud, /className="wildz-identity-home"/);
assert.match(hud, /className="wildz-mission-home"/);
assert.match(hud, /className="wildz-map-home"/);
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm test`

Expected: FAIL because controls still render in the second world grid row.

- [ ] **Step 3: Move controls into `.wilds-stage`**

Replace the post-stage `.wildz-social-stack` with `<WildzWorldControls ... />` immediately after the HUD/live/utility overlays inside `.wilds-stage`. Project map, trainer transition/challenge, combat, and requested panels into `exclusiveOwner`; increment the existing dismiss signal before trainer and combat ownership.

- [ ] **Step 4: Give top controls stable structural homes**

Change `WildzReferenceHud` to render `.wildz-identity-home`, `.wildz-mission-home`, and `.wildz-map-home`. Keep the identity and companion data currently shown, but ensure the active companion's name is not duplicated as the explorer identity title.

- [ ] **Step 5: Run complete tests and typecheck**

Run: `pnpm test && pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/play/PlayCampaign.tsx src/features/play/WildzReferenceHud.tsx tests/wildz-reference-layout.test.ts tests/wildz-contextual-world-ui.test.ts
git commit -m "feat: place controls inside the living world"
```

---

### Task 6: Edge-to-edge visual system and collision-safe responsive homes

**Files:**
- Modify: `app/globals.css`
- Modify: `tests/wildz-flagship-mobile-ui.test.ts`
- Modify: `tests/wildz-reference-layout.test.ts`

**Interfaces:**
- Consumes: semantic home classes from Tasks 4 and 5.
- Produces: the approved resting, fan, roster, and ability-wheel layouts.

- [ ] **Step 1: Write failing CSS contracts**

```ts
assert.match(css, /\.wildz-app \.wilds-world\s*\{[^}]*grid-template-rows:\s*minmax\(0, 1fr\);/);
assert.match(css, /\.wildz-world-controls\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*pointer-events:\s*none;/);
assert.match(css, /\.wildz-movement-home\s*\{[^}]*position:\s*absolute;[^}]*bottom:/);
assert.match(css, /\.wildz-tools-home\s*\{[^}]*left:\s*50%;/);
assert.match(css, /\.wildz-companion-home\s*\{[^}]*right:/);
assert.match(css, /\.wilds-companion-real-name/);
assert.doesNotMatch(css, /\.wildz-world-controls[^}]*background:/);
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm test`

Expected: FAIL because the stage still uses portrait-only two-row CSS and the unified homes are unstyled.

- [ ] **Step 3: Implement the resting overlay**

Set `.wildz-app .wilds-world` to one `minmax(0, 1fr)` row at every viewport. Make `.wildz-world-controls` absolute/inset/pointer-transparent. Position movement at bottom-left, tools at bottom-center, and companion at bottom-right with safe-area offsets. Give only individual buttons localized glass backgrounds. Delete or override all `.wildz-social-deck`, `.wildz-social-stack`, and full-width command-dock backgrounds used by the gameplay shell.

- [ ] **Step 4: Implement expansion geometry**

Anchor `.wildz-creature-drawer` above the companion home; keep preview and expanded heights bounded below the top HUD. Fan `.wilds-world-tools-fan` upward from center. Place the ability wheel around the right thumb without clipping. Anchor camp/run above the movement home. Use z-index layers declared in one contiguous CSS section.

- [ ] **Step 5: Implement top and responsive collision rules**

Use a three-column safe-zone grid for identity, mission, and map; at narrow widths constrain mission and truncate copy; at 844×390 use shallow horizontal fans. Add `prefers-reduced-motion` rules for every fan, drawer, and wheel transition. Preserve 44/68 pixel target floors and `env(safe-area-inset-*)` on every edge home.

- [ ] **Step 6: Run tests, types, and lint**

Run: `pnpm test && pnpm typecheck && pnpm lint`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css tests/wildz-flagship-mobile-ui.test.ts tests/wildz-reference-layout.test.ts
git commit -m "feat: float tasteful controls over the world"
```

---

### Task 7: Multi-touch, focus, dismissal, and recovery verification

**Files:**
- Modify: `src/features/play/use-world-overlay-director.ts`
- Modify: `src/features/play/WildzWorldControls.tsx`
- Create: `tests/wildz-world-controls-recovery.test.ts`

**Interfaces:**
- Consumes: complete overlay UI.
- Produces: release-safe multi-pointer and recovery behavior.

- [ ] **Step 1: Write failing recovery contracts**

```ts
assert.match(hook, /orientationchange/);
assert.match(hook, /visibilitychange/);
assert.match(hook, /event\.key === "Escape"/);
assert.match(controls, /onLostPointerCapture/);
assert.doesNotMatch(controls, /preventDefault\(\)[\s\S]*wildz-world-controls/);
```

Add reducer tests proving movement does not change overlay ownership and a companion pointer does not dismiss movement.

- [ ] **Step 2: Run tests and confirm any missing recovery path**

Run: `pnpm test`

Expected: FAIL on at least the missing composition-level lost-capture or focus-restoration contract.

- [ ] **Step 3: Complete lifecycle and focus recovery**

Store the originating trigger before a fan or panel opens. On panel close or recoverable load failure, schedule `origin.focus()` with `requestAnimationFrame`. Cancel active gesture state on hidden document, resize/orientation, or exclusive owner. Do not attach a parent pointer handler that captures movement and companion pointers together.

- [ ] **Step 4: Run full automated gates**

Run: `pnpm test && pnpm typecheck && pnpm lint`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/play/use-world-overlay-director.ts src/features/play/WildzWorldControls.tsx tests/wildz-world-controls-recovery.test.ts
git commit -m "fix: make world overlays recover safely"
```

---

### Task 8: Production browser qualification and score update

**Files:**
- Modify: `docs/release/flagship-mobile-experience.md`
- Create ignored artifacts: `output/playwright/unified-controls-*`

**Interfaces:**
- Consumes: completed unified overlay.
- Produces: reproducible release evidence and updated automatic-failure list.

- [ ] **Step 1: Run complete automated and production gates**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm release:check
```

Expected: all commands exit 0. Record build warnings without hiding them.

- [ ] **Step 2: Play every required viewport**

At 320×568, 360×800, 390×844, 430×932, 844×390, 768×1024, and 1440×900 verify resting world, movement, simultaneous companion action, cycle/name update, roster preview/expanded, ability hold-slide/cancel, tools fan, every preserved panel, map, mission, trainer transition, combat, return, resize, and rotation.

- [ ] **Step 3: Verify accessibility and recovery**

Repeat the representative 390×844 path with keyboard only, reduced motion, 200% text adjustment, offline mode, missing `navigator.vibrate`, page background/resume, and lost pointer capture. Expected: no clipped/unreachable control, accidental action, focus loss, or world unmount.

- [ ] **Step 4: Capture objective evidence**

Save resting, tools fan, roster preview, roster expanded, ability wheel, landscape, trainer, and combat screenshots. Measure canvas bounds, control rectangles, horizontal overflow, overlap, nonblank composited pixels, renderer calls, triangles, DPR, and console/page errors.

- [ ] **Step 5: Update the release report and run the premium audit**

Document before/after canvas area, real-name evidence, function-preservation matrix, device results, performance, console status, visual scorecard, and remaining automatic failures.

Run:

```bash
python3 /Users/bjklock/.codex/skills/threejs-game-director/scripts/audit_reference_report.py --premium --audio docs/release/flagship-mobile-experience.md
```

Expected: `Director report audit passed.`

- [ ] **Step 6: Commit**

```bash
git add docs/release/flagship-mobile-experience.md
git commit -m "test: qualify unified living-world controls"
```

---

## Completion boundary

This plan is complete only when the separate bottom row is structurally removed, not visually disguised; all functions remain reachable; the real individual creature name is visible; all seven viewports pass; and the release report contains active browser evidence. Completion of this plan starts—but does not substitute for—the subsequent location-by-location full-game specifications named in the approved design.
