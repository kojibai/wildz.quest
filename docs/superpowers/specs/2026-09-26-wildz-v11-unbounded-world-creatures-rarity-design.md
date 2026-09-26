# Wildz v11.0.0: Open World, Living Creatures, and Rarity Conformance

**Date:** 2026-09-26

**Status:** Design approved in conversation; written spec awaiting review

**Release target:** v11.0.0

## Outcome and scope

Wildz v11 removes the authored coordinate boundary and fixed creature-family ceiling from new gameplay. Exploration can continue through procedurally addressed regions; every admitted creature has a unique canonical identity and reproducible origin. Rare encounters become rare by a disclosed, versioned law that depends on the encounter site's distance from the starting area. Every eligible site has a nonzero chance of each rare class. The best frontier odds are Rare 1 in 1,000, Mythic 1 in 100,000, and Eternal 1 in 1,000,000.

Players see the full law before discovery. A specific site's result is revealed at the encounter. Afterward, its portable proof can be checked without a server. Three public pages explain the world, creature creation, and conformance in the editorial style of About. The release ledger covers the complete change set since the first v10.0.0 release, including the v10.1.0 work already committed locally.

This design is a coordinated release program with three implementation streams: world addressing and runtime migration; encounter, creature, and proof rules; public explanation, conformance, and release qualification. They share versioned contracts and ship together in v11. A partially migrated coordinate system or a page that advertises unshipped odds cannot ship.

## Honest meaning of “infinite” and “one of one”

The world has no designed last region. Signed arbitrary-precision region coordinates make the address space mathematically unbounded. A real client still has finite memory, storage, compute time, network payload capacity, and visible precision. V11 must keep the active simulation bounded and measure performance at near and distant addresses. It must not promise zero latency for coordinates of arbitrary digit length.

Each admitted creature has a canonical one-of-one identity: its versioned birth tuple is unique in the admission ledger, and later history remains attached to it. Procedural traits, phenotype, voice inputs, behavior, and lineage vary on a very large generative space. Finite screens and finite art primitives cannot guarantee that no two creatures ever look similar. Public copy must distinguish unique identity from visual resemblance and must not advertise mathematically infinite unique rendered images.

## World address and local simulation

The v11 address is `{ worldVersion, regionX, regionZ, localX, localZ }`. `regionX` and `regionZ` are signed arbitrary-precision integers serialized as canonical decimal strings. Local offsets are fixed-point integers within one 24-unit encounter region and never use huge world-space floating-point positions. Conversion to render, physics, and audio coordinates subtracts the current region origin first; those systems receive only bounded nearby numbers. A single canonical parser, serializer, comparator, and neighbor operation owns this address type. Arbitrary-precision values never pass through `Number` or a 32-bit hash before generation.

Terrain, encounter sites, ecology, resources, structures, exploration atlas, travel, world service, multiplayer rooms, persistence, and proof coordinates migrate to this address contract. Procedural generation uses domain-separated, versioned hashing of canonical region addresses and local slots. The old central world remains geographically stable under its existing version; crossing into v11 regions must not change the meaning of old places. Old numeric coordinates convert exactly where representable. V1 cards and saves retain their original verification and interpretation; a failed or unknown migration never silently relocates a player or rewrites a proof.

The active region radius, terrain mesh budget, creature instances, physics objects, audio emitters, and caches remain fixed-size around the player. Atlas data stays sparse; an extreme explored path never allocates its bounding rectangle. Generation and disposal use bounded queues and cancellation when the player moves. Teleport and Rift transitions rebuild a local window instead of simulating the intervening distance. Input parsing has resource guards against oversized or malformed addresses; these are operational safety limits, disclosed separately from any designed world edge.

## Eligibility, distance, and exact class law

An **eligible encounter** is one admitted site encounter for one player identity and one site slot under the v11 law. Opening the same site again, reconnecting, refreshing, or retrying a claim returns the same result. Failed capture does not create another rarity roll. The site must exist under the versioned world generator and be reachable under the game's movement/travel authority. Client-supplied coordinates alone do not qualify an encounter.

