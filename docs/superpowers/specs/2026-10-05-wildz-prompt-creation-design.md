# Wildz prompt creation and consequential world objects

Date: 2026-10-05

Status: Approved for implementation planning by the player's “execution” reply on 2026-10-05. Product implementation follows review of the written plans. This document adds no gameplay implementation.

## Intended outcome

Players shape the living world by speaking with their creatures. A discreet HUD icon opens a compact conversation. The player selects one or more creatures, allocates a maximum resource budget, describes a creation or change, sees it in place, and commits it. The creation becomes an actual persistent object or space that players and creatures can use, inhabit, modify, transfer, and trade. Further conversation edits the same creation and its history.

The requested creative range includes furniture, tools, forged weapons, gardens, houses, palaces, extensive inhabited places, caves, mountains, waterfalls, volcanoes, and galaxies containing places to explore. Useful creations can benefit other people and their makers. Destruction, depletion, repair, growth, and transfer have lasting consequences. Existing manual construction remains available and compatible.

The player explicitly requires immediate interaction and no added gameplay lag. The architecture must protect movement and rendering from generation, validation, persistence, and synchronization. Complete generation and global admission cannot truthfully be guaranteed to take zero time. Immediate feedback, fast local interaction, bounded work, progressive detail, and measured performance qualification are required; a loading animation alone does not meet this requirement.

## Existing foundations and gaps

These are findings from the repository, not claims of live service qualification:

| Area | Existing foundation | Required expansion |
| --- | --- | --- |
| Construction | `wilds-world-construction.ts`, `wilds-construction-component.ts`, and recipes describe physical pieces, interiors, collision, materials, work, and revision lineage. | Compose whole creations; support richer shapes, materials, behaviors, and aggregate revisions. |
| Building interface | `WildsContinuousBuilderPanel.tsx`, `use-wilds-continuous-builder.ts`, and `PlayCampaign.tsx` provide placement and adjustment. | Add the conversation surface and whole-creation placement without replacing the piece builder. |
| Conversation | `CreatureConsciousnessPanel.tsx` and `/api/receiz/creature-observer` support grounded conversation and streamed replies. | Add structured creation proposals. Existing conversational replies do not execute world changes. |
| Creatures | Capability identity, readiness, consent, mandates, crew journals, reservations, navigation, and source-command coordinators exist. | Connect selected creatures to actual creation work with qualified authority and observable results. Existing crew foundations are not proof that unrestricted autonomous construction is live. |
| Use | `wilds-construction-function.ts` resolves functional workbenches, storage, and beds; Steward tools have capability and durability. | Add composable interactions, equipment, gardens, damage, and environmental effects. |
| Persistence | World commands, immutable sources, outbox, checkpoints, owned additions, and Vault restoration exist. | Retain creation definitions, state, custody, spaces, and all meaningful successor events. |
| Performance | World work already has a worker client; rendering uses cached physical projections and bounded quality profiles. | Worker generation, incremental uploads, region/space streaming, bounded simulation, and explicit performance gates. |
| Global coordination | `wilds-world-repository.ts` publishes shared world projections. Its source explicitly identifies cross-instance overwrite limitations. Market repository interfaces describe conditional append with verified admission. | Qualify atomic participant transitions and durable conditional append for creations. Public-store publication alone is insufficient for conflicting global edits or custody. |
| Commerce | Current market routes admit portable card listings. | Introduce creation assets and ownership/rights transitions; arbitrary creations cannot be passed off as creature cards. |

The existing regenerative world design already requires source-object authority, atomic consequential operations, bounded Phi emission, creature consent, and synchronization outside gameplay hot paths. This expansion follows those laws.

## Architecture choice

Three approaches were considered:

1. **Composable creation graph with a prompt interpreter — recommended.** Open-ended arrangements, procedural forms, and registered gameplay behaviors share one persistent model. Creative requests can cross categories while physical and economic behavior remains deterministic and testable.
2. **Prompt selection from a blueprint catalog.** Fast to deliver, but a finite list of houses, gardens, and weapons does not satisfy the requested creative freedom. Existing blueprints remain useful as building blocks and suggestions.
3. **Unrestricted generated meshes and executable scripts.** Visual freedom alone does not provide usable interiors, resource conservation, reliable mechanics, transferable state, or predictable device cost. Optional generated art may enrich a validated graph; unrestricted model-generated code is not the execution model.

The selected design separates four responsibilities: interpreting intent, compiling a creation, admitting a consequential operation, and projecting its visible/playable result. Each responsibility has a versioned interface and can be replaced independently.

## Player interaction

The HUD gains one restrained creation icon next to the existing world actions. Its accessible label and tooltip are **Create with creatures**. It follows the game's existing visual language, with no permanent chat feed or added row of build controls.

Opening it shows a floating conversation panel on desktop and a compact sheet on phones, initially capped near 400 px wide on desktop. Movement controls remain reachable. The main elements are selected creature portraits, compact resource-budget chips, the conversation, a multiline composer, and one context-sensitive primary action. Advanced allocation and sharing controls expand on demand.

The normal flow is:

1. Select one or more available owned creatures. Each shows current readiness and relevant skills. Combined skills unlock techniques; the roster is not restricted to the active companion.
2. Allocate maximum amounts of actual available resources. Planning does not spend or reserve them. The player can revise the budget at any time before committing.
3. Describe what to create: “Build a curved stone palace with a waterfall courtyard and rooms my friends can live in.” The creature responds naturally while a validated proposal appears as a world preview.
4. Refine through conversation: “Move the entrance to the river,” “make the tower taller,” or “add a garden that visitors can harvest.” Explicit selections bind pronouns such as “it” to the correct creation.
5. Position the whole creation using existing world pointing and placement gestures. The panel compacts during placement. A creation can span several bounded chunks and regions; it is not forced into the current per-piece reach rule.
6. A single **Build here** action commits the displayed plan, exact resource ceiling, participating creatures, and placement. It also provides the concrete bounded authorization for those creatures. A substantive change to the plan requires a new commitment; there is no invisible spending approval for later conversations.
7. Local admitted geometry becomes playable immediately when ready. A short assembly presentation follows actual admitted construction stages. Large builds stream completed sections; unfinished sections remain clearly unfinished. No repeated manual “work” clicks are required by this flow.
8. Select a completed creation to continue the conversation, use it, inspect condition, change access, repair, offer a transfer, or list it for sale.

Drafts survive panel minimization and reload. Closing the panel does not revoke already committed work. A separate stop action cancels unstarted work and releases its unused reservations; uncertain dispatched work must first be recovered.

When a request lacks a necessary skill, resource, physical support, or supported behavior, the creature explains the exact missing ingredient and offers a compatible revision. The planner never silently turns a requested working mechanism into decoration or claims completion from dialogue.

## Open-ended creation graph

A proposed `wildz.creation-definition.v1` is an immutable, content-addressed definition. It contains:

- graph and grammar versions, deterministic seed, author attribution, and definition digest;
- hierarchical nodes with stable local identifiers, transforms, attachments, and spatial bounds;
- procedural surfaces and volumes: extrusions, sweeps, profiles, arches, shells, terrain fields, and modular architecture;
- versioned material definitions and optional immutable art-asset references;
- physical collision, support dependencies, walkable surfaces, interior volumes, entrances, and navigation connections;
- typed behavior components, bounded parameters, and their permitted event connections;
- per-node material requirements, work requirements, and required creature techniques;
- render/detail metadata, compiler version, and declared complexity bounds.

This allows unfamiliar combinations and silhouettes without enumerating every finished creation. Behavioral range expands through registered components. A proposed unfamiliar mechanic must become an implemented and verified component before being advertised as playable; text cannot grant a new simulation law.

