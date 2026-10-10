# Native wallet and coupled trade executor implementation plan

> Withdrawn proposal. The user explicitly requires Wildz-only composition from the
> published 128.0.0 packages. The SDK/host additions described below are not
> released APIs, are not approved, and have been removed from the active
> implementation. Do not apply their migrations, edit Receiz, or use their names
> as published capability evidence. This text remains a historical design record.


> **Status: source implementation added; production rollout remains unqualified.** The additive v128 SDK, native host, wallet integration and isolated acceptance/recovery tests now exist. See [the implementation and rollout record](../../developers/native-wallet-rollout.md) for actual interfaces, source paths and remaining deployment requirements. The unchecked tasks below preserve the original planning checklist and proposed names; they are not the final API inventory. Local synthetic acceptance does not establish a successful live payment or trade.
>
> **For agentic workers:** Use the linked implementation record and exact installed SDK inventory to continue rollout. Do not execute live value operations as release tests.

**Date:** 2026-10-09.

**Goal:** Execute native Settlement/Reserve sends and bilateral exchanges of Phi, creatures and resources from genuine participant proof sources, with both peers' exact consent and one atomic acceptance of every value and custody leg.

**Architecture:** Reuse canonical sealed artifacts, admitted identities, signed capabilities, native ownership appends and native value origins. Add explicitly versioned adapters that verify those transitions and connect them to one complete-set native executor. Persistent head indexes, locks, receipts and outboxes remain coordination beneath the verified proof sources.

**Tech stack:** Receiz SDK 128.0.0 source, TypeScript, canonical Signature V4/native record seals, verified carried history and KKS coordinates, PostgreSQL compare-and-set, Wildz Next.js routes and browser recovery.

**Spec:** [Wallet peer trade implementation boundary](./2026-10-09-wallet-peer-trade.md).

## Global constraints

- The installed SDK version inspected is `@receiz/sdk@128.0.0`; the planned additive APIs in this document are not installed exports.
- Do not invent predecessors, balances, heads, candidates, issuer keys, revocation evidence, signatures, registry roots or committed runtime custody.
- Preserve historical V113/V124/V125 schemas and semantics. New native aggregate members and atomic-bound handoff receipts require explicit versions and dispatch; old bytes must not acquire a new interpretation.
- Both parties authorize the same canonical frozen plan: exact assets, quantities, recipients, consideration, any native fees, expiry, expected predecessor heads and execution domain.
- Preparation does not issue an independently claimable gift or commit any value, ownership, resource reservation or one-use consumption.
- Every stale head, missing or expired consent, revoked key, invalid proof and rejected execution produces zero writes across the complete set.
- Persist one semantic idempotency identity and exact committed recovery. Lost responses and reloads resolve that attempt; they do not create new attempts or resend uncertain legs.
- Display and message projections follow the verified complete outcome. Publication success is checked separately when private delivery is required.
- Keep cryptographic preparation off gameplay and wallet first-paint paths. Reuse exact admitted source custody without weakening freshness, head or expiry checks.
- This document authorizes no live value action and makes no claim that existing source or a test-root fixture is live-qualified.

## Evidence and limits observed before implementation

Upstream paths below are relative to `/Users/bjklock/Kai-Turah/receiz`. Line numbers identify the source inspected on this date; recheck them when preparing the upstream diff. No upstream file was changed for this plan.

