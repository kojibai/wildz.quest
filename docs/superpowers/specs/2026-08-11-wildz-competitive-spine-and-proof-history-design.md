# Wildz Competitive Spine and Proof-History Design

## Status

Approved direction on 2026-08-11. This specification extends the approved world-class mobile redesign with four binding outcomes:

1. Mortal Arena uses the repository's advanced deterministic Arena runtime instead of the simplified parallel simulation.
2. Every creature's complete gameplay history travels with both its individual card and its containing Vault without rewriting the immutable base proof object.
3. Receiz SDK, MCP, and AI skills become player-visible foundations for fair competition, portable history, offline continuity, tournaments, coaching, and world operations while remaining below sealed proof authority.
4. Kai time treats `00:00:00` as sunrise. Night is visibly dark and star-filled while characters, threats, paths, and interactions remain readable through authored moonlight, rim light, affinity light, and a player-controlled Wilds lantern.

This specification is gameplay-first. The accepted UI and interaction hierarchy remain intact unless a gameplay state requires additional feedback, accessibility, or competitive information.

## Product outcome

Wildz should be a game in which practiced execution, tactical preparation, knowledge of a creature, and adaptation to an opponent reliably improve results. A player should be able to explain why an action succeeded or failed, train the relevant skill, reproduce the improvement, and prove the resulting history without trusting a mutable database projection.

The flagship loop is:

`explore -> recognize an opportunity -> prepare a proof-pinned roster -> perform skill-based play -> replay and verify the result -> append exact consequences -> return to a changed world`

The loop succeeds when:

- controls produce immediate and predictable actions;
- attacks, defense, movement, abilities, tags, and stage interactions have learnable rules;
- AI and human opponents obey the same legal action model;
- competitive outcomes can be reproduced from admitted inputs;
- progression comes from recorded contributions rather than client-supplied totals;
- a card or Vault restored elsewhere reproduces the exact creatures and their histories;
- offline play remains meaningful without being misrepresented as globally committed; and
- darkness changes atmosphere and tactics without making the game illegible.

## Current baseline

The repository contains two Arena implementations.

- `src/features/games/mortal-arena` owns the current player-facing Mortal Arena. It provides free movement, range-based light and heavy attacks, binary guard, focus, swapping, fleeing, NPC delay, campaign scaling, settlement, and the current scene.
- `src/features/play/arena` contains the deeper deterministic system. It provides proof-pinned fighters, analytic movement and collision, directional attack chains, commitment windows, reach, mass, damage, Break, launch, stamina, focus, cooldowns, guard, parry, dodge, tags, pickups, mechanisms, hazards, rescues, withdrawal, retirement, boss transitions, legal delayed opponents, replay, receipts, causal consequences, and exact card projection.

The advanced system is extensively unit-tested but is not the engine used by `MortalArenaExperience`. The player-facing system consequently presents named abilities and boss phases without using the full underlying tactical model.

Creature continuity is also split. Living card revisions and per-card proof appends already exist, and full Vault export carries player continuity. Routine level, XP, bond, and some mastery changes can nevertheless remain in player-level `companionProgress` or `livingProgress` projections until a later evolution, ascension, life event, or settlement writes a card revision. A full Vault can therefore know more than an individually exported card.

The current Receiz v118 integration passes its checker and correctly fails closed. Local identity, identity artifacts, and portable proofs are available. Live API, checkout, and webhooks require deployment configuration. The v118 SDK does not provide the Wildz-specific conditional market ownership append, so the game must not claim authoritative market transfer until that capability exists.

## Design principles

### One rule model, multiple game modes

Shared primitives—input admission, movement, combat timing, abilities, condition, replay, receipts, and consequences—have one authoritative implementation. Modes compose those primitives with different stages, stakes, objectives, and persistence policies. They do not fork combat arithmetic.

### Mastery over opacity

Every competitive mechanic needs a readable tell, a legal response, a measurable cost, and a punishable recovery state. Randomness may vary authored situations but may not replace player execution or secretly alter competitive hit resolution.

### Exact creatures, not family-level approximations

