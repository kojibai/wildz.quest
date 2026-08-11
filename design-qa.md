# Design QA — First-principles Mobile Popovers and Collision-safe HUD

## Source and implementation comparison

| User reference | Final implementation |
| --- | --- |
| ![User HUD reference](/Users/bjklock/Downloads/Screenshot%202026-08-11%20at%2010.43.17%E2%80%AFAM.png) | ![Final premium Vault](/Users/bjklock/Kai-Turah/wildz.quest/output/playwright/mobile-popover-redesign-414x558.png) |

## Comparison findings

- The three top-right controls now occupy one right-aligned row at x=238, 288, and 338 on the 390px viewport, leaving an 8px right safe margin.
- The two destination pills and the scan/temperature action now own a fixed three-lane mobile row: 30vw / 34vw / 30vw. Their responsive type and padding shrink without stacking, truncating, or intersecting.
- Kai Klok and the 44×44 audio control retain their prior left-side geometry and behavior.
- A slim live compass now uses the same heading convention as movement and the minimap, with wrapped nearby cardinal/bearing ticks and a collision-safe top lane.
- The bottom-right control contains only the selected real Vault creature. Tap or a stationary hold toggles real character actions, including the renamed `Bond` action; a second tap closes them with no X. Upward flick retains the exact single-row Slate preview behavior from `01613171`, including the existing pull-to-expand path; no ability wheel is mounted.
- Card Vault, audio, living-world, live-roster, selected-player, and Kai sheets now share one portal architecture outside the gameplay pointer tree. The non-scrolling frame is `overflow:hidden`; its only content viewport is `overflow-y:auto`, `touch-action:pan-y`, `scroll-snap-type:none`, and `-webkit-overflow-scrolling:touch`.
- The visible drag strip and sheet pointer capture were removed. Premium mint/gold chrome is fixed above the scroller, so a finger can begin on a button, card, label, or summary without changing gesture owners.
- Production at 414×558 measured Card Vault as a 420px viewport over 1,884px of content. A real vertical gesture beginning on the `Open Market` button moved `scrollTop` 0→760 while world position and event state stayed byte-for-byte unchanged.
- Eternal Pulse uses the same architecture inside the Command Center: exactly one scroller (432px viewport / 712px content), zero nested scrollers, and a real gesture beginning on `Full teaching` moved 0→260 without moving the world.
- Body-level layers include a pointer-blocking backdrop and stop React portal pointer propagation, preventing the canvas/gameplay handlers from receiving any part of a popover gesture.
- The live roster and selected guest explorer surface keep the same foreground state for their complete lifetime and sit 20 layers above expanded gameplay controls; movement, utility, menu, and companion controls can no longer paint over them.
- Light- and dark-scheme browser chrome both resolve to the invariant Wildz forest theme `#09110d`, matching the already locked root/body surface so Safari cannot switch the URL bar white when an overlay opens.
- Capture locking, sealing, world toast, real five-stat reward, and Card Vault handoff share the new proof-seal treatment without changing capture authority.

## Result

final result: passed

Production browser verification at 414×558 and 1280×720 found no blocked vertical gesture, nested scroller, world-input leak, header movement, or bottom-message/control collision. The fixed header remains visible while the native content viewport moves independently.
