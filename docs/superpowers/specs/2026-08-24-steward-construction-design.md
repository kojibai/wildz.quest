# Steward Construction: First Living-World Build Loop

## Outcome

Players can discover renewable timber and stone sources, work with a willing bonded creature to gather exact conserved material lots, and use those lots to build a persistent Trail Shelter that every explorer sees and collides with.

The loop is natural world interaction, not a tutorial: resource sources are visible in the terrain, touching one attempts the work, and the existing Foraging Satchel shows exact holdings and offers construction when the required materials are present.

## Authority boundary

- The deterministic source, the active Receiz ID, the verified creature card, and the current shared-world checkpoint are the inputs of authority.
- A material lot is a source proof object. Its digest binds source head, quantity, quality, worker, creature, and Kai moment.
- A structure proof binds its blueprint, position, contributors, and the exact consumed lot heads.
- The world checkpoint uses compare-and-swap publication so two harvests cannot spend the same source capacity and two builds cannot consume the same lot.
- Receiz SDK/API World publication distributes and resolves those proofs. It does not grant the local source its truth.
- Practice mode may preview the interaction but cannot create transferable material authority.

## Playable slice

1. The current terrain region deterministically exposes timber and stone sources.
2. A source projects current availability from admitted harvested capacity and Kai replenishment.
3. A nearby player touches a source. The active verified creature must be willing and carry the matching natural work family.
4. The world admits one exact material lot and advances the source head atomically.
5. The Satchel displays timber and stone by exact unconsumed quantity.
6. When at least four timber and three stone are held, the player can arm a Trail Shelter placement.
7. The next valid terrain touch commits the shelter, consumes the selected exact lots once, and publishes the shared state.
8. Every client renders the same shelter and receives matching fixed collision geometry.

## Creature relation

Work derives from the verified creature's canonical affinity:

- Grove, Prism, Spark, and Tide can perform careful lumber work.
- Stone and Ember can perform quarry work.

Consent uses the existing condition and bond model. Exhausted, injured, or unwilling creatures do not work. Switching bonded creatures is part of the play loop; no special capability is hidden behind creature level.

## Conservation and concurrency

- Source availability never falls below zero and replenishes only from Kai pulse policy.
- Lot IDs and heads are content addressed.
- A lot has one lifecycle: available or consumed by one structure.
- Construction validates current owner custody and exact unconsumed lot heads.
- Duplicate command IDs are idempotent; divergent use of a consumed lot fails closed.
- A failed or conflicting global publication rolls the in-memory candidate back.

## Presentation and performance

- Only sources in the player's current deterministic region neighborhood are projected and only nearby nodes are rendered.
- Sources and structures use lightweight authored meshes with no per-frame allocation or timers.
- Existing custom collision remains the correct physics choice: structures are static authored obstacles, not rigid bodies.
- Structure collision is derived from the same dimensions used by the visible mesh.
- Shared state remains checkpoint-driven, so refresh restores built structures immediately.

## Deferred after this vertical slice

Additional resources, tools, multi-piece freeform blueprints, tunnels, workshops, player-authored experiences, maintenance/decay, and cooperative multi-player stages extend the same proof and custody model. This slice establishes their authoritative foundation without placeholder writes.
