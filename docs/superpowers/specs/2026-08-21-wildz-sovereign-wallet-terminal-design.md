# Wildz Sovereign Wallet Terminal Design

Date: 2026-08-21  
Status: Approved for V122-bounded implementation  
Scope: One native in-game terminal for verified Phi, resources, creature cards, player-to-player transfer, receipt recovery, and wallet access without leaving the Wildz experience.

## Product intent

Receiz is invisible authority beneath Wildz, never a destination the player must visit. The player opens a tasteful value instrument directly below the Kai Klok and remains inside the living world for balance awareness, recipient discovery, sending, receiving, asset custody, and receipt history.

The expanded surface must feel like a sovereign financial command instrument: official, exact, calm, legible, and trustworthy. It must not look like a crypto wallet, web dashboard, shopping cart, inventory bag, tutorial, or external embedded website. The world remains visible and alive behind the terminal on desktop. On mobile, the terminal owns the safe viewport because financial review requires precision.

## Success criteria

- A connected player can see admitted Phi value from the gameplay HUD without opening a different site.
- A player can open the terminal from the left instrument stack directly below the Kai Klok.
- The terminal supports Overview, Send, Receive, Assets, and Ledger surfaces with one consistent interaction model.
- A sender can resolve a recipient by exact username, review verified identity, select transferable Phi/resources/cards, authorize once, and receive a final proof-bound receipt.
- The terminal never invents balances, recipients, ownership, settlement, availability, or completion.
- Unknown, pending, rejected, and committed states remain visibly distinct and recover exactly after reload, timeout, or device interruption.
- Gameplay movement and frame paths perform zero wallet fetch, verification, transaction planning, hashing, sorting, React state publication, or SDK work.
- Desktop, narrow laptop, tablet, portrait mobile, and landscape mobile remain readable and operable with safe-area and 44 px control floors.
- No token, private key, raw proof object, owner identifier, subject identifier, digest, invited list, or internal authority payload appears in ordinary player UI.

## Experience architecture

### HUD instrument

`WildsBalancedStatusHud` owns a new wallet instrument immediately beneath the Kai Klok inside `wilds-left-instrument-home`. The instrument is a stable-width, two-line control:

- Upper micro-label: `PHI RESERVE` when admitted, `VERIFYING` while resolving, `SECURE` when authorization is required, or `OFFLINE` when only verified cold state is available.
- Primary value: localized Phi with tabular numerals and bounded abbreviation. The exact value remains available to assistive technology and inside the terminal.
- Status light: verified green, pending amber, authority-required neutral gold, failed red, offline blue-gray.
- No USD amount appears on the HUD. Fiat is display-only and belongs inside an expanded detail surface when a verified price basis exists.

The control is hidden only while another exclusive modal owner blocks the status home. It never overlaps the movement control, player focal area, multiplayer cluster, map, or audio control. Opening it claims a new exclusive `wallet` owner through the existing play-shell/modal authority; it cannot coexist with combat, map, market, profile, command center, trainer, reward, or another exclusive surface.

### Terminal geometry

Desktop (greater than 900 px): a left-anchored command terminal occupying `clamp(520px, 46vw, 760px)` and the safe vertical viewport. The world remains visible on the right under a restrained neutral scrim; camera and simulation continue visually, while gameplay input is blocked.

Laptop/tablet: a centered sheet occupying most of the viewport with the same information hierarchy and no nested-card reflow.

Mobile portrait and landscape: a full-screen safe-area terminal. Primary navigation becomes a bottom five-item rail. The confirmation control remains reachable above the bottom safe area. Long content scrolls inside one owned content region; the page itself never scrolls.

Closing restores focus to the exact wallet instrument when still connected and enabled. Escape/back closes only when no authorization or final confirmation is in progress. Viewport, visibility, identity change, and exclusive-owner change cancel uncommitted recipient lookup and selection without discarding an already staged exact transaction.