Distance uses the encounter region's signed integer address, not a client travel counter. Let `d² = regionX² + regionZ²`; compare it with exact integer squared thresholds, avoiding overflow and floating-point square root. The band's radial boundaries are 25, 125, and 500 encounter regions. One region is 24 world units, so the frontier starts at approximately 12,000 world units from the origin. The starting area and every other eligible location retain a nonzero rare chance.

| Distance band | Exact region-radius rule | Uncommon | Rare | Mythic | Eternal | Trail |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Origin | `d² < 25²` | 1/5 | 1/10,000 | 1/1,000,000 | 1/10,000,000 | 7,998,989/10,000,000 |
| Wilds | `25² ≤ d² < 125²` | 1/5 | 1/5,000 | 1/500,000 | 1/5,000,000 | 7,997,978/10,000,000 |
| Deep wilds | `125² ≤ d² < 500²` | 1/5 | 1/2,000 | 1/200,000 | 1/2,000,000 | 7,994,945/10,000,000 |
| Frontier | `d² ≥ 500²` | 1/5 | 1/1,000 | 1/100,000 | 1/1,000,000 | 7,989,890/10,000,000 |

Each row sums to one. One integer draw in `[0, 10,000,000)` maps to mutually exclusive ranges for Eternal, Mythic, Rare, Uncommon, and Trail; no second rarity roll is hidden in species selection, habitat, capture, foil, or evolution. This table expresses the chance of the named class, not a cumulative “at least this rare” chance. At frontier odds, 10,000 independent Eternal-eligible encounters give about a 0.995% chance of at least one Eternal; 1,000,000 give about 63.2%. Actual history may differ. Rarity is not a guaranteed reward after any number of attempts.

The site's location also determines habitat, available body grammars, materials, and encounter presentation. No undisclosed biome multiplier changes the table above. A region's place in the world therefore affects the encounter through its distance band and ecology while preserving simple, auditable class odds.

## Deterministic reveal and offline proof

Undiscovered outcomes are intentionally not public coordinate lookups: a public pre-discovery generator could be scanned at machine speed and turn Eternals into a route list. The generation law and odds are public. The encounter service admits a player's site presence and signs a fixed canonical input containing the release key ID, world and rarity versions, player scope, site address, and slot. Ed25519 gives one deterministic signature for that input. Domain-separated SHA-256 blocks from the signature feed 64-bit rejection sampling into `[0, 10,000,000)`: reject values at or above `floor(2⁶⁴ / 10,000,000) × 10,000,000`, then take the remainder. The class and creature seed derive from separate domains. The release manifest publishes and pins the verification key before encounters are admitted; key rotation creates a new explicit version, never a silent reroll. The stated odds assume a uniform, unpredictable cryptographic draw; a deterministic site has one fixed outcome once signed.

The portable v11 proof carries the canonical input, signature, public key identifier, law and generator versions, derived roll, class, birth tuple, and generation digest. An offline verifier first checks the signature against the pinned release key, then recomputes the band, unbiased draw, class, creature traits, and digest. It reports each check and rejects tampering, malformed addresses, unknown versions, and a mismatched class. Global duplicate-birth admission belongs to the ledger; an offline verifier can detect a duplicate only when given both proofs or a trusted ledger snapshot. The issuer still controls its signing key and admission service; the proof establishes a reproducible signed result, not that the operator could never choose or misuse a key. The conformance page states this trust boundary plainly.

The client cannot receive authoritative undiscovered results while completely disconnected from the encounter authority. Offline exploration and local world generation continue; an offline encounter records a pending observation and clearly withholds an authoritative rare claim until reconnection and admission. Reconnection is idempotent and cannot turn repeated submissions into extra rolls. V11 must explain this limitation in the game and public documentation rather than silently fabricate a collectible proof.

## Creature generation and gameplay value

