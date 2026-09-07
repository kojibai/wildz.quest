# Continuous Sovereign Construction Design

## Outcome

Wildz construction becomes an always-available, resource-backed creative activity. A player may begin a place with no materials, see admitted stakes immediately, gather renewable hay, timber, and stone, and watch each exact contribution become physical construction. The player can finish every supported component alone. Creatures and other players increase throughput and visible activity, but never grant permission or remove a solo player's ability to continue.

A place is not a fixed shelter recipe. It is a continuously expandable collection of structural, living, and functional components. Its size and detail are determined by the materials and work contributed to it, not by a room cap, shelter tier, daily timer, creature requirement, multiplayer requirement, or premium blueprint gate.

## Current State and Problem

The live Trail Shelter and Trail Bridge flow requires the complete material cost before placement and requires a rested companion mandate for terminal work. Workbenches and caches also use complete-cost instant construction. This makes construction legible but still permission-gated and coarse.

The repository already contains a deterministic preview-only catalog for foundation, room, roof, door, stair, bridge, storage, workshop, habitat, light, and water pieces. It supports anchors, rotation, height, exact collision solids, inhabitable interiors, undo, and deterministic placement digests, but it is unmounted and explicitly non-physical. This design promotes that component vocabulary through a new admitted construction authority rather than treating the preview as world truth or expanding the two-prefab site model indefinitely.

## Product Laws

1. **Planning is immediate.** A valid component can be placed as an admitted plan without owning its full recipe or any material.
2. **Resources remain meaningful.** Hay, timber, and stone are exact conserved lots. Physical progress cannot appear without admitted material and work.
3. **Opportunity is renewable.** Every construction resource has deterministic renewable world sources. A depleted node may recover, but the resource family never has a permanent global supply ceiling.
4. **Solo construction is complete construction.** The player has a positive baseline work contribution for every ordinary building component. No creature or other player is required.
5. **Collaboration changes throughput, not access.** Multiple creatures and players can deposit materials and perform work in parallel. They do not unlock ordinary pieces or authorize completion for the owner.
6. **Every admitted change is visible.** Empty plans show stakes and layout lines. Deposits show staged materials. Work advances the frame, enclosure, function, and finish in the world.
7. **Expansion has no player-facing cap.** Storage, synchronization, rendering, and collision are paged and streamed internally instead of refusing additional rooms or pieces.
8. **Function arrives before ornament.** A component becomes usable at its functional stage; its final stage may add finish, comfort, and visual refinement.
9. **Customization is recoverable.** Planning edits are free, unfinished revisions conserve unused resources, and finished renovations preserve the usable predecessor until the replacement is admitted.
10. **Proof objects remain authority.** Preview meshes, progress bars, local journals, animations, and caches never manufacture construction, resource custody, collision, or function.
11. **The edge is fully authoritative.** A valid action sealed by the active Receiz ID and its edge-held source proofs is final locally in the same interaction. Network access is never an admission step.

## Local Edge Authority and Instant Sync

The active Receiz ID proof object and the exact source objects held at its edge authorize construction. A placement, deposit, work, customization, or renovation command validates, seals, persists, and projects its successor locally before the interaction returns. That sealed proof immediately drives visible geometry, collision, function, saved state, and subsequent commands. The interface never labels locally admitted work as pending.

Receiz synchronization distributes already-authoritative proofs; it does not approve them later. When transport is available, publication begins immediately in the background. When transport is absent, play continues identically from the local proof graph and synchronization resumes automatically when a peer or Receiz transport becomes reachable. The replication journal is not a gameplay command queue, and reconnect is not a settlement event.

Collaborator deposits and work are actor-authored append-only contribution proofs addressed to an exact project/component lineage. They can be admitted by the contributor's Receiz edge without acquiring a network lock on the owner's device. Synchronization unions valid contribution proofs and folds them in deterministic causal order. Compatible excess materials move forward to the component's next unfinished stage or remain in exact project custody; they are not discarded. Concurrent work is credited exactly once up to the component's remaining work.

