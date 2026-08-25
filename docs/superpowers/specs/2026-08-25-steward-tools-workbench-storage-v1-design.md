# Steward Tools, Workbench, and Storage V1

## Outcome

Complete the first authoritative production loop beyond raw gathering: explorers and willing companions gather exact timber and stone lots, place persistent workstations, craft proof-bound tools, equip them, and store or retrieve exact lots without creating value from UI state.

## Laws

- The Receiz ID and every admitted source proof object remain authority. The SDK distributes and synchronizes; it never invents ownership.
- Every material lot remains an exact, immutable source-derived object. A tool can improve precision and quality, but one admitted harvest still consumes one unit of source capacity and produces one lot.
- Workbench and cache construction consumes exact, unspent lot heads once.
- Tool crafting consumes exact, unspent lot heads once and records the workbench, builder, materials, durability, revision, parent head, and canonical head.
- Equipping changes an owner-scoped projection, not tool ownership.
- A cache stores exact unconsumed lots. Stored lots cannot be spent until withdrawn, and storage cannot change owner or lot head.
- All productive work remains a living operation admitted against the bounded construction emission rail.

## Content and Costs

| Object | Cost | Function |
| --- | --- | --- |
| Steward Workbench | 3 timber, 2 stone | Required physical station for tool crafting |
| Trail Cache | 2 timber, 2 stone | Persistent exact-lot storage |
| Steward Axe | 1 timber, 1 stone | Lumber precision tool, 24 durability |
| Quarry Pick | 1 timber, 2 stone | Quarry precision tool, 24 durability |

## Tool Effect

A matching equipped tool within an admitted harvest is consumed by one durability revision. It raises the resulting lot quality by one, capped at five, and improves the operation's useful-output/durability evidence. It does not grant the creature profession, bypass consent, expand reach, increase lot quantity, or reduce source consumption.

## Authority Model

New world projection fields:

- `stewardTools`: latest canonical revision by stable tool ID.
- `equippedStewardTools`: equipped tool ID by owner Receiz ID.
- `storedMaterialLots`: cache structure ID by material lot ID.

New event kinds:

- `tool.crafted`
- `tool.equipped`
- `storage.material_moved`

Existing `resource.material_harvested` carries an optional next tool revision so the source, lot, operation, emission, award, and durability change are atomic.

## Player Experience

- The existing steward craft surface lists workbench and cache beside shelter and bridge.
- Nearby owned workbenches reveal craftable tools, exact costs, durability, and equip state.
- Nearby owned caches reveal deposited totals and simple exact-lot deposit/withdraw actions.
- The work HUD shows the matching equipped tool and durability as a subtle meter; errors state the physical reason (missing station, out of reach, stored material, wrong profession, or depleted tool).
- Static workbench/cache geometry is projected from world state. No work is added to the render loop.

## Performance and Compatibility

- Projection additions default to empty maps when replaying existing checkpoints.
- Rendering uses memoized static object lists and existing distance culling.
- No polling, timers, or per-frame allocations are introduced.
- Offline/outbox execution uses the same world service and reducer, so reconnection cannot create a second authority path.

## Verification

- Pure proof tests cover deterministic IDs/heads, costs, durability, quality, and rejection paths.
- Reducer/service tests cover one-time lot consumption, storage exclusion, reach/ownership, atomic tool use, replay, and checkpoint recovery.
- UI contract tests cover clear costs, station requirements, tool durability/equip state, and cache actions.
- Full typecheck, test suite, production build, and mobile browser verification must pass before commit.
