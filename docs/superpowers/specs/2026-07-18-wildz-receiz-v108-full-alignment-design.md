# Wildz Receiz v108 Full Alignment Design

Date: 2026-07-18
Status: Approved for implementation planning

## Objective

Move Wildz completely to the Receiz v108 standard. Runtime code uses only the current root `@receiz/sdk@108.0.0` surfaces, operator tooling uses only `@receiz/mcp-server@108.0.0`, and repository AI doctrine aligns with `@receiz/ai-skills@108.0.0`. The application binds its constitutional context to ruleset `108.0.0` and registry digest `126ca9283fee4ef4c398dbcb958e861cbea191724fdab8eb08df55ff0c14bb79`.

This is a strict native-v108 cutover, not a package-only update or a v107 compatibility facade. Historical artifacts may be accepted only through compatibility behavior exposed by the v108 verifier. Wildz must not import `@receiz/sdk/v107`, call v107 operations, or present v107 key, head, receipt, reconcile, signed-command, or transport mechanics as current authority.

## Governing authority

The exact sealed proof object and its admitted, verified history are stronger truth than the SDK response, MCP result, AI output, server state, database state, IndexedDB state, session state, UI state, marketplace projection, compiler output, checker output, or release lock.

The v108 SDK, MCP package, and AI skills define the integration contract beneath that stronger truth. Receiz.com native behavior precedes developer rails. The packages do not become proof authority merely because their versions and registry digest match.

The implementation must enforce the following v108 release assertions:

- `RECEIZ_RELEASE_VERSION === "108.0.0"`;
- `RECEIZ_RULESET_VERSION === "108.0.0"`;
- `RECEIZ_V108_REGISTRY_DIGEST === "126ca9283fee4ef4c398dbcb958e861cbea191724fdab8eb08df55ff0c14bb79"`;
- all `ARTIFACT-001` through `ARTIFACT-010` laws are present and covered;
- `RECEIZ_V108_RELEASE_AUTHORITY.proofObjectFirst === true`;
- `RECEIZ_V108_RELEASE_AUTHORITY.receizComReferenceBeforeDeveloperRails === true`;
- a queued command is not a global commitment; and
- registry payloads, release locks, MCP output, and AI output are not proof admission.

## Package and repository cutover

Pin all three Receiz packages exactly to `108.0.0` and regenerate the pnpm lockfile from the official npm releases. Update package-version tests, release documentation, doctor output, checker scripts, generated contracts, MCP instructions, and local Wildz skills to the v108 registry and terminology.

Rename v107-specific scripts and public commands to v108 names. No current file, test description, or documentation may describe v107 operations as active. A historical version reference is allowed only when it clearly labels a verified legacy artifact or an earlier migration as historical evidence.

Compiler imports remain Node-only through `@receiz/sdk/compiler`. Runtime imports use the root SDK. The explicit historical `@receiz/sdk/v107` entry point is forbidden throughout application and test code.

## Proof-object custody and verification

Wildz must label and keep separate:

- a `payload`, which is application data and never an artifact; and
- a `sealed artifact`, which is the indivisible byte sequence issued by native Record -> Seal and carries integrity, Signature V4, owner, claim, verification path, provenance, and payload binding.

All artifact admission follows this sequence:

1. Receive the complete sealed artifact.
2. Call the v108 root SDK `artifacts.verifyAndOpen` operation.
3. Reject before extraction unless enclosing integrity, Signature V4, owner, claim, verification path, continuity, and payload binding all verify.
4. Persist the exact admitted artifact bytes and their independently computed digest.
5. Expose only `opened.verifiedPayload.bytes` to Wildz domain parsers.
6. Build local, public, world, market, and UI projections beneath the admitted proof.

Payload JSON, a manifest, a self-hash, a proof head, a receipt, a database row, a filename, an image preview, or an MCP inspection result cannot replace the complete sealed artifact.

