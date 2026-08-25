# Persistent Cooperative Construction V1 Design

## Outcome

Players place a real Trail Shelter or Trail Bridge site, contribute exact material lots, complete one visible bounded work action beside an eligible companion, and return after refresh to the same unfinished or completed structure. Every step is causal world history rather than disposable UI state.

## Playable Loop

1. Steward Craft arms a shelter or bridge placement without consuming anything.
2. Confirming a valid preview admits an unfinished construction-site proof at that exact position.
3. A nearby site appears physically as a survey ring and partial foundation. The Satchel exposes its exact timber, stone, and work progress.
4. Any Receiz ID holding eligible loose material lots may contribute them. Each accepted lot becomes reserved to that exact site and cannot be stored, crafted, transferred, or spent elsewhere.
5. Once materials are complete, a nearby player with a rested verified companion admits the bounded build work.
6. The completed site advances to a terminal head, its reserved lots become consumed by the resulting structure, bounded construction Φ settles, and the shared shelter or bridge gains its normal render and collision projection.
7. Checkpoint replay restores placed, funded, worked, and completed states byte-identically.

## Source Authority

- The active Receiz ID proof object is player authority.
- The deterministic terrain projection is placement authority.
- Exact material lot proof objects are contribution authority.
- The verified companion card and sovereign mandate are work authority.
- Each site head binds blueprint, position, parent head, revision, material requirements, exact contributed lot heads, contributor Receiz IDs, work progress, and terminal structure head.
- SDK, MCP, API, URLs, and checkpoints distribute and reconcile these proofs; no representation may create, demote, replace, or outrank the source proof objects.
- Placement and contribution do not issue Φ. Lawful productive work issues Φ only when the final structure is admitted.

## Domain Model

`WildsConstructionSiteV1` is a content-addressed causal object with:

- one deterministic `siteId`;
- blueprint `trail-shelter` or `trail-bridge`;
- exact position and rotation;
- `materialsRequired` and exact contributed lot IDs/heads;
- contributor records keyed by Receiz ID;
- `workRequired: 1` and bounded `workCompleted`;
- lifecycle `placed | materials-ready | complete`;
- revision, parent head, Kai uPulse, optional terminal structure ID/head, and proof-object authority marker.

The world projection adds:

- `constructionSites` by site ID;
- `reservedMaterialLots` mapping lot ID to site ID.

Existing completed `structures` and `consumedMaterialLots` remain unchanged. Completion atomically removes reservations and adds consumption records, so a lot has exactly one live disposition.

## Commands and Events

- `construction.site.place` → `construction.site_placed`
- `construction.site.contribute` → `construction.site_contributed`
- `construction.site.work` → `construction.site_worked`

Placement validates reach, dry-ground shelter placement or physical bridge banks, overlap, and active-card presence. Contribution validates current site head, ownership of every exact lot, required remaining kinds, and absence from stored, reserved, or consumed maps. Work validates current site head, complete materials, reach, active-card proof, and a fresh `build` mandate. A completion work event carries the exact terminal structure, living operation, emission successor, amount, and Φ award.

All commands are idempotent by command ID. Stale heads and conflicting material dispositions fail without changing projection state.

## Presentation

- Confirm copy says “Place site,” not “Confirm build.”
- An unfinished site is visible immediately as a restrained survey ring, laid materials, and a partial frame whose geometry is derived only from admitted progress.
- The Foraging Satchel shows the nearest site within six meters with fixed-width timber, stone, and work meters.
- A single “Contribute exact lots” action selects only the remaining required kinds in stable lot-ID order.
- Once funded, the action becomes “Work beside [companion].” Completion feedback names the structure and exact Φ settlement.
- All controls retain 44px touch targets, safe-area fit, focus states, wrapping, and reduced-motion behavior. No tutorial overlay is added.

## Performance and Physics

- Site projection is event-driven and memoized from checkpoint state; ordinary movement performs no new proof work.
- Nearby render filtering is bounded and uses shared geometry/materials.
- Incomplete sites have no blocking collision. Completed structures continue through the existing static authored obstacle projection.
- No new frame loop, timers, rigid bodies, or detailed-mesh collision are introduced.

## Compatibility

- Legacy V3 checkpoints hydrate missing `constructionSites` and `reservedMaterialLots` as empty maps.
- Existing instant build commands remain replay-compatible for historical events and tests, but the player-facing shelter and bridge flow uses progressive sites.
- Workbench and Trail Cache remain instant in this slice; progressive multi-stage versions can adopt the same site primitive later.

## Verification

- Pure tests prove deterministic site heads, stale-parent rejection, exact contribution conservation, terminal irreversibility, and exact structure material lineage.
- World service tests prove place → contribute → work → completion, idempotency, failed conflict atomicity, Φ only at completion, and checkpoint restoration at unfinished and completed stages.
- Render contracts prove the site panel, place-site copy, touch targets, responsive fit, and admitted partial geometry.
- Full tests, production build, desktop/mobile browser flow, console check, screenshot, and nonblank Three.js canvas gate completion.

