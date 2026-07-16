# Wildz Games Kernel and Mortal Arena Design

## Status

Approved direction on 2026-07-16. This specification defines the shared Wildz Games anthology kernel and its first flagship game: a lightweight, real-time, free-movement 3D creature fighter in the Arena of Echoes.

This specification supersedes only the Arena of Echoes implementation described in `2026-07-16-wildz-receiz-gameplay-logic-parity-design.md`. The remaining Receiz-to-Wildz location mappings continue unchanged.

## Product outcome

Wildz becomes a world of deep, reimagined game archetypes built around verified Wildz cards and Receiz primitives. Players take the same living creatures into fighting, racing, dungeons, tactics, party challenges, arena sports, rhythm, exploration, puzzle, and collection games. Every game contributes to one portable creature life and one remembered player journey.

The first flagship is a real-time 3D arena fighter with the accessibility, expressive movement, comeback drama, character mastery, and emotional stakes people value in enduring fighting games, while remaining an original Wildz system. It does not copy protected characters, art, stages, names, music, story, exact rules, animations, user interface, or trade dress from another game.

The Mortal Arena occupies the literal center of the world atlas at coordinate `{ x: 0, z: 0 }`. It replaces the current center landmark as the map's primary visual and gameplay anchor. Hearttree remains part of the wider world and recovery journey, but no longer owns the center coordinate. The center Arena must be identifiable through silhouette, motion, atmosphere, sound, and map projection without changing the established Wildz HUD, buttons, or control geometry.

The experience is instant on mobile, light to download and run, deep enough for long-term mastery, playable with live opponents or NPCs, fully progressive offline, globally synchronized when connected, and bound to the actual evolving histories of verified cards.

## Program decomposition

The anthology is a program, not one monolithic release.

1. Build the shared Games kernel and creature runtime.
2. Ship the Arena of Echoes flagship fighter end to end.
3. Design and ship each additional game as an independent module using the shared contracts.

Future modules receive separate design specifications and implementation plans. They must reuse the common card, lifecycle, progression, artifact, input, audio, matchmaking, receipt, and synchronization contracts rather than forking creature truth.

The first planned families are:

- free-movement 3D fighting;
- creature racing;
- cooperative dungeon and boss exploration;
- tactical card combat;
- party obstacle and survival games;
- arena sports;
- rhythm and harmony challenges;
- exploration, puzzle, and collection trials.

## Existing Wildz primitives

The program builds on existing implemented truth:

- verified portable cards and living-card revision chains;
- deterministic creature forms, genomes, variants, traits, abilities, and shape language;
- card mastery, XP, growth, achievements, evolution, fusion, and lineage;
- multiplayer rooms, challenges, two-player battle state, idempotent commands, and current live transport;
- Arena of Echoes location, access, visual shell, and Focus, Guard, and Strike interaction language;
- eight modular boss families, transformations, hazards, weaknesses, support objectives, raids, receipts, history, and artifacts;
- proof-sealed Vault packaging, IndexedDB state, offline-first PWA support, and Receiz identity/session boundaries;
- world checkpoints, ecology activities, settlement districts, embedded market, and portable public projections;
- adaptive audio and drawer behavior defined in `2026-07-16-wildz-adaptive-audio-and-drawer-affordance-design.md`.

The current turn-based PvP and landmark Arena engines remain compatibility projections until the real-time kernel replaces their result path. They are not extended into a second competing combat authority.

## Shared Wildz Games kernel

### Module contract

Every game module declares:

- stable game ID and rules version;
- supported player count and connectivity modes;
- eligible card and roster rules;
- input alphabet;
- deterministic setup and seed rules;
- fixed-timestep simulation interface;
- snapshot and input-trace schemas;
- completion, result, score, injury, resource, and reward rules;
- offline eligibility;
- authoritative verification requirements;
- checkpoint and resume rules;
- audio scene projection;
- bundle and runtime budgets.

