# Wildz v111 Proof-World Integration

## Objective

Make Wildz consume the continuity model already defined by `@receiz/sdk`, `@receiz/mcp-server`, and `@receiz/ai-skills`. The sealed Receiz proof object is the strongest truth for the global world, cards, creatures, ownership, progression, and Vault recovery. Wildz projections, server state, browser state, receipts, and public-store rows remain derived views beneath that truth.

## Constitutional context

- SDK, MCP, AI Skills, and ruleset: `111.0.0`.
- Registry digest: `cf02d0bce6ad1541cfe84e27bfb1036777b29616bf8a1e5aeafb899a945e359a`.
- Laws: `ARTIFACT-001` through `ARTIFACT-020`, `receiz.merge.causal`, `receiz.replay.deterministic`, `receiz.history.append-only`, `receiz.identity.portable`, `artifact.complete-object-custody`, `artifact.verify-before-extract`, and `ownership.cross-platform-proof-object-continuity`.
- Forbidden authority paths: direct state writes, history rewrites, payload-as-artifact handling, structural objects as authority, origin-platform locks, and server/public-store projections replacing verified artifacts.

## Existing SDK operations to adopt

Wildz will integrate, not reimplement:

- `createReceizProofHistoryNode`, `normalizeReceizProofHistory`, and `mergeReceizProofHistoryPrefix` for append-only state, ownership transitions, terminal events, namespace preservation, and independently verified evidence roots.
- `createReceizCausalRecord` and `createReceizCausalHistory` for causal parents, Kai ordering, deterministic heads, replay, and proof-memory projection.
- `appendReceizPortableAssetOwnership` and `deriveReceizPortableOwnershipContinuity` for bearer ownership handoffs while preserving immutable object identity and provenance.
- `artifacts.verifyAndOpen`, `artifacts.admit`, `artifacts.planRecovery`, `artifacts.admitAndRecover`, and `artifacts.commitRecovery` for exact-byte verification and atomic local recovery.
- `assets.createProofObject` followed by `artifacts.download` and independent reopen verification for every changed portable proof object.
- Connect/OIDC user access tokens for user-authorized Record, Seal, and publication operations. No player login or player-driven world action depends on a manually configured `RECEIZ_CONNECT_ACCESS_TOKEN`.

## Authority model

### Global world

The global Wildz world is a sealed proof object. Each admitted gameplay command produces a causal record and proof-history append carrying its Kai pulse, causal parents, receipt, event, and `wildz.quest` namespace data. `WildsWorldProjection` is rebuilt from verified history and may be cached or publicly projected, but it is never authority by itself.

World snapshots and commands must resolve the same verified head. Authenticated clients never receive an isolated practice boss projection. If the canonical head cannot be verified, the client keeps its last verified artifact projection, queues local commands, and reports synchronization as pending without substituting unrelated state.

### Cards and creatures

A creature card is a portable sealed proof object. Its immutable identity and provenance remain stable. Growth, XP, bond, level, scores, abilities, health/life changes, achievements, battle results, evolution, and other gameplay effects are state/history appends in the Wildz namespace. The current card presentation is derived from the verified proof history.

Every local gameplay action immediately creates a causally linked local addition and updates the derived UI. Offline additions remain verified local truth beneath the last sealed artifact until native Record -> Seal synchronization returns a complete descendant artifact. A queued command is not represented as a global commitment.

### Vault and cross-application recovery

The Vault is a complete sealed portable-state proof object containing the admitted identity binding, exact card artifacts or custody references, player state namespaces, causal additions, and synchronization outbox. Imports first verify the enclosing artifacts, then recover only from verified payload bytes. Unknown application namespaces are preserved byte-for-byte.

Any compatible application can call `admitAndRecover`, project current verified state with zero network calls, and atomically commit through `commitRecovery`. A changed Vault or card creates a new native Record -> Seal artifact linked to the prior artifact digest; prior artifacts are never edited.

### Ownership

Uploading and claiming a bearer card creates an authenticated `ownership.transition` append. A sequential offline chain of any length is preserved and submitted as a complete causal suffix. After verification, current ownership is derived from the latest admitted ownership transition while genesis ownership and every prior transition remain immutable provenance.

Divergent verified histories are not collapsed by a custom “latest row” merge. Both artifacts are preserved and the affected append stops until an explicit resolution cites both verified histories, as required by v111 portable continuity.

## Connectivity and token flow

1. Verify the Identity Seal, Receiz Key, Record, or accepted Vault artifact.
2. Complete Connect/OIDC when delegated Record, Seal, or public projection scopes are required.
3. Store the returned access token in the existing secure HTTP-only scoped cookie.
4. Verify the token profile matches the admitted proof identity before attaching it to the world actor.
5. Bootstrap or recover the verified global world head.
6. Mount gameplay from that verified head plus verified local causal additions.
7. Reconcile automatically on reconnect, reseal changed proof objects, independently reopen them, and replace projections only with verified descendants.

An optional delegated service token may run unattended scheduler work, but it is not required for player identity, player-driven world bootstrap, boss entry, progression, card save, or Vault recovery.

## Failure behavior

- Exact-byte verification failure returns no new artifact or authoritative projection.
- Missing Connect authority retains verified local play and queues additions; it does not switch to a different practice world.
- Registry skew, missing evidence roots, broken causal parents, namespace conflicts, owner/claim/path mismatch, and divergent verified heads fail closed with structured zero-write results.
- Public-store or server-cache failure cannot overwrite a verified local artifact.
- Repeated commands and additions deduplicate by SDK-derived digests and idempotency identities.

## Migration boundary

Legacy Wildz local seals, custom world event rows, and V3 Vault payloads remain read-compatible inputs only. They must be admitted and migrated through current v111 verification and native Record -> Seal. The migration preserves prior bytes and histories; it does not bless custom digests, cursors, receipts, or public-store rows as current proof authority.

## Required verification

- Typecheck and existing law coverage.
- Mutation tests for world, card progression, ownership, and Vault updates.
- Offline partition and multi-device causal simulations.
- Replay equivalence from sealed history to world/card/Vault projections.
- Ten-step offline ownership handoff and reconnect test.
- Cross-application exact-byte round trip with unknown namespace preservation.
- Independent verifier and canonical exact-byte readmission.
- MCP conformance and v111 release lock.
- Structured zero-write tests for every authority failure.

Implementation is incomplete until all required evidence passes. Local UI success, MCP output, server rows, plan digests, and receipts alone do not prove completion.
