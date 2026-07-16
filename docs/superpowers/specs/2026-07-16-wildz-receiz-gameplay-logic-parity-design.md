# Wildz Receiz Gameplay Logic Parity Design

## Status

Approved direction on 2026-07-16. This specification imports the current advanced location and proof-game logic from Receiz into the existing Wildz world without changing Wildz's accepted visual design, buttons, HUD, navigation, world composition, or interaction language.

This is a logic-parity program, not a visual port of Receiz Commerce or Receiz Sports.

## Product outcome

Every major Wildz location becomes a durable gameplay destination rather than a short local interaction. Existing location surfaces keep their names, art, layout, controls, and buttons, while the systems behind them gain deterministic runs, server verification, proof-bound rewards, matchmaking, seasons, tournaments, replayable history, ownership continuity, and append-only world consequences.

The resulting game should feel deeper without looking redesigned. A returning player sees the same Wildz, but locations now remember what happened, support repeatable and social play, resist client-side reward forgery, and connect outcomes to verified cards and world progression.

## Upstream baseline

The parity audit uses these exact Receiz sources:

- Receiz main commit `f95f2fcab2f1ba732ff59130d80a61e146d210b3` (`qualify Receiz v105 release`) for the current repository baseline.
- Receiz World district definitions in `app/lib/world/blueprint.ts`, current district projection in `app/world/WorldExperiencePrimitives.ts`, and authority types in `app/lib/world/types.ts`.
- Signal Circuit card, discovery, battle, pack, vault, provenance, market, and conformance logic under `app/lib/game/signalRun*.ts`, `app/game/SignalRun*.tsx`, and `app/api/game/signal-run/**`.
- Sports proof-game foundations under `app/lib/game/sportsArena*.ts`, `app/lib/game/sportsPackDerby*.ts`, `app/lib/game/pitchCommand*.ts`, and `app/api/game/sports/**`.
- Pack Derby design and implementation contract in `docs/superpowers/specs/2026-06-15-pack-derby-design.md`.
- Pitch Command design and proof-witness contract in `docs/superpowers/specs/2026-06-17-pitch-command-design.md`.
- Receiz v91-v93 product-truth releases for deterministic math, server-recomputed rewards, proof-native gameplay, strongest-truth-first projection, bounded proof reads, offline replay, and append history.

Future upstream commits are not silently included. Additional parity requires a new audit against an explicitly named commit.

## Visual preservation law

The following Wildz surfaces are accepted and must remain visually unchanged:

- full-screen world composition and Three.js environment;
- explorer, companion, camera, lighting, weather, and world labels;
- top HUD, minimap, mission indicator, world status, and contextual action;
- D-pad appearance and movement behavior;
- bottom social deck, six permanent command buttons, active-creature drawer, and embedded market;
- existing landmark experience art, headers, action rows, button labels, icons, and layout;
- existing settlement experience art, district tabs, service actions, and layout;
- existing modal, sheet, dialog, card, typography, color, spacing, and motion language.

Implementation may add state and behavior behind these surfaces. It may update existing text values that already represent live gameplay state, such as score, phase, rank, history, availability, or result. It may not add a new permanent HUD cluster, navigation item, button, tab, card rail, visual theme, or commerce shell.

No Receiz Sports stadium, baseball, soccer, UFC, command-console, commerce-dashboard, or market-desk UI is copied into Wildz. Receiz logic is adapted to the Wildz fiction and current controls.

Visual regression is a release blocker even if logic tests pass.

## Governing authority

Wildz follows the same strongest-truth hierarchy adapted to its existing primitives:

1. verified portable card proof and admitted identity/session authority;
2. canonical Wildz world, settlement, activity, challenge, and reward records;
3. append-only event history and current-owner continuity;
4. deterministic projections and bounded read models;
5. live multiplayer and presence deltas;
6. local UI, camera, selection, animation, and optimistic feedback.

Local experience state may project a run immediately, but it cannot issue a durable reward, change canonical ownership, settle a stake, publish a record, or finalize a tournament result. Those transitions require authoritative recomputation or admission through existing Wildz server boundaries.

Known verified local or public proof paints first. Network refresh appends or refines behind it and may not make stronger known truth wait.

## Approved location mapping

### Trail Gate: entry, routes, and return memory

Trail Gate adopts Receiz World presence and route-continuity logic.