Game modules consume admitted creature snapshots and emit proposed life events. They cannot mutate cards, Vaults, ownership, settlement, or global world state directly.

### Deterministic simulation

The kernel runs a fixed-timestep simulation that is portable between browser clients and server verification.

- Gameplay state uses deterministic numeric representations and bounded update order.
- Inputs are compact, ordered, sequence-numbered frames.
- Physics needed for competitive results is implemented inside the deterministic simulation boundary.
- Decorative particles, camera interpolation, cloth, secondary motion, and non-authoritative effects remain outside that boundary.
- Snapshots carry state digest, last admitted input sequence, and rules version.
- Replays consume the original setup and ordered input trace.
- Proof-safety caps bound match duration, input volume, entity count, and rollback history.

### Hybrid online simulation

Online combat uses a hybrid architecture:

- the local client simulates immediately for responsive input;
- players exchange or submit compact input frames rather than rendered state;
- an authoritative match service validates sequences and emits signed snapshots;
- clients reconcile with bounded rollback when a snapshot differs;
- final results are recomputed from admitted setup, inputs, and rules version;
- NPC and boss actors use the same legal state and input interface as human actors.

The protocol supports later 2v2 and four-fighter modes, but the first release renders and verifies one active fighter per side.

### Creature runtime

One card-to-character runtime transforms a verified living card into a playable creature across all games.

It projects:

- shared body rig and animation graph;
- modular anatomy and silhouette pieces;
- scale, mass, reach, locomotion, aerial control, and collision profile;
- material palette, markings, aura, scars, repaired damage, equipment, and memorial state;
- health, power, guard, speed, bond, element, abilities, mastery roles, genome, stage, condition, and learned traits;
- temperament and relationship-driven idle, reaction, victory, fear, grief, and recovery behavior;
- level-of-detail representations for active play, distant view, icon, and low-power fallback.

Evolution alters reusable modules and parameters rather than requiring a unique heavy model for every card.

## Flagship match format

### Teams and opponents

- A player enters with one to three verified creatures.
- One creature per side is active at a time.
- Online matchmaking prefers a live human opponent.
- Empty or unsuitable queues offer an NPC opponent immediately.
- Campaign stages, challenge matches, ranked matches, and bosses all use the same combat kernel.
- NPC tiers progress from teaching rivals through adaptive champions and multi-phase bosses.
- NPCs do not access hidden player inputs or ignore legal cooldowns, resources, collision, or condition rules.

### Arena movement

Combat takes place in bounded 3D arenas with:

- full ground movement;
- jumping and aerial recovery;
- elevation and traversable geometry;
- obstacles, hazards, pickups, and destructible tactical elements;
- readable edges and fall recovery;
- camera framing that prioritizes both active fighters and immediate threats;
- authored low-power variants that preserve competitive geometry.

Falling from the arena inflicts declared damage and recovery pressure. It does not bypass the creature-life model with an unexplained instant result.

### Vitality and Break

Combat uses two connected pressures:

- **Vitality** is the active share of the creature's persistent physical condition. Reaching zero causes canonical retirement in mortal Arena play.
- **Break** is temporary balance, guard stability, and resistance to launch, stagger, combos, and finishers.

Attacks may damage Vitality, Break, or both. High Break pressure enables launches and vulnerable states. Guard, movement, Focus, abilities, matchup properties, arena geometry, and team support create counterplay.

### Controls

The flagship preserves Wildz's existing mobile interaction language.

- The movement trackpad controls free movement and directional modifiers.
- Strike performs fast attacks and directional chains.
- Guard blocks, dodges, parries, and restores Break under declared conditions.
- Focus reads opponent tells, improves targeting, and enables advanced counters.
- Each card's two verified abilities become real animated combat powers.
- Swap calls a surviving roster member through a vulnerable but cancelable tag window.
- Flee channels a safe withdrawal that concedes the match if completed.
- The existing contextual action remains the large primary prompt.

