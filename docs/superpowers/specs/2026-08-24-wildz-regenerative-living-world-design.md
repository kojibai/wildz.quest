# Wildz Regenerative Living World Design

Date: 2026-08-24

Status: Approved architecture; implementation planning follows separately

## Purpose

Wildz is a persistent sovereign world in which players, creatures, ecology, materials, structures, discoveries, authored experiences, and Phi participate in one truthful causal system. A player may become a builder, explorer, farmer, miner, steward, guide, healer, engineer, artist, merchant, scientist, sanctuary keeper, experience creator, or a profession the developers never named in advance.

The world must feel open rather than permissive-by-menu. Players see possibilities in the land, imagine an outcome, and realize it through lawful cooperation with sovereign creatures and other players. Their actions leave durable consequences. Regenerative contribution creates bounded prosperity; extraction, damage, neglect, and waste create real costs and restoration obligations.

The first production slice is the **Regenerative Grove**, built on a universal living-world transaction kernel reusable by every later biome, profession, structure, and authored experience.

## Foundational laws

1. The source proof object is authority. A projection, database row, API response, MCP response, render mesh, cache, index, or server receipt is a replaceable representation and cannot outrank it.
2. A Receiz ID is the person's edge authority and wallet. Global services distribute and coordinate admitted additions; they do not grant the identity authority it already carries.
3. Every economically or physically meaningful change is append-only, deterministic, attributable, and idempotent.
4. A command that cannot advance every required participant atomically writes nothing.
5. Players steward what they create; they do not permanently own raw wilderness merely by reaching it.
6. Creatures are sovereign embodied beings, not inventory-shaped productivity multipliers.
7. Natural law protects the world without making it feel fenced. Consequences arise from understandable physical, ecological, relational, and economic causes.
8. Composition is open-ended; execution is bounded by declared capabilities, available matter, participant consent, exact heads, safety, ecology, and emission law.
9. Passive offline absence never kills, punishes, or erases a creature, person, structure, or world contribution.
10. Gameplay remains local and immediate. Synchronization never enters the movement, camera, animation, weather-rendering, or collision hot path.

## Architecture choice: one universal living-world kernel

Wildz will not create unrelated authority rails for harvesting, construction, excavation, ecology, creature labor, experiences, and Phi rewards. Every meaningful action uses one operation model and category-specific deterministic laws.

An operation binds the exact participating proof objects:

- player Receiz ID and current head;
- participating creatures and relationship/work heads;
- region and affected world-feature heads;
- material sources, tools, inventories, and created-feature heads;
- a bounded work mandate;
- the applicable World Emission budget and policy digest;
- the exact Kai moment/root;
- an idempotency identity and expiry.

The lifecycle is:

`observe -> compose -> preview -> participant consent -> stage -> execute -> admit -> project`

Preview is always zero-write. It shows the intended physical result, material requirements, creature and player cooperation, ecological effect, safety conditions, likely time, weather exposure, and possible Phi consequence. It never reserves matter, changes custody, moves a creature, alters the world, or promises an emission.

Execution rechecks exact participant heads and deterministic law. It consumes or transforms materials, advances work and relationship state, changes the world, records consequences, and moves bounded Phi capacity in one atomic Receiz operation. A stale head, revoked mandate, lost consent, changed environment, unavailable material, unsafe geometry, or exhausted emission envelope causes a clean zero-write failure.

The shared world projects only admitted heads. Sparse indexes and warmed caches make those heads discoverable and fast, but deleting every projection must not destroy authority or prevent reconstruction.

## World operation model

A universal operation has six semantic parts:

1. **Intention** — the desired outcome and exact area of effect.
2. **Participants** — people, creatures, tools, materials, features, and policies whose heads may advance.
3. **Plan** — deterministic stages and their capability, matter, safety, and consent requirements.
4. **Consequences** — physical, ecological, relational, stewardship, discovery, and economic deltas.
5. **Admission** — the atomic proof transition or proof of zero writes.
6. **Projection** — the immediately visible world derived from the admitted result.

Category laws specialize the same kernel for harvesting, transformation, transport, construction, excavation, repair, ecological restoration, creature care, discovery, access, authored play, settlement, transfer, and governance. New professions compose existing lawful verbs before introducing a new authority primitive.

## Regenerative Phi economy

### World Emission proof object

Lawful productive work may issue new Phi from a bounded **World Emission** proof object. This is not an unlimited reward function and not permission requested from a server. The source object carries the issuance authority and exact law.

It includes:

- policy version and digest;
- Kai epoch;
- global epoch ceiling and remaining capacity;
- nested region/biome budgets;
- nested contribution-class budgets;
- already-consumed operation identities;
- restoration-debt and reserve rules;
- parent and successor heads.

An admitted issuance atomically reduces the applicable emission capacity and credits the player's Receiz ID. Receiz coordinates and validates the exact multi-participant transition; the proof-carried emission law remains its authority.

### Contribution accounting

An action's emission basis is deterministic and inspectable:

`net contribution = useful output + ecological renewal + public benefit + cooperation + durability - extraction - damage - waste - unresolved restoration debt`

No single scalar is inferred from engagement, time spent, clicks, rarity theater, or a server's opinion. The contribution vector records exact measurable consequences.

Positive examples include pollination, habitat expansion, watershed repair, erosion prevention, feeding living beings, rescue, public infrastructure, durable teaching, cooperative construction, and repairing another person's useful creation. Negative terms include depleted matter, habitat fragmentation, unsafe excavation, avoidable breakage, abandoned waste, coercive creature work, and unresolved damage.

Useful production may be valuable without earning new emission. A player can still sell, exchange, or use what they produced. Newly issued Phi is reserved for net-regenerative contribution inside remaining lawful envelopes.

### Bounded issuance and anti-exploitation

- Emission is capped globally per Kai epoch, then by region/biome and contribution class.
- Repeating the same action against the same causal state cannot issue twice.
- Repetition with falling marginal benefit produces falling or zero emission.
- A player cannot manufacture public benefit by creating and repairing their own artificial damage.
- Related operations are evaluated as a causal sequence so splitting one action cannot multiply rewards.
- Cooperation reward depends on distinct necessary contributions, not extra identities attached to a receipt.
- Restoration debt may defer or reduce emission until the harmed system is actually restored.
- Every issued amount shows its source, calculation policy, participating work, and admitted operation.

### The bee pattern

The canonical economy loop resembles a bee: gather pollen, transfer it through living work, sow more flowers through movement, produce nectar and honey, and nourish other beings. The valuable result is not extraction alone; it is the larger living relationship produced by the full cycle.

The Regenerative Grove implements this pattern first so the economic law is proven through visible gameplay before being generalized to mountains, oceans, settlements, and authored experiences.

## Shared land and stewardship

Raw wilderness is not permanently claimable. Players may discover, care for, cultivate, traverse, and lawfully transform it, but arrival does not create dominion.

Players may steward admitted creations and bounded spaces such as homes, workshops, gardens, bridges, tunnels, farms, sanctuaries, trails, machines, or experiences. Stewardship carries obligations:

- maintain structural and ecological safety;
- honor declared public, private, invited, or cooperative access;
- repair or lawfully dismantle harmful abandoned work;
- preserve contributor and maker provenance;
- carry restoration debt when construction consumes more than it renews;
- transfer stewardship without rewriting creation history.

Protected ecological zones, sacred places, critical routes, rare habitats, and public necessities cannot be privately enclosed or destructively overwritten. Shared settlements use explicit contributor roles and bounded governance rather than a single opaque owner flag.

Structures age through material, use, weather, maintenance, and environment. Neglect may produce wear, overgrowth, closure, or ruins; it does not make history disappear. Ruins remain truthful features with provenance, bounded salvage, and possible restoration.

## Sovereign creatures and relationships

Each creature is a continuous living subject with immutable identity and append-only lived history. Its current projection includes:

- physical condition, energy, nourishment, injury, and recovery;
- trust, affection, familiarity, safety, and bond with particular people;
- preferences, fears, temperament, memory, habitat comfort, and social relations;
- innate abilities available from the beginning at their safe base expression;
- developed endurance, control, range, efficiency, specialization, and mastery;
- current commitments, work mandates, consent, fatigue, refusal, and rest needs;
- custody/stewardship transitions and awareness of relationship change.

No signature capability is artificially withheld at level one. Progression makes flight, swimming, climbing, burrowing, tracking, harvesting, shaping, and other real abilities stronger, longer, safer, more precise, and more versatile.

### Work and cooperation

The player proposes a bounded mandate, not an unlimited command. It declares the exact task, place, permitted actions, available resources, safety policy, duration/expiry, rest conditions, and revocation path. A creature evaluates willingness and capability from its own current state and relationship.

Creatures may accept, request help, choose a role, pause, refuse, protect another participant, or stop when exhausted or endangered. Multiple creatures can form real work teams: a burrower opens ground, a surveyor detects instability, a stabilizer reinforces it, a hauler moves spoil, and an illuminator makes the route usable. Other players may contribute complementary skills, materials, care, or stewardship.