Progression, condition, loadout, mastery, and history are keyed by exact asset ID and exact parent revision. Family IDs remain catalog and discovery relationships, not creature identity.

### Immutable origin, append-only life

The birth/base proof object remains byte-identical. Gameplay produces successor history in a named Wildz namespace through append-only events and checkpoints. Custody succession is separate from creator, provenance, and gameplay history.

### Local responsiveness, explicit authority

Input, animation, audio, haptics, and local simulation do not wait for a network round trip. Canonical shared results require the appropriate Receiz admission and commit path. Pending, accepted, published, and effect-delivered states remain distinct.

## Canonical Arena architecture

### Runtime ownership

`src/features/play/arena` becomes the canonical Arena domain. The following parts remain separate and testable:

- fighter projection: exact proof, revision, anatomy, stats, abilities, and condition;
- match definition: mode, proof-pinned teams, stage, spawns, hazards, mechanisms, pickups, boss phases, and ruleset;
- fixed-step runtime: admitted inputs, movement, combat, context actions, tags, hazards, transitions, and terminal state;
- opponent controller: observable state, bounded public history, reaction limits, legal action selection, and telegraphs;
- transcript and replay: genesis, inputs, checkpoints, terminal digest, and mutation rejection;
- consequences: contributions, XP, mastery, relationships, injuries, scars, mortality, memorial, and rewards;
- receipt: definition, transcript, consequences, actor, authority mode, publication status, and verification;
- presentation adapter: stable projections for the existing React/Three.js scene, HUD, audio, haptics, and result director.

The current `MortalArenaExperience` remains the presentation entry point during migration. Its hook is replaced with an adapter over the canonical Arena runtime. The simplified `simulation.ts`, `combat.ts`, `movement.ts`, and `npc-controller.ts` are removed only after behavior, persistence, and browser parity are proven.

### Simulation rules

- Fixed simulation rate: 60 Hz.
- Inputs are semantic intents with sequence and target frame.
- Simulation values are finite, bounded, and quantized where replay identity requires it.
- Input order is deterministic and cannot depend on network arrival order.
- Visual animation follows simulation state; animation does not decide hits.
- Collision uses analytic or simple authored proxies rather than rendered meshes.
- Each action defines startup, active, recovery, stamina/focus cost, directional intent, reach, and legal cancel windows.
- Guard, parry, and dodge are distinct outcomes with distinct timing, costs, and counterplay.
- Affinity changes matchup incentives but does not create automatic wins.
- Named abilities use the exact card ability, element, power, anatomy, cooldown, and effect contract.
- Tags expose both outgoing and incoming fighters to declared risk.
- Boss phases change actual hazards, weaknesses, legal actions, AI policy, and presentation.

### Player mastery tools

Practice mode exposes optional learning aids:

- input and action history;
- startup, active, and recovery timing;
- hit, miss, guard, parry, dodge, and punish explanation;
- stamina, focus, Break, and cooldown timelines;
- recorded ghosts and replay segments;
- repeatable drills for movement, spacing, defense, tags, hazards, and matchup knowledge;
- accessibility-safe speed reduction for drills, never for ranked play.

These aids explain public rules and observed state. They do not reveal hidden future inputs.

## Game modes and competition

### Practice

Practice has no mortality, no ranked rating, and no canonical progression rewards. It supports drills, configurable opponents, replay loading, and local ghosts.

### Adventure

Adventure covers trainers, authored Arena paths, bosses, and world encounters. Results can append progression, condition, relationships, rewards, and world memory. Normal defeat cannot cause death unless the encounter explicitly enters an informed Mortal covenant.

### Ranked

Ranked is the pure competitive ladder.

- Permanent death is disabled.
- Rulesets, stage pools, roster budgets, and legal assets are versioned.
- Match definitions pin exact card and ruleset proofs.
- The server admits inputs and replays the deterministic transcript before settlement.
- Rating changes derive from verified settlement, never a client-provided win total.
- Matchmaking considers rating, latency region, queue time, ruleset, and party constraints.
- Placements, divisions, seasons, decay, rematches, disconnects, forfeits, and draws have explicit rules.
- Roster construction uses declared budgets and matchmaking bands to prevent purchased statistics from replacing execution.
- Spectator and public replay projections omit private or exploitable information.
- AI agents cannot submit ranked inputs for a human player.