Creature birth is derived from a versioned tuple of site address, slot, player scope, encounter proof, and generator version. A procedural grammar combines authored silhouettes and animation rigs with region-derived lineage keys, morphology, palette, pattern, surface detail, voice parameters, temperament, ecology affinity, and ability seeds. The unbounded address contributes to the lineage key, so there is no fixed enumerated family list; related creatures still share explicit ancestry and authored body archetypes. Generation is deterministic and bounded for one creature; it never enumerates the possible space. The immutable birth tuple, not a truncated display hash, is the canonical identity. Public display names and short hashes are labels, not uniqueness proofs. The admission ledger rejects a second birth for an existing tuple.

Rarity is assigned by the encounter law independently of anatomy and base combat utility. Evolution, care, bonds, and history can change gameplay attributes without changing birth rarity or provenance. This lets ordinary companions remain useful. The public creature page shows the derivation and range of each attribute and the card viewer shows actual proven attributes for a selected creature.

The authoritative rarity value is the exact probability fraction for that creature's distance band. The comparison score is `−log₂(probability)` in bits, rounded to two decimal places for display only; for example, frontier Rare is about 9.97 bits, Mythic 16.61, and Eternal 19.93. Gameplay capability and progression are disclosed separately. No fixed cash price, investment value, or covert combat multiplier is inferred from the scarcity score.

## Public pages and conformance evidence

The editorial routes `/world`, `/creatures`, and `/conformance` use the About/Guide design language, responsive layout, accessible headings and tables, keyboard-operable controls, and clear mobile typography. About, Guide, game menus, card details, and the sitemap link to them. The content is generated from the versioned world, rarity, and creature rules where practical; editorial summaries identify their source version.

`/world` shows the address model, region size, procedural terrain and ecology inputs, map-scale examples, navigation and active-window behavior, and the finite-device caveat. `/creatures` walks through birth, one-of-one identity, traits, behavior, evolution, abilities, and the limits of visual uniqueness. `/conformance` publishes the complete class table including Trail and Uncommon, exact distance calculation, scarcity score formula, eligibility rules, reveal timing, key/trust boundary, and worked encounter proofs. It includes a local proof checker and downloadable versioned JSON test vectors. The checker processes a supplied proof in the browser without uploading it. Public examples include each rarity, every band boundary, malformed input, and legacy-vs-v11 verification behavior. Page copy must never confuse catalog share, class odds, capture chance, and probability of at least one success across many attempts.

## Error handling, compatibility, and release qualification

Unsupported proof versions fail closed with a readable message and preserved bytes for future verification. Invalid signatures, altered addresses, mismatched traits, duplicate births, and stale admission attempts never become admitted cards. Network loss leaves a labeled pending observation, not an invented rarity. Old v10 cards remain verifiable under their original catalog and proof law; v11 does not relabel or retroactively reroll them. A migration audit covers saves, atlas, structures, resources, multiplayer positions, Rift destinations, public card displays, and export/import paths.

Qualification includes unit and property tests for signed-address arithmetic, region transitions, integer odds ranges and row sums, boundary distances, deterministic generation, rejection sampling, and proof tamper cases. Integration tests exercise one-result-per-site, offline pending/reconnect behavior, old card continuity, and very distant coordinates. Browser tests inspect the three public pages, proof checker, keyboard and screen-reader semantics, mobile layouts, and actual game movement/capture. Performance comparisons use the v10.1.0 build as baseline on the same browsers/devices and record frame time, active object count, memory, traversal/teleport latency, and first playable time at near and distant addresses. Any material regression or unverifiable rarity claim blocks release; the result report records measured limits rather than claiming zero latency.

The v11.0.0 release work updates package/app/service-worker versions, changelog, complete release notes since v10.0.0, source and test-vector links, and the normal `pnpm release:check` and browser qualification evidence. The final source commit is local for the user to push. Publishing, deployment, tags, and remote release actions require their separate release decision.
