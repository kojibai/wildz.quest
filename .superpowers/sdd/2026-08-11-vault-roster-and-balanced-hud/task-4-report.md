# Task 4 report: balanced persistent world status controls

Date: 2026-08-11

Base: `0049d4e`
Task commit: the commit containing this report (the final hash is reported in the Task 4 handoff; a Git commit cannot contain its own final object hash).

## Outcome

- Removed the generic top-right ellipsis, `worldStatusOpen`, and the status fan from product source and CSS.
- Added `WildsBalancedStatusHud`, with live/living-world status adjacent to the minimap and a persistent left-side Kai/audio instrument cluster.
- Reused the existing multiplayer controller, living-world client, Kai moment, presentation audio state, and audio settings component. No parallel network, clock, or audio state was introduced.
- Preserved one modal owner: persistent homes inherit `aria-hidden` and `inert`; ordinary status details unmount while blocked; the multiplayer-owned incoming challenge remains reachable through its existing controller and a body portal.
- Retained all direct capabilities: living-world status/detail, live roster/chat/share/challenges, Kai Command Center, and sound settings.

## TDD evidence

### RED

Command: `pnpm test`

The four newly added Task 4 contracts failed against the old fan implementation, as expected:

1. `world HUD removes the generic status toggle and composes balanced persistent homes`
2. `both persistent homes inherit modal ownership and gate their direct actions`
3. `live controls stay persistent while multiplayer modal content escapes the inert home`
4. `balanced homes remain touch-safe and collision-aware at phone and short-landscape sizes`

The clean-base run also exposed independently approved architecture contracts whose source-location assertions were stale. With explicit authorization, test assertions only were updated to the stronger current contracts:

- Trainer presentation now requires the exact `exclusiveOwner === "combat" && combatSurface === "trainer"` gate.
- Slate artwork now requires the actual `entry.asset` projection.
- Drawer callbacks now require synchronous early-return ownership guards before dispatch.
- Retired cards are asserted absent from `projectVaultCompanionRoster` while all Card Vault Memorial reachability/unplayability coverage remains intact.

Two further full-suite source-location assertions surfaced after the intentional status extraction and were updated without production changes:

- Multiplayer ownership now follows `PlayCampaign -> WildsBalancedStatusHud -> WildsMultiplayer`, including blocked, dismiss, and interaction gates.
- Living-world reachability now follows `PlayCampaign -> WildsBalancedStatusHud -> WildsLivingWorldHud`.

### GREEN

- Task-focused set: 71 tests, 71 passed, 0 failed.
- Contextual multiplayer integration file after extraction-contract repair: 11/11 passed.
- Wilds V3 UI integration file after extraction-contract repair: 3/3 passed.
- Full repository suite: final result recorded in the verification section below.

## Implementation and ownership review

- `PlayCampaign` projects `backgroundHomesBlocked` from `isPlayHomeAvailable(exclusiveOwner, "status")` and sends that single decision into the two persistent homes.
- The map-status home owns the existing living-world and multiplayer surfaces. Living-world details unmount when blocked. Multiplayer roster/chat close through the existing interaction/dismiss lifecycle.
- The incoming multiplayer challenge is rendered into `document.body`; this keeps the multiplayer-owned dialog outside the persistent home's inert subtree while preserving the same controller state and answer actions.
- The left instrument home owns the existing Kai command action and `WildsAudioSettings`. Both inherit the campaign action gate, and the home unmounts while blocked so no audio detail remains behind another owner.
- The command action checks the synchronous campaign ownership guard before opening. Existing drawer, combat, panel, and stage-owner behavior remains unchanged.
- Source/CSS search confirms no product occurrences of `worldStatusOpen`, `.wilds-world-status-trigger`, `.wilds-world-status-fan`, or multiplayer `controlsExpanded` remain.

## Responsive and browser evidence

Verified the real development build in WebKit with the Playwright CLI:

- 390x844 portrait: map status sits below the minimap; Kai/audio sit beneath identity; scan path, Slate, D-pad, tools, and companion control remain clear. Evidence: `output/playwright/task4-balanced-hud-390x844.png`.
- 320x568 portrait: compact world indicator, live/share controls, Kai/audio, play prompt, movement, and utility homes remain non-overlapping. Evidence: `output/playwright/task4-balanced-hud-320x568.png`.
- 844x390 short landscape: Kai/audio compress to a left row and map/live/social remain at the right, clear of trainer/player focal lanes and movement controls. Evidence: `output/playwright/task4-balanced-hud-844x390.png`.
- Audio sheet remains centered and fully inside the 390x844 viewport. Evidence: `output/playwright/task4-audio-sheet-390x844.png`.
- Command Center ownership replay: the command dialog is the accessible interactive owner; persistent status actions are hidden/disabled while it is open. Evidence: `output/playwright/task4-command-owner-390x844.png`.
- Browser console after the viewport and ownership replay: 0 errors, 0 warnings.

Interactive targets use a minimum 44x44 CSS contract. Safe-area offsets and dedicated 320px, 390px portrait, and 844x390 short-landscape rules were inspected in the screenshots above.

## Verification

- `pnpm test`: PASS — 1,084 tests, 1,084 passed, 0 failed (109 suites).
- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS.
- `git diff --check`: PASS.
- Old-symbol source/CSS search: PASS.

## Self-review and concerns

- No network, audio, or Kai time authority was duplicated.
- No persistent home is interactive behind a competing modal owner.
- Expanded surfaces are viewport-bound, and owned multiplayer dialogs escape inert ancestors through portals.
- Existing Task 1-3 roster/Slate/command and modal production architecture was preserved; only authorized stale assertions were repaired.
- Local browser verification did not synthesize a second multiplayer peer, so incoming challenge behavior is covered by ownership/source contracts rather than a live two-client browser exchange.
