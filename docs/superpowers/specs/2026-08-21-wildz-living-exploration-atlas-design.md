# Wildz Living Exploration Atlas Design

**Date:** 2026-08-21  
**Status:** Approved design  
**Scope:** Persistent personal exploration, atlas expansion, and discovered-space navigation

## Outcome

Every explorer owns a personal living atlas. A new account begins with the existing central Wildz territory revealed. Walking or legitimately arriving outside that territory permanently paints the exact terrain the explorer has reached into their atlas. The World view grows to contain the explorer's complete discovered geography and can be panned, rotated, and zoomed across all of it. The player may Rift to any revealed terrain coordinate, while undiscovered geography remains hidden.

The atlas is a different view of the gameplay world, not a second geography system. Elevation, water, trails, surfaces, landmarks, and obstacles continue to come from the same deterministic terrain and geography authorities used by gameplay.

## Player Experience

- The starting atlas remains the familiar nine-by-nine region area centered on the original Wildz territory.
- Crossing into a region outside known territory reveals that region and a one-region sight fringe around it. The fringe creates a natural painted edge instead of an isolated square.
- Revealed terrain appears with the same art and physical geography the player encounters in the world.
- Unrevealed terrain remains an atmospheric dark void. It does not expose terrain shapes, landmarks, routes, encounters, bosses, ecology sites, or other player locations.
- The World view opens at one stable geographic scale near the current or last camera position. Discovery growth extends the navigable canvas instead of shrinking previously known land. The dedicated Fit discoveries action remains available when the explorer wants the complete bounds on screen.
- The current location is always marked, even when the user moves the camera elsewhere.
- Region and Landmark zooms remain local detail views centered on the explorer.
- Selecting revealed terrain may initiate Rift travel. Selecting hidden space does nothing and provides concise “Unexplored—travel there to chart it” feedback.
- Rift travel reveals only the destination's immediate sight area. It never paints the unseen corridor between origin and destination.
- Ordinary walking can continue to the released world coordinate limits regardless of atlas state.

## Exploration Authority

Exploration is local proof-backed player history, not server authority. The proof object and restored `PlayState` carry the player's atlas. A server connection is not required to reveal or inspect explored terrain.

The canonical discovery unit is the existing multiplayer region identified by integer `(regionX, regionZ)` coordinates and `WILDS_REGION_SIZE`. Discovery is updated only when an admitted player position enters a region whose sight area is not already known. It is not recalculated every render frame and never triggers card verification or network verification.

The initial known area is deterministic: regions `x = -4…4` and `z = -4…4`. Each newly entered region reveals itself and its eight immediate neighbors. The sight rule is fixed and deterministic so save restoration and repeated input produce the same atlas.

## Compact Persistent Representation

`PlayState` gains a versioned exploration value:

```ts
type WildsExplorationAtlas = {
  version: 1;
  rows: Array<{
    z: number;
    ranges: Array<{ minX: number; maxX: number }>;
  }>;
};
```

Ranges are sorted, non-overlapping, adjacent ranges are merged, and coordinates are bounded to released world regions. This representation preserves sparse routes without falsely revealing the rectangle between them and remains compact for long straight or contiguous journeys.

Pure exploration helpers own all validation and mutation:

- create the deterministic starting atlas;
- normalize and validate restored rows and ranges;
- reveal the fixed sight area for a world position;
- test whether a region or exact world coordinate is known;
- calculate discovered bounds and counts;
- merge compatible atlas histories without removing prior discovery.

Legacy saves without exploration state migrate to the starting atlas plus the restored player's current sight area. Invalid or oversized exploration data fails safely to that same deterministic baseline. Exploration is monotonic: valid discovery can be added but never silently removed by movement, upload, reconciliation, or restore.

## Save and Identity Continuity

The atlas is part of full game state and therefore flows through the existing serialization surfaces:

- local `PlayState` persistence;
- lightweight runtime checkpoints;
- full Vault export and restore;
- Wildz Identity Seal and Receiz ID Card export and restore;
- same-owner merge and continuity reconciliation.