Care, compatible work, shared success, rescue, rest, and truthful handling deepen relationship. Coercion, overwork, abandonment in present danger, incompatible custody, and repeated disregard erode it. A creature transferred to another person retains its memory and recognizes the change; custody does not reset personality or manufacture trust.

### Leaving and mortality

Passive offline time alone never produces deterioration, departure, or death. A neglected relationship can cool only through admitted context and remains recoverable. A creature may leave after persistent active mistreatment or violated consent, with legible warnings and opportunities for repair.

Permanent death is limited to explicit active mortal-risk contexts or severe admitted abuse/abandonment in present danger after unmistakable warning. Ordinary exploration, work, absence, connectivity loss, transfer, or failure cannot silently kill a creature.

## Materials, transformation, and collectibles

The world contains more than creatures. Discoverable proof-object families include:

- living: seeds, spores, pollen, cultures, eggs where lawful, medicines, symbiotic organisms;
- material: timber, fibers, stone, clay, ores, crystals, sand, salts, shell, and recovered matter;
- nourishment: fruit, herbs, nectar, honey, fungi, crops, prepared foods, and creature feed;
- historical: tools, inscriptions, ruins, maker fragments, prior-world evidence, and relics;
- scientific: samples, weather records, maps, ecological observations, and rare phenomena;
- spiritual/cultural: lawful ritual objects, memory marks, songs, patterns, and place-bound artifacts;
- knowledge: techniques, routes, recipes, blueprints, ecological relationships, and local forecasts;
- crafted: components, tools, structures, art, machines, habitats, instruments, and experience pieces.

Every meaningful object has exact origin, custody, capacity or condition, transformation history, contributors, Kai context, and current head. Materials are conserved across extraction, transformation, construction, use, repair, salvage, transfer, and decay. Visual pickups and inventory rows never create custody.

Rare discoveries emerge from a truthful convergence:

`place + ecology + Kai moment + season/weather + world history + player action + creature relationship`

They are not rerolled duplicates from a hidden loot table. Returning to the same admitted cause restores the same discovery state. A singular object remains singular across devices, transfers, caches, markets, vaults, and world projection.

## The first playable slice: Regenerative Grove

The Grove must prove the universal kernel through a complete, enjoyable loop:

1. Observe soil, moisture, plant maturity, pollinator activity, weather, and creature interest through visible and audible world behavior.
2. Gather bounded seeds, pollen, fallen material, fruit, or herbs without erasing the habitat.
3. Cooperate with creatures whose base abilities are already usable: pollinate, dig, carry, water, prune, sense, protect, compost, cultivate, and build.
4. Transform inputs into nectar, honey, food, medicine, fibers, tools, habitat pieces, or other lawful outputs.
5. Sow, restore, and expand habitat so future players and creatures encounter a richer grove.
6. Build small persistent features such as hives, irrigation, paths, nurseries, shelters, storage, bridges, signs, and observation areas.
7. Admit the complete causal operation and issue bounded Phi only when the net contribution qualifies.
8. Let other players discover, use, maintain, improve, learn from, or build experiences around the result.

The grove changes visibly over Kai days and seasons. Flowers open and seed, pollinators migrate, water moves, soil recovers or depletes, structures weather, creatures remember participation, and prior player work becomes part of future opportunity.

## Persistent construction and excavation

Construction has three distinct layers:

1. **Intention:** a translucent, collision-aware preview of the complete desired form.
2. **Work:** visible staged progress performed by people and consenting creatures using exact materials, tools, and capabilities.
3. **Admission:** the finished or partially finished physical state becomes shared world truth.

Players can build real-space foundations, homes, farms, workshops, bridges, paths, habitats, machines, settlements, arenas, puzzles, waterways, defenses, sanctuaries, and public infrastructure. Every result has geometry, collision, entrances, interiors, clearance, stability, utilities, access, condition, provenance, and stewardship.

Excavation creates real entrances, traversable tunnels, rooms, shafts, caves, submerged routes, and mountain interiors. Soil, stone, water pressure, ventilation, drainage, stability, protected features, nearby construction, safe exits, and creature capabilities bound each segment. A tunnel is never a teleport or temporary visual effect.

The player may preview the outcome, but scale determines necessary cooperation. A small garden bed may need one person and a digging companion. A mountain passage may need surveyors, rock borers, stabilizers, haulers, water control, rescue capability, several players, and many admitted work stages. This cooperation is the gameplay, not a waiting timer.

