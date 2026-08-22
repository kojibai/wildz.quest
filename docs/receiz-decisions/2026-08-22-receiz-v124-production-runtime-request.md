# Receiz V124 universal production-runtime primitives

Status: requested additive contract after coordinated V123 adoption

## Objective

V124 should expose application-neutral primitives for safely operating any registered Receiz domain: games, marketplaces, organizations, document workflows, agents, regulated records, and future custom reducers. Applications should not independently rebuild distributed transaction journals, replay verifiers, authority-session resolvers, privacy filters, recipient limiters, or checkpoint stores.

These contracts are additive. V123 plans, artifacts, events, receipts, IDs, heads, idempotency keys, scopes, registry/reducer digests, and historical verification must remain byte-compatible.

## 1. Registered-domain operation envelope

```ts
type ReceizOperationPlanV124 = Readonly<{
  schema: "receiz.operation_plan.v124";
  applicationId: string;
  domainId: string;
  operationKind: string;
  registryDigest: string;
  reducerDigest: string;
  exactPlanBytesB64u: string;
  exactPlanDigest: string;
  expectedParticipantHeads: Readonly<Record<string, string>>;
  semanticIdempotencyKey: string;
  attemptId: string;
  writesOnFailure: 0;
}>;
```

Receiz supplies adapters from its built-in subject, world, inventory, access, Settlement, Reserve, and multi-domain plans into this envelope. A registered custom reducer may produce the same envelope without pretending its domain digest is a Receiz platform digest.

## 2. Hosted exactly-once execution

```ts
client.execution.stage(plan): Promise<ReceizDurableExecutionHandleV124>
client.execution.execute(handle, authoritySession): Promise<ReceizExecutionOutcomeV124>
client.execution.resolve({ applicationId, executionId }): Promise<ReceizExecutionOutcomeV124>
client.execution.resolveByIdempotencyKey({ applicationId, domainId, operationKind, semanticIdempotencyKey }): Promise<ReceizExecutionOutcomeV124>
client.execution.cancel(handle, authoritySession): Promise<ReceizZeroWriteFailureV124>
```

Required law:

- Staging is globally durable and atomically compares `(applicationId, domainId, operationKind, semanticIdempotencyKey)`.
- Exact duplicate bytes converge on the same handle. Same key with different bytes returns a zero-write conflict.
- Receiz executes only the exact staged bytes. Applications never reconstruct an ambiguous operation.
- Commit-response loss resolves after restart through the execution ID or idempotency key.
- Committed and zero-write terminal outcomes are durably authenticated and byte-stable across processes/devices.
- `unknown` retains the staged operation. Malformed statuses fail closed and never initiate execution.
- Cancellation cannot erase a possibly committed operation.
- Failures bind the exact execution, attempt, plan, and idempotency coordinates and report `writes: 0`.

## 3. Strict registered-domain replay and checkpoints

```ts
type ReceizDomainReplayExpectationV124 = Readonly<{
  applicationId: string;
  domainId: string;
  afterHead?: string | null;
  expectedRegistryDigest: string;
  expectedReducerDigest: string;
}>;

client.domains.verifiedAdditionsV124(expected): Promise<ReceizValidatedDomainAdditionsV124>
client.domains.verifiedReplayV124(expected): Promise<ReceizValidatedDomainReplayV124>
client.domains.verifiedCheckpointV124({ applicationId, domainId, throughHead }): Promise<ReceizValidatedDomainCheckpointV124>
validateReceizDomainReplayV124(input: unknown, expected): Promise<ReceizValidatedDomainReplayV124>
```

Validation rejects unknown fields/statuses, noncanonical ordering, same-ID/different-byte duplicates, gaps at every index, incorrect causal parents, participant-head maps, registry/reducer/application/domain digests, through-heads, or checkpoint digests. The admitted result binds exact event bytes and exposes no unchecked remote JSON as authority.

## 4. Server-custodied authority sessions

```ts
client.runtime.openAuthoritySession({
  applicationId,
  actorSubjectId,
  proofArtifact,
  signedChallenge,
  requestedRails,
  requiredNamespaces,
  audience
}): Promise<ReceizAuthoritySessionV124>
```

Receiz binds current Kai, application/audience, owner, actor, proof artifact/key, nonce, actual scopes, revocation head, subject heads, and exact namespace projections. The result is a short-lived opaque browser credential or server-only handle—not a reusable bearer, private key, or caller assertion. Refresh and close operations must preserve the same guarantees.

## 5. Exact-head namespace projections

```ts
client.subjects.resolveNamespacesV124({
  subjectId,
  atHead,
  names,
  expectedAdmittedProofDigest,
  expectedOwnershipHead,
  expectedRegistryDigest,
  expectedReducerDigest
}): Promise<ReceizValidatedNamespaceProjectionV124>
```

