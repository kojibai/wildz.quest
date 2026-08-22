# Wilds authored-world authority on Receiz v121

Status: accepted implementation boundary for Wildz 8.0.0

## Decision

Player excavation is a proof-native world mutation. A rendered tunnel, chamber, water volume, portal, collision surface, encounter habitat, or atlas reference may exist only after the corresponding Receiz world transaction is admitted and replayed. A local preview is always `physical: false`.

The world is sharded by the canonical 128-unit discovery-site region. Each append is bounded to one region world (`wildz.excavation.region.v1:<x>:<z>`). Cross-region construction is rejected until Receiz exposes an explicit multi-world transaction/portal protocol.

The current v121 client supports the exact world rails needed after subjects exist:

- `subjects.resolve`, `subjects.state`, `subjects.history`, and `subjects.additions`
- `world.planCommand`, `world.validateCommand`, and `world.executeCommand`
- `world.planTransaction` and `world.executeTransaction`
- `world.additions` and `world.replay`

The browser requests and records the exact granted OAuth scopes. Mutation preflight requires a cookie-bound player token carrying every scope produced by `receizOidcScopesForRails("worldCommands", "worldEvents", "subjects", "subjectMandates", "subjectInventory")`. A service/delegated token, guest identity, proof-only Vault session, missing scope, profile mismatch, foreign card, foreign subject, or stale head fails closed with zero writes.

## Implemented and verified library authority flow

1. Decrypt and validate the Wildz identity-key proof session.
2. Require the live cookie bearer and the exact granted world scopes.
3. Resolve the live Receiz profile and bind it to the same canonical player coordinate.
4. Verify the complete card and direct owner or exact Vault membership proof.
5. Resolve both explorer and creature as persistent remote Receiz subjects.
6. Bind subject IDs, current owners, creature proof digest, and exact subject heads. Because v121 cannot resolve typed capability and condition namespaces at an exact remote subject head, production preflight then fails closed with `receiz_subject_namespace_authority_required`; request-card-derived capability is never accepted as authority.
7. The verified library foundation derives substrate, water, space, exit/rescue, protected volumes, and route safety from the immutable Phase-B physical projection. This is not a production mutation claim.
8. Ask the SDK to plan each command and transaction; never construct an SDK command digest locally.
9. Verify exact participants, heads, world head, registry/reducer digests, command bytes, attempt, and idempotency before execution.
10. Treat only an exact v121 receipt/event chain as admitted. Ambiguous execution retains the exact staged plan and resolves additions before retry.
11. The pure authored-world foundation can rebuild authored state from supplied Receiz additions, trigger full replay on an initial gap, re-derive physical evidence, and atomically compare-and-swap a supplied graph-plus-cursor store.
12. The pure foundation can compose one immutable natural-plus-authored physical projection and proves stable warmed references. It is deliberately not connected to visible gameplay until durable incremental storage, full SDK checkpoint verification, authored atlas/restore, and private access envelopes exist. Therefore no new authored-world network or generation work runs during gameplay.

The production route currently performs authority preflight only; it does not claim to mutate or hydrate the playable world. The public-snapshot projector is pure and redacts owner/steward/proof identity, but no public GET is shipped yet. A future public GET must require only `receiz:world_events.read`, not the mutation scope set. Creator/steward/profile publication must remain a separate, range-gated projection. Invited/private geometry remains unavailable unless a subject-scoped encrypted envelope can be verified.

## Explicitly forbidden fallbacks

- The legacy Wilds `publicStore` service is not world-mutation authority.
- The v120 in-process creature observer/runtime is not a persistent remote subject.
- A server process singleton, optimistic outbox, client assertion, locally self-hashed event, renderer mesh, or server database row is not physical authority.
- Missing scopes, subjects, grants, envelopes, heads, proof binding, or material participants never downgrade to local/practice mutation.
- Task 8 does not invent inventory balances or consume placeholder materials. Installed structures remain blocked on Task 9's exact multi-participant inventory transaction.

## Lawful v121 boundary and SDK request

`@receiz/sdk@122.0.0` now exposes durable remote `subjects.admit`, authenticated subject-state transport, private edge envelopes, exact execution lookup, multi-world planning, and explicit Phi Settlement/Reserve intents. Wildz adopts those surfaces through one adapter and provides authenticated idempotent creature-subject admission from the exact card bytes. Gameplay frames, movement, restore, and card switching never call these rails.

The published v122 client does not expose an SDK-custodied normal `world.planCommandV122` / `world.planTransactionV122` operation. It validates and executes `ReceizWorldTransactionV122`, but an application would have to manufacture `ReceizWorldCommandV122.exactCommandBytesB64u`, command/plan/authority digests, and the transaction digest itself. Wildz refuses that authority substitution. Construction, resource consumption, excavation publication, and authored-world hydration therefore remain preview/nonphysical until the SDK returns the exact normal v122 command and transaction plans. Private planning is used only for its documented encrypted envelope boundary; it is not repurposed as a public command planner.