| Boundary | Exact current source | Consequence |
| --- | --- | --- |
| Aggregate planning exists | `packages/receiz-sdk/src/v124Execution.ts:312–334, 388–451`; `test/v124Execution.test.ts:887–902` | Ownership world transactions and value intents can form one canonical plan in a shared domain. Planning does not perform native custody or settlement. |
| Prepared source is mandatory | `packages/receiz-sdk/src/v124Execution.ts:621–644` | `stagePrepared` verifies sources; `execute` rejects plan-only handles with `V124_EXECUTION_TRANSITION_SOURCE_REQUIRED`. |
| Existing member is an append | `packages/receiz-sdk/src/v124PortableAuthority.ts:596–601, 674–682, 725–729` | Every member is reconstructed through the existing artifact append planner. A native owner-changing successor has no corresponding member branch. |
| Provenance does not change owner or balance namespaces | `packages/receiz-sdk/src/namespaceReducer.ts:267–272, 347–366`; `artifactTransition.ts:3391–3400` | The append preserves other root namespaces byte for byte. Merely recording an ownership or payment event cannot establish those effects. |
| Native ownership primitives exist | `packages/receiz-sdk/src/globalReconciliation.ts:685–756`; `portableAsset.ts:352–389`; `test/v113PerHandoffAuthority.test.ts:165–239` | A sender-signed handoff, ownership/history append, genuine reseal and pinned admission can establish a real native successor. |
| Handoff consent is currently independent | `packages/receiz-sdk/src/globalReconciliation.ts:653–675, 789–817` | The signed handoff basis has no aggregate plan commitment and uses `artifact:local`. An unsigned trade wrapper cannot condition this existing receipt. |
| Commit/store/recovery is append-only | `packages/receiz-sdk/src/artifactTransitionStore.ts:65–110`; `v124PortableAuthority.ts:991–1035` | The public contract accepts append units and recovery requires genuine SDK-issued committed transitions. Caller property bags cannot fill a native ownership gap. |
| Admission engine is not the native executor | `packages/receiz-sdk/src/commandAdmission.ts:115–123, 142–170`; `admissionStore.ts:24–41, 149–153` | It verifies one command capability and advances one application aggregate. Numeric resource effects do not themselves update native asset heads or execute either value rail. |
| Existing edge value completion is standalone | `packages/receiz-sdk/src/v125EdgeValue.ts:233–234, 270–296` | It accepts one value operation and its exact two-participant standalone plan. Mixed aggregate recovery needs additive operation selection and complete-set verification. |
| Hosted mixed execution is rejected | `app/lib/receiz/v124/runtimeDependencies.server.ts:2016–2039` | More than one operation returns `UNSUPPORTED_ATOMICITY`; legacy incomplete ownership/inventory/world plans are also rejected. |
| Value delegate heads do not derive from candidates | `app/lib/receiz/v124/runtimeDependencies.server.ts:1239–1240, 1376–1384, 1411–1414`; `runtime.server.ts:2756–2758` | Source/destination value and consumed-locator hashes are computed independently of portable append nodes. The host then requires equality with the supplied proposed native heads. Sealing a document containing a hash does not make that hash its actual history head. |
| Locator predecessor is not a native history source | `packages/receiz-sdk/src/v124Execution.ts:231–241` | Its expected head is a digest of an unconsumed-locator coordinate. The portable append verifier instead needs an admitted predecessor's real history head. Recipient aliases/locators cannot manufacture that source. |
| Even single prepared execution hits a SQL contract mismatch | `app/lib/receiz/v124/runtime.server.ts:2775–2776`; `runtimeDependencies.server.ts:2389–2390`; `supabase/migrations/20260822070100_receiz_v124_production_runtime.sql:1947–1961` | The server sends `exactTransitionSet` and `preparedCommitSet`. The SQL function's exact allowed key list excludes both and raises `V124_EXECUTION_TRANSPORT_CLOSED_INPUT_INVALID`. Accepting these fields alone does not supply verification, effects, atomic custody or recovery. |
| Canonical bearer claim can mutate a leg independently | `app/lib/sdk/bearerOwnershipClaim.server.ts:227–269, 362–427, 462–468`; `bearerClaimIdempotency.ts:154–178` | A qualifying bearer source is claimed independently, with per-predecessor coordination and no whole-trade prerequisite. Calling it during trade preparation breaks atomicity. |
| Existing PNG gifts do not fit the modern claim carrier | `packages/receiz-sdk/src/index.ts:4424`; `app/lib/sdk/bearerOwnershipClaim.server.ts:183` | Modern claim requires `portable_asset`; Wildz PNG exports carry `native_record_seal`. Preserve and admit the original source through a qualified native successor/migration adapter, rather than relabeling continuity or assuming a historical instrument is a native artifact. |

Two local, non-mutating checks established that the installed planner accepts an ownership + settlement plan with two operations/four derived participants, and that a provenance ownership-transfer event leaves `ownership.ownerReceizId` unchanged. They created no sealed source, staged no execution and moved no value. They do not qualify an executor.

## Participant inputs versus protocol work

These are required source inputs, not assertions that the inputs are unavailable:

1. Exact sealed current native asset predecessors, original payload identity, native ownership continuity, actual continuity head/reference, verified carried history and its actual head. Continuity references and proof-history heads are separate coordinates when the source format distinguishes them.
2. Genuine sender and receiver value origins, source proof-object/subject identities, current admitted value/history heads, native funded Reserve evidence where applicable, and the native Settlement evidence required by its rail. A carried display balance does not supply spend authority.
3. Both sealed identity artifacts and held-key proof/consent, including authentic signed issuer key-state evidence sufficient for the admission/commit Kai. A recipient handle is a discovery coordinate; it is not this identity evidence.
4. Actual complete successor KKS coordinates when required by the admitted predecessor. Never synthesize a coordinate from a pulse, timestamp or expected head string.
5. Genuine canonical sealing custody for the successor's actual admitted owner, plus exact source bytes and capability signatures. Sealing authority does not confer another owner's authority or authorize a transfer by itself.
6. The same frozen unsigned economic plan at both peers, and each peer's bounded signed approval of that plan and its applicable native legs.

Wildz can collect, admit, preserve and present these sources and signatures. It can implement durable storage for already supported complete-set appends. The native ownership member, conditional handoff signature, native value-effect binding, aggregate edge inspection, shared claim/commit coordination and hosted SQL recovery contract are actual SDK/native executor work. They cannot be replaced by an application trade record that declares them completed.

## Chosen additive interfaces

The names in this section are planned interfaces, not current SDK exports. Implement them beside the existing native primitives and preserve their verifier custody rules.

- `planReceizNativeTradeV128(input: ReceizNativeTradeIntentInputV128): Promise<ReceizOperationPlanV124>` creates the existing canonical aggregate envelope from explicitly versioned native ownership/value operation payloads. Intents contain admitted predecessor coordinates, destinations, exact quantities and native economic constraints; they do not contain their own signatures or future sealed candidate bytes. This avoids a digest/signature cycle.
- `createReceizAtomicOwnershipHandoffReceiptV128(input: ReceizAtomicOwnershipHandoffInputV128): Promise<ReceizAtomicOwnershipHandoffReceiptV128>` signs the native handoff and the already frozen `exactPlanDigest`/`commitDomain`. Its schema, audience and signed basis are explicit V128 additions. It cannot be downgraded to an unconditional V113 receipt by deleting an outer property.
- `prepareReceizNativeOwnershipTransitionV128(input: ReceizNativeOwnershipTransitionInputV128): Promise<ReceizPreparedNativeOwnershipTransitionV128>` consumes genuine predecessor/identity admissions, exact temporal evidence, the atomic-bound native receipt, both aggregate approvals and a canonical sealer. It constructs and reopens the native owner-changing successor, preserves unrelated source bytes/history, and returns uncommitted SDK-custodied candidate/member transport.
- `verifyReceizNativeTradeTransitionSetV128(wire: unknown, options: ReceizNativeTradeVerifierOptionsV128): Promise<ReceizVerifiedNativeTradeTransitionSetV128>` dispatches tagged native ownership/value members, verifies every source and approval against the same plan, and derives the complete expected/proposed head and candidate set. Public pinned verification creates production custody; arbitrary-root diagnostics expose inspection only.
- `commitReceizNativeTradeV128(input: { transitionSet: ReceizVerifiedNativeTradeTransitionSetV128; store: ReceizNativeTradeStoreV128 }): Promise<ReceizNativeTradeCommitResultV128>` prepares and freshly revalidates the complete SDK-issued unit set, calls the store once, checks the complete receipt binding, and issues committed custody only after full acceptance. The store has one `commitSet` contract, not a sequence of independently successful `commitTransition` calls.
- `createReceizNativeTradeRecoveryV128(input: { transitionSet: ReceizVerifiedNativeTradeTransitionSetV128; committed: ReceizCommittedNativeTradeV128 }): Promise<ReceizNativeTradeRecoveryV128>` packages only genuine committed complete-set custody. `recoverReceizNativeTradeV128(wire, options)` reopens exact native successors and the entire bound outcome; it cannot promote a partial member or caller receipt to success.
- Add an aggregate value inspection overload/API with an explicit `operationId`. It selects exactly one intended value leg inside the verified complete plan and requires the complete native trade recovery before reporting that leg settled.
- Add versioned prepared native execution methods at the SDK client/host boundary. They retain the existing authenticated transport and exact authority-session verification, dispatch the V128 source/recovery types, and resolve the original semantic idempotency identity after a lost response. Existing V124 methods retain their current wire contract.