Behavior composition includes versioned sensors, switches, conditions, bounded counters, event routing, hinges/sliders, actuators, and resource-consuming effects. These can make doors, lifts, traps, machines, and interactive places from the same graph. Connections declare event/step limits and permitted targets; loops cannot perform unbounded work or cause repeated economic effects from one event. Stateful behavior executes through deterministic rules rather than arbitrary generated JavaScript.

The prompt interpreter receives the player's intent, selected creation, current local physical context, resource ceiling, and exact current creature capabilities. Its output is a structured graph or graph patch plus a concise explanation. It has no direct mutation or custody permission. Schema validation rejects invalid identifiers, references, cycles where forbidden, dimensions, bounds, quantities, and unsupported components.

The compiler derives materials, work, physics, interactions, and budget use from the graph. Suggested prices, damage, yields, and resource quantities are proposals, not authoritative outputs. Geometry and mechanical parameters are clamped or rejected by versioned rules. Seed, graph, assets, and compiler version must reconstruct the same playable creation after restoration.

Use the existing Receiz conversation integration where structured proposal capability can be demonstrated. A separate planner port isolates any additional provider. Planning capability must be qualified explicitly; the current text-only or local autobiographical reply path is not an arbitrary creation generator. Saved definitions remain usable without calling a model again. A planner outage preserves drafts and existing creations.

## Persistent state and consequences

A proposed `wildz.creation-instance.v1` binds a definition to an instance ID, source head, location or custody, parent head, owner, steward, creator attribution, access policy, and current state. Definitions can be reusable; physical instances have independent material provenance and histories. Learning or purchasing a design never duplicates the materials of a built instance.

State is composed from small versioned components: condition, support, storage, equipment, resource production, habitat, access, ecological impact, and bounded behavior state. Events advance only affected components and aggregate instance heads. Animation frames, view counts, and speculative speech do not append consequences.

| Creation | Playable behavior | Persistent consequence |
| --- | --- | --- |
| House or palace | Walk through entrances, climb connected stairs, occupy rooms, rest, store items, furnish, host visitors. | Occupancy rights, condition, contents, maintenance, access, and structural revisions. |
| Garden | Plant, grow, water, tend, harvest, feed creatures, and permit shared harvesting. | Consumed inputs, finite produce, soil/water state, ecological changes, and attributed useful harvests. |
| Tool | Equip, use an applicable harvesting or crafting technique, repair, lend, or transfer. | Durability, material extraction, produced lots, custody, and current capability. |
| Weapon | Equip and attack through the game action system, with range, recovery, damage type, wear, and target rules. | Damage to eligible targets, breakage, repair debt, spent ammunition/energy where applicable, and salvage. |
| Cave or mountain | Traverse real surfaces and connected interiors; build inside eligible spaces. | Terrain-overlay revisions, structural support, entrances, affected resources and habitats. |
| Waterfall or volcano | Interact with bounded water/heat/hazard systems and surrounding land. | Water routing, hazard state, affected ecology and structures, and restoration obligations under their rules. |
| Galaxy or other large place | Enter connected authored spaces, explore addressable worlds, build within them, and return through stable connections. | Space ownership/stewardship, portal connections, creations, inhabitants, resource state, and events. |

Gardens need explicit production/input rules and actual resource types, not a reward timer attached to a mesh. Initial equipment needs an equipment/action adapter, not just a tool name and inflated creature stats. Water and heat features require their own bounded environment rules; rendering particles does not implement them.

Damage eligibility is part of the shared world's rules. Players can modify and demolish their own creations; other creations can opt into destructive play or exist in designated contested areas. Public visibility alone does not grant alteration rights. Attacks resolve exact target heads and apply damage, support changes, and salvage atomically. A destroyed support can make dependent sections unusable; affected occupants move to an admitted safe position before traversal changes strand them. Old revisions remain historical, not usable duplicate assets.

No absence-based destructive simulation is introduced. Time-dependent production is derived from admitted inputs and bounded Kai catch-up rules; it cannot invent unlimited material while everyone is offline.

## Scale, terrain, and entire worlds

Items, buildings, landscape features, and authored spaces use the same creation identity and consequence interfaces, but different spatial projections.