The v122 capability descriptor and `receiz conformance` report also still identify SDK/package compatibility as `>=121.0.0 <122.0.0` even though the installed coordinated packages are exactly `122.0.0`. The descriptor does not expose SDK-derived Settlement/Reserve OAuth rail keys. Wildz does not handwrite or infer delegated value scopes. Live Phi movement remains disabled until the coordinated descriptor and scope inventory identify the actual grant.

Receiz SDK needs the following additive API before remote first-time excavation can be enabled end to end:

```ts
client.subjects.planAdmission(input: ReceizSubjectAdmissionInputV1): Promise<ReceizSubjectAdmissionPlanV1>
client.subjects.executeAdmission(plan, authority): Promise<ReceizSubjectAdmissionResultV1>
client.subjects.resolveCardBinding({ assetId, proofDigest }): Promise<ReceizSubjectArtifactV1 | null>
client.subjects.resolveNamespaces({ subjectId, head, names }): Promise<ReceizSubjectNamespaceProjectionV1>
client.world.verifyCheckpoint(checkpoint): Promise<ReceizWorldCheckpointVerificationV1>
client.world.additionsPrivate({ worldId, afterHead, recipientSubjectId }): Promise<ReceizEncryptedWorldAdditionsV1>
client.identity.exchangeProofAuthority(input): Promise<ReceizScopedWorldAuthorityV1>
client.world.planMultiWorldTransaction(input): Promise<ReceizMultiWorldTransactionPlanV1>
client.world.executeMultiWorldTransaction(plan, authority): Promise<ReceizWorldExecutionResultV1>
```

Required semantics:

- durable idempotent card-to-subject binding;
- exact owner and proof-object binding;
- expected-head/attempt/idempotency support;
- plan bytes and SDK registry/reducer digests;
- zero writes on validation failure;
- additions/replay visibility after an ambiguous response;
- an explicit migration result for an existing v120 subject;
- subject-scoped encrypted event envelopes or an equivalent access-controlled world-events rail for private/invited geometry and grants;
- an atomic multi-world protocol before cross-region tunnels are admitted.
- typed capability and condition namespaces resolved at the exact subject head, so the server never has to recompute authority solely from a request card;
- a proof-native Identity Seal exchange for short-lived, least-privilege world authority, allowing valid proof authority without forcing an unrelated long-lived OAuth session;
- a checkpoint/event verifier, or a normative exported `digestReceizCompositeCanonical` derivation, covering every replay field including checkpoint digest, registry/reducer digests, subject heads, causal parents, and through-head.

If an OAuth server omits `scope` on a token response, Wildz does not infer grants from what it requested. Mutation remains disabled until Receiz supplies authoritative token introspection or an explicit granted-scope set. Idempotency keys identify semantic intent; attempt IDs identify one execution. An ambiguous retry must reuse the exact planned bytes until additions or verified replay resolves the outcome.

## Adapter checklist

- Expose SDK methods with their exact indexed types; do not hardcode SDK-internal URLs.
- Preserve the exact returned plans/transactions/receipts/events byte-for-byte.
- Store the token's actual granted scope set in an HttpOnly cookie and delete it on logout.
- Verify the token/profile/proof-session coordinate on every mutation request.
- Resolve subject artifacts remotely; do not cache authority beyond their exact heads.
- Re-derive the immutable physical evidence tuple on plan, unresolved retry, and replay.
- Validate causal parents, participant sets, event count, Kai equality, registry/reducer digests, and zero-write failure IDs.
- Keep public geometry, private access envelopes, and publication-filtered maker identity as separate projections.

## Failure semantics

- Authentication/scope failure: HTTP 401, zero writes.
- Identity/card/subject binding failure: HTTP 403, zero writes.
- Missing durable subject admission: HTTP 409, zero writes.
- Missing exact subject namespace authority or unavailable profile/subject resolution: HTTP 503, zero writes.
- Invalid geometry/evidence/head/transaction: HTTP 422 or domain conflict, zero writes.
- Ambiguous execution: retain exact pending bytes; query additions before any retry.
- Replay gap/tamper: discard the candidate off-side reduction, keep the last verified graph, and full replay without advancing the cursor.
- Access revocation: deny portal admission immediately and restore through the last verified safe public exit; never reveal private geometry or provenance.

## Required verification matrix

- exact/missing/extra/mismatched token scopes and cookie/profile binding;
- direct owner and exact Vault membership; arbitrary card/subject injection;
- missing remote subject and v120-ephemeral fallback refusal;
- stale/foreign participant heads, altered plans, receipts, causal parents, and zero-write failures;
- commit-then-lost-response recovery and unresolved exact-byte retry;
- additions duplicate, conflicting duplicate, gap, full replay, CAS conflict, and crash before checkpoint commit;
- independent physical-evidence replay, protected/water/route intersections, and extreme coordinates;
- public/private/invited/open/revoke and creator-versus-steward transfer;
- exact natural/authored render/collision/camera/landing/portal/encounter parity;
- 10,000 warmed movement/frame queries with zero authority builds or network calls;
- no material spend until exact Task 9 inventory participants exist.