The new input/output types belong to the corresponding adapter modules below. Define new closed serialized schemas, for example `receiz.native-ownership-transition-member.v128`, `receiz.atomic-ownership-handoff-authority-evidence.v128`, `receiz.native-trade-transition-set.v128` and `receiz.native-trade-recovery.v128`. Their exact version tags and signing bases are part of the upstream review. The ownership member contains its operation ID, aggregate plan digest/domain, exact native predecessor and successor, original asset/payload identity, both identity admissions and the atomic-bound handoff. The handoff's signed basis includes the aggregate digest/domain, operation ID, sender, recipient, real predecessor coordinates, original artifact identity and expiry. Native claim verification dispatches on this signed version; deleting its condition never turns it into an unconditional legacy handoff. Runtime candidate/verified/committed types have SDK-held custody and no public issuer accepting caller-shaped objects.

## Review focus

The tasks below must pin these five cases explicitly:

- A participant attempts to claim an atomic-bound successor before aggregate commitment, or removes its trade binding: reject without custody/value writes.
- A competing standalone send/claim changes one predecessor after both peers signed: the whole aggregate rejects, including resource reservations and one-use consumption.
- The server commits, then the response or browser checkpoint is lost: reload resolves the same exact complete recovery once, with no new nonce or resend.
- One member has a revoked key, stale exact temporal coordinate or preserved-namespace mutation: reject the entire set before sealing/acceptance as appropriate.
- A replay changes recipient, fee, asset quantity, source member or operation ID while retaining idempotency/consent: reject rather than displaying a different completed transaction.

## Task 1: Native intents and atomic-bound ownership authority

**Files:**

- Create upstream `packages/receiz-sdk/src/v128NativeOwnershipTransition.ts` and `packages/receiz-sdk/src/v128NativeTrade.ts` for adapters over existing primitives.
- Modify upstream `packages/receiz-sdk/src/globalReconciliation.ts:653–817` and `packages/receiz-sdk/src/globalCoordinationTypes.ts:263–284` for the additive atomic-bound handoff receipt and verification dispatch.
- Modify upstream `packages/receiz-sdk/src/v124Execution.ts:219–334, 388–451` for versioned native payload adapters deriving real CAS coordinates.
- Modify upstream `packages/receiz-sdk/src/index.ts:376–402, 578–622` for supported public exports; regenerate the canonical function inventory through the repository's existing generator.
- Test upstream `packages/receiz-sdk/test/v128NativeTradePlan.test.ts` and `packages/receiz-sdk/test/v128AtomicOwnershipAuthority.test.ts`; retain `packages/receiz-sdk/test/v113PerHandoffAuthority.test.ts` unchanged in meaning.

**Interfaces:** Produces `planReceizNativeTradeV128`, the V128 native intent types and `createReceizAtomicOwnershipHandoffReceiptV128` defined above. Native CAS uses actual admitted source identity and head coordinates; native continuity references remain explicit rather than being coerced into proof-history hashes.

- [ ] Write failing tests that both peers sign one deterministic plan; changing owner, asset, amount, expiry, native fee or predecessor invalidates approval.
- [ ] Write a failing test that removing the aggregate binding from a V128 handoff cannot produce a valid V113 handoff or an independently executable leg.
- [ ] Implement canonical unsigned intent planning, derived participant/head union and the additive sender-signed atomic handoff basis. Verify both aggregate approvals and authentic key-state evidence against the exact domain and admission Kai.
- [ ] Run `node --import tsx --test packages/receiz-sdk/test/v128NativeTradePlan.test.ts packages/receiz-sdk/test/v128AtomicOwnershipAuthority.test.ts packages/receiz-sdk/test/v113PerHandoffAuthority.test.ts` from the upstream root. Require all positive and negative assertions to pass.
- [ ] Review and commit this source adapter/authority change independently. It is not an executor yet.

## Task 2: Genuine native ownership and value transition members

**Files:**

