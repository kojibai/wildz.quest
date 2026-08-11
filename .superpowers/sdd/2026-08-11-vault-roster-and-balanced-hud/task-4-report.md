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

## Fix round 1: multiplayer challenge lifecycle and target floors

Review disposition: all three P1 findings addressed in a separate, non-amended follow-up commit. The final follow-up hash is reported in the handoff.

### Root cause

- `WildsMultiplayer` treated `modalOwned` as permission to retain roster, room-chat, message draft, and selected-player state even though the containing persistent home had become inert.
- The incoming challenge installed an Escape/focus effect inside `WildsMultiplayer` while `PlayCampaign` independently installed its own Escape and generic modal-focus effects. Because the real answer operation is asynchronous, both native key listeners could submit decline before the challenge snapshot changed.
- Reactive `multiplayer` ownership came from the incoming snapshot and did not pass through `claimExclusiveOwner`, so no durable restoration origin was captured.
- Existing expanded CSS computed to 34px for roster/player close, 40px for chat toggle, 42px for chat input/send, and 36px for the audio mute row.

### Strict TDD RED

- Added a real server-rendered `WildsMultiplayer` component regression. It failed because modal-owned challenge state still rendered `wilds-player-sheet` / `Interact with Aster`.
- Added a development-only runtime fixture using the real `WildsMultiplayer`, audio settings, and modal lifecycle boundary. Before the lifecycle fix:
  - one Escape against the async incoming challenge produced `Declines: 2`;
  - focus returned to the document body rather than a durable world control;
  - computed targets measured 34, 40, 42, 42, and 36 pixels for the reviewed controls.

### GREEN implementation

- Challenge ownership now immediately excludes roster and selected-player sheets from render, then clears roster, chat, draft, and selected-player state through the existing dismissal effect.
- `usePlayModalLifecycle` is the single non-combat lifecycle owner for initial focus, Tab containment, Escape, and connected focus restoration.
- `PlayCampaign` delegates its modal lifecycle to that hook; `WildsMultiplayer` no longer installs any incoming-challenge Escape/focus listener. Its remaining key listener belongs only to the separate combat dialog.
- Reactive multiplayer ownership resolves `data-play-modal-origin="multiplayer"`, the persistent live badge, rather than an ephemeral roster/chat control. Focus restoration still passes `canRestoreFocus`, preventing focus into inert, hidden, disabled, detached, or zero-geometry controls.
- Multiplayer roster/player close controls, chat toggle, chat input/send, and the audio mute row now compute to at least 44px.

### Behavioral and browser evidence

The real WebKit fixture verified:

- roster and room chat open -> incoming challenge: `{ roster: 0, dialog: 1 }`;
- selected-player detail open -> incoming challenge: `{ playerSheet: 0, dialog: 1 }`;
- one Escape -> exactly `Declines: 1`;
- after dismissal, the persistent live badge is the active element;
- computed boxes: close `44x44`, chat toggle `344x44`, input `230x44`, send `108x44`, audio mute `290x44`.

The real world remained collision-free after the target changes:

- `output/playwright/task4-fix-round1-world-390x844.png`
- `output/playwright/task4-fix-round1-world-320x568.png`
- `output/playwright/task4-fix-round1-world-844x390.png`
- Browser console: 0 errors, 0 warnings.

### Fix-round verification

- Focused Task 4/modal set: PASS — 54/54.
- `pnpm test`: PASS — 1,085/1,085 tests, 109 suites.
- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS, 0 warnings.
- `git diff --check`: PASS.

Concern: the browser fixture uses a deterministic in-memory multiplayer controller to reproduce the real asynchronous answer timing; no external second peer or network mutation was required.

## Fix round 2: stable modal lifecycle across callback churn

Review disposition: the new P1 is addressed in a second non-amended follow-up commit. The final hash is reported in the handoff.

### Root cause and strict TDD RED

`usePlayModalLifecycle` included `onEscape` in the focus-trap effect dependencies. `PlayCampaign.closeOwnedModal` inherits the identity of `multiplayer.answerChallenge`, which the multiplayer controller currently recreates on each render. Every multiplayer poll could therefore tear down and rebuild the trap without changing ownership, scheduling initial focus again and moving a keyboard user away from the control they had chosen.

The real development-only HUD fixture now increments a visible poll revision every 100ms while a challenge owns the modal and supplies a newly identified Escape callback on each render. In pre-fix WebKit evidence, focus was moved to the later `Accept battle` control; after the next poll/render, the old lifecycle returned focus to the first `Decline` control. This was the expected RED and directly reproduced the review finding.

### GREEN implementation and runtime regression

`usePlayModalLifecycle` now updates `onEscapeRef` after every committed callback change. The trap/observer/key-listener effect depends only on `owner`, so callback churn does not reinstall focus containment. Escape invokes `onEscapeRef.current(owner)`, ensuring the one persistent listener uses the latest committed callback without giving callback identity ownership of the focus lifecycle.

The same WebKit fixture verified all requested behavior:

- focus remained on `Accept battle` while the poll revision advanced from 172 to 176;
- Escape at revision 281 recorded exact `Escape revision: 281` and exactly `Declines: 1`;
- dismissal restored focus to the connected `data-play-modal-origin="multiplayer"` live badge;
- ownership re-entry created one dialog and initialized focus on `Decline`.

Visual evidence: `output/playwright/task4-fix-round2-callback-churn.png`.

No stabilization was added to `answerChallenge`: the lifecycle boundary is intentionally tolerant of changing callback identities, including other parent rerenders and future controller implementations.

### Fix-round verification

- Focused modal/HUD set: PASS — 32/32.
- `pnpm test`: PASS — 1,085/1,085 tests, 109 suites.
- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS, 0 warnings.
- `git diff --check`: PASS.
- Browser console during the runtime replay: no application errors.

Concern: the callback-churn regression remains a development-only real-browser fixture rather than a synthetic DOM unit test; it exercises actual React effects, focus, keyboard events, inert ownership, and portaling in WebKit.