The response must bind every expected field and expose canonical bytes/digests suitable for command planning. This is the universal way to obtain current abilities, conditions, roles, policies, balances, licenses, or other reducer-defined state without trusting request payloads.

## 6. Operational capability qualification

```ts
client.runtime.qualifyV124({ applicationId, operations }): Promise<ReceizOperationalCapabilityReportV124>
```

Each requested operation reports `available | degraded | unavailable`, actual scopes, service/registry/reducer versions, authenticated publication heads, dependency health, privacy-safe reason codes, and retry guidance. Package presence or method existence never implies operational availability. Applications use this report to hide or disable unavailable actions truthfully.

## 7. Access-filtered private domain additions

```ts
client.domains.verifiedPrivateAdditionsV124({
  applicationId,
  domainId,
  afterHead,
  authoritySessionHandle,
  accessGrantHandle,
  expectedViewerSubjectId,
  expectedViewerSubjectHead,
  expectedGrantHead
}): Promise<ReceizValidatedPrivateDomainAdditionsV124>
```

The authority session and access grant are opaque Receiz-issued handles. Receiz derives the viewer, ownership, scope, and grant authority from those handles; the optional expected IDs/heads are equality constraints only and can never grant access. Applications never custody or submit a raw access key. Responses reveal only events/projections authorized at the derived viewer and grant heads. Revocation removes future hydration eligibility without rewriting immutable history. Optional public collision/tombstone projections must never expose hidden coordinates/content, invite lists, owner or subject IDs, proof digests, access material, or private metadata.

## 8. Atomic multi-domain participants

```ts
client.execution.planAtomicOperationV124({
  applicationId,
  operations,
  participants,
  expectedParticipantHeads,
  semanticIdempotencyKey,
  attemptId
}): Promise<ReceizOperationPlanV124>
```

`operations` may combine registered custom reducers with subjects, worlds, inventories, access grants, Settlement, and Reserve. Every affected participant/head is exact, sorted, and unique. Any stale, missing, unauthorized, invalid, or insufficient participant produces zero writes everywhere. Unsupported cross-domain atomicity must be rejected, never simulated with compensating local writes.

## 9. Privacy-safe public recipient resolution

```ts
client.identity.resolvePublicRecipientV124({
  applicationId,
  authoritySessionHandle,
  expectedRequesterSubjectId,
  normalizedAlias,
  purpose,
  operationNonce
}): Promise<ReceizPublicRecipientProjectionV124>
```

Receiz derives the requester and limiter identity from the opaque authority session; `expectedRequesterSubjectId` is an equality check only and cannot select authority. Receiz owns normalization, Unicode-confusable rejection, publication consent, distributed abuse limiting, and exact destination subject/head binding. The response returns only approved public display data and an encrypted, purpose-bound locator—never raw owner/subject IDs, email, proof digests, private profiles, or reusable authority.

## Universal acceptance matrix

- Two processes stage the same semantic operation: exact bytes converge; altered bytes conflict with zero writes.
- Commit-then-lost-response resolves identically after restart without replanning.
- Tampered handles, plans, outcomes, authorities, heads, namespaces, causal parents, replay cursors, checkpoints, or terminal records fail closed.
- Failure injection around every persistence, execution, and adoption boundary proves zero unintended authoritative or cache-visible writes.
- Public/invited/private/open/revoked views are verified from owner and foreign clients without identity/content leakage.
- A single atomic test spans multiple registered reducers and built-in subject/inventory/value participants.
- Ten thousand warmed consumer ticks perform zero Receiz calls, verification, digesting, journaling, history scans, or UI publication.
- All V123 historical bytes continue to verify exactly.

## Exact Wildz mapping

Wildz uses these universal primitives as follows:

- Excavation and construction are registered-domain operations whose exact topology/safety evidence is staged and recovered by hosted execution.
- Player, creature, tool, material inventory, Phi, feature, and region heads participate in one atomic operation.
- Creature abilities and condition come from exact-head namespace projections, never uploaded card assertions.
- Public tunnels hydrate through verified domain replay; private homes/tunnels use access-filtered additions and head-bound revoke/open events.
- Cross-region tunnels use atomic multi-domain execution or are rejected.
- Wallet Send resolves usernames through the privacy-safe recipient primitive and recovers through hosted exactly-once execution.
- Gameplay composes only fully admitted projections at explicit hydration boundaries; movement, camera, rendering, card switching, and restore never call Receiz.

Until operational qualification and authenticated live evidence are green, material construction, shared physical excavation, private authored spaces, and affected transfer rails remain unavailable. No application database row, process singleton, browser journal, optimistic preview, renderer mesh, or locally manufactured digest may substitute for Receiz authority.
