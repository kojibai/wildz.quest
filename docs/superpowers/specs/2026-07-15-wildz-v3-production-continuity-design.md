# Wildz V3 Production Continuity Design

Date: 2026-07-15  
Status: Design approved; written-spec review required before implementation planning  
Product: Wildz  
Canonical domain: `wildz.quest`  
Selected approach: V3 kernel migration under the accepted standalone Wildz UI

## 1. Decision and precedence

Wildz will retain its finished full-screen mobile presentation and replace the remaining incomplete or divergent game, identity, continuity, world, and release behavior with the authoritative Receiz Commerce Wilds V3 behavior.

This specification extends the existing standalone and reference-gameplay designs. Where they conflict, this document controls. In particular, it replaces the earlier rule that every Vault is non-authoritative. The new rule is content-based:

- a cryptographically verified identity-bearing Vault restores the identity embedded in that Vault and the owner-coherent player state;
- a cryptographically verified Identity Seal restores the identity embedded in the Seal;
- a legacy card-only Vault restores verified cards but cannot authenticate an identity it does not contain.

The approved work is one release program divided into dependency-ordered slices. A slice is not complete merely because its source files were copied; its adapted tests, standalone integration, browser behavior, and release evidence must pass.

## 2. Product outcome

Wildz is a standalone, installable, one-application PWA whose primary surface is the full-screen living game world. It includes the complete Wilds V3 gameplay program, owner-bound portable continuity, verified public cards and profiles, and the narrow Receiz rails required by the game. It does not include the Receiz Commerce storefront, merchant dashboard, content management, page builder, catalog administration, or general commerce navigation.

The experience must satisfy these outcomes:

1. A valid Vault image containing Receiz identity authority logs the player into that embedded identity and restores its complete compatible Wildz continuity.
2. A valid Identity Seal image logs the player into the identity embedded in that Seal and recovers owner-scoped Wildz state when available.
3. The app contains every V3 gameplay slice, including settlements, ecology, global bosses, raids, social systems, mastery, crafting, lineage utility, narrative memory, and final V8 continuity.
4. The accepted portrait-first world, HUD, battle telemetry, six-slot command dock, field guide, satchel, creature artwork, and compact social deck remain visually intact unless a V3 feature requires a targeted addition.
5. Every owned card is reachable in the horizontal companion rail and the Card Vault provides consistent rarity, newest, and oldest ordering.
6. The installed application starts offline from last verified local state and never fabricates canonical multiplayer, ownership, settlement, or ranked truth.
7. Production behavior fails closed when a required remote Receiz capability or credential is unavailable.

## 3. Source authority and migration boundary

### 3.1 Pinned source

The feature baseline is the upstream `v3.0.0` tag:

- baseline before the V3 program: `fb366506e218d82ecac20c60bc74c5977627713e`;
- V3 tag: `1cf84c0154b8cba45b0c0730dc0752235f758be8`;
- audited post-tag Wildz fixes: public `main` through `a9b0f0eaef4af894efd052e40f09299244c4ffd4`.

V3 feature completeness is measured against the tag. Post-tag changes may be included only when the parity ledger identifies them as Wildz-only fixes or compatibility corrections. Storefront and merchant changes are excluded.

The tagged V3 delta contains 53 Wilds runtime files, 34 relevant tests, and one net-modified route. Locally, only `wilds-competition.ts` and its test are already byte-identical among the V3 additions. The remaining V3 files must be ported or deliberately adapted.

### 3.2 Preservation rule

Existing modified files belong to the accepted standalone experience and must not be overwritten wholesale. This particularly applies to:

- `app/globals.css`;
- `PlayCampaign.tsx`;
- `WildsBattle.tsx`;
- `WildsCommandDock.tsx`;
- `WildsCreatureThumbnail.tsx`;
- `WildsWorldCanvas.tsx`;
- `WildzSocialDeck.tsx`;
- their current contract tests.

Pure upstream domain modules may be ported directly when their imports remain standalone-safe. Presentation and orchestration files must be merged behaviorally into the current Wildz composition.

### 3.3 No duplicated authority