- Implement upstream `packages/receiz-sdk/src/v128NativeOwnershipTransition.ts` using `packages/receiz-sdk/src/portableAsset.ts:352–389`, `packages/receiz-sdk/src/proofHistory.ts:410–445` and existing canonical admission/sealing choreography.
- Implement the value member derivation in upstream `packages/receiz-sdk/src/v128NativeTrade.ts`; reuse actual native value origin/rail admission and reducer/funding checks, not a generic provenance event as a debit.
- Modify upstream `packages/receiz-sdk/src/v124PortableAuthority.ts:596–745, 991–1057` through explicit V128 dispatch, keeping the V124 append path frozen.
- Modify upstream `packages/receiz-sdk/src/artifactTransitionStore.ts:65–110` and existing custody modules only where needed for the tagged native-unit interface; do not allow a native candidate to masquerade as `artifact.append`.
- Test upstream `packages/receiz-sdk/test/v128NativeOwnershipTransition.test.ts`, `packages/receiz-sdk/test/v128NativeValueTransition.test.ts` and a production-pinned child test following `packages/receiz-sdk/test/v124PreparedExecutionPinnedChild.ts`.

**Interfaces:** Produces native ownership preparation and complete-set verification. A V128 member carries its operation kind, exact predecessor/candidate source bytes, exact planning inputs, identity evidence and signed authorization. All members bind the same aggregate digest and commit domain. A source is uncommitted until Task 3 succeeds.

- [ ] Write failing tests for a real sealed owner-changing successor, payload identity/history-prefix preservation, both identity bindings and complete KKS continuity. Include an unrelated unknown namespace and require its exact bytes to survive.
- [ ] Write failing tests that a native value member's admitted debit/credit matches the signed amount, conservation, native fees and required origin/funded balance. A display balance or unchanged wallet namespace plus a payment event must fail.
- [ ] Implement the native adapters and pinned re-verification of exact successor bytes. Preserve the separate ownership continuity and history coordinates. Derive successor heads from admitted candidates; never demand that a fresh history node equal an independently invented hash.
- [ ] Keep diagnostic roots limited to inspection. Test-root candidate/member construction must reject when passed to production pinned verification; no caller-controlled root option may issue production candidate or committed custody.
- [ ] Run the new tests together with upstream `v112ArtifactTransitionPlan`, `v112ArtifactTransitionCandidate`, `v124PortableAuthority`, `v125EdgeValue` and V113 ownership tests. Require existing historical paths and their tamper rejection to remain intact.
- [ ] Review and commit native source construction separately. Candidate preparation still does not complete a payment or trade.

## Task 3: One atomic native acceptance and recoverable complete outcome

**Files:**

- Implement upstream `packages/receiz-sdk/src/v128NativeTrade.ts` complete-set commit/recovery APIs and the `ReceizNativeTradeStoreV128` contract.
- Modify existing candidate/commit custody modules and recovery dispatch to issue custody only from the actual verified full commit.
- Test upstream `packages/receiz-sdk/test/v128NativeTradeCommit.test.ts`, `packages/receiz-sdk/test/v128NativeTradeRecovery.test.ts` and an isolated real-store concurrency/rollback suite.

**Interfaces:** `store.commitSet` receives the exact complete prepared unit set, its shared plan/idempotency binding and candidate references. It returns either all accepted native receipts with their group binding, an idempotent replay of that same complete result, or zero-write conflict/rejection. No member receipt can resolve early.

- [ ] Write failing tests for successful Phi + creature + resource acceptance, and failure of each individual leg with no changed head, value effect, reservation, consumed claim, receipt, outbox or idempotency success record.
- [ ] Freshly verify every retained candidate and exact member authorization before the commit boundary. Prepare private immutable source storage ahead of the transaction; its orphaned uncommitted bytes are not accepted custody.
- [ ] Commit in one transaction, in a stable lock order: all actual expected asset/value heads, resource custody/reservations, one-use consumption, native value effects, every proposed accepted head, member/group receipts, semantic idempotency and exact recovery/outbox references. Check the entire expected set before applying any effect.
- [ ] Persist accepted source references as coordination to the exact sealed native successors. The database may not invent an accepted head, substitute a candidate, mint value or confer ownership absent the verified native source and approvals.
- [ ] Return success only after durable full acceptance and complete receipt verification. Persist one immutable full recovery and issue SDK committed custody for that same set. Partial receipts cannot be packaged, recovered or projected as success.
- [ ] Inject failures before each effect and before the final durable swap/SQL commit. Inject response loss immediately after commit. Verify complete rollback or exactly one complete replay, never compensation of separately committed legs.
- [ ] Run the new commit/recovery suites and existing admission/transition-store conformance suites. Add complete-set conformance assertions rather than assuming the single-aggregate conformance suite proves group atomicity.
- [ ] Review and commit complete-set execution/recovery; it is not host qualification until Tasks 4–6 pass.