The visual design, button geometry, icon language, safe-area behavior, and touch-target rules remain Wildz. Desktop adds keyboard and controller mappings without changing the mobile composition.

### Combat depth

The common input language supports:

- directional attack variants;
- grounded and aerial chains;
- charge timing;
- launch and recovery;
- perfect guard and parry windows;
- ability cancels and counters;
- stamina or energy management;
- arena-object interaction;
- tag support and roster synergy;
- collected match tools and pickups;
- comeback opportunities that require execution rather than hidden rubber-banding.

Every creature differs through real card characteristics. No card is universally dominant.

## Matchups and strategy

Matchups use strong but soft counters across:

- element and affinity;
- body mass and reach;
- ground and aerial mobility;
- burst, sustain, control, defense, and support roles;
- ability range and recovery;
- arena terrain, hazard, and weather;
- mastery, temperament, injury, relationship, and equipment;
- boss weakness and transformation phase.

A poor matchup creates a meaningful disadvantage but not an unwinnable hidden lock. Every encounter has at least one discoverable path through player skill, roster choice, items, environment use, opponent tells, practice, retreat, or preparation.

Loadouts lock at match entry. Arena pickups create tactical variation. Paid items never create competitive advantage or turn survival into pay-to-win.

## Persistent Arena Path

Each player has a canonical Arena Path containing:

- completed stages and latest checkpoint;
- unlocked opponents, bosses, arenas, and difficulty tiers;
- tutorials and techniques encountered;
- discovered opponent knowledge and matchup notes;
- losses, retreats, victories, deaths, and memorials;
- campaign story branch;
- season, series, tournament, and ranking references;
- reward and checkpoint digests.

Players resume from the latest verified checkpoint rather than restarting the campaign. An active interrupted match resumes from an authoritative snapshot when possible; otherwise it follows declared disconnect resolution.

Creature retirement never erases player checkpoints. Future teams continue the journey and retain the history of who reached each stage.

## Difficulty and learning

Difficulty increases through visible rule composition rather than secret stat inflation alone.

- Early opponents teach one mechanic at a time through readable telegraphs.
- NPC behavior demonstrates useful techniques.
- Defeats surface actionable observations in-world.
- Practice is non-mortal and supports movement, timing, matchup, and boss-pattern learning.
- Later opponents combine established mechanics, punish repeated habits, coordinate counters, reduce safe windows, and exploit arena geometry.
- Bosses introduce declared transformations, hazards, weaknesses, and support objectives.
- Encounters become strategically harder while preserving at least one legal winning path.

The adaptive opponent model may learn bounded tendencies from prior admitted matches. It cannot inspect live private inputs, secretly change rules, or invalidate a player's learned timing.

## XP, growth, and embodied evolution

Every admitted activity may contribute idempotent events to the creature's living revision chain.

Events can affect:

- XP and mastery level;
- ability proficiency and branches;
- role affinity and matchup knowledge;
- relationships and team synergy;
- temperament and behavioral expression;
- achievements and titles;
- permanent markings, shape modules, scars, repaired damage, asymmetry, gait, aura, and animation;
- genome expression and future evolution choices;
- story memories and lineage influence.

XP is never erased by injury. Injury may suppress current usable stats and alter development. Evolution derives from what the creature repeatedly does, survives, learns, protects, fears, and achieves rather than from a level number alone.

Collected resources include food, herbs, energy, recovery items, catalysts, crafting materials, temporary boosts, arena tools, lore keys, and rare evolution components.

## Persistent condition

### Condition layers

Match HP is a projection of persistent condition, not an unrelated disposable bar.

Creatures move through readable condition bands:

- healthy;
- strained;
- wounded;
- critical;
- mortal;
- canonically retired.

Condition is communicated through the existing card and world presentation plus embodied signals: posture, breathing, gait, aura, visible wounds, reactions, animation, audio, and teammate behavior.

### Recovery

Before zero Vitality, even severe injury can recover through difficult, meaningful play.