- Items use custody/equipment and a small local physical projection.
- Structures use region-indexed chunks with stable node IDs and connected physical/navigation surfaces.
- Landscape edits use bounded additive/subtractive terrain fields layered over canonical terrain. Collision, water, creatures, navigation, and rendering consume the same admitted fields.
- Extensive palaces and cave networks stream chunks around the player and nearby active creatures. All sections remain part of the same creation without loading them together.
- Galaxies are hierarchies of addressable spaces and connections. Nearby stars and worlds have progressively detailed projections; entering a world loads its bounded playable neighborhood. A backdrop alone does not satisfy a request for explorable worlds. Full astronomical fluid or gravity simulation is not implied by this representation.

Creative scale is separate from per-device active detail. A huge request compiles into a paged plan with dependencies, resource requirements, resumable work, and an immediate bounded preview. It cannot bypass resources, creature capacity, world compatibility, or device budgets by choosing a grander noun.

Space creation defines topology and permitted procedural generation; it does not mint arbitrary creatures, rarity, materials, or currency. Any generated natural resource potential remains governed by the applicable source/genesis laws and only yields value through admitted interactions. Landscape edits bind affected feature heads and lawful alteration rights. No creation can silently overwrite canonical routes, another player's place, or the original terrain generator for every player.

## Creature construction and resource allocation

Creature techniques derive from current proven capabilities, progression, and condition. Proposed technique families include shaping, masonry, forging, cultivation, excavation, water work, high-altitude assembly, and portal/world-space construction. Their actual grants must be defined by versioned game rules rather than inferred from a creature's name, color, or conversational willingness.

Different creatures contribute complementary techniques. A creature can request help, pause for care, or decline incompatible work. The prompt panel surfaces readiness and missing coverage without making every creature a universal builder.

The compiler produces a dependency graph of gather, deliver, shape, assemble, forge, plant, and finish tasks as appropriate. The commit binds exact creature subjects/heads, allowed operations, geometry bounds, resource ceilings, affected spaces, expiry, and cancellation state. Existing crew journals and execution/recovery boundaries are reused where their contracts apply.

Scheduling reservations prevent two tasks from choosing the same material. They do not establish cross-device custody. Actual resource reservation, custody changes, consumption, creation results, creature work/condition changes, and world effects must be admitted together through the qualified source-object transaction boundary.

Small creations should use one bounded aggregate execution where the rules permit it. Larger jobs execute resumable atomic stages. The instant interaction requirement means no artificial building timers or repeated work-button loops; it does not grant free work, infinite stamina, or materials. Creature motion and assembly effects depict actual work without delaying a ready small result merely for theater.

## Sharing, transfer, and maker benefit

Access has distinct permissions for visiting, inhabiting, using, harvesting, editing, and demolition. The UI uses readable presets with an optional advanced view. Public benefit does not require public editing. Collaborators can contribute resources and work through explicit contributions with retained attribution.

Creation assets extend commerce through a dedicated asset discriminator and verifier. Supported rights must be distinguished:

- transfer or sale of a physical instance and its current custody;
- transfer of stewardship for a fixed place;
- sale/license of a reusable definition;
- invitations or occupancy/use grants.

A gift requires recipient acceptance. Marketplace sale uses the existing qualified settlement model extended to creation proofs. Sold items leave the seller's inventory/equipment; transferred places preserve location, contents, valid occupants, history, and creator attribution. Existing mandates from the old steward lose authority at transfer. Definition licensing creates no physical instance without new resource admission.

Public use defaults to free. Makers can receive attributed reputation and lawful regenerative Phi for measurable benefit when the existing constitution/emission rules admit it. Optional tips or usage fees are explicit funded transfers; paid use shows its cost before commitment. Finite produce or a successful shelter/rest effect can be a benefit event; opening a panel, standing nearby, or counting visits cannot issue Phi.