## Visual system

- Foundation: mineral black and obsidian (`#02070a` through `#081217`) with physical, hairline separators rather than nested cards.
- Value: restrained Phi gold (`#f1cf67`) used only for admitted amounts and the final authorization action.
- Verification: mineral green (`#69d7b2`) used for authenticated identity, exact receipt, and committed state.
- Pending: amber; rejected/invalid: restrained red; offline retained truth: desaturated blue-gray.
- Typography: existing Wildz display face for titles; a highly legible system sans for instructions; tabular monospaced numerals for amounts, sequence, time, and receipt coordinates.
- Geometry: exact grid, etched rules, security ticks, fixed numeric columns, and one subtle Phi seal motif. No generic bank cards, token coins, neon crypto gradients, fake code rain, or decorative hashes.
- Motion: 120–220 ms state transitions, restrained count changes, and one short verification sweep. Reduced-motion produces instant state changes. Motion never delays input or authority results.
- Sound: optional existing interface cues for open, recipient verified, staged, committed, and rejected. Financial state is never communicated by sound or color alone.

## Terminal anatomy

### Persistent header

- Phi seal and `WILDZ SOVEREIGN TERMINAL`.
- Current verified username and privacy-filtered profile mark.
- Authority state: `VERIFIED`, `AUTHORIZATION REQUIRED`, `OFFLINE VERIFIED`, `RECOVERY PENDING`, or `UNAVAILABLE`.
- Close control with a 44 px minimum target.

Internal identifiers and proof coordinates remain hidden behind a deliberate advanced receipt-details disclosure; even that disclosure exposes only privacy-safe receipt coordinates.

### Overview

- Admitted Phi balance, with display-only USD equivalent only when the SDK supplies a verified price-basis head.
- Transferable resources grouped by canonical resource type.
- Transferable creature-card count and reserved/non-transferable count.
- Pending transaction strip with explicit recovery state.
- Latest three verified ledger entries.
- Primary `Send` and `Receive` actions.

The overview is a hierarchy of open bands and ledger rows, not a dashboard grid of generic cards.

### Send

The send flow is a deterministic state machine:

1. **Recipient** — exact username entry, debounced server lookup outside gameplay, explicit search submit on constrained networks, and privacy-safe verified result.
2. **Assets** — Phi, resources, or cards. Only admitted transferable availability appears. Reserved, injured/locked, listed, pending, private, or otherwise ineligible assets explain their status but cannot be selected.
3. **Review** — recipient portrait/name, itemized exact assets, fees if admitted, final resulting availability, authority source, and expiration.
4. **Authorize** — one deliberate hold/press or biometric-capable authorization action. Ordinary click cannot bypass review.
5. **Receipt** — committed, zero-write rejected, or recovery-pending. A committed receipt is permanent; a pending exact attempt can be resumed but never regenerated silently.

Phi cannot be bundled atomically with cards/resources unless an SDK-custodied transaction proves every participant/value/world effect is one atomic operation. Until then the terminal requires separate clearly labeled transfers rather than implying atomicity.

### Receive

- Verified username rendered as a copyable player coordinate.
- Local QR/deep-link representation containing only a public recipient locator, never a bearer token or proof secret.
- Optional request composer for Phi, a canonical resource type/quantity, or a specific publicly transferable card.
- Requests are non-authoritative proposals. They move no value and reserve no asset until the owner accepts through a separate reviewed transfer.
- Sharing invokes the platform share surface only after explicit user action.

### Assets

- Phi: available, reserved, pending, and total admitted value.
- Resources: canonical type, admitted quantity, transferable quantity, location/subject binding when relevant.
- Cards: exact creature art, name, level, condition, transfer eligibility, listing/reservation state, and owner-bound proof status.
- Selection uses one shared transfer composer. Cards never become generic thumbnails divorced from their exact identity.
- No derived preview or local inventory count can outrank current admitted wallet/subject state.