- Trail Gate provides safe rest and gradual condition recovery.
- Hearttree Sanctum provides deep restorative quests and trauma recovery.
- Mosslight Atelier repairs physical or magical damage and crafts treatments.
- Ecology activities provide food, herbs, energy, catalysts, and rare remedies.
- Relationships, caretaker creatures, achievements, and strong play may open recovery paths.

Recovery consumes declared player energy, time, resources, or gameplay effort. It may leave scars, altered motion, fears, resistances, abilities, titles, relationships, or evolution branches. Recovery does not erase history.

## Mortal Arena and player agency

Entering the mortal Arena is the opt-in boundary. The roster screen shows each creature's current condition and states that zero Vitality causes canonical retirement.

During combat:

- the player may swap out a damaged creature before zero;
- a swapped creature preserves its remaining condition;
- the player may heal, shield, use items, exploit pickups, or execute comeback mechanics;
- the player may flee and concede while saving all creatures still above zero;
- warning signals become unmistakable as a creature approaches death without repeatedly interrupting combat;
- reaching zero retires that creature even if its team later wins;
- surviving roster members may continue the match.

The server or deterministic offline authority freezes the exact zero-Vitality event before retirement admission. No animation, optimistic client counter, or network glitch can create retirement without a valid match result.

## Canonical retirement

Death changes gameplay eligibility; it does not delete the Receiz proof object or erase history.

At zero Vitality:

1. the match records the final action, cause, opponent, arena, condition, witnesses, team state, and contribution;
2. an end-of-life event is appended to the creature's living revision chain;
3. a sealed retirement record binds the final match digest and last living card revision;
4. the burial ritual projects the creature's actual appearance, scars, relationships, achievements, and life story;
5. the creature returns to the Vault as a memorial card;
6. active gameplay eligibility is permanently disabled.

A retired card cannot fight, boost, recover, breed, craft, stake, enter a tournament, or authorize a new gameplay result. Its proof, ownership, lineage, descendants, stories, stats, match history, achievements, and memorial remain inspectable and shareable.

Retirement is irreversible. Existing descendants preserve lineage references. Future descendants cannot be created from the retired card.

## Sacrifice, grief, and memorial

Death receives emotional specificity rather than generic failure treatment.

- Combat focuses briefly on the fallen creature and its teammates.
- The score transitions into the creature's personal motif.
- The final contribution is preserved: damage absorbed, ally protected, opponent defeated, or objective completed.
- If the team later wins, the victory record honors the fallen creature's sacrifice.
- The celebration becomes solemn before ordinary rewards appear.
- A deterministic epitaph derives from the final verified history.
- Monument Walk adds the creature to a permanent memorial constellation.
- Surviving teammates may carry grief, remembrance, vow, relationship, title, animation, and evolution events.
- Descendants may inherit a small symbolic legacy trait.
- The player can revisit the ritual, replay, final moments, complete life story, and lineage.

Death never triggers a shop prompt, replacement offer, pack advertisement, or purchase pressure. A sacrifice reward is mechanically smaller than preserving the creature so intentional death cannot become optimal farming.

## NPCs and bosses

NPC fallback is immediate when no live opponent is available.

- Teaching rivals introduce controls and strategies safely.
- Standard rivals use readable archetypes and legal counterplay.
- Adaptive champions learn bounded tendencies from admitted history.
- Boss encounters use the existing eight Wildz boss families.
- Bosses support modular opener, escalation, hazard, weakness, support objective, transformation, finale, and aftermath behavior.
- Boss tiers increase pattern complexity, arena pressure, roster demands, and consequence without hidden cheating.
- Practice versions remain non-mortal; campaign and mortal challenge versions state their consequence boundary before entry.

## Artifact-first offline authority

### Card state

The living card carries a causal revision chain containing:

- XP, mastery, abilities, traits, condition, injuries, recovery, appearance, temperament, relationships, achievements, match history, story, evolution, lineage, and retirement;
- parent revision digest;
- event digests and rules versions;
- local admission or global admission evidence.

