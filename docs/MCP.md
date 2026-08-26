# Wildz Receiz SDK, MCP, and AI-skills contract

Wildz pins `@receiz/sdk@124.0.3` as the application/runtime boundary and `@receiz/mcp-server@124.0.3` plus `@receiz/ai-skills@124.0.3` as development tooling. All three exact packages resolve from the public npm registry, and `pnpm-lock.yaml` pins their published SHA-512 integrity values. The patch release retains the coordinated v124 registry digest `d02429151b0bcebdaeb89485792e377afc55130f9a25e07982c1c88221314247` and operation-matrix digest `540d1c1bf39f1b288b257c79a6e020bdcc5e587fc9b7dbf6b7aaa5d082e20ad5`. No fork, package patch, third-party database, or external database is introduced.

The packaged MCP runtime remains operator tooling, and the packaged AI skills remain doctrine for builders and agents. Neither outranks verified artifact continuity or server admission.

The repository-wide [Receiz-first engineering law](RECEIZ_FIRST_ENGINEERING.md) is mandatory: inspect exact SDK primitives first, matching MCP tools/schemas second, applicable AI skills third, and the existing proof path fourth before designing the smallest native composition. Custom infrastructure is blocked unless an approved capability-gap record proves the installed coordinated release cannot supply the result. `pnpm receiz:architecture-lock` enforces this process and its runtime boundaries inside every release check.

Run MCP from an agent host with `pnpm exec receiz-mcp`. Public reads need no bearer token. Delegated writes require a Receiz-issued Connect/OIDC token supplied to the MCP process as `RECEIZ_ACCESS_TOKEN` or `RECEIZ_CONNECT_ACCESS_TOKEN`. Keep MCP imports out of `app/`, `src/`, client components, and browser bundles.

## v124 application contract, registry, and checker

`receiz.app.json` defines Wildz with the stable `receiz.app.contract.v1` schema and selects `artifact-first` authority with `allowDatabaseAuthority: false`. The installed v124 compiler/checker binds the repository to registry digest `d02429151b0bcebdaeb89485792e377afc55130f9a25e07982c1c88221314247` and operation-matrix digest `540d1c1bf39f1b288b257c79a6e020bdcc5e587fc9b7dbf6b7aaa5d082e20ad5`.

V124 coordinates the SDK, MCP, AI manifests, ruleset, registry, operation matrix, compatible package range, and packed runtime as one release identity. It retains the V123 value rails and adds canonical Kai time, challenge construction, authority sessions, runtime qualification, authenticated domain replay, durable execution, and public recipient resolution.

V124 remains source-first and non-breaking for Wildz: sealed proof objects remain authority, projections only accelerate distribution and restoration, and weaker partial projections cannot erase stronger verified fields.

Run `pnpm receiz:check` to invoke the official v124 repository checker against package target `124.0.3` and verify the patch release, retained `124.0.0` ruleset, registry digest, 53-operation matrix, protocol limits, and authority flags. The command is also part of the release gate. A clean checker result confirms that the declared repository integration requirements have evidence; it is not a substitute for artifact verification, strict-live qualification, or remote mutation evidence.

The checked-in historical migration checkpoint remains forward-only evidence: no sealed artifact, receipt, or proof head was rewritten. Historical sealed bytes remain eligible for current verification, but historical admissions, actors, plans, capabilities, stores, confirmations, or receipts cannot authorize a current receiver. A queued proposal is not a global commitment.

## v121 artifact operation boundary