## Native proof-object creation

Current creation uses `assets.createProofObject` so Receiz.com performs native Record before Seal. Wildz supplies only the artifact type and payload bytes plus bounded file and idempotency metadata. It must not author an owner, provenance root, claim, verification path, continuity object, settlement authority, or prior ownership head.

After creation, Wildz must:

1. require an SDK-issued current native Record -> Seal result;
2. call `artifacts.download` using only the issued sealed-artifact handle;
3. save the exact returned bytes without wrapping, repacking, recompressing, or relabeling;
4. independently hash the saved bytes and compare them with the SDK artifact digest;
5. reopen the saved file through `artifacts.verifyAndOpen`;
6. match artifact digest, payload digest, owner, claim, path, Record identity, carrier, and Signature V4 evidence; and
7. return no artifact when Record, Seal, download, round-trip, or re-verification fails.

There is no unsealed payload fallback.

## Portable continuity

Restore begins from complete verified identity and portable-state artifacts using the current root SDK identity and artifact operations. The application projects the admitted identity immediately and keeps the exact source artifact bytes as immutable history.

A continuity change creates a new payload that preserves:

- the verified account UID;
- immutable object identity;
- the previous artifact digest;
- the complete prior witnessed history;
- the provenance root;
- all known and unknown application namespaces byte-for-byte; and
- every domain object and receipt already carried by the verified source.

That new payload is passed to native Record -> Seal. It never edits or replaces the prior artifact. Local projections advance only after the new saved artifact passes independent byte identity and `verifyAndOpen` checks.

Server synchronization may discover verified additions and append them beneath carried truth. A larger, newer, or differently owned server projection cannot replace admitted local proof history.

If two verified artifacts conflict in namespace or history, Wildz preserves both artifacts and stops the affected append. Resolution requires an explicit new payload that cites both histories and produces a newly verified native artifact. Wildz never chooses a server timestamp, a latest row, or an arbitrary branch as truth.

## Ownership and provenance

Bearer ownership changes operate on the enclosing proof object. Wildz first calls `artifacts.verifyAndOpen`, then passes only the runtime-issued `opened.sealedArtifact` handle to `ownership.claimBearerAsset`, and finally downloads and re-verifies the returned complete artifact.

The operation derives prior ownership from verified carried proof and binds the destination owner to the authenticated Receiz account. Callers may not submit or override the owner, identity key, claim key, ownership head, provenance root, or history digest. A receipt is neither required nor sufficient for the current v108 ownership outcome.

Every successful ownership append must preserve:

- immutable object identity and exact payload;
- genesis ownership and every subsequent authenticated owner;
- the provenance root and prior history digest chain;
- all prior head references carried by the object;
- all unknown cross-application namespaces; and
- the complete original and newly issued artifacts as inspectable witnessed history.

The platform that created an artifact has no continuing ownership of its proof boundary. Any lawful application may append authenticated ownership and history through the v108 operation if it preserves the complete object and returns a newly verified native artifact.

On failed enclosing verification, non-bearer custody, authenticated-owner failure, custody conflict, Record failure, Seal failure, download mismatch, or output verification failure, Wildz returns no claimed artifact and leaves prior truth unchanged.

## Projection and persistence boundaries

IndexedDB remains a local owner-scoped cache of admitted artifacts, digests, and derived projections. It is not remote proof, public publication, market authority, settlement authority, or a source of current ownership.

Every projection records enough coordinates to return to its admitted sealed artifact and history. Projection repair rebuilds from verified artifacts. It never edits witnessed history to make the projection agree.

Public, world, social, and market data becomes durable only through confirmed v108 rails. Network failure, capability absence, stale state, digest mismatch, incomplete proof, or unconfirmed publication produces unavailable, conflict, or recovery-pending state. No local or emulated success advances shared authority.

## MCP alignment

MCP is v108 operator tooling and never a second verifier or continuity authority. Current artifact work is limited to the v108 artifact custody tools:

- `receiz_artifact_record_seal_plan`;
- `receiz_artifact_record_seal_execute`;
- `receiz_artifact_verify`;
- `receiz_artifact_extract_verified`;
- `receiz_artifact_round_trip_check`; and
- `receiz_artifact_explain`.

Current bearer ownership uses `receiz_bearer_asset_claim_plan` and `receiz_bearer_asset_claim_execute` with complete artifact bytes and exact permit-digest confirmation. Retired reconcile, caller-head, claim-key, identity-key, and receipt tools are not used as current operations.

MCP may inspect, plan, explain, and execute within delegated scopes after exact confirmation. Its output never authenticates an artifact, invents an owner, replaces carried history, or substitutes for independent SDK verification.

## AI-skill alignment

The checked-in Wildz builder, market operator, and release skills must be rewritten against v108 terminology, registry digest, operation names, allowed tools, forbidden operations, and required evidence. They must direct agents to complete-artifact verification, native Record -> Seal, append-only history, cross-platform ownership, unknown-namespace preservation, plan/permit/execute confirmation, independent verification, and release-lock refusal.

The skills must forbid payload-as-artifact handling, direct state writes, history or namespace rewrite, caller-owner substitution, origin-platform lock, receipt authority, v107 operation prerequisites, credential exposure, and claims of proof based on compiler, MCP, AI, hash-only, or UI evidence.

## Error and recovery semantics

All authority-changing paths fail closed. A failure returns a stable, explainable denial or recovery state and never partially advances local or shared authority.

Retries reuse stable idempotency metadata for the exact same operation. A changed artifact, payload, account, namespace set, or consequence requires a new plan and confirmation. A failed operation may be retried only from the last fully admitted artifact.

Recovery preserves source bytes and evidence. It may rebuild projections, resume an exact pending download, or repeat an idempotent native operation. It may not synthesize continuity, rewrite provenance, discard a conflicting verified artifact, or promote partial server data.

## Test and qualification contract

The implementation adds or updates evidence for:

- exact `108.0.0` package and lockfile integrity;
- v108 release identity, ruleset, registry digest, authority assertions, and `ARTIFACT-001` through `ARTIFACT-010` coverage;
- root-SDK-only imports and absence of active v107 operations;
- complete-artifact verification before payload extraction;
- native Record -> Seal creation, exact download bytes, independent hashing, and reopen verification;
- rejection of one-byte, payload, owner, Record, claim, path, namespace, provenance-root, prior-head, and history-digest substitutions;
- no-artifact behavior on Record or Seal failure;
- append-only continuity and conflict preservation;
- authenticated bearer ownership without caller owner/head/key inputs or receipt authority;
- cross-application round trips preserving object identity, exact payload bytes, full ownership history, provenance, receipts, and unknown namespaces;
- v108 verifier compatibility with supported historical sealed artifacts without historical SDK imports or write paths;
- deterministic replay and idempotent retry equivalence;
- projection invalidation after ownership changes;
- MCP v108 conformance and exact confirmation boundaries;
- local AI-skill contract alignment;
- secret-scan, typecheck, lint, full test, build, independent verifier, compatibility corpus, and release-lock results.

No failing test may be weakened to accept payload-only continuity, rewritten history, or projection authority. Missing production credentials or unavailable remote rails remain explicit external qualification gates and are not converted into passes.

## Completion criteria

The work is complete only when:

1. all three Receiz packages and all current repository contracts use v108;
2. no active v107 operation or authority assumption remains;
3. continuity, history, provenance, and ownership follow complete-artifact v108 law;
4. all required local evidence passes;
5. MCP conformance passes;
6. an independent verifier accepts exact saved artifacts and rejects mutations;
7. the compatibility corpus passes through v108 surfaces;
8. the release lock passes; and
9. every unavailable live capability is reported truthfully as a remaining external gate.