Receiz proof, SDK identity projection, admitted world history, and admitted ownership are authoritative. React state, browser storage, process memory, caches, databases, MCP output, and model output are projections or working state only.

No UI component may invent a second identity, progression, battle, market, or world rule. Components consume selectors and emit typed commands into the relevant boundary.

## 4. Target architecture

The implementation is divided into focused boundaries:

- **Identity repository:** imports, verifies, stores, activates, and exports Receiz identity authority without exposing private material to UI code.
- **Portable artifact codec:** identifies Identity Seals, identity-bearing Vaults, V3 player Vaults, legacy card Vaults, and incompatible artifacts from their contents rather than filename or selected button.
- **Continuity coordinator:** stages identity and player-state reconciliation, then commits them atomically under an owner-scoped storage key.
- **Receiz session bridge:** restores the upstream OIDC and artifact-proof session paths required for remote publication and canonical commands.
- **V3 domain kernel:** deterministic settlements, ecology, bosses, raids, social systems, mastery, crafting, lineage, narrative, world events, replay, and save migration.
- **World repository:** narrow standalone persistence/publication interface backed by Receiz capabilities, with local-practice mode clearly separated from canonical mode.
- **Presentation adapters:** project V3 state into the accepted Wildz canvas, HUD, dock, sheets, social deck, audio, and interaction controls.
- **Public projection boundary:** publishes and reads verified public cards, player profiles, ownership, activity, and shareable URLs without exposing identity authority.
- **PWA and release boundary:** service worker, install assets, security headers, accessibility, performance budgets, diagnostics, and release evidence.

Large integration components should be reduced through selectors, hooks, and coordinators as required by these boundaries. Refactoring outside these seams is excluded.

### 4.1 Receiz SDK, MCP, and repository skills

The installed `@receiz/sdk` `100.0.0` is the runtime boundary for Receiz identity creation, identity artifact parsing and projection, login proofs, public proof registration, verification, sealing, app-state publication, and capability diagnostics. Code may wrap those primitives behind standalone interfaces but may not replace their proof decisions with filename checks, display metadata, locally invented ownership, or model judgment.

The standalone identity-player binding described below is not a new identity authority. It is a small evidence envelope whose challenge is signed and verified with the official SDK identity-login proof primitive. The underlying SDK identity artifact and V3 player Vault must each pass their own source validators.

Receiz MCP is an operator and agent boundary over the same SDK/API rails. It may inspect capabilities, verify public artifacts, run diagnostics, and perform explicitly approved operations. It does not silently publish, transfer, list, purchase, settle, rotate credentials, or replace local verified identity. MCP output remains a projection and never outranks proof.

The repository's `ai-skills/wildz-builder-skill` and `ai-skills/wildz-release-skill` are release doctrine: preserve deterministic generation and append-only history, test gameplay laws before UI, require confirmation for destructive or public actions, never expose identity secrets, and collect fresh release evidence. They must be updated when new V3 or combined-Vault invariants become part of the product.

Browser SDK clients use an explicitly bound fetch implementation. The existing Safari-safe `fetchImpl: (input, init) => window.fetch(input, init)` correction is preserved and covered by a regression test.

## 5. Identity, Vault, and Seal behavior

### 5.1 Content-aware classification

Every artifact import uses one byte buffer and independently attempts the applicable verified readers:

1. enforce supported MIME, PNG signature where applicable, and bounded file size;
2. call the installed Receiz SDK `readReceizIdentityArtifact` and `projectReceizIdentityAccount`;
3. require a valid key file and reject an invalid portable-state signature when portable state is present;
4. call the V3 `verifyPortableVaultPng`, retaining its `assets` and `player` result;
5. fall back to verified V1/V2 Vault or single-card readers;
6. inspect supported Receiz Commerce Vault projection data without treating an unverified display projection as identity authority;
7. derive one explicit classification from the verified results.

The classifications are:

- `identity-player-vault`: verified Receiz key authority plus a verified V3 player Vault;
- `identity-seal`: verified Receiz key authority without a V3 player Vault;
- `player-vault`: verified V3 player Vault without embedded identity authority;
- `card-vault`: verified cards without a player payload or identity authority;
- `unsupported` or `invalid`: no admissible proof combination.