### Ledger

- Ordered immutable rows for sent, received, pending, committed, rejected, recovered, and reversed-if-the-authoritative-rail-defines-reversal.
- Each row shows direction, counterparty public username, asset summary, admitted Phi amount if present, Kai/time context, and verification state.
- Receipt detail shows a privacy-safe receipt reference, transaction state, exact finality language, and support/recovery action.
- Pagination/cursors are server-owned and bounded. Scrolling never loads the full historical graph.

## Identity, wallet, and authority

The wallet belongs to the verified Receiz identity represented by the active Wildz proof session and same-account scoped access token. It is not stored in PlayState, Identity Seal, creature card, localStorage, or a custom Wildz balance table.

The browser receives only sanitized projections:

- `WalletSummaryProjection`: admitted Phi totals, asset counts, pending count, display price basis, and status.
- `RecipientProjection`: public username, privacy-filtered mark, allowed transfer kinds, and exact server-resolved recipient coordinate.
- `TransferEligibilityProjection`: transferable quantities/assets and human-readable denial reasons.
- `LedgerPageProjection`: bounded sanitized rows and cursor.
- `TransactionStatusProjection`: staged, unknown, zero-write, or committed plus privacy-safe receipt data.

Every authority-bearing operation remains server-only. Server routes resolve the authenticated cookie actor, exact granted scopes, exact subject/value/world heads, recipient identity, asset ownership, capability/condition, access policy, and current reservation state. Browser-supplied owner IDs, subject IDs, heads, prices, balances, recipient IDs, proof digests, and authority objects are rejected.

## Receiz V122 rail mapping and fail-closed gaps

- Durable creature/card ownership: exact admitted V122 subjects.
- Private/invited payloads: subject access keys and private world envelopes where supported.
- Transaction execution/recovery: exact V122 validated transactions, staged before execute, recovered by exact transaction/idempotency lookup.
- Cross-region resource/world effects: V122 multi-world transaction only.
- Phi: explicit Settlement or Reserve intent only. USD is a display quote, never the transferred authority.

The current published V122 client does not expose SDK-custodied normal public `planCommandV122`/`planTransactionV122` bytes and does not expose Settlement/Reserve keys through the SDK scope helper. Those missing surfaces block live authored-world/resource/Phi publication. The terminal may ship read-only verified wallet state and fail-closed capability states, but it must not manufacture command bytes, handwrite delegated scopes, reuse V121 plans as V122 authority, or present a preview as completed value movement.

Authorization occurs inside the Wildz experience. If a one-time Receiz identity grant is legally required, Wildz presents its own secure authorization surface and returns to the exact terminal state. Silent OAuth, hidden consent, iframe credential entry, or a redirect that discards gameplay state is prohibited. Once granted, normal reads and transfers remain in-game.

## Server API boundaries

Planned route family:

- `GET /api/wilds/wallet/summary`
- `GET /api/wilds/wallet/assets?cursor=`
- `GET /api/wilds/wallet/ledger?cursor=`
- `POST /api/wilds/wallet/recipient`
- `POST /api/wilds/wallet/request`
- `POST /api/wilds/wallet/transfer/preview`
- `POST /api/wilds/wallet/transfer/execute`
- `GET /api/wilds/wallet/transfer/[transactionId]`

All responses use `cache-control: no-store` for private wallet data. Public recipient lookup is rate-limited, bounded, normalized, privacy-filtered, and resistant to username enumeration. Transfer endpoints require CSRF protection, exact field allowlists, stable semantic idempotency, and no request-body authority fields.

## State, caching, and performance