Creator, maintainer, and participating creatures retain contribution attribution. The rule records who receives any permitted benefit and the exact causal usage. Duplicate/replayed use cannot pay twice. Self-use or coordinated cycles cannot create unbounded rewards from unchanged resources. A useful creation remains usable when emission capacity is exhausted, without promising a payout.

## Admission, global visibility, and recovery

The meaningful lifecycle is:

`conversation -> zero-write proposal -> compiled preview -> explicit commit -> atomic admission -> local playable projection -> verified shared discovery`

Proposed creation operations include create, patch, place/move, use, equip, harvest, damage, repair, grant/revoke access, and transfer. Each binds expected participant heads, source definitions, applicable rules, Kai, affected region/space bounds, and semantic idempotency identity. These are proposed interfaces, not existing SDK method names.

An admitted operation either advances every required participant or produces a verified zero-write result. Concurrent edits compare exact heads. A stale plan is refreshed and shown again; it does not spend the old allocation or silently relocate somebody's structure.

Local source admission and verified global publication are distinct. Pending publication can preserve owned local work, but the UI cannot call it globally available until its shared state is admitted and discoverable. Externally contested custody, sales, benefit payments, and destructive effects require the corresponding shared admission before completion is claimed.

Global indexing should consume immutable admitted sources by region/space and append deltas. A projection rebuild cannot alter authority. The existing public-store world snapshot must not be treated as an atomic lock across server instances. Deployment qualification must demonstrate supported conditional admission for the required participants; the existing market interface is a reference for the contract, not evidence that a creation rail is available.

Unknown transaction outcomes enter recovery by the same operation identity. Never redispatch uncertain work, release its material reservation prematurely, invent a completed creation, or debit a second time. Disconnects preserve pending drafts/jobs. Transfers, head changes, recall, and revocation are rechecked before every new task admission.

Vault export/import retains immutable definitions/assets, current instances, source transitions, contribution attribution, crew job references, access/custody, and spatial indexes. Restoring does not generate a new identity, reroll mechanics, duplicate materials, or require the original prompt provider.

## Performance architecture and release gates

Generation is demand-driven. A closed creation panel adds no new generation requests, timers per object, or full-world polling. Conversation planning uses the server/provider path; graph expansion, terrain/mesh generation, expensive validation, hashing, source replay, and serialization run in bounded workers or server jobs. Cancellation discards obsolete proposal results by request identity.

Rendering and physics use small immutable compiled projections. Instanced or merged geometry, shared material resources, spatial indexes, cached collider/navigation chunks, and distance/quality-dependent detail are required. No creation graph interpretation, history replay, whole-roster capability derivation, or network request runs inside a movement/render callback.

Workers return transferable buffers and incremental chunk results. Main-thread GPU uploads, shader compilation, object mounting, and collider activation also have real cost; those tasks are paced against available frame budget. Detail never replaces an active walkable surface with incompatible geometry. Mobile profiles keep their existing visible geometry/draw budgets; quality may refine later without blocking use of admitted base geometry.

Dormant remote creations do not each have a frame loop. Nearby behavior uses a bounded scheduler; time-based growth uses analytical catch-up with bounded admission work. Large plans and histories are paginated. Shared updates are region/space deltas applied after input and paint. Worker failure must not fall back to a large synchronous compile on the rendering thread.

Qualification records a fresh baseline from the current checkout before product changes. Older release figures guide investigation but are not a current benchmark. Use identical browser/device, scene, camera, quality profile, and input route, with warm and cold samples.

Required measurements:

- HUD opening and input-to-feedback latency; local movement/input-to-paint p50, p95, and p99;
- frame-time p50, p95, and p99, long tasks, draw calls, triangles, texture residency, and memory;
- prompt-first-reply, preview-ready, local-admission, playable-base, and verified-global-publication times separately;
- baseline play with the feature closed; conversation streaming during movement; preview generation; small creation; a large palace; terrain changes; garden use; combat destruction; and rapid travel between spaces;
- representative phone and desktop hardware, contested edits, server reconnect, reload, and long sessions.

