# Design QA — Live Compass, Character Actions, and Premium Mobile Sheets

## Source and implementation comparison

| User reference | Final implementation |
| --- | --- |
| ![User HUD reference](/var/folders/0v/qr5byqbx4971q67dn1f05tdr0000gn/T/TemporaryItems/NSIRD_screencaptureui_XwZTzf/Screenshot%202026-08-11%20at%209.14.15%E2%80%AFAM.png) | ![Final premium Vault](/Users/bjklock/Kai-Turah/wildz.quest/output/playwright/final-premium-vault-390x844.png) |

## Comparison findings

- The three top-right controls now occupy one right-aligned row at x=238, 288, and 338 on the 390px viewport, leaving an 8px right safe margin.
- The scan/warm action owns a separate vertical band at y=228. Its rectangle has zero intersection with any of the three status controls at 320×568, 390×844, and 844×390.
- Kai Klok and the 44×44 audio control retain their prior left-side geometry and behavior.
- A slim live compass now uses the same heading convention as movement and the minimap, with wrapped nearby cardinal/bearing ticks and a collision-safe top lane.
- The bottom-right control contains only the selected real Vault creature. Tap or a stationary hold toggles real character actions, including the renamed `Bond` action; a second tap closes them with no X. Upward flick retains the exact single-row Slate preview behavior from `01613171`, including the existing pull-to-expand path; no ability wheel is mounted.
- Card Vault, audio, living-world, and live-roster sheets use one native `pan-y` outer scroller each. Their momentum is contained inside the overlay instead of chaining into the locked gameplay page, and vertical pans that begin on buttons, links, summaries, or labels remain owned by the sheet.
- Eternal Pulse again opens as the independent Kai teaching overlay from the known-good interaction, not as an inline expansion. Production computed it as `position:absolute`, `overflow-y:auto`, `overscroll-behavior-y:contain`, and `touch-action:pan-y`, with a 516px viewport over 699px of teaching content.
- The full overlay owns pointer input (`pointer-events:auto`); the live hit stack is sheet content → sheet → backdrop → overlay → canvas, preventing gameplay input from receiving popover gestures.
- Command sheets use integrated premium chrome, a restrained mint/gold accent and grip, and no persistent transform layer while resting.
- The live roster and selected guest explorer surface keep the same foreground state for their complete lifetime and sit 20 layers above expanded gameplay controls; movement, utility, menu, and companion controls can no longer paint over them.
- Light- and dark-scheme browser chrome both resolve to the invariant Wildz forest theme `#09110d`, matching the already locked root/body surface so Safari cannot switch the URL bar white when an overlay opens.
- Capture locking, sealing, world toast, real five-stat reward, and Card Vault handoff share the new proof-seal treatment without changing capture authority.

## Result

Passed — production browser verification at 390×844 found no blocking overlap, truncation, nested-scroller, pointer-ownership, target-size, compass, or character-selector regression. Full repository tests, typecheck, lint, build, and aggregate release checks pass.
