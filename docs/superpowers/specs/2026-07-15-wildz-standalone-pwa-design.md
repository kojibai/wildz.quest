# Wildz Standalone PWA Design

Date: 2026-07-15  
Status: Approved design; written-spec review required before implementation planning  
Product: Wildz  
Canonical domain: `wildz.quest`  
Source lineage: Curated standalone extraction from MIT-licensed `kojibai/Receiz-commerce`

## 1. Product outcome

Wildz is a standalone, installable, full-screen game application. It preserves the complete Wildz experience from Receiz Commerce while removing the commerce product shell, merchant tooling, and website framing. Players land directly in the living 3D world. Identity, collection, social play, competition, trading, listings, and payments are native parts of that world rather than separate applications.

The product hierarchy is explicit:

1. Play and explore.
2. Build a living card vault and public player identity.
3. Meet, challenge, cooperate with, and compete against other players.
4. Trade or purchase verified assets through a small contextual market surface.

There is no marketplace page, storefront, cart, merchant admin, site builder, or commerce navigation. Economy features must never visually replace the game.

## 2. Selected implementation strategy

Wildz will be a curated standalone fork of the upstream game.

- Extract the Wildz gameplay, presentation, multiplayer, card, proof, identity, world, and economy modules that are required for feature parity.
- Preserve the current Next.js 15, React 19, TypeScript, Three.js, React Three Fiber, and Receiz SDK architecture where those choices remain applicable.
- Replace dependencies on general commerce state with focused Wildz services and types.
- Remove unrelated storefront, merchant, product-catalog, page-builder, cart, checkout-shell, hosting, and commerce administration code.
- Keep upstream attribution and the MIT license obligations appropriate to copied source.
- Treat this repository as an independent product and release unit named Wildz.

A thin wrapper around the full commerce repository is rejected because it would leave Wildz coupled to unused product surfaces. A clean rewrite is rejected because it would create unnecessary feature-parity and regression risk.

## 3. Application architecture

### 3.1 Persistent game shell

The root route opens directly into an edge-to-edge game shell. There is no public marketing shell, website header, footer, or document-level page scrolling during play.

All player-facing surfaces appear over the persistent world:

- `/` opens the world.
- `/@username` opens the same world shell with the requested public player profile and vault overlay.
- `/card/[assetId]` opens the same shell with a verified card overlay.
- Invite links open the same shell with the relevant room, player, event, or world-coordinate context.

Closing a deep-linked overlay returns to the world without resetting movement, camera, encounter, multiplayer, or audio state. The implementation may use Next.js routes and route interception, but the user experiences one continuous application.

### 3.2 Bounded subsystems

The application is divided into independently testable boundaries:

- **Game engine:** world streaming, movement, camera, biomes, encounters, capture, battles, raids, missions, landmarks, rifts, progression, world events, and deterministic reducers.
- **Card and vault system:** living cards, growth, transformation, lineage, portable artifacts, inventory, proofs, public vault projection, and ownership state.
- **Social system:** multiplayer presence, nearby players, rooms, challenges, messages, teams, leagues, player profiles, and competitive records.
- **Economy system:** listings, discovery, offers, direct trades, purchases, settlement, cancellation, and Receiz receipts.
- **Receiz boundary:** identity, proof verification, ownership, app-state recovery and publication, public projections, durable world state, and settlement rails.
- **Presentation system:** full-screen canvas, HUD, command dock, sheets, popovers, ceremonies, responsive layout, audio, haptics, and accessibility.
- **PWA shell:** manifest, service worker, install assets, offline startup, safe areas, orientation, caching, and update recovery.
- **Brand system:** logo, iconography, typography, tokens, loading screen, metadata, and share/install artwork.

Application code imports Receiz functionality through a narrow adapter instead of scattering SDK assumptions across gameplay components.

## 4. Brand system

The customer-facing product is **Wildz**. Receiz remains the proof, identity, state, and settlement technology beneath the product but is not the primary brand.

The visual system preserves the upstream game's soft 3D world, organic terrain, creature-card language, atmospheric lighting, compact status elements, and dark translucent command surfaces.

### 4.1 Original SVG logo

The repository will include an original scalable Wildz symbol and wordmark:

- A compact W-shaped trail or rift formed from two rising terrain strokes.
- A luminous seed or star at the center, representing discovery, living cards, and world progression.
- Rounded custom `WILDZ` lettering.
- `wildz.quest` used only where domain recognition is useful, including launch, install, sharing, and repository metadata.

