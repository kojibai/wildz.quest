# Wildz Proof-Native Φ Economy Design

**Status:** Direction approved; implementation is intentionally separate from the active living-world traversal plan.

## Purpose

Wildz turns exploration, collection, creature growth, battle preparation, gifting, and trade into one proof-native economy carried by the player's Receiz identity. The economy remains instantly usable offline at its verified local head. A server may distribute missing additions and coordinate conflicting writes; it never calculates, replaces, or outranks the proof-carried balance.

## Φ Valuation Authority

- A sigil's deterministic intrinsic Φ valuation is projected locally from its verified sigil metadata and exact Kai pulse using the canonical Phi valuation function.
- Kai pulse is necessary input, but not the only input: identity, lineage, allocations, and other sealed valuation fields remain part of the exact calculation.
- Settlement and wallet arithmetic use non-negative integer micro-Φ strings. Floating-point display values never become monetary authority.
- A rendered sigil, `sigilClaimSeed`, filename, model response, MCP response, cached server balance, or visual rarity cannot create or change value.
- When a proof explicitly carries an admitted allocation such as child value or whole-note micro-Φ, that sealed/admitted field outranks a newly inferred visual estimate.
- Wildz must consume an official exported deterministic valuation primitive or a shared integrity-pinned package with cross-repository vectors. It must not silently fork monetary math into a game-only implementation.

## Local Spendable Balance

The spendable balance is a pure projection over the complete verified account history carried at the current Identity Seal head:

`admitted value + received value - sent value - spent value - consumed value`

- Identity Seal bytes are immutable. A receipt, send, spend, claim, or consumption becomes a verified append/successor at the same account identity rather than rewriting an old seal.
- Each newly admitted event is stored immediately in durable local proof memory and included in the next exported Identity Seal/Vault state.
- The balance reducer runs when a new verified addition is admitted, persists its resulting head and integer balance, then remains read-only during ordinary UI and gameplay.
- Opening a wallet, walking, fighting, scrolling, rendering a frame, changing creatures, or opening the atlas performs zero network requests and zero balance recomputation.
- Connectivity requests only additions that are not already known. An event-driven delivery or explicit head synchronization replaces recurring polling.
- Offline display is exact at the locally verified head. The UI may distinguish that fact from whether newer additions have been checked, without presenting the server as balance authority.
- A consequential send, purchase, or trade must still coordinate one exact expected-head transition so two devices cannot spend the same capacity. That is conflict prevention, not remote valuation.

## World Items as Proof Objects

Every economically meaningful finding has stable proof identity and append-only state. Initial item families include:

- consumable battle items;
- reusable tools with durability or cooldown;
- equipment that changes a bounded battle or traversal projection;
- creature training and mastery materials;
- evolution catalysts;
- crafting ingredients;
- keys and access artifacts;
- relics, cosmetics, lore objects, and rare collectibles.

Immutable genesis records define item kind, exact world discovery identity, provenance, effect policy, allowed uses, stack policy, trade policy, and any admitted Φ basis. Runtime appends record custody, quantity, durability, cooldown, equip/unequip, use, split, merge, craft, and irreversible consumption.

A consumable reaches a terminal consumed state and cannot regain capacity. A reusable object preserves identity while append history changes its remaining durability or next-use Kai boundary. Derived UI never mutates the proof object or invents remaining capacity.

## Discovery and Admission

- Deterministic world authority may project a candidate finding without creating economic value.
- Pickup performs a single explicit claim/admission that binds the exact site, item identity, owner, Kai event, and idempotency identity.
- Replaying, revisiting, reconnecting, or restoring cannot mint the same finding twice.
- Ordinary movement and nearby-world rendering never generate, verify, price, or synchronize inventory proof objects.
- Rare air, underwater, cave, waterfall, summit, ruin, and underground discoveries may use the same proof-object lifecycle with habitat- and ability-gated access.

## Creature Growth and Battle Use

Items may unlock techniques, improve bounded capability mastery, evolve a creature, recover condition, alter a battle loadout, or open traversal routes. Every effect is deterministic and admitted against exact expected creature, item, and player heads.

Economic power remains legible and bounded. No purchase silently rewrites a creature's sealed identity, anatomy, memories, capture appearance, or provenance. Progression effects append history and project current state.

## Gifts, Trades, Purchases, and Φ Sends

- Direct Φ sends use Receiz Connect with explicit user confirmation and a stable idempotency key.
- Item gifts and bearer transfers preserve the same proof-object identity and full history while revoking former-owner authority after claim.
- A player-to-player trade is an atomic multi-subject transaction: payer Φ capacity, receiver Φ receipt, item custody, both player heads, and affected creature/item heads all advance together or no authoritative write occurs.
- Listings and offers are zero-write proposals. Checkout success, an API response, a receipt-shaped object, or a marketplace row cannot independently prove settlement or ownership.
- Fees, sinks, rewards, crafting costs, repair costs, and emission limits are explicit deterministic policies with versioned digests and simulation tests.

## Performance Invariants

- Zero valuation API calls after proof admission.
- Zero recurring balance polling.
- Zero verifier, wallet reducer, market reducer, or inventory generation work on the movement/render hot path.
- One new verified event causes at most one bounded incremental balance/inventory reduction and one durable checkpoint.
- Large inventories use content-addressed heads, bounded indexes, and lazy detail projection without truncating canonical history.

## Required Verification

- Cross-runtime vectors prove the same verified glyph metadata and Kai pulse produce the same integer micro-Φ result.
- Identity Seal export/import restores exact balance, transaction history, item inventory, ownership, durability, cooldown, and consumed state without network access.
- Receiving one event advances the local balance once; reload and replay do not double-credit it.
- Sending or consuming once subtracts capacity once; sibling double-spend attempts admit at most one successor.
- Offline then online synchronization requests only unknown additions and never replaces stronger carried history.
- Gift and trade tests advance all required heads or prove zero writes.
- Ten thousand movement/render updates after a large inventory import cause zero valuation, verification, wallet, inventory, network, worker, and timer activity.

