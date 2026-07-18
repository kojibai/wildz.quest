# Wildz Kai Causal Saga Design

**Date:** 2026-07-18  
**Status:** Approved design, awaiting written-spec review  
**Scope:** Replace the placeholder mission/reward loop with a deterministic, shared, ever-evolving story and progression system derived from canonical Kai-Klok geometry.

## Product intent

Wildz remains the open living world it is today. Players may explore, collect, train, trade, battle, socialize, join raids, or follow their own interests at any time. Alongside that freedom, the world always provides a clear authored progression spine: a current story chapter, a directed next destination, meaningful missions, named NPCs, trainer battles, achievements, levels, events, and tournaments.

Everyone plays inside the same live story moment. The world does not wait for players to finish a chapter and does not rewind for late arrivals. Each Kai day advances regardless of success, partial success, failure, or inactivity. What players and communities do becomes permanent cause for what happens next.

The existing merchant placeholder language is removed. `Brandable reward card`, `brandable merchant reward card`, and equivalent generic merchant-copy rewards become game-native rewards whose names and effects come from the active mission and achievement definitions.

## Non-negotiable laws

1. The canonical Kai-Klok moment is the baseline story authority.
2. Verified prior events are the causal history; they may not be rewritten or silently discarded.
3. The next projected state is a pure function of the canonical moment, authored framework version, and admitted causal history.
4. A daily chapter resolves at its Kai boundary whether or not its objectives were completed.
5. Success, partial success, failure, and no participation are all valid recorded outcomes with distinct consequences.
6. Personal progression and world progression are separate, connected projections.
7. Free play remains available and contributes to progression where its recorded verbs satisfy authored objectives.
8. Late players join the current live chapter. Echo missions may teach prior events and award personal progression, but they never alter settled history.
9. Earned achievements, levels, memories, and rewards are monotonic and deduplicated by deterministic identity.
10. Clients never invent a canonical story outcome when world authority is unavailable.

## Kai-Klok narrative hierarchy

The authored framework interprets geometry already exposed by `KaiKlokMoment`; it does not introduce an unrelated campaign calendar.

| Kai dimension | Narrative responsibility |
| --- | --- |
| Year | Long world saga and inherited world thesis |
| Month / month name | Seven-week season, regional conflict, factions, and regional championship |
| Week / week name | Six-day character or location arc and weekly championship |
| Weekday | The daily chapter identity |
| Chakra / gate / hue / sides | Emotional theme, element, featured region, encounter topology, objective and achievement family |
| Ark | Current daily act and available activity set |
| Beat | Shared mission transition, NPC movement, dialogue turn, or tournament round |
| Step | Deterministic local encounters, roaming trainers, creatures, and resources |
| Pulse | Immediate synchronized signals, transitions, and presentation changes |

### Daily act grammar

Every Kai day contains one complete chapter expressed through six Arks:

1. **Ignite:** reveal the changed world, central conflict, featured NPC, first destination, and stakes.
2. **Integrate:** open the primary mission chain, location objectives, training, discovery, and NPC encounters.
3. **Harmonize:** emphasize community, cooperative, ecology, settlement, team, or raid contributions.
4. **Reflekt:** intensify roaming rivals, trainer battles, countermissions, and consequences from earlier acts.
5. **Purify:** run the daily tournament, boss confrontation, or decisive world event.
6. **Dream:** settle success level, record permanent memory and environmental changes, distribute admitted rewards, and foreshadow the next chapter.

The geometry supplies the baseline. Causal history determines how that baseline is expressed. For example, a Heart/Air-Gate day always retains its canonical theme, but yesterday's failed rescue may cause its primary route to begin damaged, relocate a trusted NPC, strengthen a rival team, and expose a recovery achievement.

## Nested progression

### World progression

- **Daily:** a complete live chapter, community objective, location changes, roaming trainers, decisive event, and automatic resolution.
- **Weekly:** six daily outcomes form one character or regional arc and determine the weekly championship state.
- **Monthly:** seven weekly arcs form a season with faction movement, evolving regions, legacy achievements, and a regional tournament.
- **Yearly:** eight monthly seasons form a world saga whose accumulated history determines the convergence, lasting landmarks, champions, and inherited next-year conditions.

The narrative never resets. Bounded competitive standings may start a new season, but champions, defeats, discoveries, memorials, relationships, and environmental aftermath remain historical truth.

