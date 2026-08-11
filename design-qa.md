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
- Card Vault, Kai Klok, audio, living-world, and live-roster sheets use one native `pan-y` outer scroller each. The final 390×844 production measurement for Card Vault is 636px client height / 1474px scroll height with `overflow-y:auto`, `overscroll-behavior-y:auto`, `scroll-snap-type:none`, `touch-action:pan-y`, and zero nested vertical scrollers. Sequential scroll samples reached `[180, 360, 540, 720, 838]`, the exact maximum.
- The full overlay owns pointer input (`pointer-events:auto`); the live hit stack is sheet content → sheet → backdrop → overlay → canvas, preventing gameplay input from receiving popover gestures.
- Command sheets use integrated premium chrome, a restrained mint/gold accent and grip, and no persistent transform layer while resting.
- The live roster is visually and interactively above the resting HUD while open.
- Capture locking, sealing, world toast, real five-stat reward, and Card Vault handoff share the new proof-seal treatment without changing capture authority.

## Result

Passed — production browser verification at 390×844 found no blocking overlap, truncation, nested-scroller, pointer-ownership, target-size, compass, or character-selector regression. Full repository tests, typecheck, lint, build, and aggregate release checks pass.