Exact edge custody prevents one material lot from being lawfully spent by two edges at once. If a divergent same-authority branch is discovered during synchronization, convergence preserves the lawful causal successor and returns every unconsumed object from the alternate branch to recoverable local custody. It never turns the original offline interaction into a pending action or silently deletes admitted materials.

## Player Experience

### Entering Build Mode

The existing construction control opens Build Mode directly over the active world. Exploration remains visible and movement/build mode can be exited instantly. The default surface is an in-world bottom palette; a precise inspector appears at the side on wide screens and as a responsive drawer on narrow screens.

The top resource strip always shows available hay, timber, and stone. It does not hide the palette when a count reaches zero. Empty inventory changes contribution guidance, not access to planning.

### Planning a Place

The player selects a piece and places a deterministic physical preview. Structural pieces snap to compatible terrain or construction anchors. Smaller furnishings use surface snapping, finer rotation, and local offsets. Confirming a valid preview admits a persistent planned piece and renders stakes, rope, measurements, or scaffolding at that exact transform.

The player may immediately place the next piece. Plans do not serialize behind unfinished work. Different components may be funded and worked in any order consistent with their physical supports.

### Building Continuously

Selecting a nearby unfinished component exposes one primary action: **Add what I carry**. The action allocates every compatible exact lot the player chooses, up to the remaining recipe. A partial deposit always succeeds when at least one selected lot is valid; it does not reject the action because the stage remains incomplete.

The component then exposes **Build here** whenever admitted materials support more work. Player work always contributes at the baseline rate. A press-and-hold or bounded repeated action may sustain presentation, but authority advances through discrete admitted work commands rather than frame time or an unverified timer.

The four universal stages are:

| Stage | World presentation | Authority and behavior |
| --- | --- | --- |
| Planned | Stakes, rope, measurements, ghosted silhouette | Persistent transform and recipe; no blocking collision or function |
| Framed | Foundation, posts, primary beams, laid materials | Structural solids admitted only where physically present; work may continue independently on connected pieces |
| Functional | Enclosure or usable mechanism is visibly complete | Intended collision, traversal, storage, shelter, crafting, rest, habitat, light, or water behavior becomes active |
| Finished | Roof, trim, surface finish, comfort, and decorative detail | Full selected appearance and final recipe/work head |

Recipes divide material and integer work requirements across these stages. Stage admission is monotonic within one construction revision. A renovation creates a successor revision rather than demoting a usable finished component in place.

### Running Out of Materials

No construction project closes, expires, or resets. The unfinished component remains visible with exact remaining hay, timber, stone, and work. The player can continue planning and customizing other pieces, gather from any renewable source, deposit materials into a different component, or leave and return later.

The interface may point toward nearby available sources, but it does not present waiting for one depleted node as the only path. Deterministic terrain neighborhoods expose multiple renewable source candidates, and their independent recovery projections prevent a permanent resource-family dead end.

## Resources

### Material Kinds

The canonical construction resource union becomes `hay | timber | stone`.

- **Hay** supports bindings, woven panels, bedding, insulation, thatch, soft habitat surfaces, and selected finishes.
- **Timber** supports frames, floors, walls, doors, stairs, roof structure, bridges, furnishings, storage, and workshops.
- **Stone** supports foundations, hearths, load-bearing supports, paths, reinforcement, drainage, and selected utilities.

Hay uses the same source-authoritative lot lifecycle as timber and stone: deterministic source projection, bounded capacity, exact harvest successor, custody, reservation/allocation, consumption, transfer, storage, and verified replay. Grassland source manifestations remain visible during recovery rather than disappearing.

### Renewable Opportunity

Each resource source has finite local capacity and deterministic Kai recovery. The world generator must provide construction-capable terrain neighborhoods with renewable candidates for all three material kinds. A node may be temporarily depleted, which affects build speed, but no finite global issuance or one-time quest can exhaust ordinary construction resources.

Construction recipes have no artificial scarcity tier. Different visual finishes may require different mixtures or more material, but ordinary structural function remains achievable from hay, timber, and stone available through the renewable world loop.

