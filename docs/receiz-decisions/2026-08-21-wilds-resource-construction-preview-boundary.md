# Wilds resources, construction, and authored play on Receiz v121

Status: preview-only implementation boundary for Wildz 8.0.0

## Shipped in this boundary

Wildz can deterministically reconstruct sparse resource sources from canonical 128-unit world regions. Source identity, position, terrain-compatible kind, capacity, quality, capability/tool requirements, and Kai replenishment policy are immutable and cache-bounded. Explicit harvest inspection can produce a deterministic candidate only after exact source, source-head, reachability, protection, creature-work, tool, and remaining-capacity checks.

The candidate is not a resource proof. Every harvest result is marked `physical: false`, `publish: "blocked-receiz-v122"`, and `writes: 0`. It does not change the source, create inventory, transfer custody, or spend or receive Φ.

Wildz also provides a pure local blueprint surface with a bounded component catalog: foundation, room, roof, door, stair, bridge, storage, workshop, habitat, light, and water. Placement uses exact structural solids rather than gross occupancy boxes, so doors and room air remain inhabitable while walls, floors, and frames collide. Every placement is bound to the exact blueprint ID, world ID, source revision, and source digest before the reducer may admit it into the disposable preview. Terrain/water/structure anchors, support, rotation, height, and undo-preview state are deterministic. The optional build panel is not mounted into the live game. Its language is diegetic and contains no fixed tutorial, numbered steps, identical scripted path, or protocol/version copy.

Creature work compiles a blueprint into bounded deterministic profession stages. Piece-level material kind and capacity requirements are matched against canonical resource-source projections and exact source heads; materials are never pooled as an untyped action count. Exact creature, tool, resource-reference, canonical region, bounded action-budget, and bounded expiry inputs are carried in the plan. The plan cannot execute online or offline; it is marked `offlineExecution: false`, `execute: "blocked-receiz-v122"`, `physical: false`, and `writes: 0`. Prefix progress is a local projection only.

Declarative authored experiences compile a bounded graph of typed nodes and transitions. The compiler rejects arbitrary code, unknown fields, duplicate/nondeterministic transitions, unreachable nodes, dead ends, unbounded score/hazard/reward fields, missing accessibility metadata, and reward/processor/shop/traversal references outside the explicit preview authority set. Replay enforces door, key, switch, puzzle, traversal-capability, and Kai-timer semantics; it is pure, deterministic, and bounded before parsing Kai values. Reward nodes emit nonphysical boundary candidates rather than proofs, inventory, Φ, battle results, or world mutations.

Damage, repair, and salvage are policy previews only. They validate ownership/public-play/consent/protection and calculate bounded projected integrity or salvage capacity without modifying a structure or creating inventory.

## Explicitly not shipped

- harvesting admission, ecological source mutation, resource proof creation, inventory mutation, split/merge/gift/listing/sale, or Φ settlement;
- blueprint publication, physical structure admission, collaborative head advancement, or authored atlas/restore;
- online or offline creature job execution, mandates, polling, queues, or background work;
- authored reward, shop, processor, hazard, battle, or score consequences outside the pure preview state;
- public/private/invited construction, destruction, repair, salvage, or stewardship commands;
- live-game resource generation, build validation, proof verification, history reduction, or network work during movement/rendering.

## Receiz boundary

Publishing any Task 9 candidate requires the v122 contracts documented in [Wilds authored-world authority on Receiz v121](./2026-08-21-wilds-authored-world-authority.md): durable subject admission/card binding, exact-head typed namespaces, verified replay/checkpoints, subject-scoped encrypted additions, atomic multi-participant inventory/world transactions, and explicit proof-native authority exchange. There is no v120 runtime, local database, optimistic outbox, server loot table, API-success, or guest/practice fallback.

Until those contracts are present, preview state is disposable visual intent. The proof object remains authority.