### Player progression

Each player has permanent, independently projected tracks:

- trainer level and title;
- regional reputation;
- companion mastery and techniques;
- story contribution and chapter participation;
- rival and NPC relationships;
- tournament qualification and rank;
- discoveries and field-guide completion;
- daily, weekly, monthly, yearly, and lifetime achievements.

The directed path never invalidates free play. Recorded travel, battle, capture, training, mission, lineage, ascension, ecology, raid, social, crafting, and tournament verbs can satisfy story or achievement criteria when the authored definition accepts them.

## Causal model

The active projection is conceptually:

```text
active story = project(
  canonical Kai moment,
  authored framework version,
  admitted world-event history,
  settled chapter outcomes
)

player story = project(
  active story,
  verified player-event history,
  permanent player unlocks
)
```

Every consequential event declares its causes and deterministic identity. Examples include mission acceptance, objective contribution, NPC encounter, trainer result, qualification, tournament result, chapter settlement, achievement grant, reward grant, NPC relocation, and environmental aftermath.

Chapter settlement records:

- the exact Kai day and story definition;
- objective totals and contribution basis;
- outcome band: success, partial success, failure, or unopposed;
- decisive causes and referenced event identifiers;
- world changes produced;
- NPC and rival changes produced;
- achievements and rewards made eligible;
- hooks passed into the next day, week, month, and year.

Settlement is idempotent. The same canonical causes produce the same settlement identifier and projection. Later events append; they never modify the settled record.

## Authored story framework

Content is authored as reusable, typed narrative grammar rather than an endless hard-coded date list or unconstrained generated text.

The framework contains:

- sagas, seasons, weekly arcs, and daily chapter templates;
- named characters, rivals, factions, voices, motives, relationship transitions, and team growth rules;
- regions, landmarks, route graphs, gates, and environmental states;
- conflicts, objectives, mission nodes, branches, and consequence tables;
- trainer archetypes, team composition rules, tactics, and rematch evolution;
- achievement families, requirements, titles, cosmetics, lore, techniques, sigils, and artifact definitions;
- tournament formats, qualification rules, round schedules, and NPC backfill rules;
- recap and Echo mission definitions;
- presentation text selected from deterministic authored variants.

Definitions are versioned. A daily story instance pins the exact definition version so later content improvements do not rewrite history.

## Mission graph

Each daily chapter projects a directed acyclic mission graph with:

- one primary golden path;
- explicit ordered objectives and map destinations;
- optional branches for exploration, ecology, social play, raids, training, and collection;
- prerequisite rules derived from the current story and player state;
- accepted gameplay verbs for each objective;
- contribution and completion rules;
- start and end Kai boundaries;
- success, partial, failure, and expiry consequences;
- game-native rewards and achievement hooks.

The UI always identifies one recommended next action without preventing alternate actions. Optional branches can affect outcome strength, relationships, tournament seeding, or future hooks without blocking the daily resolution.

## Living trainers and NPCs

### Named characters

Named story NPCs persist across days and remember admitted encounters. Trust, rivalry, injuries, relocation, team composition, dialogue, and availability evolve from causal history.

### Seeded trainers

The trainer population is deterministic for a given world projection. A seed basis includes the pinned story instance, Kai coordinate, location, encounter slot, and relevant historical modifiers. It does not use client-local randomness.

Trainer categories include:

- teaching trainers for new players;
- route scouts and roaming challengers;
- location specialists;
- recurring rivals;
- veterans and champions;
- story bosses and tournament entrants.

Difficulty uses authored tier bounds, player trainer band, location, current geometry, and prior results. Scaling must preserve meaningful progression: opponents may select an appropriate roster within a bounded band, but they do not mirror the player exactly or erase the value of leveling.

Existing tiered arena NPC behavior is reused and extended rather than replaced.

### Live players and population guarantees

Real connected players remain visible through the existing shared-world and multiplayer systems. NPC trainers guarantee that routes, battles, and brackets remain playable when population is sparse. NPCs are visually and semantically identified; they never impersonate live users.

## Tournament director

Daily Purify tournaments are always capable of resolving. Weekly, monthly, and yearly championships aggregate the appropriate settled results.

The director owns:

- qualification achievements and entry windows;
- bracket identity and deterministic seeding;
- live-player entrants;
- seeded NPC backfill;
- Kai-aligned round deadlines;
- admitted battle results;
- forfeits and automatic NPC resolution;
- placement, titles, sigils, reputation, and story consequences;
- settlement even when no live player qualifies.

The same entrant cannot occupy multiple bracket identities. Replayed results are deduplicated. A bracket never waits past its canonical deadline.

## Achievement engine

Achievements are authored causal milestones, not generic marketing counters.

Scopes include:

- **Daily feats:** immediate chapter, discovery, battle, social, and tournament accomplishments.
- **Weekly paths:** recurring rival arcs, multi-day protection, and weekly championship milestones.
- **Monthly legacies:** regional mastery, faction consequences, complete seasonal paths, and regional placement.
- **Yearly legends:** saga-changing contributions, convergence results, and world championship placement.
- **Lifetime identity:** permanent trainer, companion, exploration, social, and historical milestones.

Each grant has a deterministic identifier derived from player, definition, scope instance, and qualifying causes. Progress is projected from recorded events. Grants are append-only and idempotent.

Rewards are game-native and bounded: titles, companion techniques, cosmetics, lore memories, trail effects, tournament sigils, access, reputation, or verified artifacts. Generic `Brandable reward card`, merchant coupon, and customizable business-use copy are removed from the gameplay mission path.

## Late arrival and return continuity

A returning or new player receives:

1. a concise story-so-far projection from settled memories;
2. a causal explanation of the current world state;
3. the current live chapter and remaining Kai time;
4. the recommended next objective appropriate to their progression;
5. optional Echo missions for essential prior knowledge or personal unlock prerequisites.

Echo missions replay authored learning and challenges, not canonical world mutation. They can grant explicitly defined personal rewards and achievements, but cannot change old community totals, tournament results, NPC history, or environmental settlement.

## System boundaries

The implementation is divided into independently testable modules:

### Kai Story Director

Consumes a canonical `KaiKlokMoment`, pinned framework version, and settled history. Produces the active saga, season, weekly arc, daily chapter, Ark act, consequences, and next transition.

### Causal World Ledger

Extends the existing append-only world event model with story, mission, trainer, tournament, achievement, and settlement event kinds. It validates causal references, deterministic identifiers, ordering, and replay.

### Mission Graph

Projects available objectives and evaluates recorded gameplay verbs against pinned definitions. It does not directly mutate rewards or progression.

### Achievement Engine

Projects progress and emits deterministic grant candidates from verified events. Admission remains at the existing command/world authority boundary.

### Trainer Population

Projects NPC placement, identity, tier, roster, and evolution. Battle simulation remains owned by the arena systems.

### Tournament Director

Projects qualification, entrants, brackets, deadlines, results, and settlement candidates. It consumes admitted arena results rather than duplicating combat logic.

### Story Projection UI

Displays story and progression projections. It never becomes proof authority and never claims pending outcomes are settled.

## UI experience

The existing world remains visually and spatially intact. The current mission surface becomes a living saga panel containing:

- current Kai day chapter and Ark;
- time remaining in the current act and day;
- story stakes and world condition;
- one directed next objective with destination;
- optional nearby missions and roaming challengers;
- player trainer level and achievement progress;
- community objective and projected consequence band;
- tournament qualification and bracket status;
- story-so-far and a readable cause-and-effect trail.

Map and HUD projections identify story NPCs, seeded trainers, live players, missions, and tournament sites distinctly. The command center exposes deeper history without crowding the exploration HUD.

All placeholder merchant reward copy in the mission path is replaced. The initial chapter uses a specific authored reward so no generic fallback is visible during migration.

### Card-back birth-pulse interpretation

Living card backs use the same canonical Kai teachings as the saga. The Birth Pulse section must interpret the companion's recorded birth moment rather than repeat calendar labels. Its prose and geometry rows explain what the corresponding harmonic day/chakra, eternal month, week, and Ark mean through their canonical color, element, mathematics, geometry, and teaching.

The visible passage must not use the harmonic day, month, week, or Ark names as a substitute for meaning. Names may remain inside the exact proof coordinate or an expandable proof record, but the player-facing Birth Pulse story speaks in meanings such as grounded Root stability, compassionate Heart coherence, coherent-light completion, or purification through twelve-rayed crown geometry.