The action label never overrides the bytes. Uploading a Vault through the Seal action or a Seal through the Vault action still produces the correct content-based behavior.

Receiz Commerce, receiz.app, Signal, sealed-card, original Wildz, and future SDK-compatible images use the same classifier. When an artifact contains verified Receiz identity authority, that identity is used. Only verified Wildz/card domains enter gameplay inventory; unrelated portable domains remain attached to the identity projection and are never fabricated into game cards.

### 5.2 Identity-bearing Vault format

Upstream V3 stores identity authority and player continuity as separate proof layers. The standalone canonical Vault combines them while keeping both source validators usable.

The canonical export pipeline is:

1. render the Wildz Vault PNG artwork;
2. embed `receiz.wilds_vault_png_proof.v3` before PNG `IEND`, including cards and `receiz.wilds_player_vault.v3`;
3. obtain the Receiz document seal when that capability is available and verify that the returned PNG still contains the V3 proof;
4. append the official SDK identity artifact trailer after `IEND`;
5. append a `receiz.wildz_identity_binding.v1` trailer containing the identity key ID, player ID, V3 Vault digest, player payload digest, signing time, challenge, and SDK identity signature.

The binding challenge is a canonical encoding of the key ID, player ID, Vault digest, and player payload digest. It is signed with the embedded identity through the SDK login-proof primitive. Import must decode the challenge, recompute the canonical value, verify the signature with the embedded key file, and require all owner fields to agree.

This composition has three compatibility properties:

- the V3 Vault reader can read the proof chunk before `IEND`;
- the Receiz SDK identity reader can read its official trailer after `IEND`;
- the standalone binding reader proves that the two independently valid layers belong together.

An export that cannot create the identity binding is not presented as an identity-bearing Vault. It may be exported only as a clearly labeled player/card Vault.

### 5.3 Restore transaction

Import is staged before any active state changes:

1. inspect and classify;
2. verify identity, portable state, cards, player digest, and identity binding where present;
3. derive the SDK account owner and candidate Wildz actor ID;
4. require the V3 `playerId`, identity owner, binding owner, and destination owner-scoped key to agree;
5. load the current canonical projection when online or the last verified projection when offline;
6. run `reconcileWildsPlayerVault` against a staged local state;
7. prepare the identity record, public session descriptor, full V8 game state, settings, events, receipts, and canonical cursor;
8. commit them in one IndexedDB transaction;
9. activate the new in-memory identity and render the success state;
10. establish or refresh the remote Receiz session when reachable.

If any verification, owner check, migration, storage transaction, or activation step fails, the previously active identity and game state remain unchanged. A remote session outage does not invalidate locally verified artifact authority; it sets remote state to `pending` or `offline` and disables remote-only mutations until admitted.

### 5.4 Exact import behavior

- **Identity-bearing Vault:** activate the embedded identity, restore and reconcile the embedded V3 player continuity, then load that owner in the game.
- **Identity Seal:** activate the embedded identity, then load its owner-scoped local state and recover compatible verified portable state. It never imports unrelated cards by inference.
- **V3 player Vault without identity:** accept only when its `playerId` matches the already active verified identity. Otherwise request the matching Identity Seal or identity-bearing Vault.
- **Legacy V1/V2 card Vault:** merge verified cards into the active owner's inventory after explicit confirmation. It never changes identity.
- **Invalid or tampered artifact:** show a specific human-readable reason and mutate nothing.

### 5.5 Identity persistence and sessions

Plaintext Receiz key files and raw private key material are forbidden in `localStorage`, logs, analytics, error payloads, screenshots, model prompts, MCP output, and public projections.

The browser identity repository stores:

- a public session descriptor containing key ID, owner projection, handle, and status;
- the key file encrypted in IndexedDB with AES-GCM under a non-extractable Web Crypto wrapping key stored through IndexedDB structured clone;
- decrypted key material only in memory for the shortest signing or export operation that needs it.

The existing plaintext `wildz:receiz-identity:v1` record is migrated once, verified, moved into the protected repository, and removed only after a successful transaction. Identity switch and logout clear in-memory references.

