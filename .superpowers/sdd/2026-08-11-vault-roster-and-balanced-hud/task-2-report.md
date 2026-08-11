# Task 2 — Premium Vault roster drawer

## Result

Rebuilt the world Slate as a living Vault companion selector. It receives Task 1's `VaultCompanionRosterEntry[]`, keeps retired cards out of the active selector, renders the exact name and complete projected stats, marks new captures, selects by exact asset ID, closes immediately, and restores safe focus to the companion command origin.

The closed companion command UI was not changed.

## Scope

Implementation commit: `98de9d4` (`feat: rebuild the mobile Vault roster drawer`).

The task brief's listed files did not include `PlayCampaign.tsx`; it required a minimal approved expansion so its existing `newRosterAssetId` is passed to `WildzWorldControls` and reaches the roster projection.

Two approved stale-contract repairs were also required:

- `tests/wilds-render-contract.test.ts` now verifies the current single combat-source projection (`combatSurface === "pvp"`) rather than the obsolete direct multiplayer class condition.
- `tests/wildz-final-integration-blockers.test.ts` now verifies that the active Slate excludes retired/memorial behavior while Card Vault retains the inline memorial record.

## RED

1. Replaced the old drawer/card-rail contracts with roster-entry and selection/focus expectations before changing production code.
2. Ran `pnpm test`.
   - Result: failed as expected on nine Task 2 drawer assertions: old card inputs, missing projected stat fields, retired handling, missing roster wiring, and missing focus restoration.
   - The same run also exposed one pre-existing stale assertion in `tests/wilds-render-contract.test.ts`: `renders the SDK-native live multiplayer loop inside the shared world` expected `/multiplayer\.activeBattle \? " pvp-active"/` even though the approved modal gate already uses `combatSurface === "pvp"`.
3. Added explicit 320px portrait and 844x390 short-landscape CSS assertions and ran `pnpm test` again.
   - Result: failed as expected on the missing responsive Slate rules.

## GREEN

- `pnpm test` — exit 0, full Node test suite green after roster, stale-contract, and responsive changes.
- `pnpm typecheck` — exit 0.
- `pnpm lint` — exit 0.
- `git diff --check` — exit 0.

Final combined verification command:

```sh
pnpm test && pnpm typecheck && pnpm lint && git diff --check
```

It completed successfully (the test run includes the full repository suite; no failing tests).

## Interaction and accessibility checks

- Preview and expanded states focus the active living entry, or the first living entry.
- Expanded mode alone contains Tab focus; preview remains non-modal.
- Escape, resize, orientation change, pointer cancellation, and external drawer closure all close via the controlled snap path.
- `WildzWorldControls` captures the companion command origin and restores it in a cancellable animation frame only when `canRestoreFocus` permits it.
- Selection calls `onSelectCard(entry.asset.id)` once, plays the existing exception-safe haptic adapter, then closes.
- Preview is horizontally virtualized; expanded pages remain bounded and vertically scrollable.
- CSS covers reduced motion, safe-area-bounded placement, 320px portrait compaction, and 844x390 short-landscape four-column spreads without page overflow.

## Self-review

- Confirmed `WildzCreatureDrawer` no longer accepts `nearbyCards`, raw companion progress, condition state, or memorial props.
- Confirmed all displayed stat values come from the canonical projected roster entry.
- Confirmed retired/memorial presentation stays in `WildsInventory` (Card Vault), not the active Slate.
- Confirmed Task 1 roster projection and the modal-owner commits `f1a6c22` / `e0dcc1d` were preserved; no modal owner implementation was weakened.

## Screenshots

None taken. Verification used the automated repository suite and responsive CSS contracts; no browser fixture was run.

## Concerns

- The project’s existing UI test harness is source-contract based rather than a DOM renderer. The selection/focus contract is covered at the controlled component boundary, but a future browser fixture would add direct click-and-focus execution coverage.
- The worktree initially had only 449 MiB free. With authorization, only the ignored, regenerable `.next` directory was removed after `git check-ignore`; available space increased to roughly 1.2 GiB and tests regenerated their own build output.

---

## Fix round 1 — focus, geometry, and live DOM proof

### Scope

This non-amended follow-up addresses the review's Important findings without changing the approved modal/combat architecture.

- Opening now calculates the active card's sorted index, initializes the preview render window around it, selects the containing expanded spread, and focuses only after the rerendered entry ref exists.
- The expanded trap uses one DOM-order eligible-focusable query: drawer handle, Sort select, then creature choices. This makes both the handle and Sort reachable while keeping Tab inside Slate.
- `WildzWorldControls` records the concrete companion command button rather than `document.activeElement` (which may be `body` after `preventDefault`). Its controller observes the actual controlled `open -> closed` snap transition, including exclusive-owner closes, and then safely restores that explicit origin.
- Preview capacity is 184px, enough for the 44px touch-sized tool row plus the complete card. Short landscape keeps the Bond/condition row visible and makes Sort 44px high.

