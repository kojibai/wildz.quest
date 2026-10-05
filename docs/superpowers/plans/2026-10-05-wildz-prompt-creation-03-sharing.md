# Wildz Shared Creation Ownership and Benefits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make admitted creations discoverable and usable by other players, transferable/sellable with intact state, and eligible for bounded maker benefit.

**Architecture:** Verified conditional source transitions govern global conflicts and custody. A sparse region/space index distributes admitted references; dedicated creation asset/rights adapters extend commerce without pretending creations are creature cards. Usage consequences feed the existing constitutional benefit/emission system.

**Tech Stack:** Plans 1–2 contracts, Receiz typed source/transaction and commerce adapters, existing market conditional-append interfaces, Next.js routes, cached world projections.

**Spec:** [Approved design](../specs/2026-10-05-wildz-prompt-creation-design.md); [global constraints](2026-10-05-wildz-prompt-creation.md); requires Plan 2 for real instance effects.

## Global Constraints

- “Public visibility alone does not grant alteration rights.”
- “Public use defaults to free.”
- “Definition licensing creates no physical instance without new resource admission.”
- “A gift requires recipient acceptance.”
- “A useful creation remains usable when emission capacity is exhausted, without promising a payout.”
- World public-store projection is not a cross-instance atomic lock. Never infer trade/transfer/payment from a projection acknowledgment.

## Review Focus

- Competing independent clients/server instances must not lose updates: Task 1.
- Revoked occupancy/edit grants or old-steward mandates cannot mutate the new owner's creation: Task 2.
- Occupied places and equipped objects transfer without duplication or broken occupants: Task 3.
- Reusable definition licenses cannot copy embedded material or counterfeit a creature asset: Task 4.
- Duplicate/shared/self-use and exhausted emission must preserve useful access without fabricated rewards: Task 5.

---

### Task 1: Qualified conditional creation repository and sparse discovery

**Files:** Create `src/lib/receiz/wilds-creation-repository.ts`, `wilds-creation-server.ts`, `src/features/play/creation/index.ts`, `publication.ts`, and `app/api/wilds/creation/snapshot/route.ts`; create `tests/wilds-creation-repository.test.ts`, `tests/wilds-creation-index.test.ts`.

**Interfaces:** `CreationRepository.read(input:{worldId:string;spaceId:string;regionIds:readonly string[];after:string|null;limit:number}):Promise<CreationRepositoryPage>`; `.compareAndAppend(operation:CreationOperation):Promise<CreationAdmissionOutcome>`; `.lookup(operationId:string):Promise<CreationAdmissionOutcome>`. Page contains authenticated admitted source references and continuation, not authority derived from index rows. `CreationRepositoryRail` has typed read/conditional-append/lookup/proof-verification ports; qualify the installed SDK adapter against these contracts. `CreationIndexEntry={instanceId:string;head:string;worldId:string;spaceId:string;regionIds:readonly string[];bounds:CreationBounds;definitionDigest:string}`; bounds are min/max `CreationPoint`. `selectCreationNeighborhood(index,query)` returns bounded source references in deterministic order.

- [ ] Write tests for two competing expected heads, duplicate idempotency with changed bytes, missing/malformed conditional receipt, overwritten projection, independent process reload, stale index head, continuation, distant region queries, and exact lookup recovery. Primary test: `test("admits one of two incompatible global successors", ...)` with `assert.equal(outcomes.filter(x => x.status === "admitted").length, 1)`; construct the stated input in this task's fixture/double setup.
- [ ] Run repository/index tests and confirm missing conditional admission/discovery behavior fails.
- [ ] Implement durable qualification and exact receipt validation, sparse index updates from admitted source events, and region/space delta reads. Reuse source execution contracts from Plan 2; if no operational conditional rail exists, return unavailable and preserve local owned sources for later publication. Do not implement an in-memory global queue as the cross-process fix.
- [ ] Run tests and authenticated disposable independent-client contention/lookup qualification; record actual proof evidence. Verify shared discovery references reconstruct the same instance/definition without trusting a mutable index payload.
- [ ] Commit: `feat: coordinate and discover shared creation sources`.

### Task 2: Access, inhabitation, contributions, and stewardship

**Files:** Create `creation/access.ts`, `occupancy.ts`, `contributions.ts`; extend `creation/state.ts`, `actions.ts`, `interactions.ts`, `navigation.ts`; create `tests/wilds-creation-access.test.ts`.

**Interfaces:** `canAccessCreation(instance:CreationInstance,actorId:string,permission:keyof CreationAccessPolicy,kaiUPulse:number):boolean`. `CreationOccupancyGrant={grantId:string;instanceId:string;subjectId:string;roomNodeIds:readonly string[];permissions:readonly ("inhabit"|"use")[];expiresAtKaiUPulse:number|null;head:string}`. `CreationContribution={operationId:string;instanceId:string;actorId:string;workerIds:readonly string[];resourceRefs:readonly {id:string;head:string;quantity:number}[];nodeIds:readonly string[];head:string}`. Grant/revoke, contribution, and stewardship commands are variants of the exact-head `CreationCommand`; public/invited/private presets expand to explicit permission rules.