The initial rating implementation should use a transparent uncertainty-aware system such as Glicko-2, with deterministic integer projections for player-visible divisions. Rating math and seasonal policies are independently versioned from combat rules.

### Mortal Covenant

Mortal play is an opt-in high-stakes queue or authored encounter family. It is not the primary ranked ladder. Entry requires exact risk disclosure, eligible living cards, proof-pinned roster, explicit consent, and a verified consequence path. Withdrawal before zero remains a legal survival decision. Zero Vitality is irreversible only when replay, consent, ruleset, and receipt all verify.

## Creature history and proof continuity

### History model

Kai Klok is the authoritative deterministic temporal state machine for Wildz. Its exact safe-integer `uPulse` (Kai micro-pulse) is the smallest native temporal coordinate. Causal ancestry is evaluated first; when valid competing projections require temporal resolution, the head with the greatest admitted `uPulse` wins. Conventional ISO timestamps are descriptive interoperability metadata only and may never outrank a `uPulse`. If multiple events share one `uPulse`, causal append sequence orders them; non-identical events claiming the same causal slot fail closed unless an explicit deterministic merge law applies, while byte-identical/idempotent events remain no-ops.

Each creature owns a `receiz.wildz.creature-history` namespace rooted in its immutable base asset. A history event includes:

- schema and ruleset version;
- event ID and idempotency identity;
- exact asset ID;
- parent history digest;
- occurred-at Kai and conventional coordinates;
- source mode and encounter/match/activity ID;
- admitted actor and authority profile;
- replay, receipt, or source-event digest when applicable;
- bounded effects;
- resulting projection digest.

Events cover:

- XP, level, and level threshold crossings;
- bond moments and relationship changes;
- ability, combat, exploration, community, character, and location mastery;
- wins, losses, retreats, rescues, tags, boss phases, tournaments, seasons, and rating records;
- fatigue, injuries, scars, recovery, vitality, retirement, and mortality;
- ability unlocks, loadouts, upgrades, evolution, ascension, anatomy, genome, and appearance;
- lineage, parenthood, offspring, mentors, rivals, and memorials;
- crafting or economy effects that legally target the creature;
- custody references without rewriting historical provenance.

High-frequency inputs remain in match transcripts, not as one card append per frame. A verified settlement appends the transcript digest plus contribution-derived consequences. Ordinary world actions may be batched into bounded, causally ordered checkpoints, but the checkpoint must retain all event IDs and a digest over the complete event segment.

### Exact projection

The current level, XP, bond, mastery, condition, loadout, rating history, and life state are pure projections of the verified history. `companionProgress`, `livingProgress`, HUD values, matchmaking cards, and export views consume that projection instead of maintaining independent truth.

Legacy family-keyed progress migrates once to the exact selected asset with an explicit migration event. Ambiguous progress is retained in player continuity for inspection and is not silently assigned to multiple creatures.

### Individual card export

An individual card export contains:

- the byte-identical base proof object;
- the complete verified creature-history append chain or a complete self-contained history block graph;
- the exact current projection and its digest;
- required replay/receipt evidence or content-addressed embedded nodes within protocol limits;
- no Identity Seal, passphrase, unrelated Vault state, or mutable database authority.

Reopening the card in a clean installation must reproduce every player-visible creature field and verify the same history head without network access.

### Vault export

A Vault contains the exact exported representation of every admitted card plus player/world continuity that is not creature-owned. Shared history nodes are content-addressed and deduplicated. The Vault commits:

- ordered exact asset identities;
- each card base proof digest;
- each creature-history head;
- the player continuity head;
- custody and membership evidence;
- the complete self-contained block graph needed for offline restoration.

Import verifies the enclosing artifact first, then each card, append chain, history head, and player binding. It reconstructs creatures before selecting or publishing them. A newer verified descendant may extend an existing history. Divergent siblings remain explicit; timestamps and last-write-wins cannot choose authority.