The symbol must remain legible as a 16-pixel favicon, PWA icon, profile badge, loading mark, social image element, and in-world waypoint. The master asset is SVG; required raster PWA sizes are derived from it and visually verified.

## 5. Full-screen interaction model

### 5.1 Game-first mobile layout

The game canvas fills the viewport, including modern dynamic viewport handling. A minimal safe-area HUD presents essential player and world state without framing the canvas in a card or browser-like page.

Thumb movement and contextual actions occupy dedicated lower safe zones. Vault, map, social, audio, identity, and market use small recognizable controls. Controls must not overlap browser safe areas, gameplay targets, or one another at supported viewport sizes.

The mobile overlay system uses focused bottom sheets. Desktop uses compact side popovers or constrained dialogs. The world remains visible and alive behind overlays. Dismissing any overlay returns control immediately and preserves the previous camera and gameplay context.

### 5.2 Seamless social marketplace

There is no marketplace destination. A discreet in-game icon opens the market surface.

The market supports:

- contextual listings from nearby players, teammates, recent opponents, and active events;
- search and bounded discovery;
- verified asset and seller inspection;
- fixed-price listings;
- player offers;
- direct asset trades;
- purchases and settlement;
- listing cancellation;
- public profile and vault inspection;
- Receiz proof and receipt access.

An asset or player can expand into a detailed overlay, but the application never navigates into a storefront. Closing the market returns the player to the exact world state.

Purchases may expand collection and strategic choice. Purchased rarity cannot guarantee victory, fabricate mastery, create achievements, or directly determine ranked standing. Competitive progress comes from verified play, mastery, contribution, and cooperation.

## 6. Automatic Receiz identity

### 6.1 No signup

Every first-time visitor receives a Receiz ID automatically through official SDK identity primitives. There is no registration form, email requirement, password, account-creation page, guest-mode choice, or delayed identity prompt.

The app creates a starter handle and local identity state, then guides the player through character genesis. Durable and public claims are labeled according to their actual admission state; locally prepared state is not misrepresented as globally admitted proof.

### 6.2 Opening choice and restoration

The opening character screen provides two clear paths:

1. **Create my explorer:** select gender presentation and generate a new deterministic character.
2. **Restore my Wildz:** import a Receiz Identity Seal or portable Wildz Vault.

An Identity Seal restores the existing Receiz identity authority and then recovers the associated character, public profile, vault, ownership, progression, and social history.

A portable Vault restores verified Wildz game history, cards, progression, and appearance. Ownership-sensitive actions remain locked until current Receiz ownership and identity authority are reconciled. A Vault must not be treated as authority to impersonate its original owner.

Import validation and reconciliation complete before the active identity changes. A failed, invalid, incompatible, or cancelled import leaves the current identity untouched.

Players can export the active Receiz Identity Seal and portable Vault from the identity/profile controls. Raw seal contents, private key material, and recovery secrets never enter logs, analytics, public projections, model prompts, or MCP output.

## 7. Deterministic character genesis

After a new player selects gender presentation, Wildz performs a one-time deterministic genesis using:

- the player's Receiz identity reference;
- the admitted Kai Pulse coordinate for the genesis moment;
- a versioned Wildz character generator.

The generator selects a unique combination from bounded authored traits such as face and hair treatment, complexion, silhouette details, outfit pieces, outfit colors, materials, accessories, trail effect, and signature mark.

The output is sealed into the player profile with:

- generator version;
- allowed source references;
- canonical trait payload;
- appearance digest;
- genesis proof coordinate.

The same verified inputs always regenerate the same base character across devices. Reloading, reinstalling, or restoring valid artifacts does not reroll appearance. Repeated Pulse attempts cannot be used to farm preferred or rare combinations.

Earned cosmetics may layer over the immutable base without replacing its genesis record. Character-generation rules are versioned so older characters retain their original interpretation after future art-system changes.

The new-player path is:

> Land → automatic Receiz ID → create or restore → select gender when creating → Kai Pulse character reveal → enter the world

The reveal is ceremonial but concise and can be skipped after generation completes.

## 8. Public player profiles and vaults

Every player has a shareable profile at `wildz.quest/@username`. Opening that URL loads the persistent world shell and presents the profile as an overlay.

The public projection can display:

- username and explorer appearance;
- active companion and selected public cards;
- verified public vault items with ownership, rarity, growth, lineage, and proof links;
- achievements and discoveries;
- battle, raid, team, and league records;
- reputation and public contribution history;
- listings and trade availability;
- bounded recent public activity.