Extend `CreationState` with readonly `occupancyGrants` and `contributions` maps keyed by their admitted identity. Instance node storage remains in `nodeStates`; do not introduce a second contents ledger.

- [ ] Test visitor entry versus edit/demolish separation, shared garden harvest permission, grant expiry/revocation, room specificity, occupied transfer retaining grants, revoked old-steward mandate, contributor authorization, and safe admitted relocation when an occupancy grant ends. Primary test: `test("a public visitor cannot demolish the creation", ...)` with `assert.equal(canAccessCreation(instance, visitorId, "demolish", kaiUPulse), false)`; construct the stated input in this task's fixture/double setup.
- [ ] Run access tests and confirm missing policy/state transitions fail.
- [ ] Implement current-head access enforcement in both local interaction projections and production admission, collaboration contribution attribution, and a compact advanced sharing view in `WildsCreationPanel.tsx`. Do not call permission-to-visit permission-to-alter.
- [ ] Run access/physical tests and two-player browser scenarios: visit, inhabit, contribute, revoke, and return through a valid route.
- [ ] Commit: `feat: share inhabited creations with explicit rights`.

### Task 3: Physical-instance gifting and transfer

**Files:** Create `creation/transfer.ts`, `src/lib/receiz/wilds-creation-transfer.ts`, `app/api/wilds/creation/transfer/route.ts`; modify equipment/access/source-admission adapters; create `tests/wilds-creation-transfer.test.ts`.

**Interfaces:** `CreationTransferOffer={offerId:string;instanceId:string;expectedHead:string;from:string;to:string;rights:"instance"|"stewardship";expiresAtKaiUPulse:number;operationId:string}`. Export `prepareCreationTransfer(instance:CreationInstance,offer:CreationTransferOffer,context:CreationAuthorityContext):CreationOperation` and `acceptCreationTransfer(offer:CreationTransferOffer,recipient:CreationAuthorityContext,port:CreationAdmissionPort):Promise<CreationCommitResult>`. Offers do not transfer until recipient acceptance and atomic admission. Retain creator attribution, source history, location, contents, valid occupancy, and condition; update custody/stewardship and invalidate prior work/equipment authority together.

- [ ] Test wrong recipient, expired/stale offer, double acceptance, sender moving/equipping during acceptance, unknown settlement lookup, occupied place transfer, preserved contents/damage, old-owner invalidation, and two devices racing to accept. Primary test: `test("accepted transfer preserves contents and occupant grants", ...)` with `assert.deepEqual(successor.nodeStates, previous.nodeStates); assert.deepEqual(successorState.occupancyGrants, previousState.occupancyGrants)`; construct the stated input in this task's fixture/double setup.
- [ ] Run transfer tests and confirm missing accepted atomic custody behavior fails.
- [ ] Implement source-bound offers, acceptance, exact instance custody transitions, safe equipment removal, and pending/recovery UI. Use qualified transfer/transaction methods from the installed SDK; no successful HTTP response without verified admission completes transfer.
- [ ] Run transfer/equipment/admission tests and real two-player gift/reload checks with a portable tool and an occupied place.
- [ ] Commit: `feat: transfer creations without duplicating custody`.

### Task 4: Creation market assets and definition licenses

**Files:** Create `creation/market-asset.ts`, `src/lib/receiz/wildz-creation-market-adapter.ts`; modify `src/features/market/wildz-market.ts`, `src/lib/receiz/wildz-market-state.ts`, `wildz-market-route.ts`, `wildz-market-adapter.ts` through explicit asset discriminators, and `app/api/market/listings/route.ts`, `checkout/route.ts`, `settlement/route.ts`; create `tests/wildz-creation-market.test.ts`. Here the two unqualified market server filenames share `src/lib/receiz/`, and the route suffixes share `app/api/market/`.

**Interfaces:** `CreationMarketAsset={kind:"creation-instance";instance:CreationInstance;definition:CreationDefinition}|{kind:"creation-definition";definition:CreationDefinition;license:CreationDefinitionLicense}`; license contains issuer, grantee, allowed copy/use/redistribution rights, terms digest, and admitted head. `verifyCreationMarketAsset(value:unknown,verifySource:CreationSourceVerifier):Promise<CreationMarketAsset|null>`. Extend market asset unions while preserving the existing card branch and its exact validator. `prepareCreationListing(asset:CreationMarketAsset,priceCents:number,context:CreationMarketContext)` produces the existing listing request family with an explicit creation discriminator and source/rights bindings.