### Ownership and transfer

Creator, birth owner, historical custody, current custody, and gameplay history are different fields. A legitimate transfer appends current custody and preserves every predecessor byte. Possession, a profile projection, an MCP result, or an AI explanation cannot manufacture ownership.

Until Receiz exposes the Wildz-specific conditional market ownership append, marketplace transfer remains fail-closed. Bearer ownership may use the supported complete-artifact claim path with explicit confirmation and verification.

## Receiz utilization

### SDK

- `artifact.verify`: verify exact card, Vault, replay package, season award, or tournament artifact bytes.
- `artifact.admit`: establish same-runtime eligibility under the current registry.
- `artifact.append.plan`: prepare a zero-write successor for creature history, competitive history, profile, or supported world state.
- `identity.capability.sign`: authorize the exact declared transition without exposing identity keys.
- `artifact.transition.seal`, `stage`, and `commit`: create immutable candidates and atomically advance a named accepted head.
- `admission.command.execute`: admit match settlement, raid contribution, crafting, publication, and other constitutional commands.
- `public-proof.projection.locate`: locate public proof projections without treating them as verified bytes.
- `artifact.global.resolve`: resolve accepted bytes from the named coordination domain, then reverify them.
- `artifact.offline.reconcile`: reconcile verified offline history structurally with explicit divergence handling.
- profile and economy showcase planners: prepare proof-native roster, achievement, season, and supported economy presentations without treating plans as commits.

### MCP

The nine current artifact MCP tools support operator and agent workflows for verification, admission, append planning, transition staging/commit, global resolution, and offline reconciliation. Player-visible uses include:

- tournament check-in and roster verification;
- replay verification and dispute evidence;
- public coaching and post-match analysis;
- support-assisted Vault diagnosis and migration;
- accepted-head and effect-delivery monitoring;
- world-event, season, and raid operation preparation;
- cross-application card continuity inspection.

MCP reads may inform play and operations. MCP writes require delegated scope, exact confirmation, and the normal proof/commit path. MCP never becomes match, identity, ownership, or settlement authority.

### AI skills

Receiz skills guide builders and agents for deterministic replay, constitutional laws, causal sync, portable continuity, receipt admission, offline-first behavior, global reconciliation, performance, observability, testing, authority security, commerce, distribution, and release.

AI may:

- generate legal authored encounter definitions and opponent personalities;
- simulate balance across declared rosters and stages;
- analyze verified public replays;
- coach from observable decisions;
- propose quests, tournaments, schedules, and world events;
- prepare plans and evidence for confirmed operations;
- detect suspicious replay patterns for human or constitutional review.

AI may not:

- fabricate proof, history, ownership, ratings, or settlement;
- see or exploit hidden ranked inputs;
- play a ranked human account;
- commit mutations without the exact capability and confirmation path;
- erase divergence, unknown namespaces, or prior custody.

## Kai day and night visibility

### Canonical day phases

The Kai day begins at sunrise:

- `00:00:00`: the sun first crosses the horizon; warm low-angle light and long shadows.
- Ignite: sunrise into early morning.
- Integrate: morning ascent.
- Harmonize: midday and the solar peak within the phase, never at `00:00:00`.
- Reflekt: afternoon descent and lengthening shadows.
- Purify: sunset and twilight.
- Dream: visibly dark night through pre-sunrise.

Every consumer uses `projectKaiWorldExpression`; no subsystem derives a second clock or treats `00:00:00` as noon.

### Night art direction

Night must visibly read as night in screenshots and play:

- a dark sky with a readable star field and bounded Ark-specific constellations;
- the sun below the horizon and no daylight-colored hemisphere wash;
- darker terrain, vegetation, structures, fog, and distant silhouettes;
- moon/Ark key light with cool directionality;
- warm settlement, window, camp, landmark, and path lights;
- reflective materials and water responding to night sources;
- reduced distant detail and stronger local contrast without black crush.