When two valid same-owner states merge, discovered regions are unioned. A different owner's atlas never contaminates the active account. Card-only imports do not replace identity or exploration state. Identity-bearing restoration activates the exact saved atlas together with the rest of the account.

Movement persistence remains coalesced by the existing save scheduler. Crossing a region boundary produces one small state change; ordinary steps within the region retain the current object reference and add no save pressure.

## Atlas Projection

`projectWildsAtlas` receives the exploration atlas and exposes:

- the exact discovered region set needed by the selected zoom;
- discovered bounds;
- a stable atlas center derived from those bounds for World view;
- whether any proposed coordinate is revealed;
- the explorer's current region and the total known-region count.

World zoom projects the full discovered bounds rather than forcing `{ x: 0, z: 0 }`. Region and Landmark zooms retain bounded windows around the current position. Static geography outside discovered regions is excluded before rendering, so hidden facts are not merely covered by a visual mask.

The full discovered map may be sparse. Atlas terrain meshes are generated per contiguous revealed range or compatible tile batch. Empty gaps stay empty. Terrain samples use exact world coordinates through `sampleWildsTerrain`.

## Camera and Navigation

World view uses one constant physical region scale. Terrain cells, routes, buildings, monuments, labels, presence, and markers retain the same proportions no matter how far the atlas expands. Newly discovered coordinates extend the canvas; they never reduce `regionUnit`, squeeze the starting island, or cluster fixed-size landmarks together.

When World view opens, the atlas restores its last camera relationship when available or starts at the stable geographic scale near the current location. Map controls then allow free pan, zoom, and rotation. World-view panning has no discovered-bounds clamp, origin clamp, or invisible camera wall: the player may move the camera indefinitely through uncharted darkness while only discovered geography remains painted and interactive.

Discovered-bounds expansion never changes camera distance, pan target, orbit angle, or world scale. Camera framing changes only through an explicit zoom-mode choice, the You action, or Fit discoveries. It does not fight intentional camera movement while the map is open.

Mobile and pointer interaction follows map conventions instead of the default orbit-camera gestures:

- one-finger drag or primary-pointer drag pans the atlas and moves the camera target with it;
- pinch zooms toward the gesture midpoint;
- optional rotation requires a deliberate two-finger gesture and never replaces one-finger pan;
- drag direction follows the finger so the map feels physically held;
- momentum is short, bounded, and disabled under reduced motion;
- panning can continue beyond every discovered edge without an artificial limit;
- releasing a gesture never springs the camera back to the starting territory or current player position;
- opening World view restores the prior view or uses the stable geographic scale near the current marker, while a dedicated “You” action can recenter without changing discovery or zoom;
- a dedicated “Fit discoveries” action can restore the complete painted atlas to view without changing discovery or imposing a later camera constraint;
- Region and Landmark views may recenter when their zoom mode is explicitly selected, but remain freely pannable within their projected bounds.

Atlas clicks convert the exact mesh intersection back to world coordinates. A click is admitted only when the resulting coordinate is revealed. Landmark Rift actions follow the same rule. The current marker and selected destination use the same dynamic atlas center and scale as terrain, routes, labels, and player presence.

At very large discovered extents, World view uses bounded screen-space detail: terrain sampling density and decorative instances adapt to the viewport rather than growing linearly with traveled distance. Region and Landmark zoom preserve close detail. This keeps atlas size from affecting gameplay and keeps opening the atlas bounded on mobile.

## Privacy and Shared World Facts

An explorer's atlas is private account state unless a future feature explicitly shares it. Remote presence and living-world facts are shown only when they fall inside revealed space. Discovery by another player does not reveal territory on this player's map.

The global world remains deterministic and shared: two players visiting the same coordinates reveal the same geography, but each retains an independent record of having discovered it.

## Aquatic Discovery and Swimming Progression

Water geography also becomes deterministic creature habitat. The encounter authority must sample the same terrain authority used by movement and rendering before admitting a water hotspot:

- aquatic and Tide-aligned families are preferentially placed on actual shallow-water, deep-water-edge, marsh, and shoreline coordinates;
- land families are not presented as submerged encounters unless their sealed habitat and anatomy support water;
- every released deep-water area that spans multiple encounter regions deterministically receives reachable aquatic discovery opportunities;
- the first aquatic catch remains possible from dry land or shallow water through the existing bounded scan radius, preventing a requirement to swim before owning a swimmer;
- farther aquatic discoveries may require leading with an already-owned swimming creature and entering deep water;
- caught creatures retain their exact generated identity and proof; terrain changes which valid habitat family is encountered, never the proof rules;
- selecting a living aquatic creature continues to grant `swim` through the existing cached traversal-capability projection;
- injury, fatigue, retirement, and ownership rules continue to govern whether that exact creature can provide swimming.

Terrain-aware hotspot generation occurs only during the existing explicit search action. It examines a fixed candidate budget in nearby encounter regions, memoizes deterministic region projections, and performs no work during ordinary movement, rendering, identity restoration, or card verification. No background aquatic scan is introduced.

The atlas paints water exactly where gameplay does but does not expose hidden aquatic encounters before discovery. Once an aquatic creature signal is legitimately found, normal encounter and capture feedback identify the water habitat clearly.

## Failure Behavior

- Missing exploration state migrates without blocking login or gameplay.
- Malformed ranges are rejected or normalized within strict limits; they never allocate an unbounded mesh.
- A persistence failure leaves the newest exploration state queued through existing save behavior.
- Atlas rendering failure does not affect walking, movement input, or world simulation.
- Offline exploration works immediately and saves locally.
- No atlas operation re-verifies already admitted cards, Vaults, or identity artifacts.
- Aquatic hotspot selection failure falls back to another bounded deterministic candidate; it never stalls movement or the render loop.

## Testing and Release Gates

Pure unit tests must prove:

- deterministic starting discovery;
- sight-area reveal and idempotency;
- sparse range normalization and union;
- exact known/unknown coordinate checks;
- monotonic discovery across movement and Rift arrival;
- legacy migration and malformed-data bounds;
- same-owner restore union and foreign-owner isolation;
- deterministic discovered bounds and atlas centering.

Integration and rendering contracts must prove:

- World view follows complete discovered bounds instead of origin;
- current-position markers remain correctly projected outside the starting area;
- hidden terrain and hidden facts are absent from the projection;
- clicks work anywhere on revealed meshes and fail on hidden gaps;
- one-finger pan and pinch zoom reach the entire discovered atlas without snapping back to origin;
- World-view region, terrain, route, building, monument, label, presence, and marker proportions remain invariant as discovered bounds grow;
- opening or expanding the World view does not automatically compress the complete discovered extent;
- the current-location action recenters deliberately while ordinary gestures preserve their chosen camera target;
- the fit-discoveries action restores full discovered bounds after unrestricted panning;
- World-view camera targets are never clamped to origin or discovered bounds;
- Region and Landmark zooms remain bounded and usable;
- runtime checkpoints, Vaults, and Identity Seals restore the exact atlas;
- movement inside one region performs no exploration mutation;
- aquatic hotspots occupy terrain-authorized water or shoreline coordinates;
- every representative deep-water cluster has a shoreline-accessible aquatic opportunity;
- catching and selecting an aquatic creature enables the existing swimming path without proof reverification;
- ordinary movement frames invoke neither exploration expansion nor aquatic hotspot generation unless a region boundary or explicit scan requires it;
- production build, full test suite, mobile WebKit visual checks, console checks, and gameplay frame-time checks pass.

## Non-Goals

- No finite world wall or travel restriction is introduced.
- No server becomes exploration authority.
- No terrain is generated specifically for the atlas.
- No automatic reveal of the rectangle between sparse discoveries.
- No sharing, trading, or monetizing personal maps in this release.
- No card or identity reverification is added to movement or atlas rendering.
- No background encounter search or aquatic simulation is added to the gameplay loop.