## Task 4: Native hosted execution, SQL and aggregate value confirmation

**Files:**

- Modify upstream `packages/receiz-sdk/src/v124Execution.ts:621–665` and client exports through additive V128 prepared execution/recovery dispatch.
- Modify upstream `packages/receiz-sdk/src/v125EdgeValue.ts:208–296, 320–355` through additive aggregate inspection with exact `operationId`; preserve standalone behavior.
- Modify upstream `app/lib/receiz/v124/runtime.server.ts:2731–2802` and `app/lib/receiz/v124/runtimeDependencies.server.ts:1239–1260, 1376–1414, 1961–2039, 2389–2390` for native source verification, complete preparation and recovery.
- Create a new upstream migration replacing/extending the execution function whose current closed input is `supabase/migrations/20260822070100_receiz_v124_production_runtime.sql:1947–1961`; do not edit the historical migration in place.
- Test upstream `app/lib/receiz/v124/__tests__/nativeTradeExecution.server.test.ts` and `nativeTradeExecutionPostgresBehavior.test.ts`.

**Interfaces:** Consumes Tasks 1–3. The host verifies the authenticated route/session and pinned native complete set; the service-role SQL function performs the complete acceptance. Client completion/edge confirmation re-verifies the exact committed recovery and selected operation, not a transport `status` field.

- [ ] Write the single-prepared-execution contract regression first: the actual server input includes `exactTransitionSet` and `preparedCommitSet`, and the current SQL rejects it. Assert the exact rejection on the old function in an isolated database.
- [ ] Implement a closed versioned SQL input contract and complete persistence/receipt/recovery validation. Merely accepting the two fields, ignoring them, or relaxing the signature/root checks must fail the tests.
- [ ] Replace the native execution path's independent synthetic value/locator-head derivation with verified source/candidate bindings. Preserve legacy synthetic coordinates in their historical APIs. A locator's one-use consumption is a coordination dependency, not an invented portable artifact predecessor.
- [ ] Reuse native rail effect/funding authorization in the same transaction. No separate HTTP value call or native claim may happen before or after the group transaction as a substitute for coupled effects.
- [ ] Accept multiple qualified operations only after complete source/member verification and derived effect checking. Preserve unsupported rejection for arbitrary world/custom projections that do not supply this native bridge.
- [ ] Add aggregate edge inspection requiring an exact unique operation ID and the full committed recovery. Selecting the wrong rail, member or operation fails; a two-participant subset cannot hide another failed leg.
- [ ] Verify actual SQL rollback, concurrent confirmation, stable idempotency conflicts and restart recovery in an isolated database. Use real SDK methods and production verifier entrypoints; mock transport-only `committed` objects do not prove this contract.
- [ ] Run upstream `pnpm test:v124-production-runtime`, SDK prepared execution/portable authority/edge value suites, and the new SQL behavior tests using the repository's isolated database harness. Database tests must not point at live participant value.
- [ ] Review and commit the host/migration change. A passing source test is still not a deployed native rail.

## Task 5: Conditional native claims share the same custody acceptance

**Files:**

- Modify upstream `app/lib/sdk/bearerOwnershipClaim.server.ts:227–269, 435–468` and `app/lib/sdk/bearerClaimIdempotency.ts:154–194` with versioned conditional-source dispatch.
- Modify corresponding historical handoff/reconciliation verification for V128 atomic receipts.
- Add a new migration/coordination adapter connecting conditional claims to Task 4's consumed predecessor/native accepted-head records.
- Test upstream `app/lib/sdk/__tests__/atomicBearerClaim.test.ts` and SDK `packages/receiz-sdk/test/v128AtomicOwnershipAuthority.test.ts`.

**Interfaces:** Atomic-bound native source claims consume/replay the same predecessor and accepted-head coordinates as aggregate execution. They require exact complete committed recovery for the bound plan/domain. Historical unconditional claims retain their own source interpretation, but cannot bypass an already consumed predecessor participating in the new native domain.