Remote authority uses the source-compatible Receiz routes and session model:

- `/api/auth/receiz/start`;
- `/api/auth/receiz/callback`;
- `/api/auth/receiz/complete`;
- `/api/auth/receiz/me`;
- signed artifact challenge/continuation where supported;
- secure, `HttpOnly`, same-site cookies for remote session state.

Local artifact login and remote OIDC/session status are displayed separately so offline local authority is never misrepresented as an active remote session.

## 6. Owner-scoped continuity

### 6.1 V8 save model

The game migrates from local schema V5 to tagged V3 schema `receiz.wilds.save.v8`, accepting V2 through V7 inputs. It retains inventory, progression, explorer appearance, active companion, movement and audio preferences, civic receipts, ecology knowledge, raid receipts and history, personal events, achievements, canonical cursor, and every other V8 field defined by the source.

The existing global `receiz:wilds:save:v2` browser key becomes migration input only. New persistence is keyed by verified identity key ID and actor ID. A legacy save is claimed once by the identity active during migration, recorded with a migration marker, and never silently shared with another identity.

### 6.2 Player Vault reconciliation

The source V3 `receiz.wilds_player_vault.v3` contract is retained:

- payload digest verification;
- owner binding;
- normalized full `PlayState`;
- avatar, movement, and audio settings;
- bounded personal events and receipts;
- canonical world cursor;
- deterministic inventory merge and duplicate elimination;
- stale and ahead-of-canonical warnings.

Restoration never rolls canonical state backward. An ahead cursor remains locally marked as synchronization pending until the canonical repository confirms it.

### 6.3 Public card continuity

The standalone identity session must feed the existing public-card registration boundary. Exported card QR URLs and copied links must resolve on a second device through the public proof route. The canonical card path is `/cards/[assetId]`; `/c/[assetId]` remains a compatible alias so existing generated QR codes do not fail.

## 7. V3 gameplay program

### 7.1 Domain kernel first

Pure contracts and tests are ported before presentation integration:

- civic history and route memory;
- settlements and landmark civilization;
- ecology grammar, activity, history, privacy, and mastery;
- boss ecology, raid roles, rounds, encounters, and history;
- social core and competition;
- card mastery taxonomy, crafting, lineage utility, and portable reconciliation;
- narrative memory;
- player Vault and V8 save migration.

The existing `wilds-competition.ts` implementation is retained unless an adapted integration test proves a compatibility change is required.

### 7.2 World contract

World events, state, record, service, and standalone repository are migrated together before UI consumers. The server exposes canonical and local-practice modes explicitly and preserves deterministic replay, checkpoint validation, bounded histories, revision monotonicity, rollback after publication failure, verified-card authority, ecology ticking, raid leases, retreat, social administration, and privacy projections.

The snapshot seam is atomic: V3 `worldSnapshot()` returns `{ projection, mode }`, the snapshot route spreads that response, and `use-wilds-world.ts` consumes that exact shape. The server, route, and client hook must land together so the response cannot become double-nested.

The client hook uses bounded two-second polling, abort cleanup, revision rollback prevention, typed commands, and the active verified card for actions that require it.

### 7.3 Settlements

Wayfinder Hollow and the full settlement slice are integrated into the existing world:

- five districts and three residents;
- physical discovery and entry;
- services, card attunement, and deterministic route puzzles;
- civic receipts, reputation, monuments, and civic-history replay;
- atlas, map, environment, audio, context actions, and V8 continuity.

### 7.4 Dynamic ecology

The complete ecology slice includes all eight source families: market, ruin, portal, festival, migration, bloom, stormfront, and distress. It retains deterministic bounded placement, lifecycle and descendants, private rumor knowledge, physical discovery, contribution authority, causal child and aftermath events, receipts, atlas projection, ecology mastery, and history.

Presentation renders no more than two detailed ecology manifestations simultaneously and uses the accepted shared-canvas quality profile.

### 7.5 Global bosses and raids

The complete boss program includes:

- eight boss families with deterministic anatomy, territory, tracking, successors, and memorial state;
- recurring semantic raid rounds, telegraphs, hazards, and card-derived roles;
- leases, reconnect, retreat, rotation, squad assembly, and support capacity;
- typed action intents, achievements, knowledge, receipts, history, and durable consequences;
- atlas, Rift, environment, audio, action-dock, and experience integration.

Only one detailed boss renderer is active at a time. V3 raid commands extend the accepted six-slot Wildz command dock rather than replacing it with the upstream commerce-shell presentation.

### 7.6 Social, mastery, crafting, and narrative

The final slices include team creation, invitations, roles, scheduled events, six-player squads, abuse reporting, newcomer protection, Genesis League scoring, mastery roles, regional utility, loadout synergy, XP and levels, competitive normalization, boss artifacts, crafting, lineage utility, portable record reconciliation, regional seasonal story, recurring characters, historical atlas layers, return continuity, celebrations, and memorials.

These systems appear through the current Wildz dock, field guide, satchel, profile, social deck, and focused full-screen experiences. No general commerce page or dashboard is introduced.

### 7.7 Trail Pack and Wilds Heartbeat

The existing fifth dock slot remains the game-native Trail Pack / Wilds Heartbeat rather than a duplicate active-card list. It provides:

- one active leader and two support companions;
- verified artwork, element, level, evolution, power, bond, mood, role, trait, and owner context from real state;
- deterministic pack synergy affecting scouting, battle support, capture, recovery, or discovery through V3 mastery and lineage rules;
- bounded companion reactions to biome, encounter, energy, ecology, boss, raid, and recent events;
- a memory trail for captures, battles, transformations, landmarks, lineage, civic history, raids, and bonding;
- world whispers projected from admitted ecology, narrative, settlement, and memorial history;
- optional visible support-companion presence subject to the existing renderer budget.

The quick card rail changes the active leader. The Trail Pack manages party relationships, support composition, mood, memory, and synergy. Neither surface stores a second progression model.

### 7.8 Six-slot dock contract

The accepted six slots remain unique and in this order: Card Vault, Field Guide, Player Profile, Social Market, Trail Pack / Wilds Heartbeat, and Foraging Satchel. V3 interactions extend these sheets or open a focused game experience; they do not reintroduce redundant map, active-deck, merchant-rewards, or commerce navigation. Opening any sheet preserves dark safe-area coverage in mobile Safari.

## 8. Card rail and Card Vault ordering

`nearbyCards.slice(0, 4)` is removed. The companion rail renders the complete owned-card sequence in a horizontally scrollable, touch-friendly, keyboard-operable list. It uses bounded card widths, scroll snapping, visible focus, and no hidden pagination cap. The active companion is expressed with `aria-pressed` and remains visible after ordering changes.

Every rail card uses its generated card-character artwork and verified status. Level, evolution, element, power, bond, owner, trait, and temperament come from the card manifest and saved companion progress. List position, capture order, sorting, or import order must never synthesize or change these values.

A shared pure ordering module is used by both the horizontal rail and Card Vault. It never mutates the inventory array. Supported modes are:

- `rarity`: Eternal, Mythic, Rare, Uncommon, Trail;
- `newest`: `manifest.capturedAt` descending;
- `oldest`: `manifest.capturedAt` ascending.

Every mode uses `asset.id.localeCompare` as its deterministic final tie-breaker. Invalid dates sort after valid dates and then by asset ID. `capturedAt` means original capture/acquisition time, not Vault import time. Rarity is the default mode. The selected order is stored per identity as a display preference.

The compact control uses an accessible select or segmented popover appropriate to the current deck width. Changing order does not change ownership, active companion, or source inventory order.

## 9. Persistent app shell, profiles, sharing, and game economy

Wildz remains one continuous application shell. Technical deep links open overlays or focused experiences over the same shell and return to the unchanged world state when dismissed.

Profile controls include compact native Share and Copy Link actions:

- Share calls `navigator.share` when supported and falls back to clipboard copy;
- Copy Link always writes the canonical public URL;
- canonical profile URLs use `/u/[handle]` with compatible aliases retained where already published;
- success, cancellation, denial, and unavailable states are announced accessibly;
- control animations respect reduced-motion preferences.

