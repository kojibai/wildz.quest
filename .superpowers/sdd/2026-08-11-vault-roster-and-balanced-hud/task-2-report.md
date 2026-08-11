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