## Component and Customization Catalog

The first admitted catalog promotes and extends the existing component vocabulary:

- structural: foundation, floor/room, wall/opening, door, window, column, stair, roof, bridge, platform, and path;
- living: bed, hearth, storage, workbench, light, garden, water feature, and creature habitat;
- finishing: trim, surface finish, roof finish, railing, partition, and selected decorative attachments.

Each catalog definition provides stable kind and variant identifiers, anchor rules, stage recipes, authored visible geometry, stage collision solids, functional behavior, supported customization fields, and salvage policy. Arbitrary scripts, remote meshes, or unbounded user-authored collision are not admitted as customization.

Supported customization includes:

- position, anchor, height, and rotation;
- structural size variants and supported room spans;
- wall openings and door/window positions;
- roof profile and orientation;
- material assignment by supported surface;
- bounded finish palette, trim, and pattern choices;
- habitat species/family accommodation settings;
- utility configuration appropriate to the component kind.

Structural pieces use deterministic snap anchors with reliable coarse rotation, including supported diagonal variants where collision geometry exists. Furnishings and finishing pieces use finer deterministic rotation and local surface offsets. The preview must use the same transform, geometry variant, and collision definition that admission verifies.

### Editing and Renovation

- A planned component can be moved, rotated, mirrored, duplicated, restyled, or removed without material loss.
- An unfinished component revision releases unallocated lots immediately. Allocated-but-unconsumed lots are released when the active stage has not embedded them.
- Material already embedded in an admitted physical stage remains with that component or enters a bounded salvage successor; it never silently returns as a full duplicate.
- A finished component remains functional while a renovation successor is planned and built. At terminal replacement, the old collision/function projection and the new successor switch atomically.
- Undo and redo apply to the current local planning session. Only confirmed commands enter shared history.
- A selected room, shelter group, or place can be saved as a personal blueprint containing supported component definitions and relative transforms. Applying it creates plans; it does not manufacture materials or completed structures.

## Functional Places

Construction is not geometry alone. At the functional stage:

- shelter surfaces provide admitted cover and recovery context;
- doors, openings, stairs, platforms, paths, and bridges become physically traversable;
- storage accepts exact material lots under its custody rules;
- workbenches expose crafting supported by their admitted kind and revision;
- hearths expose rest and comfort behavior;
- lights affect local authored lighting within bounded render budgets;
- habitats provide a persistent place for assigned creatures to rest, live, and optionally contribute work;
- gardens and water features expose only the stewardship behaviors supported by their admitted components.

Functional behavior is selected from a trusted catalog and bound to the component head. A decorative preview cannot activate function. Removing or renovating a function follows the successor and salvage laws rather than mutating UI state.

## Solo Work and Collaboration

### Solo Baseline

Every ordinary construction recipe defines positive integer work requirements and a positive player baseline contribution. A nearby authorized owner can always submit player work when the component has material available for the next increment. Player work does not require an active creature card, creature consent mandate, another player, a level threshold, daily energy, or a cooldown.

### Creature Contributions

The owner may assign zero or more willing creatures to compatible construction work. Each creature contribution is an independent bounded operation with exact creature identity, head, profession evidence, component head, action budget, and expiry. Creature condition can reduce or pause that creature's contribution, but it never disables player work.

Multiple creatures may work on different pieces or contribute separate work increments to the same eligible piece. Their value is parallel throughput, embodied animation, affinity-sensitive presentation, and contribution history. No creature family owns an exclusive ordinary structural permission.

### Player Collaboration

Projects use `private | invited | public` access and separate permissions for planning, material contribution, work, renovation, and removal. The owner may continue solo under every access mode. An owner cannot accidentally configure a project that requires an absent collaborator for ordinary progress.

Different contributors can act on different components without a project-wide lock. Owner-authored geometry, policy, removal, and renovation commands compare the exact component head because they replace component structure. Contributor deposit and work proofs are append-only, address an exact component lineage, and merge without rewriting one another. The deterministic fold credits each compatible lot and work proof once; excess compatible material moves forward or remains in project custody, so synchronization never loses a contribution or double-counts progress.