### Vault state

The proof-sealed Vault carries:

- complete card collection and current card revisions;
- player Arena Path and other game checkpoints;
- inventory and resources;
- world and story progress;
- pending match receipts and global append queue;
- causal synchronization cursor;
- retirement and memorial records.

Browser IndexedDB is a working projection of these portable artifacts, not a replacement authority. Updated cards and Vault packages remain exportable.

### Offline play

Without internet, players may:

- play deterministic solo games and NPC battles;
- continue campaign stages allowed by their current checkpoint;
- fight eligible bosses;
- earn pending XP, history, injuries, recovery, evolution, resources, and checkpoints;
- perform recovery and crafting activities;
- canonically retire a creature in opted-in mortal offline play.

An offline match records the complete deterministic setup and input trace, recomputes the result locally, seals a match receipt, appends card revisions, and commits the updated Vault atomically.

Offline play cannot authorize live PvP, matchmaking, auctions, ownership transfer, money or card stakes, global tournament advancement, or global rankings.

### Global synchronization

On reconnection:

1. submit signed pending receipts and causal revision chains;
2. verify identity/session authority appropriate to the artifact;
3. recompute deterministic activities;
4. validate card parent digests, inventory spending, condition, retirement, checkpoint, and rules versions;
5. admit compatible history in causal order;
6. merge global presence, tournament, ranking, and world consequences;
7. seal the admitted global snapshot into the local Vault.

### Branch conflicts

If multiple devices extend the same card revision:

- compatible XP, history, discoveries, relationships, and achievements combine idempotently;
- valid injuries, condition loss, resource spending, and recovery requirements cannot be discarded;
- canonical retirement dominates later activity based on an older living parent;
- contradictory ownership, settlement, stake, inventory, or rules branches fail closed;
- every rejected or merged branch remains inspectable;
- no conflict silently rewrites the creature's life.

Backup rollback may create a historical branch but cannot erase globally admitted consequences.

## Match and life data flow

The canonical flow is:

`verified living card → admitted fighter snapshot → deterministic simulation → ordered input trace → recomputed match result → proposed life events → card revisions → atomic Vault revision → global causal admission → refreshed card/Vault artifacts`

Retirement adds:

`zero Vitality → valid result freeze → end-of-life append → sealed retirement → burial ritual → memorial Vault projection → global memorial admission`

## Lightweight mobile delivery

The world shell does not bundle every game.

- Shared kernel, card runtime interfaces, and low-detail creature projection remain small.
- Each game module is route- or location-split and loads only on entry.
- The first playable arena slice loads before optional music, spectators, decorative effects, alternate arenas, replay media, or high-detail assets.
- Creature bodies use shared rigs, instanced modules, parameterized materials, and bounded textures.
- Arenas use instancing, level-of-detail tiers, compressed assets, bounded particles, baked or inexpensive lighting, and deterministic low-power geometry.
- Network transport sends inputs and snapshots, never video.
- Optional modules and alternates use cache quotas and least-recently-used eviction.
- The service worker pins only the common kernel, current creature essentials, one arena, core SFX, and offline receipts needed for instant play.
- Music streams or caches progressively under the approved CC0 audio manifest.

Explicit performance budgets are set in the implementation plan after measuring the current production baseline. Budgets must cover initial transfer, parsed JavaScript, decoded audio, texture memory, geometry memory, simulation time, render time, rollback memory, battery, and thermal behavior on representative mobile Safari and Chromium devices.

## Error handling

