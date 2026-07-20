# Wildz Receiz SDK, MCP, and AI-skills contract

Wildz pins `@receiz/sdk@113.0.0` as application/runtime authority and `@receiz/mcp-server@113.0.0` plus `@receiz/ai-skills@113.0.0` as development tooling. The finalized packages resolve directly from the official npm registry, and `pnpm-lock.yaml` pins their published integrity values. No fork, patch, third-party database, or external database is introduced.

The packaged MCP runtime remains operator tooling, and the packaged AI skills remain doctrine for builders and agents. Neither outranks verified artifact continuity or server admission.

Run MCP from an agent host with `pnpm exec receiz-mcp`. Public reads need no bearer token. Delegated writes require a Receiz-issued Connect/OIDC token supplied to the MCP process as `RECEIZ_ACCESS_TOKEN` or `RECEIZ_CONNECT_ACCESS_TOKEN`. Keep MCP imports out of `app/`, `src/`, client components, and browser bundles.

## v113 application contract, registry, and checker

`receiz.app.json` defines Wildz as a v113 `receiz.app.contract.v1` application with the `identity`, `proof`, `proofMemory`, `publicStore`, and `commerce` features. It selects `artifact-first` authority and sets `allowDatabaseAuthority` to `false`. The SDK's compiler APIs compile that declaration into a deterministic integration plan; the checked-in `receiz.generated.json` records repository evidence for Record-before-Seal, durable proof memory, continuity verification, idempotency, and browser-safe secrets. Constitutional operations bind to registry digest `4c4aa85f9785d205dcf7e4e5109837a83f8c3bf8e166130ae7e87353f299c637` and application-operation matrix digest `091ab9e6b3acb05283510a19754e53c637dbd96b47b499a524dc44c34f8e783b`.

Run `pnpm receiz:check` to invoke the official v113 repository checker against target `113.0.0` and verify the exact release, ruleset, registry digest, 30 artifact laws, operation matrix, protocol limits, and authority flags. The command is also part of the release gate. A clean checker result confirms that the declared repository integration requirements have evidence; it is not a substitute for artifact verification, strict-live qualification, or remote mutation evidence.

The checked-in historical migration checkpoint remains forward-only evidence: no sealed artifact, receipt, or proof head was rewritten. The current runtime and checker are v113-only. Historical sealed bytes remain eligible for current verification, but historical admissions, actors, plans, capabilities, stores, confirmations, or receipts cannot authorize a current receiver. A queued proposal is not a global commitment.

## v113 artifact operation boundary

The v113 operation matrix adds `artifact.global.resolve` and `artifact.offline.reconcile` to exact-byte verification, same-runtime admission, append planning, identity capability signing, transition seal/stage/commit, command execution, and public-proof projection location. Admission is eligibility, never operation authority. Planning performs zero writes and binds SDK-issued verified history and actor evidence, the registry-discovered operation law, canonical event, expected head, idempotency identity, and named commit domain. Only a verified plan-bound capability may seal; staging stores immutable candidate bytes without advancing a head; commit independently resolves and reverifies the staged bytes before atomic acceptance. Receipts are report-only and cannot re-enter an authority-bearing API.

The SDK v113 commerce clients do not expose the Wildz-specific verified conditional market ownership append required by the game contract. The market adapter therefore reports missing capability and fails closed when that append is unavailable. MCP must not synthesize it, and IndexedDB or process memory must not be presented as durable market authority.

## v113 native proof objects

New card and Vault exports use the SDK v113 native Record → Seal operation. Wildz supplies only the artifact type and exact payload bytes. The authenticated Receiz service resolves owner, claim, verification path, and native continuity; application code does not author ownership, namespace, provenance, settlement, or prior-head authority.

An export is accepted only when all of these agree:

- the authenticated Wildz player and SDK-returned Receiz owner;
- `continuity.carrier === "native-record-seal"`;
- a non-empty claim and `/v/` verification path;
- the claim and path in the SDK verification bundle; and
- successful SDK verification with no integrity errors.

The SDK-returned native artifact is the final download. Its bytes and MIME type are preserved exactly; Wildz never wraps a new v113 artifact in a legacy portable-asset envelope. The `wildz-v113` idempotency namespace binds retries to the exact payload digest. Verification obeys the published v113 protocol limits and fails closed when the local runtime cannot safely materialize an otherwise protocol-valid artifact.

## Legacy v102 read compatibility

Existing `receiz.portable_asset.v1` artifacts remain importable only after v113 `artifacts.verifyAndOpen` returns `verified-legacy-read`. Wildz may parse the returned `verifiedPayload.bytes`; it never parses the enclosing artifact itself. Compatibility is read-only and isolated from all current proof creation.

Cryptographic authority comes from complete-artifact `artifacts.verifyAndOpen`. Local decoding, filenames, visual previews, MCP inspection, and model output cannot authenticate an artifact.

An offline Identity-Seal Vault is a separate supported authority path. It retains the official Receiz Identity Seal plus the Wildz signed V3 binding. Protected keys request their passphrase for that export operation only; the passphrase is neither persisted nor written to the artifact.

## MCP authority boundary

MCP may inspect capabilities, resolve public proof/app-state records, and prepare delegated operations. The single current v113 artifact inventory is exactly `receiz_artifact_verify`, `receiz_artifact_admit`, `receiz_artifact_append_plan`, `receiz_artifact_transition_seal_and_stage`, `receiz_artifact_transition_commit`, `receiz_artifact_global_resolve`, `receiz_artifact_reconcile_plan`, `receiz_artifact_reconcile_stage`, and `receiz_artifact_reconcile_commit`. The first five also describe the historical v112 compatibility inventory; they do not form a second current surface. Bearer ownership uses complete artifact bytes. MCP never reconstructs a smaller local claim.

Global means acceptance by the named `receiz.com/global/v1` coordination domain, not universal consensus. Known artifact truth paints before remote startup. Returned bytes are independently reverified, structural divergence is preserved for explicit resolution, and accepted-head status is reported separately from effect delivery. A Connect token coordinates a request but is not artifact, identity, or operation authority.

Identity signatures, native proof-object admission, ownership heads, settlement, player confirmation, and release authority remain SDK/artifact/server concerns. Never place credentials or passphrases in prompts, logs, examples, browser storage, generated proof metadata, or MCP resources. Canonical mutations are command-only and require actor and tenant binding, scoped capability, expected revision/head, causal parents, registry digest, idempotency, bounded effects, and exact permit-digest confirmation for listing, offer, trade, payment, transfer, publication, or release actions.