Contributor identities, exact deposited lot heads, player work, creature work, and terminal stage participation remain part of the component's causal history and presentation ledger.

## Domain Model

### Construction Project

`WildsConstructionProjectV1` is the stable place identity and contains:

- project ID, owner Receiz ID, name, access policy, and collaboration permissions;
- style defaults used only when a component does not override them;
- home region and paged references to region-local construction chunks;
- revision, parent head, Kai uPulse, and proof-object authority marker.

The project object does not inline every component. Its references are paged so growth does not create one ever-expanding mutation or synchronization payload.

### Construction Chunk

`WildsConstructionChunkV1` belongs to one canonical world region and contains a bounded, sorted page of component head references plus continuation metadata. A chunk page is capped internally for verification and transport safety, but another page is created automatically. This implementation bound is never exposed as a settlement or piece cap.

Cross-region expansion creates region-local components and continuity anchors in adjacent chunks. A component that visually spans a region boundary compiles into linked region-local segments. No cross-region atomic mutation is required to place the next independent segment, and failure in one region cannot roll back already admitted neighboring construction.

### Construction Component

`WildsConstructionComponentV1` contains:

- component ID, project ID, region ID, owner, kind, variant, and customization;
- exact transform, anchors, support evidence, stage geometry digest, and functional definition ID;
- per-stage hay, timber, stone, and integer work requirements;
- exact allocated lot IDs/heads and their custodians/contributors;
- embedded/consumed material lineage by stage;
- player and creature work contributions;
- current stage and progress within the next stage;
- contributor identities, revision, parent head, Kai uPulse, renovation predecessor/successor references, and terminal/removal state;
- source-proof-object authority marker and canonical head.

Progress derives from the verified component only. A percentage is a UI projection of admitted stage material and work, never an independently writable value.

## Commands and Events

The local edge world service synchronously admits bounded component-level transitions:

- `construction.project.create`
- `construction.component.place`
- `construction.component.revise-plan`
- `construction.component.deposit`
- `construction.component.work`
- `construction.component.remove-plan`
- `construction.component.begin-renovation`
- `construction.component.replace`
- `construction.component.salvage`
- `construction.blueprint.save`

Each successful local command seals one corresponding causal world event before returning. Commands bind actor authority, project/component heads, exact selected lot heads, position/reach where physical action applies, and a unique command ID. They are idempotent. A stale, invalid, ambiguous, cancelled, or zero-write local mutation advances no authority. Transport availability does not participate in validation.

Placement admits no material consumption and no collision beyond physical stakes that are intentionally non-blocking. Deposit reserves or embeds only exact compatible lots. Work consumes only material assigned to the admitted increment and advances only the geometry, collision, and function proven by that successor. No work command issues a whole finished component from a progress percentage.

## Rendering, Collision, and Streaming

- The live world renders planned and partial geometry solely from admitted component state.
- Each component kind supplies shared geometries/material families for all stages; repeated pieces use instancing or batching where it preserves selection and stage presentation.
- Nearby construction chunks are selected outside the frame-critical path and memoized from the world projection.
- Planned stakes and nonphysical material piles do not create blocking collision.
- Framed collision contains only admitted physical solids. Functional collision uses the exact catalog solids bound into the component proof.
- Doors and room interiors preserve openings and inhabitable air; collision never falls back to a gross occupied box.
- Far chunks leave active render and collision sets without leaving saved authority.
- Large finished surfaces may be combined for rendering, but selection maps combined geometry back to exact component IDs.
- Stage transitions use short event-driven assembly presentation. Animation never delays command settlement or outranks the admitted result.

There is no player-facing maximum room count, component count, project radius, or settlement tier. Internal page sizes, region streaming radii, per-frame draw budgets, and collision culling are implementation constraints that automatically scale rather than rejecting new admitted construction.

## Interface

The approved interface direction is the in-world palette plus precise inspector.