Automatic failure conditions include a night phase that looks like blue daytime, stars visible over a bright daylight sky, full-strength daylight shadows, or darkness hiding the player, threats, navigation, or interaction targets.

### Character readability

The world can be dark while gameplay remains readable:

- the player and active creature receive a restrained camera-facing fill and world-consistent rim light;
- enemies, hazards, pickups, and interactables use authored silhouettes, motion, material response, and telegraphs rather than a global brightness boost;
- affinity light is low-intensity and identity-specific: Spark flicker, Ember warmth, Tide caustic shimmer, Grove bioluminescence, Prism refraction, and Stone mineral glint;
- essential combat tells maintain contrast against every night background;
- exposure adapts slowly and within declared bounds when entering or leaving lit spaces;
- accessibility offers a separate night-visibility setting that increases local readability without converting night to day.

### Wilds lantern

The player owns a toggleable Wilds lantern rather than a mandatory modern flashlight.

- It casts a warm, short-to-medium-range cone with soft spill around the player.
- It is available during Dream, caves, storms, and other authored darkness.
- It can be toggled from a direct utility action and through keyboard/controller accessibility bindings.
- It does not consume a competitive combat action or cover the primary movement controls.
- It may affect ecology and stealth: reveal markings, attract some creatures, warn others, expose the player, or interact with reflective paths.
- Ranked arenas use authored competitive lighting and do not allow one player to gain a visibility advantage through lantern settings.
- Low-quality mode replaces expensive dynamic shadows with a projected light mask, baked pools, or simplified unshadowed spill.

The lantern supplements moonlight, rim light, landmarks, and creature affinity. It is not used to compensate for an unreadable render pipeline.

## World simulation propagation

The canonical Kai phase influences:

- NPC schedules, shops, trainer routes, settlement activity, and rest;
- creature sleep, hunting, migration, affinity, and encounter tables;
- ecology, weather, bosses, rifts, resources, and hazards;
- music, ambience, spatial cues, insects, birds, and settlement sound;
- world events and authored opportunities;
- lighting, stars, constellations, particles, fog, water, and materials;
- Receiz world-event records through the exact admitted Kai coordinate.

Time changes available situations, not the fairness of an already-admitted ranked match.

## Error handling and recovery

- Interrupted matches resume from a verified checkpoint or settle under declared reconnect/forfeit rules.
- Duplicate inputs, settlements, creature-history events, and commits are idempotent.
- Invalid replay, proof, parent, consent, roster, or ruleset evidence fails before consequence application.
- Card and Vault restore is atomic: no partial progress, custody, or retirement applies on failure.
- Missing live Receiz rails retain verified local truth and label pending work honestly.
- Offline divergence remains inspectable until a legal structural reconciliation succeeds.
- A failed lantern or night asset falls back to readable authored lighting, never a black screen.
- Visibility changes, pause, backgrounding, resize, pointer cancellation, and reconnect cannot leave held inputs or lights active incorrectly.

## Performance requirements

- Active combat targets stable 60 FPS on capable phones and an authored stable 30 FPS tier on lower-power devices.
- Simulation determinism does not depend on render frame rate.
- The advanced runtime avoids per-frame allocations and bounds transcripts, events, diagnostics, and checkpoint cadence.
- Ranked networking sends bounded semantic inputs and snapshots, not rendered state or complete Vaults.
- Creature-history exports deduplicate content-addressed evidence and enforce Receiz protocol and runtime materialization limits.
- Star fields use instancing, points, or a bounded sky shader; they do not create one draw call per star.
- Only important night lights cast dynamic shadows. Lantern, moon, and local sources follow the active quality tier.
- Expensive SDK verifier code stays out of the first interactive gameplay path where platform boundaries permit it.

## Verification

### Gameplay

- deterministic replay across at least 3,600 frames;
- light chains, heavy commitment, guard, parry, dodge, stamina, focus, cooldowns, exact abilities, tags, rescues, items, pickups, mechanisms, hazards, falls, withdrawal, knockout, and mortality;
- boss transitions change runtime behavior, not labels alone;
- AI uses observable state, reaction limits, legal inputs, and readable telegraphs;
- practice, adventure, ranked, and Mortal policies remain isolated;
- keyboard, pointer, touch, and controller intents produce equivalent legal simulation inputs;
- pause, restart, reconnect, background, and retry leave no stale state.