The v121 operation matrix contains the prior artifact/global rails and retains `profile-showcase.genesis.plan`, `profile-showcase.append.plan`, `economy-showcase.genesis.plan`, `economy-showcase.append.plan`, and `economy-showcase.merge.plan`. Profile showcases use the literal `profile-showcase:<owner>` identity—not a payload digest—and successor history travels in the sealed bytes without introducing a new signer, issuer, or head authority. Economy merges require verified sibling heads. Admission is eligibility, never operation authority. Planning performs zero writes and binds the v121 registry and operation matrix, runtime-custodied actor/history evidence, literal identity, canonical body/event, expected head, idempotency identity, and named commit domain. Only a verified plan-bound capability may seal; staging stores immutable candidate bytes without advancing a head; commit independently resolves and reverifies the staged bytes before atomic acceptance. Receipts are report-only and cannot re-enter an authority-bearing API.

V121 also retains the v115 native-capture and PBI-authorship laws: native capture attests only a dedicated camera ceremony, authorship requires the canonical verified enclosing predecessor, does not transfer ownership or alter media truth, and appends in verified order. Offline settlement does not wait for global publication.

V121 exposes direct bearer transfer instruments, but a bearer instrument is not the Wildz marketplace's separate conditional listing/payment/settlement append. The market adapter reports missing capability and fails closed when that append is unavailable. MCP must not synthesize it, and IndexedDB or process memory must not be presented as durable market authority.

## v121 native proof objects

New card and Vault exports use the SDK v121 native Record → Seal operation. Wildz supplies only the artifact type and exact payload bytes. The authenticated Receiz service resolves owner, claim, verification path, and native continuity; application code does not author ownership, namespace, provenance, settlement, or prior-head authority.

An export is accepted only when all of these agree:

- the authenticated Wildz player and SDK-returned Receiz owner;
- `continuity.carrier === "native-record-seal"`;
- a non-empty claim and `/v/` verification path;
- the claim and path in the SDK verification bundle; and
- successful SDK verification with no integrity errors.

The SDK-returned native artifact is the final download. Its bytes and MIME type are preserved exactly; Wildz never wraps a new v121 artifact in a legacy portable-asset envelope. The `wildz-v120` idempotency namespace binds retries to the exact payload digest. Verification obeys the published v121 protocol limits and fails closed when the local runtime cannot safely materialize an otherwise protocol-valid artifact.

## Legacy v102 read compatibility

Existing `receiz.portable_asset.v1` artifacts remain importable only after v121 `artifacts.verifyAndOpen` returns `verified-legacy-read`. Wildz may parse the returned `verifiedPayload.bytes`; it never parses the enclosing artifact itself. Compatibility is read-only and isolated from all current proof creation.

Cryptographic authority comes from complete-artifact `artifacts.verifyAndOpen`. Local decoding, filenames, visual previews, MCP inspection, and model output cannot authenticate an artifact.

An offline Identity-Seal Vault is a separate supported authority path. It retains the official Receiz Identity Seal plus the Wildz signed V3 binding. Protected keys request their passphrase for that export operation only; the passphrase is neither persisted nor written to the artifact.

## MCP v121 living-subject surface

The v121 package retains 37 typed living-subject tools in five coherent groups:

- subject resolution and projections: resolve, state, history, memory query, relationships, inventory;
- Twin: profile, message, portable-mind export, and mind-import plan;
- mandates: get, plan, activate, pause, and revoke;
- deterministic world/runtime: additions, command plan/validate/execute, transaction plan/execute, receipt, replay, job enqueue/status/cancel, and conformance;
- proof brain and custody: brain head/search/resolve/stream plus bearer transfer preview, instrument issue/inspect/claim, cancel, and status.

Wildz uses the official subject Twin at the application observer boundary. The Twin receives exact proof references and may return speech, performance, and proposed intents. Speech is an observation; an intent is zero-write until a separate world command validates and executes. Factual memory must cite admitted event objects. Multi-subject effects commit atomically, failed decisions write zero—including zero Kai—and active mandates are reverified at execution.