`WildsCompanionCommand.tsx` has the smallest supporting API addition (`onCommandButtonReady`) solely to provide that explicit origin. The existing closed command interaction remains unchanged. No PlayCampaign memorial state was removed: the surrounding modal/Card Vault boundary is outside this narrow fix and remains preserved.

### RED

Before production edits, added the four failing contracts and ran:

```sh
pnpm test > /private/tmp/wildz-task2-round1-red.log 2>&1
```

Result: exit 1 with exactly 4 failing Task 2 assertions:

1. `preview height keeps the full stat card below the accessible sort control`
2. `selecting a roster entry uses its exact asset id, closes, and restores the companion command focus`
3. `opening a virtualized roster renders its active entry before focusing it and traps every drawer control`
4. `drawer exposes three wordless states with automatic roster windowing`

The red log is retained at `/private/tmp/wildz-task2-round1-red.log` for this session.

### GREEN

After implementation:

```sh
pnpm test
pnpm typecheck
pnpm lint
git diff --check
node --test .test-build/tests/wildz-creature-drawer-ui.test.js .test-build/tests/wildz-card-rail-ui.test.js
```

- Full `pnpm test` — exit 0 (full repository suite).
- `pnpm typecheck` — exit 0.
- `pnpm lint` — exit 0.
- `git diff --check` — exit 0.
- Focused compiled UI contracts — 17/17 passed, 0 failed (142ms).

### Live browser evidence

Fresh post-fix Next dev server: `node scripts/next-runtime-guard.mjs dev --hostname 127.0.0.1 -p 3001`, then browser automation at `http://127.0.0.1:3001/u/world`.

- **390x844 portrait:** command focus plus ArrowUp entered preview; the active living entry received focus. Measured drawer `184px`, tool row `44px`, and card `114px`; the card was fully visible (`607.2–721.2` inside drawer `553.2–737.2`). Expanded Tab sequence was handle -> Sort -> card -> handle, proving the all-control DOM-order trap.
- **844x390 landscape:** resizing closed the controlled Slate and returned real focus to the companion command. Reopening with ArrowUp focused the active entry. Measured drawer `156px`, tools `44px`, Sort `44px`, card `96px`, fully visible; computed stat-row display was `flex`, text `Bond 1Ready`.

Screenshots (local, generated evidence):

- `output/playwright/task2-roster-390x844-preview.png`
- `output/playwright/task2-roster-390x844-expanded.png`
- `output/playwright/task2-roster-844x390-preview.png`

The live save contains one companion, so the separate development-only fixture below supplies multi-card execution coverage without fabricating product Vault state.

### Fix-round self-review and concerns

- The pointer-origin failure mode is handled by storing the command button reference before the drawer request; no focus restoration depends on `document.activeElement`.
- The externally controlled closure test covers the controller transition path, and the live orientation closure visibly restored command focus.
- The fixture route is development-gated (`/test-fixtures/creature-drawer` returns 404 outside development) and is intentionally not part of product navigation.

### Browser fixture replay (real Drawer, 17 sealed assets)

Added a development-only route backed by `CreatureDrawerBrowserFixture`, which renders the actual `WildzCreatureDrawer` with 17 independently sealed local card assets. It opens with the asset at sorted index 14 active, provides a controlled external close, records the exact selected asset ID and count, and restores its explicit open-button origin after controlled closure.

Browser replay at 390x844 produced:

- opening: expected active index `14`, virtual rail `padding-inline-start: 1840px`, `7` rendered cards, and the active entry focused;
- alternate visible-card DOM click: `selectionCount: "1"`, selected exact asset `wilds:0213d5d8bb280fee528917a5`, Drawer `closed: true`, origin `restored: true`;
- expanded focus order: Close handle, Sort select, then card buttons; focusing the final eligible card and pressing Tab returned focus to `Close creature selector`;
- independent external `Controlled close fixture Slate`: `closed: true`, `restored: true`.

This is bounded direct DOM replay of the real component’s reducer callbacks and focus behavior, not a claim of physical pointer fidelity. The production live run above separately exercises the real keyboard/control path.

Fixture screenshot: `output/playwright/task2-roster-browser-fixture.png`.

Fix-round implementation commit: `e536944` (`fix: harden Slate drawer focus and layout`).