HUD feedback should occur on the next available paint and never wait for planning or network. The release fails if normal gameplay latency/frame time regresses beyond measured run-to-run noise, existing device budgets are exceeded, or creation work introduces sustained stalls. Record the measurement protocol and noise range before evaluating changes. Do not claim zero latency or “no lag” based only on unit tests, fixed-size fixtures, desktop emulation, or an unchanged draw count.

## Delivery boundaries

The vision spans several subsystems. Deliver it through separately reviewable work packages with a shared creation contract, rather than placing everything in `PlayCampaign.tsx`:

1. **Creation contract, compiler, and HUD conversation.** Grounded graph proposals, resource/skill planning, whole-creation previews, prompt revisions, and compatibility with manual building. No preview is relabeled as a finished result.
2. **Creature execution and usable instances.** Qualified bounded execution, materials, physical interiors, persistent state, basic tool/weapon equipment, functional gardens, repair/damage, source retention, and restoration. Demonstrate a real house, tool/weapon, and public garden from prompt through use.
3. **Shared creations and consequence economy.** Conditional global admission/indexing, multiplayer use, access/occupancy, transfer, market asset integration, maker attribution, and bounded benefit settlement. Demonstrate two real players using and transferring the same instance.
4. **Large environments and connected worlds.** Rich architecture and materials, terrain/water/heat behaviors, extensive interiors, authored spaces, galaxies, and streamed creation plans with measured device performance.

Each package gets a focused implementation plan. Dependencies, missing runtime qualification, or unfinished mechanics remain explicit. Completion of an early package does not mean the entire requested world-creation system has shipped.

## Acceptance evidence

The full expansion is complete only when these representative scenarios work through production gameplay and admitted state:

1. Open the small HUD icon, select several creatures and exact resource limits, prompt an original inhabited palace, refine it, place it, build it without manual per-piece work, walk inside, furnish it, and let an invited player inhabit it.
2. Prompt a distinctive tool and weapon, forge them using appropriate skills/resources, equip/use them, observe real wear and eligible target damage, repair them, and transfer one to another player. The old owner cannot use the transferred instance.
3. Build a shared garden. Another player gains an actual finite useful harvest or effect. The maker receives only the benefit allowed by the admitted rules; replays and empty usage earn nothing.
4. Create connected caves, a mountain feature, and working water/heat features. Traversal, environment, support, ecology, and consequences agree with what is visible. Unsupported mechanics remain clearly unbuilt.
5. Create and enter a connected large authored space with explorable worlds. Nearby creation/state loads without enumerating or simulating the whole space hierarchy.
6. Two devices contend for the same material or creation head. At most one incompatible successor is admitted; there is no duplicate spend, lost edit, duplicated item, or invented completion.
7. Lose connectivity or reload during execution, transfer, and publication. Recovery resolves the exact operation without redispatching unknown work. Vault restore preserves identity, contents, damage, attribution, access, and spaces.
8. Gameplay movement, input, and frame-time qualification pass the measured baseline comparison while creation, streaming, combat, and shared updates are active.

Meaningful unit/integration tests cover deterministic compile/replay, collision/interior/navigation correctness, budget conservation, capability/readiness, multi-creature dependencies, exact-head races, damage/support effects, garden growth/harvest, custody/market/benefit transitions, and unknown-outcome recovery. Browser and multi-client checks verify the actual HUD, placement, inhabitation, equipment, shared use, transfer, and restoration. Performance evidence is collected separately from correctness tests.

## Review decisions

The approved architecture defaults are the compact conversational HUD, graph-based composition, actual creature skill/resource constraints, preserved manual building, free public use with explicit optional funded charges, destruction governed by target permissions/contested areas, and streamed large creations/spaces. Concrete execution contracts, mechanical parameters, and delivery tasks are specified in the implementation plans for review.

The written architecture was approved for implementation planning. The written implementation plans require review before product implementation. No production service, new runtime capability, complete generator, globally atomic creation system, or performance result is claimed by this document.
