# Design QA — First-principles Mobile Popovers and Collision-safe HUD

## Source and implementation comparison

| User reference | Final implementation |
| --- | --- |
| ![User HUD reference](/Users/bjklock/Downloads/Screenshot%202026-08-11%20at%2010.43.17%E2%80%AFAM.png) | ![Final mobile HUD](/Users/bjklock/Kai-Turah/wildz.quest/output/playwright/final-mobile-polish-414x558.jpg) |
| ![Boss-pill and message-spacing reference](/Users/bjklock/Downloads/IMG_6074.jpg) | ![Final separated event lanes](/Users/bjklock/Kai-Turah/wildz.quest/output/playwright/final-mobile-event-lanes-414x896.png) |

## Comparison findings

- The three top-right controls now occupy one right-aligned row at x=238, 288, and 338 on the 390px viewport, leaving an 8px right safe margin.
- The two destination pills and the scan/temperature action now own a fixed three-lane mobile row: 30vw / 34vw / 30vw. Their responsive type and padding shrink without stacking, truncating, or intersecting.
- Kai Klok and the 44×44 audio control retain their prior left-side geometry and behavior.
- A slim live compass now uses the same heading convention as movement and the minimap, with wrapped nearby cardinal/bearing ticks and a collision-safe top lane.
- The bottom-right control contains only the selected real Vault creature. Tap or a stationary hold toggles real character actions, including the renamed `Bond` action; a second tap closes them with no X. Upward flick retains the exact single-row Slate preview behavior from `01613171`, including the existing pull-to-expand path; no ability wheel is mounted.
- Card Vault, audio, living-world, live-roster, selected-player, and Kai sheets now share one portal architecture outside the gameplay pointer tree. The non-scrolling frame is `overflow:hidden`; its only content viewport is `overflow-y:auto`, `touch-action:pan-y`, `scroll-snap-type:none`, and `-webkit-overflow-scrolling:touch`.
- The premium drag affordance is restored as a dedicated 24px header control. Only that header control captures a downward pull; the content viewport has no drag handlers, so a finger can begin on a button, card, label, or summary without changing gesture owners.
- Production at 414×558 measured Card Vault as a 420px viewport over 1,884px of content. A real vertical gesture beginning on the `Open Market` button moved `scrollTop` 0→760 while world position and event state stayed byte-for-byte unchanged.
- Eternal Pulse uses the same architecture inside the Command Center: exactly one scroller (432px viewport / 712px content), zero nested scrollers, and a real gesture beginning on `Full teaching` moved 0→260 without moving the world.
- Body-level layers include a pointer-blocking backdrop and stop React portal pointer propagation, preventing the canvas/gameplay handlers from receiving any part of a popover gesture.
- The live roster and selected guest explorer surface keep the same foreground state for their complete lifetime and sit 20 layers above expanded gameplay controls; movement, utility, menu, and companion controls can no longer paint over them.
- Light- and dark-scheme browser chrome both resolve to the invariant Wildz forest theme `#09110d`, matching the already locked root/body surface so Safari cannot switch the URL bar white when an overlay opens.
- Capture locking, sealing, world toast, real five-stat reward, and Card Vault handoff share the new proof-seal treatment without changing capture authority.
- Character quick actions now open Card Vault with the active asset selected and the pagination moved to that exact card.
- Camera heading publication now comes directly from OrbitControls changes instead of a competing render-frame sampler, keeping walking direction synchronized with the latest look direction.
- On portrait mobile, the centered scan/temperature pill stays in its established lane while destination and boss pills move to a dedicated lane 50px lower. The 44px top-right controls can no longer occupy the same vertical band as those event pills.
- The bottom event message now measures 190px at 414px wide (responsive range 168–190px), uses centered 10px copy that resolves to two lines for the live experience message, and sits lower with a clear 36px gap above the center toggle. Its x=112–302 footprint remains between the D-pad (ending at x=106) and companion control (starting at x=311).
- Held movement now advances from a stable 45ms deadline. A mildly late camera frame retains the original cadence, while a severe stall drops backlog rather than replaying a burst; movement speed, orbit damping, direction, and gesture ownership are unchanged.

## Result

Production browser verification at 320×568, 414×558, 414×896, and 1280×720 found no blocked vertical gesture, nested scroller, world-input leak, header movement, or bottom-message/control collision. At 414×896 the scan pill measured x=164–250 while the first right control began at x=262; the narrower message measured x=112–302 and y=757–800 while the toggle began at y=836. At 320×568 the scan moves to the y=154 event lane, four pixels below the top controls, with 16px reserved on either side for the destination pills. The fixed popover header remains visible while the native content viewport moves independently.

final result: passed
