# Compact Status Row and Character-Only Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the three top-right status controls in one collision-free row, slim the event bars beneath them without truncation, keep audio unchanged, and make the bottom-right companion control open only the owned-character roster.

**Architecture:** Keep Kai Klok and all domain components intact. Change only final HUD composition CSS and the companion command’s activation contract; the existing Vault roster projection, drawer, selection reducer, focus restoration, and modal ownership remain authoritative.

**Tech Stack:** Next.js 15, React 19, TypeScript, CSS, Node test runner, Playwright browser verification.

## Global Constraints

- Kai Klok placement, appearance, content, click behavior, and Command Center destination remain unchanged.
- Top-right order is living-world status, live explorers, share invite.
- Nearby event bars occupy rows below the three-control primary row.
- The opened live roster stacks above Kai Klok, audio, and every resting HUD control.
- Status/event visuals may shrink, but every semantic target remains at least 44 by 44 CSS pixels.
- Audio control and icon dimensions remain unchanged.
- Bottom-right tap/Enter/Space opens the compact Slate roster; upward flick or hold opens the expanded Slate roster; none opens or executes field abilities.
- Character selection continues through the existing authoritative `select-asset` path using exact sealed Vault names and IDs.
- Do not create a replacement field-ability HUD control.

---

### Task 1: Character-only bottom-right selector

**Files:**
- Modify: `src/features/play/WildsCompanionCommand.tsx`
- Modify: `src/features/play/WildzWorldControls.tsx`
- Modify: `tests/wildz-companion-command-ui.test.ts`
- Modify: `tests/wildz-creature-drawer-ui.test.ts`
- Modify: `tests/wildz-final-integration-blockers.test.ts`
- Modify: `tests/wildz-flagship-mobile-ui.test.ts`
- Modify: `tests/wilds-render-contract.test.ts`
- Add or modify runtime fixture test: `tests/wildz-creature-drawer-runtime.test.ts`

**Interfaces:**
- Consumes: `onRequestDrawer(snap: "preview" | "expanded")`, `onSelectCard(assetId: string)`, and the existing `VaultCompanionRosterEntry[]`.
- Produces: a `WildsCompanionCommand` whose pointer click and Enter/Space activation call `onRequestDrawer("preview")`, whose upward flick and hold call `onRequestDrawer("expanded")`, and whose sideways gestures still call `onSelectCard`; no ability props or listbox surface remain.

- [ ] **Step 1: Write the failing character-only activation tests**

Add behavioral/source assertions that require this contract:

```ts
test("the companion command activates only the owned-character roster", () => {
  const command = readFileSync("src/features/play/WildsCompanionCommand.tsx", "utf8");
  const controls = readFileSync("src/features/play/WildzWorldControls.tsx", "utf8");

  assert.match(command, /result\.kind === "open-drawer-preview"[\s\S]*onRequestDrawer\("preview"\)/);
  assert.match(command, /result\.kind === "open-drawer-expanded"[\s\S]*onRequestDrawer\("expanded"\)/);
  assert.match(command, /event\.key === "Enter" \|\| event\.key === " "[\s\S]*onRequestDrawer\("preview"\)/);
  assert.match(command, /aria-label=\{activeEntry \? `\$\{activeEntry\.name\}\. Open character roster\./);
  assert.doesNotMatch(command, /onUsePower|onSelectAbility|abilityListboxRef|wilds-companion-ability-wheel|Choose active companion ability/);
  assert.doesNotMatch(controls, /onUsePower=|onSelectAbility=|fieldPowers=/);
});
```

In the real drawer fixture, verify pointer click and Enter transition `closed` to `preview`, while upward flick and hold transition `closed` to `expanded`, without changing selected asset or last world event.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
pnpm test
```

Expected: the new character-only assertions fail because click/Enter still execute field powers and the ability wheel still exists.

- [ ] **Step 3: Remove ability activation from the companion command**

In `WildsCompanionCommand.tsx`:

- remove `fieldPowers`, `onUsePower`, `onSelectAbility`, and `selectedAbilityIndex` props;
- remove the hold timer, keyboard ability-listbox state, listbox rendering, and the `A` shortcut;
- change `advanceCompanionGesture` so a stationary hold yields character-only expanded-roster intent rather than `ability-wheel`;
- map the character-only gesture results to:

```ts
playWildsHaptic("drawer-open");
onRequestDrawer("preview");
```

- map upward flick and hold results to `onRequestDrawer("expanded")`;
- map Enter and Space to the compact roster-open path;
- preserve left/right character cycling, upward roster opening, pointer cancel/lost-capture cleanup, and exclusive-owner cancellation;
- change the accessible name to character-selection language and remove `aria-haspopup="listbox"`/ability-expanded semantics;
- remove the field-power label from the closed command visual.

In `WildzWorldControls.tsx`, stop deriving/passing field powers and ability callbacks to `WildsCompanionCommand`. Keep the parent ability state/action props temporarily if other stage consumers still require their public component signature; do not invoke them from the companion selector.

- [ ] **Step 4: Run focused and full tests and verify GREEN**

Run:

```bash
pnpm test
pnpm typecheck
```

Expected: all tests pass; no type error remains from removed companion props.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/features/play/WildsCompanionCommand.tsx src/features/play/WildzWorldControls.tsx tests
git commit -m "fix: make companion command character-only"
```

---

### Task 2: One-row top-right controls and slimmer event bars

**Files:**
- Modify: `app/globals.css`
- Modify: `tests/wildz-balanced-status-hud.test.ts`
- Modify: `tests/wildz-reference-layout.test.ts`
- Verify unchanged: `src/features/play/WildsBalancedStatusHud.tsx`

**Interfaces:**
- Consumes: existing `.wilds-map-status-home`, `.wilds-living-world-hud`, `.wilds-live-cluster`, `.wilds-live-pill`, `.wilds-live-badge`, `.wilds-live-share`, `.wilds-left-instrument-home`, and `.wilds-audio-settings > summary` DOM.
- Produces: one visual row in order status/live/share, compact circular visuals inside 44-pixel semantic targets, slim untruncated event bars beneath it, and no Kai/audio change.

- [ ] **Step 1: Write failing CSS contracts**

Require the final unified CSS block to include:

```ts
assert.match(finalCss, /\.wilds-map-status-home\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(3, 44px\)/);
assert.match(finalCss, /\.wilds-map-status-home \.wilds-living-world-hud\s*\{[^}]*display:\s*contents/);
assert.match(finalCss, /\.wilds-map-status-home \.wilds-live-cluster\s*\{[^}]*display:\s*contents/);
assert.match(finalCss, /\.wilds-map-status-home \.wilds-live-pill\.event\s*\{[^}]*grid-column:\s*1 \/ -1/);
assert.match(finalCss, /\.wilds-map-status-home \.wilds-live-roster\s*\{[^}]*z-index:\s*calc\(var\(--wildz-layer-expanded-controls\) \+ 10\)/);
assert.match(finalCss, /@media \(max-width: 640px\)[\s\S]*\.wilds-map-status-home :is\([^}]*\)\s*\{[^}]*width:\s*44px;[^}]*min-height:\s*44px/);
assert.match(finalCss, /\.wilds-map-status-home \.wilds-live-pill\.event::before\s*\{[^}]*inset-block:\s*4px/);
assert.match(finalCss, /\.wilds-map-status-home \.wilds-live-pill\.event\s*\{[^}]*min-height:\s*44px;[^}]*white-space:\s*nowrap/);
```

Record the exact `WildsBalancedStatusHud.tsx` Kai button block before implementation and assert its existing class, title, accessible label, `kaiMoment` content, and `onOpenCommandCenter()` path remain unchanged afterward.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm test
```

Expected: the new row/event assertions fail against the current stacked control layout and full-height event pills.

- [ ] **Step 3: Implement final CSS geometry**

In the last unified living-world CSS block:

- make `.wilds-map-status-home` a right-aligned three-column grid with 44-pixel semantic tracks;
- use `display: contents` for the living-world wrapper and multiplayer cluster so status/live/share share one grid formatting context in DOM order;
- explicitly place the mode pill, live badge, and share button in row one/columns one through three;
- place each `.wilds-live-pill.event` across columns one through three so event bars flow into rows below;
- keep fixed detail sheets unaffected through their existing fixed selectors;
- give `.wilds-live-roster` an expanded-surface z-index above the left instrument home and other resting controls;
- keep each semantic button at 44 by 44 pixels;
- on mobile, draw a 36-pixel visible circle with an inset pseudo surface, without shrinking the 44-pixel button box;
- give event buttons a 44-pixel semantic height with a 36-pixel inset visible pill, `white-space: nowrap`, content-sized width, and no text overflow/truncation for the supported viewports;
- do not modify the audio summary, audio icon, or Kai button dimensions;
- do not edit `.wilds-kai-command-pill` behavior, size, placement, or component source;
- add narrow-phone and short-landscape gaps/maximum width so the three controls never wrap or overlap the minimap/viewport.

- [ ] **Step 4: Run focused and full checks and verify GREEN**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
git diff --check
```

Expected: all commands exit zero.

- [ ] **Step 5: Commit Task 2**

```bash
git add app/globals.css tests/wildz-balanced-status-hud.test.ts tests/wildz-reference-layout.test.ts
git commit -m "style: compact persistent world controls"
```

---

### Task 3: Production browser qualification

**Files:**
- Modify: `docs/release/flagship-mobile-experience.md`
- Create/update tracked evidence under: `docs/release/evidence/compact-status-character-selector/`

**Interfaces:**
- Consumes: the optimized production artifact and the existing real admitted multi-creature QA profile.
- Produces: retained screenshots and structured evidence for the exact user-visible layout and activation behavior.

- [ ] **Step 1: Build and serve the optimized artifact**

Run:

```bash
pnpm build
pnpm start -p 49817
```

Expected: production is ready on `http://127.0.0.1:49817/`.

- [ ] **Step 2: Verify the three required viewports**

At 320x568, 390x844, and 844x390 record:

- status/live/share top-right button rectangles share one row (their vertical centers differ by no more than 1 CSS pixel);
- every visible event bar begins below the bottom edge of that primary row;
- all three semantic rectangles are at least 44 by 44 pixels;
- no pairwise collision with minimap, mission, viewport edge, or one another;
- audio semantic/icon rectangles match the pre-change baseline;
- every event bar is at least 44 pixels high semantically, has a 36-pixel visible pill, and satisfies `scrollWidth <= clientWidth`;
- Kai Klok label, destination, and click behavior are unchanged;
- opening “Everyone live now” places the roster above Kai/audio in hit testing and computed z-order;
- zero horizontal document overflow.

Capture a settled screenshot at each size.

- [ ] **Step 3: Verify character-only activation**

Using a real two-creature Vault profile:

1. click the bottom-right companion command;
2. assert Slate preview opens and no `.wilds-companion-ability-wheel` exists;
3. assert no world event, energy, XP, or bond changes from opening;
4. select the other creature and assert exact real name/portrait/world actor/active ID change;
5. reload and assert persistence;
6. focus the command, press Enter, and assert Slate opens again with focus inside;
7. hold the command and assert expanded Slate opens;
8. flick upward and assert expanded Slate opens;
9. assert no Grove Pulse, Bond, or field-ability options appear in any selector flow.

- [ ] **Step 4: Run final release gates**

Stop only the production server started by this task, then run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm release:check
git diff --check
```

Expected: all commands exit zero and the full test summary has zero failures.

- [ ] **Step 5: Update release evidence and commit**

Document exact viewport measurements, selector behavior, console/page/network results, build coordinate, and honest residuals. Track the evidence and an executable validator, then commit:

```bash
git add docs/release/flagship-mobile-experience.md docs/release/evidence/compact-status-character-selector
git commit -m "test: qualify compact HUD character selector"
```
