# Steward Craft Loop V1 Design

## Purpose

Turn the existing lawful resource and construction rails into one natural player loop: notice a living source, work beside the active willing creature, receive exact material lots, choose a known blueprint, preview its physical placement, confirm the work, and return later to the same persistent shared structure.

## Authority

- Every rendered tree and rock remains a deterministic projection of canonical terrain authority.
- Harvested-source state, exact material lots, consumed-lot records, structures, living operations, bounded Phi awards, and world emission remain the only durable authority.
- UI state and 3D placement ghosts are disposable presentation. They cannot create lots, consume lots, issue Phi, or persist structures.
- The active verified card is the assigned work partner. Its exact capability and condition determine whether work is available; no duplicate UI rule may outrank that projection.
- Construction confirmation calls the existing world command. A preview never consumes material.

## Player Flow

1. Every nearby rendered tree or rock exposes its subtle capacity ring and can be selected.
2. The world HUD shows the active creature's exact work family and remaining work capacity.
3. The Foraging Satchel presents a compact Steward Craft section with the active partner, exact material bank, and blueprint cards.
4. Selecting Trail Shelter or Trail Bridge closes the Satchel and enters placement mode.
5. The first terrain tap creates a local ghost preview. Validity, physical reason, required materials, and assigned creature are visible without blocking movement.
6. The player confirms or cancels. Only confirmation submits the existing authoritative build command.
7. On admission, exact lots are consumed once, bounded Phi settles from the existing emission rail, and the persistent structure assembles in stages for every projection consumer.

## Blueprints

V1 exposes the two structures already admitted end to end:

- Trail Shelter: two timber, one stone; dry reachable ground; public recovery landmark.
- Trail Bridge: four timber, two stone; water centered between two safe level banks; public crossing.

The catalogue is a data projection rather than hard-coded buttons so paths, storage, tools, and workstations can be added when their exact structure/tool proof schemas and physical effects are admitted. V1 must not visually offer structures the authority cannot yet create.

## Interaction and Mobile Layout

- Blueprint cards use stable compact rows, fixed material counters, explicit locked/ready states, and a minimum 44px action target.
- Placement controls sit above the existing bottom controls, respect safe-area insets, and shrink through `clamp()`/container constraints without truncation or overlap.
- The 3D ghost uses shared low-cost geometry and material, follows only explicit taps, and performs no per-frame React state writes.
- Confirm is disabled for invalid placement. Cancel always restores normal terrain search.
- Reduced-motion mode retains the ghost and state cues without pulses or assembly flourish.

## Performance

- Blueprint readiness is a memoized pure projection from current material counts, active work meters, and pending command state.
- Terrain taps compute one placement projection; ordinary movement performs no new resource, blueprint, or structure work.
- Ghost rendering reuses existing shelter/bridge geometry and shared materials.
- Existing bounded source neighborhood and persistent structure projections remain unchanged.

## Verification

- Pure tests cover catalogue requirements, creature assignment, material locks, reach, bridge physical validity, and preview/confirmation separation.
- Render contracts cover the responsive craft selector, placement HUD, confirm/cancel semantics, and 3D ghost.
- Existing steward world/service tests prove exact lot consumption, Phi settlement, idempotency, and restored structure persistence.
- Full tests, typecheck, production build, desktop/mobile browser interaction, console/page errors, canvas pixels, and renderer diagnostics gate release.