- Wallet state lives in a dedicated controller mounted outside Canvas and outside gameplay reducers.
- The HUD reads one small stable summary projection. It never derives wallet truth from cards or inventory.
- Opening the terminal triggers bounded summary/asset/ledger reads; background refresh uses focus/visibility and admitted event invalidation, not timers in gameplay frames.
- One same-session cache may retain the latest verified projection by authenticated identity and head. It must distinguish `loading`, `verified`, `offline-verified`, `stale`, `revoked`, and `failed`.
- Identity change, ownership invalidation, scope revocation, or privacy-head change invalidates private projections immediately.
- No request, verifier, digest, filter/map/sort, allocation, timer, or React setter occurs inside Three.js `useFrame`, movement, camera, swimming, flight, creature animation, card switching, or restore hot paths.
- Opening/closing the terminal must not rebuild the world, reset exploration, change active creature, reset camera, or remount Canvas.

## Failure and recovery language

- **Loading**: no balance placeholder pretending to be zero.
- **Authority required**: `Secure wallet` action; world and game state remain preserved.
- **Offline verified**: show last admitted value with an explicit offline marker; disable send and recipient lookup.
- **Insufficient availability**: explain reserved versus transferable amount.
- **Recipient unresolved**: no partial identity may be authorized.
- **Zero-write rejection**: no asset, balance, inventory, card ownership, or ledger projection changes.
- **Ambiguous execution**: exact staged attempt remains pending; poll exact transaction/idempotency outcome; never replan or double-send.
- **Committed**: update only from authenticated receipt/addition and reconcile all affected projections atomically.
- **Revoked/private**: remove private projection immediately and retain only legally public receipt facts.

## Privacy and security

- Username lookup returns only a public, consented player projection.
- No email, raw Receiz ID, subject ID, owner ID, grant membership, proof digest, token, access key, private coordinate, or exact private inventory leaks.
- QR/deep links contain a public locator plus optional non-authoritative request, never credentials.
- Clipboard and share actions require explicit user input.
- Transfer review protects against Unicode-confusable usernames and visibly distinguishes exact normalized username.
- Sensitive responses use no-store, same-origin enforcement, CSRF protection, strict CSP, and sanitized error codes.
- A staged transaction journal contains exact SDK transaction bytes and minimum recovery metadata, encrypted/owner-scoped where persisted; it never contains reusable browser authority.

## Accessibility and mobile input

- Terminal is one accessible dialog with labeled tab/rail navigation, a programmatic title, and owned focus boundary.
- Focus enters the terminal header, follows visual order, and returns to the HUD instrument on close.
- Amount fields use appropriate input mode, exact parsing, and accessible currency/unit labels.
- Every status uses icon/shape/text in addition to color.
- Every interactive target is at least 44 CSS pixels; primary mobile confirmation is at least 52 px high.
- Safe-area insets protect header, bottom navigation, confirmation, and scroll region.
- Keyboard: Escape/back rules, arrow/tab navigation where semantically appropriate, Enter for search/review, and no global gameplay shortcuts while owned.
- Pointer cancellation, lost capture, visibility change, orientation change, and overlay replacement cannot accidentally authorize.
- Reduced motion eliminates scans, count animations, and sheet travel without removing state feedback.
- Large text, long usernames, maximum balances, zero balances, many resource digits, and localized number separators do not clip or shift controls.

## Component boundaries

- `WildsWalletInstrument`: HUD value/status control only.
- `WildsWalletTerminal`: exclusive responsive shell and navigation.
- `useWildsWalletController`: bounded fetch/cache/recovery state; never authority.
- `WildsWalletOverview`, `WildsWalletSend`, `WildsWalletReceive`, `WildsWalletAssets`, `WildsWalletLedger`: focused surfaces.
- `wilds-wallet-projections.ts`: strict sanitized schemas and normalization.
- `wilds-wallet-route-authority.ts`: authenticated server actor, scope, recipient, and ownership resolution.
- `wilds-wallet-transfer.ts`: exact preview/execute/recovery orchestration over SDK rails.
- Existing `PlayCampaign`, `play-shell-owner`, `world-overlay-state`, `WildsBalancedStatusHud`, and global styling receive narrow integration changes only.