Card sharing uses `/cards/[assetId]` with `/c/[assetId]` compatibility. Public URLs expose verified projections only.

The in-game market is retained only as a Wildz gameplay surface. Process-memory listings, client-asserted actors, and checkout responses that never settle ownership cannot ship as production authority. Listing, purchase, trade, and cancellation must use authenticated actors, verified ownership, idempotency, Receiz receipts, and durable ownership append. If those capabilities or deployment credentials are absent, the UI reports the feature unavailable and performs no simulated transfer.

## 10. PWA, security, accessibility, and performance

### 10.1 PWA

The service worker provides a versioned application shell, required first-start assets, offline startup from last verified local state, navigation fallback, activation cleanup, `clients.claim`, and a consent-aware update flow that does not reload active gameplay unexpectedly. The manifest, maskable icons, Apple touch icon, theme colors, launch metadata, and standalone display behavior use Wildz assets.

Offline mode permits local exploration and owner-scoped verified state. Canonical world commands, multiplayer, public publication, market mutations, ownership changes, ranked results, and settlement remain pending or unavailable until admitted remotely.

### 10.2 Security

Production responses include an environment-appropriate Content Security Policy, `X-Content-Type-Options: nosniff`, frame restrictions, strict referrer policy, and a minimal permissions policy. Artifact and seal proxies enforce request size, MIME/signature validation, timeouts, bounded responses, safe errors, and rate limits where a durable deployment facility is available.

Environment files are ignored by default, secret scanning covers supported key and token formats, and secrets never enter client bundles. Remote routes derive the actor from the authenticated session rather than request JSON.

### 10.3 Accessibility and mobile behavior

- Primary actions are at least 44 by 44 CSS pixels.
- Dialogs and sheets trap focus where appropriate, restore focus on close, and support Escape.
- Terrain scanning and world actions have keyboard equivalents.
- The viewport permits user zoom; gameplay layout must tolerate zoom rather than disabling it.
- Safe areas are verified at 320 by 568, 390 by 844, and 430 by 932 CSS pixels.
- Reduced motion, high-contrast readability, accessible names, and live status announcements are required.

### 10.4 Performance

The accepted adaptive quality profile remains authoritative. The V3 limits include at most one detailed boss, at most two detailed ecology manifestations, bounded polling and histories, disposed Three.js resources, heading-change thresholds, and camera-relative movement. Production diagnostics do not poll every 500 milliseconds.

The release target is no blank canvas, no relevant console error, no horizontal overflow, responsive first paint before decorative assets complete, and renderer budgets documented in release evidence. Bundle growth must be measured and large optional experiences loaded on demand where doing so does not break world continuity.

## 11. Error and status model

User-facing restore errors map stable codes to clear recovery actions. At minimum they distinguish:

- missing identity payload;
- invalid or oversized identity artifact;
- invalid portable-state signature;
- invalid or duplicate card proof;
- invalid V3 player digest;
- invalid identity-player binding;
- owner mismatch;
- unsupported legacy schema;
- storage transaction failure;
- remote session unavailable;
- canonical cursor stale or synchronization pending.

No error includes key material or raw artifact content. Recoverable remote failures preserve locally verified identity and state while disabling the affected remote action. Tamper, owner, or binding failures preserve the previously active session without importing partial state.

## 12. Test and evidence strategy

Implementation follows test-first development at each boundary.

### 12.1 Automated contracts

The adapted V3 suite includes all relevant tagged tests plus standalone-specific contracts for:

- SDK-generated Identity Seal PNG import and visible identity activation;
- combined identity-bearing Vault export, cold import, login, V8 restoration, and owner coherence;
- passphrase-protected and unprotected SDK identities;
- binding, player payload, card, image, and owner tampering;
- foreign-player V3 Vault rejection without the matching identity;
- V1/V2 card Vault compatibility;
- migration of plaintext legacy identity and global V2–V5 saves without cross-owner leakage;
- cold restart under the restored owner;
- public card publication and second-device QR recovery;
- exact `{ projection, mode }` snapshot shape and revision monotonicity;
- settlements, ecology, bosses, raids, social, mastery, crafting, lineage, and narrative behavior;
- complete card rail rendering and deterministic rarity/newest/oldest sorting;
- Share and Copy Link success and fallback behavior;
- offline, pending, capability-unavailable, and admitted states;
- security headers, artifact bounds, focus lifecycle, safe areas, and PWA update behavior.