- Network loss preserves local input and attempts bounded reconnection.
- A client/server state mismatch rolls back to the latest admitted snapshot.
- An invalid result issues no XP, reward, injury, or retirement append.
- A valid authoritative result remains binding even if the client disconnects before presentation.
- Reconnection presents any admitted injury or retirement through the full corresponding narrative, never as a silent Vault change.
- Partial offline traces are quarantined rather than guessed.
- Unsupported rules versions remain replayable but cannot generate new results.
- Missing optional assets degrade to shared low-detail bodies, arenas, and effects without changing collision or result truth.
- A memorial card can never be projected as active because of stale cache or older Vault state.
- Ownership and settlement conflicts fail closed without erasing local evidence.

## Test strategy

Implementation follows test-first development.

### Kernel determinism

- identical setup and input trace produce identical snapshots, state digests, match result, life events, and replay;
- browser and server implementations agree across supported engines;
- input reorder, omission, duplication, overflow, invalid sequence, and unsupported rules version fail deterministically;
- rollback reconciliation converges under latency, jitter, loss, and reconnection;
- cosmetic frame rate cannot change competitive results.

### Combat

- movement, collision, jump, recovery, Break, Vitality, attacks, guard, Focus, abilities, swap, flee, items, hazards, and victory conditions obey declared rules;
- matchup properties create meaningful advantages without hidden hard locks;
- NPCs use only legal state and inputs;
- bosses follow declared modules and transitions;
- a creature above zero can flee or swap without retirement;
- zero Vitality creates exactly one proposed retirement.

### Lifecycle

- XP events are idempotent and never erased by injury;
- condition, recovery, resource spending, scars, traits, relationships, and evolution derive from admitted events;
- retirement is irreversible and disables every active gameplay path;
- memorial cards preserve proof, ownership, full history, lineage, and replay;
- surviving teams honor sacrifices without generating exploitable death rewards;
- no death or burial flow contains purchase pressure.

### Offline and sync

- complete offline matches atomically update cards and Vault;
- app interruption cannot commit half a life event;
- pending receipts recompute and admit on reconnect;
- compatible branches merge; injury and spending cannot disappear; retirement dominates stale living branches;
- ownership, stake, and settlement conflicts fail closed;
- offline-disabled modes remain unavailable without claiming global authority.

### Progression

- campaign checkpoints resume without replaying completed rewards;
- creature retirement does not erase player progress;
- difficulty combines known mechanics and always exposes a legal winning path;
- practice teaches advanced mechanics without mortal consequence;
- ranking, seasons, series, and tournaments use admitted results only.

### Browser, visual, and performance QA

- instant mobile entry, complete match, NPC fallback, live PvP, disconnect/reconnect, boss, checkpoint, recovery, offline run, sync, death, burial, and memorial paths;
- active desktop and supported mobile viewports;
- existing Wildz world, controls, HUD, deck, buttons, style, and safe areas remain coherent;
- nonblank canvas, no relevant console errors, no hydration failure, no leaked audio or simulation workers;
- measured transfer, memory, frame-time, battery, thermal, network, and cache budgets;
- degraded quality mode preserves input, collision, telegraphs, and result truth.

## Release gates

The first flagship is complete only when:

- the shared module, simulation, creature, lifecycle, artifact, and synchronization contracts are implemented and versioned;
- real-time 3D combat is playable end to end on representative mobile devices;
- live PvP prefers real opponents and NPC fallback is immediate;
- one-to-three-creature rosters support swap, flee, recovery, comeback, and mortal consequence;
- campaign checkpoints, increasing strategic difficulty, teaching, bosses, XP, items, evolution, and history are durable;
- offline gameplay updates card and Vault artifacts atomically and later synchronizes causally;
- zero Vitality creates one irreversible sealed retirement and a complete emotional ritual;
- memorial cards remain in the Vault, preserve history, and cannot enter active gameplay;
- no paid advantage or death-adjacent purchase pressure exists;
- the accepted Wildz visual language remains intact;
- audio, build, typecheck, lint, automated tests, browser playtests, mobile performance, offline replay, synchronization, and visual verification pass;
- future anthology modules remain independently loadable rather than bloating the flagship bundle;
- any remaining scalability, browser, networking, content, or balance gaps are reported rather than described as complete.