- [ ] Write failing tests for precommit standalone claims of each candidate, deletion of the atomic receipt binding, substitution of an unrelated recovery, and a concurrent standalone claim of an original predecessor.
- [ ] Enforce the signed condition at native claim and reconciliation boundaries. Do not depend on a Wildz UI flag or unsigned transport wrapper; a participant may hold and inspect candidate bytes before commitment.
- [ ] Coordinate standalone claims and aggregate consumption on the same native predecessor identity/head. An earlier competing legitimate claim makes the entire trade stale; a committed trade prevents reuse of its predecessors. Per-source object-storage locks alone do not establish this shared SQL transaction.
- [ ] Verify that accepting/importing one completed member requires the whole aggregate recovery and cannot execute another native append or value payment. Delivery/import projects the existing completed transaction.
- [ ] Run old bearer idempotency/handoff conformance and the new early-claim/concurrency tests. Preserve old valid bytes and reject atomic downgrade attempts.
- [ ] Review and commit claim coupling before exposing trade execution to peers.

## Task 6: Wildz wiring and final qualification

**Files:**

- Wire qualified native source/runtime adapters through `src/lib/receiz/adapter.ts`, `wilds-wallet-v124-runtime.ts` and a native trade route/source module.
- Reuse `src/lib/receiz/wilds-wallet-execution-source-member.ts` only for its supported append mechanics; do not treat it as the new native ownership/value executor.
- Extend wallet/native trade controller recovery using the existing per-owner durable checkpoint and identity-cancellation guards.
- Test `tests/wilds-wallet-v124-runtime.test.ts`, `wilds-wallet-execution-source-member.test.ts`, `wilds-wallet-driver.test.ts`, `wilds-wallet-transfer-routes.test.ts` and new `wilds-native-trade.test.ts`/`wilds-native-trade-recovery.test.ts`.

**Interfaces:** Consumes the installed, released and actually qualified SDK/host APIs from Tasks 1–5. Resolves real participant predecessors and signatures into the native source port, persists exact pending attempt custody before submit, and uses only complete native recovery for user-facing completion.

- [ ] Write integration tests for recipient → amount → review → confirm using genuine source inputs and actual SDK validation, including both peers' exact consent for trades.
- [ ] Wire preparation and complete-set execution. A missing native source/protocol deployment must remain explicit unfinished support; it must not be described as successful Send or Trade implementation.
- [ ] Persist and verify the durable pending checkpoint before submitting. Simulate failed storage, cancellation while signatures are pending, identity replacement, lost response and reload. Require no duplicate execution and no cross-owner recovery display.
- [ ] Show resulting owner/value/recipient from the actor-bound admitted recovery. Reject tampered browser recipient/stage metadata and projection-only private-message delivery claims.
- [ ] Keep first paint, movement and inventory rendering independent of expensive proof preparation. Measure preparation/commit separately, verify no new gameplay or wallet hydration latency regression, and retain bounded source verification/materialization.
- [ ] Run Wildz typecheck and focused wallet/trade checks with the qualified SDK package. Parent-owned `.test-build` must not be reused concurrently by independent workers.
- [ ] Regenerate and verify SDK/MCP/AI-skills capability parity through the existing upstream release workflow. Every surface invokes this same native executor and preserves its proof/custody boundary.
- [ ] Publish/deploy only the reviewed qualified upstream release/migration through the authorized release process, then record the installed version, migration, pinned source/recovery test evidence and deployment verification. No live transfer is implied by this plan.

## Completion evidence

The requested native scope remains unfinished until these facts are demonstrated together:

1. Single prepared Settlement and Reserve executions pass the real host/SQL/recovery contract with authentic native origins, effects and heads.
2. One Phi + creature + resource exchange accepts every native leg under one exact signed plan and transaction; resulting original asset identity/history and value conservation remain verifiable from exact sealed sources.
3. Missing consent, revoked/expired evidence, stale heads, tamper, replay, concurrent claim and precommit claim each produce zero effects across the complete set.
4. A response lost after durable commit and a restarted client/host recover the original complete result exactly once. No separately claimable or committed leg survives a rejected trade.
5. Old V113/V124/V125 standalone operations retain their historical source interpretation and pass their existing conformance suites.
6. The installed/released native executor and deployed migration are identified and their real integration verified. Test-root mechanics, mocked `committed` responses, a safe `SOURCE_UNAVAILABLE` result, or this document alone cannot satisfy this evidence.

Current result: an identified source/host design and implementation plan. All tasks above remain unchecked; no upstream patch, native executor deployment, committed native payment or coupled trade was produced by writing this document.