Identity fixtures are generated ephemerally during tests. Real user private artifacts are never committed. Source-compatible sanitized fixtures may be committed only when they contain no reusable private authority.

One previously working private Receiz Vault supplied outside the repository must pass the final browser restore journey before the release can claim historical real-artifact compatibility. It is inspected locally without logging or committing its private payload. If that artifact is not available, format-level compatibility can pass, but the historical-artifact claim remains an explicit release blocker.

### 12.2 Browser qualification

Production browser testing exercises a fresh install and cold restart in WebKit and Chromium:

1. automatic identity creation;
2. Identity Seal export and restore;
3. identity-bearing Vault export, identity switch, restore, and relaunch;
4. movement, capture, battle, settlement, ecology, boss tracking, raid actions, social actions, and continuity;
5. all-card rail scrolling and each sort mode;
6. profile share/copy and card deep links;
7. offline startup and reconnection;
8. tampered artifact and remote-capability failure;
9. service-worker update recovery;
10. supported mobile viewports and desktop renderer profiling;
11. direct visual comparison of the final 390 by 844 state with the approved reference hierarchy and safe-area composition.

### 12.3 Release commands and evidence

The missing release scripts are restored. The final candidate must pass, from the final tree:

- complete unit and integration tests;
- type checking;
- lint;
- production build;
- secret scan;
- Receiz SDK doctor and configured capability checks;
- release contract and PWA checks;
- mobile WebKit/Chromium journeys;
- direct auth, world, card, profile, and market API probes;
- renderer, bundle, offline, accessibility, and overflow evidence.

Upstream V3's historical qualification does not qualify this standalone repository. Evidence is regenerated against the final Wildz commit and records any environment-gated capability explicitly.

The completed implementation is committed on `main` without pushing. Push remains the user's action.

## 13. Dependency-ordered delivery

The implementation plan must preserve this order:

1. identity repository, artifact classifier, source-compatible Identity Seal PNG, auth routes, and session bridge;
2. V8 save migration, V3 player Vault, combined Vault binding, atomic restore, and identity-scoped persistence;
3. public-card session bridge, deep-link compatibility, public profile sharing, and durable game-economy authority;
4. pure V3 domain modules and tests;
5. world event/state/record/service, standalone world repository, snapshot route, and client hook as one contract;
6. settlements and civic history integration;
7. ecology integration;
8. global boss and raid integration;
9. social, mastery, crafting, lineage, competition, and narrative integration;
10. all-card rail and shared Card Vault ordering;
11. PWA, security, accessibility, performance, documentation, and release evidence.

Each step begins with failing tests, ends with its focused tests passing, and preserves the accepted standalone presentation. Broad file replacement, hidden fallback data, simulated remote success, and release claims based only on upstream evidence are prohibited.

## 14. Completion definition

The program is complete only when all of the following are true:

- a valid identity-bearing Vault logs in as its embedded identity and restores complete compatible V3 continuity after a cold restart;
- a valid Identity Seal logs in as its embedded identity and owner-scoped state remains isolated;
- mismatched or tampered artifacts import nothing;
- every tagged V3 gameplay slice is present, integrated, and covered by adapted tests;
- the accepted fullscreen Wildz presentation remains intact and all V3 actions are reachable;
- every owned card is reachable and both card surfaces implement the same deterministic sort contract;
- profile Share, Copy Link, card QR links, and public recovery work across devices;
- the six-slot dock, Trail Pack / Wilds Heartbeat, real card projections, D-pad, minimap, Safari-safe fetch, and dark mobile safe areas remain functional;
- offline and capability-gated states are truthful;
- no client-spoofed identity or process-memory ownership path remains in a production authority role;
- the PWA, security, accessibility, browser, build, and release gates pass against the final standalone commit;
- remaining deployment credentials or external capability requirements, if any, are reported as explicit environment gates and never represented as completed live settlement.