Creature conversation admits the exact proof object into the SDK's v121 living-subject runtime and uses its local `runtime.subjects.twin.message` projection first. The exact card proof object remains authority; the route/server is only verifier, observer, transport, and optional enrichment. The existing deterministic conversation append to the exact live proof head remains independent of voice playback. MCP validates and audits this contract but is not imported into runtime code. The local neural renderer is an integrity-pinned acoustic payload, never an intelligence or identity rail. Future acoustic-inspection tooling may inspect payload integrity, readiness, proof-derived profiles, and render conformance without moving those tools into the browser runtime.

Bearer tools preserve the subject identity and proof brain while changing custody. Claim revokes former-owner authority immediately. Transfer preview, an issued instrument, inspection output, status, or a local projection is not custody by itself; claim must return exact evidence that the receiver independently verifies.

## MCP authority boundary

MCP may inspect capabilities, resolve public proof/app-state records, and prepare delegated operations. The current artifact inventory remains exactly nine tools: `receiz_artifact_verify`, `receiz_artifact_admit`, `receiz_artifact_append_plan`, `receiz_artifact_transition_seal_and_stage`, `receiz_artifact_transition_commit`, `receiz_artifact_global_resolve`, `receiz_artifact_reconcile_plan`, `receiz_artifact_reconcile_stage`, and `receiz_artifact_reconcile_commit`. The 37 living-subject tools are an additional typed surface, not replacement proof authority. Bearer ownership uses complete artifact bytes. MCP never reconstructs a smaller local claim.

Global means acceptance by the named `receiz.com/global/v1` coordination domain, not universal consensus. Known artifact truth paints before remote startup. Returned bytes are independently reverified, structural divergence is preserved for explicit resolution, and accepted-head status is reported separately from effect delivery. A Connect token coordinates a request but is not artifact, identity, or operation authority.

Identity signatures, native proof-object admission, ownership heads, settlement, player confirmation, and release authority remain SDK/artifact/server concerns. Never place credentials or passphrases in prompts, logs, examples, browser storage, generated proof metadata, or MCP resources. Canonical mutations are command-only and require actor and tenant binding, scoped capability, expected revision/head, causal parents, registry digest, idempotency, bounded effects, and exact permit-digest confirmation for listing, offer, trade, payment, transfer, publication, or release actions.

## Competitive operator and reviewer surface

Use MCP as a read-only audit surface first. An operator may inspect current capabilities and sanitized public/app-state records to compare tournament health, season participation, admission failures, ruleset distribution, replay commitments, disconnects, settlement latency, and unresolved publication states. A replay review must start from the exact Arena definition, signed admission envelope, pinned fighter revisions, Kai root, input transcript, checkpoints, and terminal digest; MCP output can organize that evidence but cannot make a replay valid. Creature review likewise begins with an SDK-verified card or Vault and then checks exact asset identity, parent linkage, event and projection digests, Kai chronology, bounded effects, and terminal life state.

Do not invent a tournament or balance tool when the installed v121 inventory does not expose one. Use the installed nine artifact and 37 living-subject tools only for their documented operations, SDK verification for enclosing artifacts, and repository/server audit adapters for product-specific projections. If a required read, audit, or conditional command is unavailable, report the capability as unavailable and leave the operation pending.

Balance analysis and coaching may consume sanitized, already-admitted replays to produce simulations, matchup aggregates, counterfactuals, or recommendations. Those outputs are advisory: they do not alter matchmaking, ratings, cards, season standings, or proofs. AI and MCP never sign a covenant or admission envelope, never admit a match or creature event, and never choose a hidden live-player action.

Commands remain a separate, explicit-confirmation path. Publication, tournament administration, season closure, settlement, release, and deployment require the exact reviewed command/permit digest, a verified actor and scoped capability, current expected head/revision, and a fresh human confirmation immediately before execution. Read-only audit permission is never mutation permission. Record plan, attempt, admission, and effect-delivery status separately; a receipt or successful attempt is not proof of publication or effect delivery.

This documentation records the supported operating boundary; it is not evidence that MCP, authenticated tournament reads, remote publication, or any mutation was exercised in this release. Those claims require saved, sanitized release evidence from the actual run.