- Entering a named route creates a deterministic route session with actor, active card proof, origin, destination, seed, requirements, and return coordinate.
- Every accepted step appends an idempotent event.
- Completion is recomputed from the declared route and input trace.
- Discovery, completion, abandonment, and return are recorded separately.
- Re-entering the world restores the last verified location and active route without replaying already admitted rewards.
- Route history becomes an input to Cartographer House and world progression.

The existing Trail Gate buttons and presentation remain unchanged.

### Dawn Commons: presence, matchmaking, and public activity

Dawn Commons adopts Signal Commons presence and Signal Circuit challenge-queue logic.

- Nearby players may advertise availability for friendly, card-stake, or money-stake play using existing challenge controls.
- Defense opt-in permits a verified card projection to accept bounded asynchronous challenges without transferring identity authority.
- Matchmaking uses current location, activity type, verified card eligibility, player availability, and cooldowns.
- Challenge offer, accept, decline, cancel, expire, active, result, and settled transitions remain explicit and idempotent.
- Public activity projects only bounded, privacy-safe summaries.
- A live presence delta never rewrites canonical results, ownership, or player history.

The existing Dawn Commons district and Wilds multiplayer surfaces remain the only presentation.

### Mosslight Atelier: attunement, foundry, and provenance

Mosslight Atelier adopts Studio Row and Signal Pack Foundry logic.

- Card attunement verifies the exact admitted proof and binds the output to that proof digest.
- Repeatable crafting uses deterministic recipes, declared inputs, seed, bounded rarity tables, and a recomputable result manifest.
- Inputs are never consumed by local UI. Any ownership-affecting operation requires authoritative admission.
- Pack or reward reveals reuse the existing Wildz creature-card and drawer surfaces.
- Created derivatives retain parent proof references, recipe version, source card identity, and causal provenance.
- Duplicate mutation keys return the prior result rather than issuing twice.
- A transferred-out card cannot remain an active crafting input or reward authority.

No new foundry dashboard or pack-opening visual is introduced.

### Cartographer House: cooperative ventures and path witnesses

Cartographer House adopts Venture House coordination plus Pitch Command's deterministic witness model.

- Players can start or join cooperative route sessions using existing location and activity controls.
- Every path decision becomes a compact witness with route ID, step index, source state, selected direction, geometry or rule verdict, observed time, and deterministic digest.
- The route tape can be projected through the existing Cartographer House content without a new tab or console.
- Cooperative actors pin verified cards before the activity starts.
- A completed route result is locked to the participant set, input trace, rule version, and witness chain.
- Historical route witnesses paint immediately from admitted local history; live additions append behind them.
- Venture-style shared objectives may coordinate up to the existing eight-actor activity limit.

The existing Cartographer House visuals and buttons remain unchanged.

### Monument Walk: archive, seasons, leaderboards, and governance

Monument Walk adopts Council Hall governance and Sports series/tournament history logic.

- Verified landmark, arena, raid, ecology, route, and Prism outcomes feed an append-only history.
- Seasons define deterministic start, close, eligible activity families, scoring version, and reward rules.
- Leaderboards rank admitted result records, not client counters.
- Tournament brackets lock entrants and verified card pins before the first round.
- Round advancement is recomputed from admitted results.
- Ties use declared deterministic tie-breakers.
- Season and tournament closeout is explicit so stale active rows cannot remain live indefinitely.
- Historical results remain replayable and inspectable after closeout.
- Governance-style decisions may choose future world modifiers but cannot rewrite already sealed outcomes.

The existing Monument Walk archive surface remains the presentation boundary.

### Embedded Market: offers, auctions, value, and settlement continuity

The existing embedded Wildz market adopts Exchange Market and Signal Circuit market mechanics.

- Listings, offers, auctions, bids, cancellations, expiry, and admitted settlement use explicit state machines.
- Seller ask is not card value. Deterministic value basis and market state remain separate.
- Ownership changes only after a verified admitted Receiz settlement.
- A transferred-out card disappears from owner-authorized actions while its causal history remains inspectable.
- Auction winners receive no local ownership claim before settlement admission.
- Idempotent mutation keys prevent duplicate bids, accepts, or settlement appends.
- Existing market failure, capability-unavailable, pending, cancelled, and settled states remain visually authoritative.

No external `/market` navigation or Receiz Market Desk UI is introduced.

## Approved advanced landmark mapping

### Arena of Echoes: verified competition

Arena of Echoes adopts Signal Circuit battle queues and Sports tournament primitives.