Damage, collapse, repair, dismantling, salvage, and rebuilding are admitted physical transitions. Private and protected work cannot be griefed. Destructible public play requires explicit policy. Unsafe or ecologically harmful work remains visibly constrained by its actual causes rather than an unexplained invisible wall.

Development order after the kernel is:

1. Regenerative Grove
2. Mountain and underground works
3. Living homesteads and workshops
4. Shared settlements
5. Player-authored experiences at full scale

## Player-authored experiences

Players compose experiences from real world features: terrain, weather, buildings, tunnels, waterways, farms, arenas, trails, puzzles, machines, discoveries, artifacts, and creatures. Entering an experience means traveling to its actual admitted place or accepting an authorized invitation, not loading a detached counterfeit world.

Authors can declare objectives, teams, checkpoints, allowed tools, creature requirements, time windows, access, risks, rewards, reset behavior, and win states through a bounded declarative grammar. Arbitrary executable code is not admitted into world authority.

The governing principle is **unbounded composition, bounded execution**. An experience cannot counterfeit Phi, duplicate matter, seize creatures, erase geography, exceed its declared area, or promise rewards it has not lawfully committed.

Access may be open, invited, cooperative, discovery-gated, contribution-based, fixed-price, suggested-contribution, membership, or seasonal. Reward provenance is always visible:

- creator-funded Phi, cards, materials, or artifacts committed before play;
- bounded World Emission for genuine restoration, discovery, education, cooperation, or public benefit;
- lawful outputs produced by the experience itself.

Those sources never blur. The experience remains affected by real weather, ecology, visitors, maintenance, and time. An untended maze can overgrow; a restored sanctuary can attract new life; a heavily traveled trail can become a road; a harmful attraction can accrue restoration debt.

Creators build reputation from truthful consequences: durable usefulness, meaningful enjoyment, repeat visitation without manipulation, ecological improvement, cooperation, education, and honest delivery of promised outcomes. This supports open-ended professions without predefining what every player must become.

## Kai Klok calendar and living climate

The canonical Wildz year is 336 Kai days across eight 42-day months:

- Months 1-2: spring
- Months 3-4: summer
- Months 5-6: autumn
- Months 7-8: winter
- Month 1, Day 1: first day of spring
- Month 8, Day 42: final day of winter

The real Kai Klok moment from the canonical Klok authority—not device wall time—is the calendar authority. Day fraction drives daylight and intraday progression. The exact climate projection is:

`Kai moment + season + region + latitude/character + elevation + biome + water + recent admitted ecology = local weather`

Different regions have different simultaneous weather. A mountain can receive snow while a valley receives rain and a warm coast experiences high wind and changing tides. Seasonal tendencies never flatten biome identity: winter in a rainforest, desert, summit, coast, and cavern expresses differently.

Weather systems move continuously and deterministically across regions. Rain, snow, fog, heat, drought, wind, lightning, storms, tides, currents, visibility, and rare celestial conditions affect actual play:

- plant growth, flowering, pollination, harvest, fire, and soil;
- flight lift/control, swimming currents, navigation, and creature migration;
- tunnel flooding, erosion, snowpack, structure wear, and material choice;
- tracks, scents, visibility, rare habitats, and discovery conditions;
- authored experiences and public work.

Players at the same admitted place and Kai moment receive the same weather. Refreshing or switching devices cannot reroll it. A forecast exposes only what can lawfully be inferred from current conditions, instruments, creature senses, local knowledge, and available observations.

## Natural guidance and legibility

Wildz never breaks the fifth wall with conventional onboarding. The world teaches through behavior:

- wind, clouds, water, lighting, tracks, sound, growth, damage, and creature reactions reveal conditions;
- creatures notice opportunities, danger, fatigue, incompatibility, and needed help through natural action;
- contextual tools reveal deeper information only when used;
- previews explain required cooperation and consequences without turning play into a form;
- blocked actions identify their physical or relational cause in-world;
- capability development improves expression rather than withholding the fantasy at level one;
- ordinary accessible routes coexist with advanced branches.

Controls and information remain progressive, tactile, and mobile-first. Only relevant actions occupy the immediate HUD. Every device size shrinks and reflows without truncation, overlap, browser zoom, text-selection controls, or accidental native gestures.

## Persistence, synchronization, and performance

Every admitted action is an immutable world event. Current world state is a fast projection over those events, checkpointed by content-addressed heads.

The frame-critical path may read prepared local projections only. It performs no network request, proof verification, history scan, wallet reduction, resource generation, worker creation, subscription setup, or distant remeshing.

Required behavior:

- movement, camera, animation, creature behavior, collision, and visible weather remain local and immediate;
- nearby world, structures, climate, and encounter state hydrate before entering view;
- world and map geometry are cached by immutable heads and appear without pop-in;
- refresh restores the last admitted position, discoveries, creatures, construction, relationships, climate, inventory, and jobs;
- repeated refreshes replace listeners, timers, workers, presence channels, and subscriptions instead of accumulating them;
- remote presence uses bounded interpolation separate from simulation;
- sync requests only additions beyond known heads;
- one admitted addition causes at most one bounded incremental reduction and cache invalidation;
- an ambiguous operation resolves by stable operation ID and is never blindly repeated.

Connectivity loss does not freeze exploration. New shared admissions may remain visibly staged until coordination returns, while already admitted local truth and ordinary movement continue. Reconciliation cannot teleport the player, duplicate work, reverse lawful progress, or replace stronger carried history with a weaker projection.

## Failure and recovery

Failure remains causal and recoverable:

- missing matter prevents the next stage but preserves completed admitted work;
- creature refusal or exhaustion changes the plan without corrupting prior progress;
- unsafe excavation exposes instability before collapse;
- weather damage advances exact feature condition rather than deleting geometry;
- revoked access or mandates stop future work without rewriting history;
- stale heads produce a re-preview against current truth;
- ambiguous execution resolves the original operation before another can begin;
- failed multi-participant settlement, emission, transfer, or construction writes nothing.

No fallback may fabricate a balance, card, material, creature decision, weather event, world change, or success receipt.

## Verification requirements

The first implementation plan must build automated contracts for the kernel and Regenerative Grove before expanding the feature surface.

### Determinism and authority

- Identical proof heads and Kai moment produce identical plans, climate, contribution vectors, and consequences across runtimes.
- Representations cannot admit an operation without the required source proof objects.
- Deleting projections and rebuilding from admitted proofs restores the same world head and visible state.
- Replaying an operation identity cannot duplicate matter, work, discovery, custody, or Phi.

### Economy

- World Emission cannot exceed global, region, or contribution-class budgets.
- Phi issuance advances the emission source and recipient atomically or writes nothing.
- Extraction-only and cyclic self-damage do not qualify as regenerative issuance.
- Cooperative attribution requires necessary distinct contributions.
- Restoration debt deterministically reduces or defers emission.

### Creatures

- A creature can accept, refuse, pause, and revoke work according to current state.
- Work cannot exceed mandate scope, material allocation, capability, safety, or consent.
- Transfer preserves identity, memory, relationships, condition, and history.
- Offline absence alone never damages or kills a creature.
- Base signature abilities function at level one and progress by quality, duration, range, control, and mastery.

### World and multiplayer

- Two players observing the same admitted region see the same changes.
- Competing operations against one capacity admit at most one valid successor.
- Construction and excavation preserve collision, entrances, safe exits, and protected features.
- Refresh, identity export/import, and device switching preserve exact continuity.
- Authored experiences cannot affect undeclared participants or geography.

### Climate

- Month 1 Day 1 resolves to spring and Month 8 Day 42 resolves to winter's final day.
- Season boundaries are exact and deterministic.
- Same region/moment/history produces identical weather; different regions may produce different weather.
- Weather consequences are applied once through admitted causal operations.

### Performance and release

- Ten thousand movement/render ticks produce zero network, verifier, wallet, history, job-reducer, world-generation, and subscription work.
- Repeated mount, refresh, identity restore, creature switch, and map open leave no duplicate workers, listeners, timers, channels, or caches.
- Opening the world map and approaching admitted construction show warmed geometry without visible regeneration.
- Mobile layouts and gestures remain usable across supported viewport and safe-area sizes.
- Long-running ecology and climate simulations remain deterministic, bounded, and incrementally projectable.

## Scope decomposition

This document defines the complete architecture. It does not authorize implementing every system in one undifferentiated release.

The first implementation plan covers:

1. Receiz 124.0.2 migration and capability inventory;
2. the universal operation schema and deterministic preview/admission contracts;
3. World Emission proof object and bounded settlement integration;
4. creature consent/work mandates needed by the Grove;
5. Grove resource, ecology, transformation, construction, and discovery loop;
6. Kai calendar seasons and Grove-local climate;
7. projection persistence, synchronization, performance guards, and release verification.

Mountain excavation, full homesteads, shared settlements, and general authored experiences follow as separate implementation plans on the same kernel. Their laws are specified here now so the first slice cannot choose shortcuts that make the full vision impossible later.