- [ ] Test creature-card backward compatibility, wrong asset discriminator, tampered/unsupported definition, stale instance owner/head, attempted duplicate physical instance from a license, listing reservation contention, accepted sale removing seller custody/equipment, and unknown checkout/settlement recovery. Primary test: `test("a definition license creates no funded physical instance", ...)` with `assert.equal(Object.keys(state.instances).length, Object.keys(before.instances).length); assert.equal(embeddedMaterialTransfers, 0)`; construct the stated input in this task's fixture/double setup.
- [ ] Run creation-market and existing market route/settlement tests, confirming intended missing creation support fails.
- [ ] Implement dedicated source verification and conditional listing/reservation/settlement integration, preserving price currency/units from existing commerce. A definition license allows building a new independently funded instance; it transfers no embedded materials. UI states what is being purchased and which rights transfer.
- [ ] Run market/transfer tests and authenticated disposable sale/license flows where qualified. Report unavailable settlement separately; do not label a listing as a sale or retry unknown charges.
- [ ] Commit: `feat: trade creation instances and reusable design rights`.

### Task 5: Causal public benefit, maker attribution, and funded charges

**Files:** Create `creation/benefit.ts`, `usage.ts`; modify `wilds-living-operation.ts`, `wilds-constitution.ts`, `wilds-world-emission.ts`, `wilds-steward-build-settlement.ts`, and `src/lib/receiz/wilds-world-emission-source.ts` through focused category adapters; create `tests/wilds-creation-benefit.test.ts`.

**Interfaces:** `CreationUsageEvent={usageId:string;operationId:string;instanceId:string;instanceHead:string;actorId:string;effect:"rest"|"harvest"|"craft"|"traverse";effectSourceHeads:readonly string[];contributionHeads:readonly string[];kaiUPulse:number}`. `prepareCreationBenefit(event:CreationUsageEvent,context:CreationBenefitContext):CreationBenefitProposal` produces the existing consequence vector plus attributed beneficiaries and bounded emission eligibility, not an awarded balance. Context binds admitted effect sources, contribution history, emission head/rules, and previous usage receipts. `CreationUsagePrice` is free or an explicit funded transfer with amount/unit, payer/payee and terms head; monetary settlement and world effect share the supported atomic boundary.

- [ ] Test actual finite garden harvest/rest benefit versus view/idle/click, duplicate replay, self-use, unchanged-state cooperation cycles, exhausted emission, stale creator/maintainer heads, no unjustified reward for destruction, and paid use rejecting without funds with zero physical effects. Primary test: `test("exhausted emission preserves free use without payout", ...)` with `assert.equal(useOutcome.status, "admitted"); assert.equal(awardedPhiMicro, "0")`; construct the stated input in this task's fixture/double setup.
- [ ] Run benefit tests and confirm missing lawful attribution/admission behavior fails.
- [ ] Implement free public default, causal usage records, contribution-based attribution, allowed reputation and Phi settlement under the existing constitution, and explicit optional tips/fees. Earned benefit must reduce the real applicable emission capacity or funded payer balance; preserve useful free access when emission is unavailable/exhausted.
- [ ] Run benefit/garden/settlement tests and two-player garden/rest usage. Verify replay produces neither another harvest nor another reward.
- [ ] Commit: `feat: attribute bounded benefit from useful shared creations`.

### Task 6: Real global continuation and two-player qualification

**Files:** Modify `creation/persistence.ts`, `publication.ts`, `wilds-world-refresh-coordinator.ts`, `use-wilds-world.ts`, and qualification report; create `tests/wilds-creation-multiplayer.test.ts`.

**Interfaces:** `applyCreationDelta(current:CreationState,page:CreationRepositoryPage,verifySource:CreationSourceVerifier):Promise<CreationState>` preserves newer source heads and detects unrelated forks; never lets a stale remote snapshot delete owned pending additions. Actor movement requests only cached spatial selection; periodic/shared refresh follows the existing coordinator and regional pagination.

- [ ] Test independent client/server reload, offline owned changes, conflicting global edits, stale delta after custody transfer, no duplicate effects on reconnect, regional subscription changes, and Vault restore of shared grants/market/benefit state. Primary test: `test("stale publication cannot restore the previous owner", ...)` with `assert.equal(next.instances[instanceId].ownerId, recipientId)`; construct the stated input in this task's fixture/double setup.
- [ ] Run multiplayer/source recovery tests and confirm missing delta/continuation behavior fails.
- [ ] Implement verified delta adoption, sparse discoverability, pending/global status, and exact multi-device continuation without full-world replay per movement update.
- [ ] Run Plan 3 tests, full regression checks, and actual independent-player creation→visit→inhabit→harvest→gift/sale→reload scenarios; retain authenticated receipts and clear any unresolved runtime qualification from completion claims.
- [ ] Commit: `test: qualify shared creations across players and recovery`.