- Solo practice remains immediately available where current access permits.
- Live challenges use the existing Wilds challenge and battle presentation.
- Match seeds bind both player IDs, admitted card proofs, mode, rule version, and accepted time.
- Each action appends to a bounded input trace.
- The server recomputes combat state, winner, score, and any eligible reward.
- Defense opt-in supports bounded asynchronous play with a declared defensive strategy; it never grants identity or transfer authority.
- Ranked series and tournaments reuse the Monument Walk season records.
- Card or money stakes remain disabled unless current Receiz capabilities can admit and settle the exact stake.

The existing Focus, Guard, and Strike buttons remain unchanged.

### Prism Arcade: proof-native skill run

Prism Arcade adopts Pack Derby's input-trace and server-recomputation architecture without importing baseball rules or visuals.

- A run binds player, verified card, world name, deterministic seed, rules version, start time, and optional eligible boost.
- Existing Sync, Cyan, Magenta, and Burst intents become the authoritative input alphabet.
- The deterministic engine generates a longer sequence of gates, timing windows, lane patterns, hazards, harmony changes, misses, recoveries, and completion conditions.
- Every input, including misses or timeouts, appears in the trace.
- Client projection may animate immediately, but the final score, completion, reward lane, and receipt digest are recomputed server-side.
- Reward eligibility depends on completed verified objectives, not display score alone.
- Reward lanes remain bounded and use existing Wildz cosmetic, lore, achievement, or admitted card reward systems.
- Challenge runs may bind multiple players to the same seed for fair comparison.

The existing Prism Arcade art and four action buttons remain unchanged.

### Hearttree Sanctum: proof-memory trials

Hearttree Sanctum adopts Pitch Command's witness/archive discipline and strongest-known-truth behavior.

- Daily and permanent trials derive deterministic chamber order, clue sequence, master behavior, and reward rules from a published seed and the admitted card proof.
- Pulse, Advance, Guard, and Awaken remain the complete input alphabet.
- Each chamber decision emits a witness that chains to the previous witness digest.
- Known admitted daily proof paints immediately offline.
- A background refresh may append a new daily trial but cannot replace a selected historical witness.
- Trial completion and lineage rewards are recomputed before admission.
- Replaying a historical trial is read-only and cannot issue the reward again.

The existing Hearttree art and buttons remain unchanged.

## Shared deterministic activity kernel

The current `wilds-activity-core.ts` becomes the shared authority-neutral state machine for location sessions.

It gains typed support for:

- activity family and rules version;
- participant/card admission locks;
- deterministic seed and input trace;
- witness chain and current witness digest;
- started, active, paused, result, verification, reward, settled, expired, and exited states;
- optimistic client result versus admitted result;
- server verification evidence;
- reward lane and durable reward admission;
- season, tournament, challenge, and route references;
- idempotent mutation keys and revision ordering;
- return coordinate and resume behavior.

Activity-specific engines remain pure modules. They consume an admitted setup plus an ordered input trace and return the same result on client and server. React components render projections and emit intents only.

## Server verification

Authoritative result routes follow one common contract:

1. validate actor and session authority;
2. load or admit the declared session setup;
3. verify each pinned card proof and current ownership eligibility;
4. reject unsupported rules versions, participant drift, reordered inputs, missing timeout events, or malformed traces;
5. recompute the activity from seed and trace;
6. compare score, outcome, witness digest, completion state, and reward lane;
7. append one idempotent admitted result;
8. issue or admit a reward only after successful recomputation;
9. return the canonical activity projection.

Routes never accept a client score as authority. A replay of the same mutation key returns the existing admitted result. A different payload using the same key is rejected.

## Progression and rewards

- Results may grant existing achievements, cosmetics, lore, mastery, route unlocks, reputation, or admitted card rewards.
- Display score alone never grants a reward.
- Reward rules are versioned and published with the activity setup.
- Higher reward lanes require verified completion thresholds, not repeated local attempts.
- Daily, seasonal, and tournament rewards close explicitly.
- A reward record pins the source result digest and admitted card proof.
- A transferred-out source card does not erase historical rewards but cannot authorize new runs or boosts.
- No gameplay result may synthesize Receiz settlement, ownership, or payment truth.

## Offline and recovery behavior

- Known admitted location, activity, history, and reward records remain available offline.
- A fully deterministic solo run may be played offline and stored as a pending verification candidate.
- Pending candidates are never shown as settled rewards.
- Reconnection submits candidates in revision order with idempotent mutation keys.
- Multiplayer, stake settlement, auctions, matchmaking, and authoritative tournament advancement fail closed while offline.
- Route teardown, reload, or app suspension preserves an active deterministic trace and return coordinate.
- Recovery rejects partial or internally inconsistent traces rather than guessing missing events.