### In-World Palette

- remains visible while Build Mode is active;
- groups structural, living, and finish pieces;
- never disables planning because resource counts are low;
- shows selected kind, snap/rotation state, and valid/invalid physical preview;
- retains at least 44px touch targets and safe-area clearance.

### Inspector

- names the selected component and its functional purpose;
- exposes supported transform, variant, opening, material, finish, and habitat/utility controls;
- shows the four construction stages and exact current/remaining resources and work;
- provides **Add what I carry**, **Build here**, revision, renovation, duplicate, and removal actions appropriate to the current state;
- explains physical placement failures and never substitutes protocol/version language for player-facing reasons.

### World Feedback

The world itself is the primary progress display. Stakes, delivered lots, posts, beams, walls, roof layers, trim, workers, and creature activity appear at the exact component. The inspector's meter summarizes this evidence; it is not the only feedback.

When no compatible lot is carried, the contribution action communicates the exact remaining recipe and available renewable source directions. The rest of Build Mode stays active. When a component becomes functional, feedback names the behavior now available instead of waiting for decorative completion.

## Failure and Recovery

- Invalid terrain, support, overlap, or access rejects only the selected placement/revision and preserves the last admitted project.
- Insufficient inventory deposits the valid selected subset when nonempty; it does not require full stage funding.
- An empty valid plan never expires.
- Network interruption has no construction gameplay state. The Receiz edge continues admitting, rendering, colliding, functioning, and saving exact construction locally.
- Synchronization publishes already-admitted proof events with the same command IDs and exact heads. Reconnect cannot duplicate lots or work and never asks the player to wait for settlement.
- The interface contains no network-pending construction presentation. A short local action-in-flight state may prevent duplicate taps only while the edge is synchronously sealing the proof; it is not connectivity-dependent and disappears as soon as local admission returns.
- Divergent owner-authored geometry or renovation heads converge through the Receiz causal-head law while preserving the alternate plan for recovery. Append-only same-component material/work contributions union independently; still-owned unused lots remain available and accepted lots remain credited exactly once.
- Missing or corrupt chunk hydration never projects an empty replacement over a known valid chunk. The client keeps the last verified projection and reports the unavailable region.
- Removing a planned component consumes nothing. Revising unfinished or finished construction follows the release, embedded-material, renovation, and salvage laws above.
- No decay timer, construction queue timer, creature fatigue, collaborator absence, daily quota, level, or premium entitlement can invalidate or halt ordinary owner work.

## Compatibility and Migration

Existing `WildsConstructionSiteV1` and `WildsStructureV1` proofs remain replay-compatible.

- An incomplete Trail Shelter or Trail Bridge site hydrates as one legacy-prefab project/component projection with its exact contributed lots and head preserved.
- A completed shelter, bridge, workbench, or cache remains a valid immutable legacy structure and can be selected as the predecessor of a new renovation component.
- Historical instant-build and site commands continue to replay, but the player-facing flow uses component placement, partial deposits, and solo work.
- Existing timber and stone lots retain their IDs, heads, custody, storage, reservation, and consumption status.
- Hay is added through a new verified material kind and cannot be manufactured by checkpoint defaults.
- The preview-only construction catalog remains non-authoritative until each definition has an admitted recipe, geometry/collision digest, functional definition, reducer, service validation, and replay tests. Removing `physical: false` or the preview publication blocker alone is expressly insufficient.
- Legacy checkpoints hydrate absent project, chunk, component, hay-source, and hay-lot maps as empty without altering existing canonical heads.

## Delivery Slices

This is one coherent subsystem delivered in dependency order:

1. **Continuous core:** hay source/lot authority, project/chunk/component proofs, plan-first placement, partial deposits, solo work, four stages, conservation, replay, and migration.
2. **Active builder:** in-world palette, inspector, admitted foundation/room/roof/door pieces, staged render/collision, responsive controls, and world feedback.
3. **Functional expansion:** stairs, bridges, storage, workbench, hearth, light, habitat, garden, water, and their functional-stage behaviors.
4. **Advanced customization:** openings, supported size/roof/material/finish variants, renovation, salvage, undo/redo planning, and personal blueprints.
5. **Unlimited settlement scaling:** automatic chunk paging, cross-region continuity, batching/instancing, multi-creature assignments, concurrent player work, large-place restore, and performance evidence.