Players can open profiles from world presence, nearby-player UI, multiplayer rooms, challenges, teams, leagues, and marketplace activity.

Privacy controls allow eligible vault items and presence details to be hidden. Private identity data, seal material, recovery details, payment secrets, and non-public artifacts never appear in the public projection. A public profile is a projection over verified truth, not the identity authority itself.

## 9. Receiz SDK, MCP, and AI skills

### 9.1 Authority model

- Proof objects and admitted Receiz history are authority.
- The Receiz SDK is the typed runtime application boundary.
- Receiz MCP is agent tooling over SDK and API rails.
- AI skills are operating doctrine for safe development and operation.
- Local state, React state, server memory, caches, databases, indexers, model output, and MCP output never outrank verified proof.

### 9.2 SDK rails

The implementation will use the smallest applicable official SDK rails for:

- Receiz identity creation, Identity Seal verification, import, and export;
- public profile and vault app-state resolution and publication;
- local-first proof memory and verified addition sync;
- card, vault, ownership, and receipt verification;
- multiplayer and world projections;
- listings, trades, transfers, and settlement;
- offline queues where supported;
- diagnostics and capability checks.

The exact API surface will be confirmed against the installed `@receiz/sdk` version during implementation. Missing atomic capabilities remain visibly unavailable rather than being simulated with weaker authority.

### 9.3 MCP and repository skills

The repository will document the compatible `@receiz/mcp-server` version and provide setup for agent-side diagnostics, conformance checks, public reads, capability inspection, and explicitly approved operations.

Focused Wildz AI skills will teach future agents how to:

- extend gameplay without breaking deterministic or proof boundaries;
- add character traits while preserving generator versioning;
- operate and diagnose public profiles and Vault recovery;
- add marketplace functionality with confirmation, idempotency, and audit receipts;
- verify feature parity, mobile behavior, PWA readiness, and release evidence.

MCP may inspect or invoke permitted rails but cannot silently publish, trade, settle, transfer, or mutate public state. Actions with external consequences require explicit user confirmation and auditable results.

## 10. Gameplay feature parity

The standalone extraction preserves the current upstream Wildz product loop, including:

- streamed large-world exploration and floating-origin movement;
- authored geography, biomes, landmarks, map, and rift travel;
- encounters, proximity discovery, capture, and reward reveal;
- living cards, inventory, growth, training, transformation, lineage, and portable artifacts;
- missions, battles, boss encounters, raids, world events, and progression;
- multiplayer presence, invitations, challenges, messaging, teams, and leagues;
- public profiles, Vaults, card pages, and sharing;
- adaptive quality profiles, presentation effects, audio, and accessibility behavior;
- Receiz-backed world, identity, proof, ownership, and social-state recovery;
- embedded listings, offers, direct trades, purchases, and Receiz settlement.

A feature may be intentionally changed only when required by the approved standalone interaction model, branding, security, or an unavailable official Receiz capability. Every intentional deviation is documented and verified.

## 11. PWA behavior

Wildz is installable on supported mobile and desktop browsers and uses:

- a complete web app manifest branded for Wildz;
- maskable and standard icons derived from the approved logo;
- standalone display mode and appropriate theme/background colors;
- dynamic viewport and safe-area handling;
- an application-shell cache and bounded asset caching;
- offline startup from the last verified local state;
- explicit online, pending, and verified-state indicators where authority matters;
- update detection that does not reload during active gameplay without consent;
- recovery from stale or failed service-worker updates;
- orientation and resize handling without losing game state.

Offline behavior never invents shared-world truth. Canonical multiplayer, listing, payment, transfer, ownership, ranked, and reward mutations remain pending or unavailable until admitted by the required Receiz rail.

## 12. Error handling and reconciliation

- Failed payments never grant ownership or competitive benefit.
- Duplicate payment, listing, trade, and world commands use idempotency keys and return the admitted result when available.
- Conflicting trades resolve against current verified ownership.
- Optimistic UI is clearly pending and rolls back cleanly after rejection.
- Failed public-profile or Vault recovery falls back to the last verified local prefix with a visible status.
- Failed Identity Seal or Vault imports do not mutate the active identity.
- Reconciliation previews show what identity, progression, cards, appearance, and ownership state will change before adopting imported state.
- Unsupported Receiz capabilities remain locked with an actionable explanation.
- Low-power devices receive adaptive visual quality without different rules, odds, movement, or competitive outcomes.
- PWA updates preserve active state and prompt before disruptive reloads.

## 13. Accessibility and mobile quality

Wildz supports:

- minimum practical touch targets and safe spacing;
- one-handed primary movement and context actions;
- keyboard movement and action controls on desktop;
- reduced-motion presentation without changing game rules;
- readable contrast over varied world backgrounds;
- accessible names and states for all HUD controls and overlays;
- focus containment and return for sheets and dialogs;
- non-color-only status communication;
- fallback communication for audio-dependent cues;
- responsive fit for representative small phones, modern iPhones and Android devices, tablets, and desktop.

## 14. Verification strategy

### 14.1 Automated verification

- TypeScript typecheck and production build.
- Unit tests for deterministic reducers, character genesis, appearance digests, Vault reconciliation, and Kai Pulse inputs.
- Contract tests for identity, proof, ownership, profile, listing, trade, payment, multiplayer, and world routes.
- Tests for idempotency, rejected mutations, privacy filtering, secret handling, and stale revision conflicts.
- PWA manifest, icon, service-worker, cache, offline-start, and update tests.
- Route tests for `/`, `/@username`, card deep links, and invite links.
- Upstream parity tests adapted for the standalone boundaries.

### 14.2 Browser and game verification

- First-run automatic identity and create/restore flow.
- Identity Seal export/import and cross-device restoration.
- Portable Vault restore and ownership reconciliation.
- Deterministic character regeneration from the same admitted inputs.
- Movement, camera, exploration, encounter, capture, battle, mission, progression, failure, and restart paths.
- Public profile, privacy, Vault, card, and deep-link overlays.
- Listing, offer, direct trade, purchase, cancellation, failure, and receipt flows.
- Multiplayer presence, challenge, team, league, raid, and world recovery.
- Offline startup, reconnection, pending-state admission, installation, rotation, safe areas, and PWA updates.
- Desktop and mobile console checks, nonblank 3D canvas evidence, responsive screenshots, renderer diagnostics, and performance traces.

Representative verification targets include a small mobile viewport, current iPhone-class viewport, current Android-class viewport, tablet, and desktop. Reduced-motion and constrained-device quality profiles are included.

### 14.3 Visual acceptance

The implementation is compared directly with the current upstream Wildz reference and the approved Wildz brand concept. Acceptance requires:

- no commerce or website framing around gameplay;
- world-first visual hierarchy;
- intact upstream game identity and feature readability;
- consistent Wildz logo and brand application;
- market, profile, Vault, identity, and settings surfaces that remain secondary to play;
- no clipped controls, unsafe-area collisions, unreadable overlays, or material responsive regressions.

## 15. Completion criteria

The standalone application is complete when:

- the full approved gameplay and social feature set is present;
- automatic Receiz identity, character genesis, restore, public profile, and public Vault flows work;
- the seamless market supports verified listings, offers, trades, purchases, and receipts;
- Wildz branding, SVG logo, manifest, metadata, and install assets are complete;
- commerce-only routes and product surfaces are absent;
- feature-parity deviations are documented;
- production build, typecheck, automated tests, browser playthroughs, mobile screenshots, canvas evidence, console checks, and performance diagnostics pass;
- no unresolved critical security, ownership, payment, identity, PWA, or feature-parity defect remains.

## 16. Receiz builder summary

**Primitive carried:** Receiz identity, portable Wildz Vault, living-card proofs, ownership, public player projections, canonical world and multiplayer state, listings, trades, settlement receipts, and deterministic character genesis.  
**Source of truth:** Verified proof objects and admitted Receiz history ordered by the applicable Kai Pulse coordinates.  
**SDK rails used:** Identity, proof memory, verification, app state/public projections, world/multiplayer state, ownership, transfer, settlement, offline queue, and diagnostics as supported by the installed SDK.  
**MCP rails used:** Agent diagnostics, conformance, capability inspection, public reads, and explicitly confirmed operations only.  
**First-paint plan:** Load the PWA shell and last verified local prefix immediately, then reconcile verified additions without blocking the game on unrelated session or commerce reconstruction.  
**Append/enrichment plan:** Submit bounded, idempotent intents through same-origin Wildz services; admit proof-native truth first; project UI and indexes afterward.  
**No-db boundary:** Operational caches or indexes may accelerate discovery but cannot become authority for identity, cards, ownership, world outcomes, profiles, listings, trades, or payments.  
**User confirmation needed:** External publish, trade, transfer, settlement, destructive reconciliation, and other consequential actions.  
**Checks to run:** Typecheck, production build, automated contracts, identity and Vault restoration, deterministic genesis, gameplay parity, market settlement, PWA, accessibility, browser playthroughs, mobile visual QA, and performance diagnostics.