## Performance

- Current location and admitted history paint before network refresh.
- Read models select bounded IDs before hydrating full proof payloads.
- Active screens subscribe only to relevant location, activity, challenge, or tournament deltas.
- Historical archives paginate and never hydrate the full world ledger into the first viewport.
- Pure deterministic engines have bounded trace sizes and explicit proof-safety caps.
- Background refresh cannot remount the Three.js world, landmark experience, settlement experience, or social deck.
- New logic must not reduce representative mobile frame rate or increase the accepted permanent HUD footprint.

## Error handling

- Invalid or unavailable locations preserve world play and show failure through existing feedback surfaces.
- Verification mismatch rejects the result and retains the local trace for diagnostics; it does not issue a reward.
- Stale ownership, participant drift, expired challenge, closed season, unsupported rules, and missing capability each have distinct error codes.
- A failed optional history append does not erase the admitted result.
- A failed durable result append leaves the activity pending verification, not settled.
- No error path navigates to Receiz Commerce or exposes server credentials, raw identity authority, or private proof material.

## Test strategy

Implementation follows test-first development.

### Source and visual-preservation contracts

- Freeze the upstream Receiz commit and named source paths in a parity manifest.
- Assert all current Wildz landmark, settlement, social-deck, HUD, D-pad, and command button labels remain present and ordered.
- Assert no Receiz Commerce/Sports component, route, stylesheet, dashboard, or visual namespace enters the Wildz presentation tree.
- Capture baseline and post-change mobile screenshots at the same saved state and fail on material composition drift.
- Assert D-pad and creature drawer geometry remains governed by the separately approved drawer specification.

### Deterministic engine tests

- Identical setup and trace produce identical state, score, witness chain, outcome, and reward lane.
- Reordered, omitted, duplicated, late, or malformed inputs reject or produce the declared deterministic consequence.
- Misses and timeouts cannot disappear from traces.
- Client claims cannot change server-recomputed outcomes.
- Proof-safety caps reject incomplete or unbounded runs.

### Authority tests

- Unverified, transferred-out, mismatched, or changed card pins cannot enter authoritative activities.
- Duplicate mutation keys are idempotent only for byte-equivalent payloads.
- Rewards cannot issue before result admission.
- Stakes and ownership cannot settle without verified Receiz capability and admitted settlement.
- Live presence and UI state cannot rewrite canonical result history.

### Location tests

- Trail Gate route sessions resume and return exactly once.
- Dawn Commons challenge transitions and matchmaking filters are explicit.
- Mosslight Atelier crafting retains causal provenance and cannot double-issue.
- Cartographer House witness chains and cooperative participant locks are stable.
- Monument Walk seasons, leaderboards, brackets, tie-breakers, and closeout are deterministic.
- Embedded Market auctions and offers never claim ownership before settlement.
- Arena results recompute from both admitted cards and the full trace.
- Prism rewards depend on verified completion, not display score.
- Hearttree historical replay cannot issue a second reward.

### Browser and gameplay QA

- Enter and leave every mapped location using existing controls.
- Complete solo, multiplayer, offline-pending, resumed, rejected, verified, rewarded, and historical-replay paths.
- Exercise challenge expiry, ownership change, duplicate submission, season closeout, and capability-unavailable states.
- Confirm the world, HUD, buttons, sheets, landmark visuals, settlement visuals, and command dock remain compositionally unchanged.
- Confirm no relevant console errors, hydration errors, blank canvas, lost pointer input, or background remounts.

## Release gates

The parity program is complete only when:

- the exact upstream Receiz baseline and adopted primitives are recorded;
- all approved locations have durable, repeatable, verified gameplay responsibilities;
- Arena, Prism, and Hearttree have deterministic traces and authoritative result verification;
- challenge, matchmaking, defense, season, tournament, archive, route, foundry, provenance, offer, auction, and settlement state machines pass their contracts;
- client score, local UI, or live presence cannot issue durable rewards or rewrite ownership;
- offline solo play is recoverable but never misrepresented as verified settlement;
- current Wildz visuals, buttons, HUD, world composition, navigation, and accepted mobile layout remain unchanged;
- automated tests, type checking, lint, production build, mobile browser gameplay, screenshot comparison, and performance verification pass;
- any upstream Receiz primitive intentionally not adapted is listed as a remaining parity gap rather than silently omitted.