Each slice ships only when its authority, conservation, persistence, presentation, and verification gates pass. A later slice may add breadth without reintroducing a permission gate into earlier construction.

## Verification

### Domain and Conservation

- A player with zero lots can admit a valid planned component.
- Partial hay, timber, and stone deposits produce exact deterministic successors and never require the remaining recipe.
- A lot has one live disposition and cannot be stored, transferred, deposited twice, embedded twice, or salvaged while consumed.
- Work without compatible admitted material cannot manufacture physical progress.
- Solo player work advances every ordinary component recipe with no creature or multiplayer inputs.
- Creature and player collaboration produces separate exact work contributions and changes throughput only.
- Revision, removal, renovation, replacement, and salvage conserve exact material lineage.
- Duplicate command IDs are idempotent. Stale owner-authored structural heads and conflicting lot custody fail locally with zero unintended writes, while independent valid collaborator contributions merge without a shared-head lock.

### World, Persistence, and Migration

- Plan, partial deposit, partial work, functional, finished, renovation, and salvage states restore byte-identically from checkpoints.
- Fully offline placement, deposit, work, function, renovation, saving, and restoration behave identically to connected local play.
- Immediate synchronization and later reconnect cannot duplicate, demote, delay, or erase locally admitted resources or work.
- A second device and a second authorized player project the same admitted construction.
- Legacy sites and structures restore without head mutation and can enter the renovation path.
- Region-local chunks page automatically beyond one page and link expansions across region boundaries.
- Missing/corrupt hydration cannot overwrite a last-known valid construction projection.

### Presentation and Function

- Zero-material stakes are visible immediately after admission.
- Every resource/work successor changes exact staged world geometry.
- Collision includes only admitted physical solids and preserves doors/interiors.
- Functional components expose their behavior exactly at the functional stage.
- Build Mode remains available with zero inventory and while other pieces are unfinished.
- The player can plan, edit, contribute, work, leave, return, and expand without selecting a creature or waiting for another player.
- Multiple creatures and players animate/contribute simultaneously without becoming required.

### Scale, Accessibility, and Release

- Large multi-region settlements stream by distance, preserve stable frame time within the agreed device profiles, and expose no building cap.
- Renderer diagnostics show bounded active chunk, mesh, material, draw-call, and collider counts.
- Mobile portrait, mobile landscape, tablet, and desktop layouts keep the world visible, controls readable, touch targets at least 44px, and safe areas unobstructed.
- Keyboard/focus order, reduced motion, live progress announcements, contrast, and error guidance pass accessibility checks.
- Focused tests, full tests, typecheck, production build, desktop/mobile browser playthrough, console/page errors, nonblank canvas evidence, screenshots, and construction lifecycle checks gate release.

## Explicit Non-Goals

- Arbitrary user scripting or executable experience code.
- Importing unverified remote geometry or collision as physical authority.
- Voxel terrain destruction or freeform excavation in this construction subsystem.
- Artificial decay, maintenance taxation, daily quotas, premium structural locks, or mandatory social/creature gates.
- Infinite in-memory rendering or unbounded proof payloads; scaling is achieved through transparent paging and streaming, not through player-facing denial.

## Success Criteria

A new solo player can enter Build Mode with no network, place a room plan with zero resources, see locally admitted stakes immediately, gather renewable hay/timber/stone, deposit any partial amount, perform baseline work without a creature, watch each stage become physical, use the room at its functional stage, finish and customize it, add more rooms and functional pieces, leave and restore the exact place, and continue expanding across streamed regions. Receiz synchronizes those already-authoritative proofs immediately when reachable. Invited players and multiple creatures can visibly accelerate the same project, yet removing all collaborators or all connectivity never removes the owner's ability to continue.