### Competition

- proof-pinned roster and ruleset admission;
- server replay equivalence before settlement;
- rating idempotency and uncertainty tests;
- disconnect, reconnect, timeout, forfeit, draw, rematch, and season boundaries;
- latency and input-order simulation;
- illegal input, future input, duplicate input, forged result, mismatched transcript, and tampered receipt rejection;
- public replay privacy and spectator delay.

### Creature and Vault continuity

- train, level, bond, battle, mastery, injury, recovery, relationship, evolution, ascension, rating, retirement, and custody changes append exact history;
- individual card export/reopen in a clean store reproduces every creature field and history head;
- Vault export/reopen reproduces every exact card plus player continuity;
- the base proof bytes are identical before and after gameplay;
- duplicate history is idempotent;
- newer descendants extend verified history;
- divergent siblings remain explicit;
- transfer changes custody without rewriting origin or gameplay history;
- offline verification succeeds without network access.

### Kai time and night

- exact day progress zero projects `sunrise`, horizon-level sun, warm low-angle light, and long shadows;
- the solar peak occurs during Harmonize, not at `00:00:00`;
- Dream screenshots are visibly dark at desktop and mobile sizes;
- stars and constellations are visible only under appropriate sky luminance;
- player, active creature, opponents, hazards, pickups, paths, and prompts remain readable;
- lantern toggle, cleanup, quality tiers, accessibility visibility, caves, settlements, combat, and transitions are verified;
- NPC, ecology, creature, audio, and event consumers agree on the same Kai phase.

### Release evidence

- typecheck, lint, tests, production build, Receiz checker, doctor, secret scan, AI-skill validation, and release gate;
- local browser run with console and network evidence;
- active desktop and mobile screenshots for day, sunset, dark night, lantern, practice combat, ranked simulation, boss transition, result, and world return;
- renderer, frame-time, network, transcript, history-size, and artifact-size diagnostics;
- no client or prompt exposure of keys, Seals, passphrases, capabilities, private inputs, or private Vault state.

## Delivery sequence

### Slice 1: Constitutional creature continuity

Create the exact creature-history event, projection, append, migration, card export, Vault export, clean-store restore, and round-trip verification path. Remove routine progression truth from independent family-level projections.

### Slice 2: Advanced Mortal Arena

Adapt `MortalArenaExperience` to the canonical Arena runtime. Preserve the accepted UI while exposing the full movement, combat, tag, hazard, boss, replay, settlement, and consequence model. Remove the simplified engine after parity.

### Slice 3: Training and authored Arena path

Add drills, explanations, ghosts, opponent archetypes, stage mechanics, real boss phases, campaign variety, and readable difficulty progression.

### Slice 4: Competitive service

Add ranked definitions, server input admission/replay, matchmaking, rating, seasons, reconnect, spectator/replay, dispute evidence, and verified settlement. Keep Mortal Covenant separate.

### Slice 5: Kai night and living schedules

Strengthen the canonical sunrise-to-night projection, visibly dark Dream rendering, star/constellation sky, character readability, Wilds lantern, schedules, ecology, audio, and verification fixtures.

### Slice 6: World propagation

Apply shared gameplay primitives to trainers, bosses, raids, and appropriate encounters while preserving specialized Hearttree, exploration, and negotiation objectives.

### Slice 7: Receiz MCP and AI operations

Expose verified tournament, replay, coaching, support, reconciliation, live-ops, observability, and balance workflows within the v118 authority ceiling.

## Completion standard

The program is complete only when players can become measurably better through practice; competitive outcomes are reproducible and fair; every meaningful creature change survives individual-card and full-Vault transfer; the immutable proof object remains unchanged; `00:00:00` is visibly sunrise; night is unmistakably dark and star-filled without sacrificing gameplay readability; and Receiz proof, MCP, and AI capabilities create visible player value without becoming hidden authority.
