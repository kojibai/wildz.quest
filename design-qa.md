# Design QA — Compact HUD, Character Actions, and Capture Feedback

## Source and implementation comparison

| User reference | Final implementation |
| --- | --- |
| ![User HUD reference](/var/folders/0v/qr5byqbx4971q67dn1f05tdr0000gn/T/TemporaryItems/NSIRD_screencaptureui_XwZTzf/Screenshot%202026-08-11%20at%209.14.15%E2%80%AFAM.png) | ![Final 390×844 HUD](/Users/bjklock/Kai-Turah/wildz.quest/output/playwright/final-compact-hud-390x844.png) |

## Comparison findings

- The three top-right controls now occupy one right-aligned row at x=238, 288, and 338 on the 390px viewport, leaving an 8px right safe margin.
- The scan/warm action owns a separate vertical band at y=228. Its rectangle has zero intersection with any of the three status controls at 320×568, 390×844, and 844×390.
- Kai Klok and the 44×44 audio control retain their prior left-side geometry and behavior.
- The bottom-right control contains only the selected real Vault creature. Tap/hold opens real character actions; upward flick opens Slate; no ability wheel is mounted.
- Card Vault and Kai Klok teaching both expose one `pan-y` outer scroller. A real browser wheel/touch-scroll advanced Card Vault 420px continuously and Kai teaching to its 172.5px maximum while nested content remained non-scrolling.
- The live roster is visually and interactively above the resting HUD while open.
- Capture locking, sealing, world toast, real five-stat reward, and Card Vault handoff share the new proof-seal treatment without changing capture authority.

## Result

Passed — no blocking overlap, truncation, target-size, scrolling, ownership, or character-selector regression found in the final responsive implementation.