No wallet component owns simulation state, no gameplay reducer owns wallet state, and no adapter response is rendered without projection validation.

## Testing and release gates

### Authority and correctness

- Exact cookie/profile/proof-session/username binding.
- Missing, partial, omitted, revoked, expired, and wrong-account scopes.
- Body injection of recipient/owner/subject/head/balance/price/token/proof fields.
- Exact recipient resolution, Unicode confusable denial, private-profile filtering, and rate limiting.
- Phi Settlement versus Reserve separation and USD non-authority.
- Resource/card eligibility, reservation conflict, stale heads, ownership change, and capability loss.
- Injected failure before/after every staged/execution/adoption boundary proves zero unintended writes.
- Commit-then-lost-response, timeout-before-commit, exact retry, duplicate idempotency, and journal restoration.
- Multi-world atomicity or strict refusal; never partial resource/card/Phi movement.

### UI and interaction

- Instrument is directly below Kai Klok and does not collide with audio, map, player, movement, or safe areas.
- Exclusive owner blocks world input and all other homes while terminal is open.
- Overview, Send, Receive, Assets, and Ledger states: loading, verified, empty, authority-required, offline, pending, rejected, committed, revoked.
- Exact user-visible transition: instrument → recipient → assets → review → authorize → receipt.
- Focus trap/recovery, Escape/back, screen reader names, status announcements, reduced motion, pointer cancellation.
- Desktop 1440×900 and 1280×720; laptop 1024×768; tablet 820×1180; mobile 390×844, 393×852, 430×932; supported landscape mobile.
- Long-value and long-username text fit, fixed numeric width, no horizontal/page overflow.

### Performance

- Ten thousand warm walk/swim/fly/frame/card-switch/restore ticks produce zero wallet network, proof, digest, cache-build, sort, timer, or state-publication work.
- Opening terminal does not remount Canvas or reset world/camera/creature state.
- Summary refresh is bounded and deduplicated; ledger/assets paginate; recipient lookup is bounded and cancellable.
- Mobile terminal remains responsive under maximum bounded asset rows and pending receipts.

### Release evidence

- Full test suite, typecheck, ESLint, Receiz checker/conformance, production build.
- Browser desktop and mobile screenshots for closed HUD, Overview, Send review, pending recovery, and committed receipt.
- Browser DOM, console, interaction, safe-area, touch-target, and no-overflow evidence.
- Authenticated live-rail evidence is required before claiming live balances or transfers; test doubles and local projections cannot substitute.

## Reference ledger

| Reference | Used | Design consequence |
|---|---:|---|
| `threejs-game-ui-designer/references/ui-patterns.md` | Yes | Game instrument and owned terminal, not dashboard cards; stable numeric containers; world-path protection. |
| `checklists/game-ui-quality.md` | Yes | Explicit UI states, single source of truth, focus/disabled/pressed states, world cohesion. |
| `checklists/hud-readability.md` | Yes | Fixed-width value instrument, redundant status signals, placement outside player and threat lanes. |
| `checklists/responsive-ui-fit.md` | Yes | Desktop side terminal, mobile full-screen terminal, stable controls, safe scrolling and text fit. |
| `checklists/mobile-input.md` | Yes | Safe areas, 44/52 px targets, pointer cancellation, portrait/landscape verification, no page-scroll theft. |

## Explicit non-goals

- No redirect to a Receiz wallet site during normal operation.
- No custom Wildz cryptocurrency, fabricated balance, or database-authoritative ledger.
- No generic crypto swapping, speculative charts, yield, staking, leverage, seed phrases, or token promotion.
- No raw proof/digest/debug telemetry in ordinary player UI.
- No live transfer claim until the exact required SDK rail and authenticated production evidence exist.
- No wallet work in simulation, movement, render-frame, camera, creature, or restore hot paths.
