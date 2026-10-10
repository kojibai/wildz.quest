# Adaptive building placement and shared clearance salvage

Date: 2026-10-10. Status: written design for review; shared salvage is not implemented.

## Outcome

Place a paid building on natural terrain, including mountains. Grade the complete
footprint to the building's base and blend the edge into the surrounding land.
Remove natural scenery that intersects that footprint. Put the remaining wood
and food from that scenery in visible stacks and baskets beside the property.
Any explorer can collect those finite contents. Existing player structures retain
their space, including the builder's own structures.

This work stays in Wildz and uses the installed Receiz 128.0.0 SDK and its
released source, replay, proof-object, and custody primitives. It introduces no
Receiz core changes, database, wallet connection changes, or new work on movement
frames. It does not change historical construction or resource laws.

## Current gap

The existing material harvest reducer checks a canonical procedural source and
reach from that source's original position. The nourishment reducer also checks
the original plant position and starts a new crop on its regrowth calendar.
Moving their meshes alone would leave unreachable resources, or allow a cleared
tree to produce new fruit under a building. The existing gameplay journal is
owner-bound locally and enters shared SDK custody on explicit resource actions;
a local projection does not establish a cross-player claim.

The current uncommitted placement correction distinguishes new clearance rules
from old terrain support rules. It clears trees and rocks consistently for
rendering, movement, and canonical placement, but does not yet preserve their
yield in collectible piles. That correction must not ship alone as a completed
salvage feature.

## Selected approach

Use a versioned construction clearance consequence and shared finite source
admission. Each construction consequence binds the exact admitted building,
affected original scenery IDs, source heads, remaining quantities, and side
locations. A pickup advances the shared source head and creates ordinary
inventory members through native source admission. The same original portion
cannot exist in a standing tree, a pile, and a wallet simultaneously.

Moving still-growing trees would preserve the old harvest flow but does not
meet the requested wood stack and fruit basket behavior. Owner-local loot would
be easy to display but would allow competing players to duplicate contents.
Neither is the selected approach.

## Clearance and finite yield

1. Derive clearance from the complete oriented footprint and flat apron of a
   verified, paid, surface building. A preview has no resource authority. Tools,
   equipment, and underground builds do not clear surface scenery.
2. Enumerate the deterministic procedural tree, rock, and food source IDs in
   intersecting tiles. Use bounding queries and the existing footprint budget.
   An unchanged construction head reuses its disposable projection.
3. A clearance admission freezes each affected source's remaining state at the
   admission's Kai moment. Wood uses existing canonical timber capacity and
   prior harvested quantities. Food uses the current crop's remaining portions.
   Do not accumulate missed crops or reset an already harvested source.
4. Reserve those exact portions against the standing sources when admitting
   clearance. A source already cleared belongs to its first admitted clearance;
   a later overlapping footprint cannot mint it again. Rocks become a separate
   stone pile using their existing source capacity. Berries and vegetables use
   food baskets too, so replacing the full footprint does not discard them.
5. Cleared sources stop regrowing. Evolving, moving, demolishing, reloading, or
   transferring a building does not replenish clearance contents or restore an
   already claimed procedural source. Clearance history persists independently
   of the current rendering of its original building.
6. A failed or rejected placement produces no clearance or loot. Retry with
   the same command ID produces the same consequence and piles.

## Location, appearance, and interaction

Place wood stacks, stone piles, and baskets along the outside edge of the new
footprint, beyond the building wall and within the adapted ground. Choose stable
side positions from the admitted footprint and source ordering; do not reroll
positions on reload. Keep a navigable approach and doorway clearance. Candidate
positions must avoid established structures and existing pile access points.
If needed, distribute contents around other sides or extend the side laydown
area into available natural ground; do not delete a neighbor's property.

Stack appearance reflects remaining contents but uses a bounded number of pooled
or instanced meshes. Contents are ordinary satchel materials or food and can be
used, sent, packaged, or sold through their existing flows after admission.
Collection uses the player's actual pose and reach from the pile, never a fake
pose at the original tree. The usual hand and gather controls show the item and
remaining quantity. Empty piles disappear; partial piles remain after reload.

## Source and custody boundary

Clearance and collection require independently opened source evidence, not
caller-supplied counts, world JSON, a building mesh, or a receipt alone. Carry
exact source artifacts and their causal heads through the released SDK boundary.
Use authenticated source compare-and-swap for competing claims, exact command
IDs for retries, and the existing resource package member conservation checks.
Previously admitted exact history remains admitted; verify new source evidence
and append the consequence rather than reopening all historical cards.

Before implementation, the plan must identify the concrete existing v128
application adapter that admits clearance and pickup together with the original
resource frontier. If this needs a new application law/reducer, give it explicit
new coordinates and an SDK-qualified causal handoff from the old source. Do not
silently change `wildz.resources.v128`'s registry, reducer, genesis, or historical
heads. The old wallet source remains readable and its connection path remains
unchanged. A staged handoff must prevent legacy harvest and new pile pickup from
claiming the same reserved portion.

The installed SDK already supplies source authoring, sealed domain replay,
independent opening, and custody primitives used in Wildz. First compose those
primitives at the application boundary. Any actual missing native capability
must be demonstrated with the exact released API/schema before proposing an
alternative. No local authority substitute or Receiz repository change is in
scope.

## Timing and recovery

Placement preview stays local and immediate. Canonical source enumeration,
verification, and clearance calculation happen on the existing command worker
or explicit admission path. No history replay, sealing, network request, or
resource enumeration occurs on a movement or camera frame.

The building and clearance consequence must be recoverable as one construction
result. If shared publication is staged, the local building can remain visible,
but shared piles do not become spendable until their finite source reservation
is admitted. Persist the exact pending attempt; recovery resumes it rather than
creating another pile. A pickup awaiting shared admission remains pending and
cannot be eaten, used, sent, or sold as an admitted asset. A stale claim refreshes
the pile; it cannot grant a replacement portion.

## Compatibility and validation

- Replaying an old construction/resource command preserves exact old outputs,
  heads, crop behavior, and existing wallet loading.
- Place a house over actual procedural trees, rocks, and food; verify the
  full paid source replay, grounded movement, rendering, terrain corners,
  resulting source reservations, and exact finite yield.
- Reject intersection with the builder's or another player's established
  structure, including an offset wing and a neighboring graded footing.
- Collect as the builder and a second explorer. Verify actual reach, partial
  depletion, empty depletion, reload, device restore, retry, and concurrent
  compare-and-swap. Prove conservation across all owners and old source access.
- Verify food consumption, material use, wallet counts, package send/receive,
  and marketplace selection for admitted pickup contents.
- Measure preview and placement work with small and large footprints and many
  established structures. Confirm unchanged heads reuse projections and moving
  the player/camera adds no proof work. Record measurements; do not promise zero
  browser latency or memory pressure without device evidence.

## Excluded

No player structure replacement, PvP destruction, death/stash rules, new economic
payments, background sale of player data, or changes to the player's ordinary
controls. The economic value work follows this feature separately.