The Caduceus KAI identity is displayed with the established `☤ KAI` symbol. UI labels must not spell or misspell `Caduceus KAI`, including the current `Cadueus KAI` card-back label. The underlying canonical coordinate remains unchanged.

## Authority, offline behavior, and failures

- World/admitted Kai time determines canonical transitions and deadlines.
- When authority is unavailable, the client displays the last verified projection and marks future state as pending.
- Local time may animate presentation but cannot settle chapters, move canonical NPCs, grant achievements, or advance brackets.
- Invalid definitions, unknown versions, missing causes, divergent same-ID events, and impossible transitions fail closed.
- Duplicate commands and replayed events converge on the same result.
- Pending personal actions may be queued under existing offline rules but are not presented as admitted world consequences.
- A content-definition failure falls back to the last valid pinned story projection, not fabricated narrative.

## Migration and first playable content

The implementation keeps existing exploration, cards, battles, ecology, raids, teams, market, world sites, and Kai visual expression. It connects them to the new causal story interfaces.

The first complete content slice includes:

- one full six-day weekly arc spanning the existing regions;
- six complete daily chapters, each with all six Ark projections;
- the existing Sola Reed, Mira Vale, and Oren Moss characters expanded into persistent story roles;
- at least one recurring rival and one named champion;
- deterministic route trainers at existing landmarks;
- daily Purify tournaments and one weekly championship;
- daily, weekly, and lifetime achievement examples;
- success, partial, failure, and unopposed consequences;
- late-arrival recap and Echo mission examples;
- game-native mission rewards replacing merchant placeholders.

The engine also projects the containing month and year identifiers and inherited hooks, while additional authored monthly and yearly content can be added through the same versioned framework without engine changes.

## Verification strategy

### Unit tests

- identical Kai moment, framework version, and history produce identical story projections;
- each geometry dimension selects the intended authored axis;
- all six Arks expose the correct activity classes and boundaries;
- settlement produces all four outcome bands deterministically;
- causal replay is stable and divergent same-ID events fail;
- trainer placement, tiers, rosters, and rematches are deterministic;
- mission graph prerequisites and accepted verbs are correct;
- achievement grants are monotonic and deduplicated;
- Echo missions cannot mutate settled world history;
- tournament brackets resolve with zero, sparse, or full live-player populations;
- generic merchant reward language is absent from the gameplay mission path.

### Integration tests

- existing gameplay verbs contribute to eligible live objectives;
- world command admission and recovery preserve story events;
- daily settlement affects the following day projection;
- weekly aggregation reflects six settled daily chapters;
- live players and seeded NPCs coexist without identity ambiguity;
- arena results feed tournament settlement once;
- offline recovery converges without premature grants;
- return continuity explains current state from prior memories.
- card Birth Pulse copy is a deterministic interpretation of canonical Kai teachings and does not merely list harmonic calendar names;
- the card back uses the `☤ KAI` symbol while preserving the exact coordinate value.

### Experience verification

- typecheck and production build;
- desktop and mobile browser playthrough;
- no console or page errors;
- readable current story, next objective, destination, achievement, and tournament state;
- successful free exploration while a directed mission is active;
- visible transition across an Ark boundary using controlled world time fixtures;
- active battle against a seeded trainer;
- complete tournament path with NPC backfill;
- story recap and causal history for a returning player fixture.

## Delivery phases

1. Define story, event, mission, achievement, trainer, and tournament contracts with deterministic projection tests.
2. Extend world authority, commands, replay, persistence, and settlement.
3. Integrate gameplay verbs, arena results, existing NPC controller, and trainer population.
4. Implement tournament qualification, brackets, deadlines, and NPC backfill.
5. Author the first six-day arc and its consequence matrix.
6. Replace mission/reward UI with the living saga, achievement, navigation, recap, and tournament projections.
7. Verify authority failures, offline recovery, desktop/mobile behavior, and the full daily-to-weekly loop.

## Success criteria

The work is successful when two clients at the same admitted Kai moment and world head see the same active story, NPC population, missions, tournament, and settled history; when player actions create admitted consequences that deterministically affect later chapters; when every day resolves and advances without waiting; when a solo player always has meaningful NPC competition; when returning players can understand why the world changed; when gameplay presents real achievements and rewards without the former brandable merchant placeholder; and when every card back explains the meaning of its birth geometry while using the `☤ KAI` symbol instead of spelling out Caduceus KAI.
