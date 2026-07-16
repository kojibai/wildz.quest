# Wildz Receiz SDK, MCP, and AI-skills contract

Wildz pins `@receiz/sdk@104.0.0` as application/runtime authority and `@receiz/mcp-server@104.0.0` plus `@receiz/ai-skills@104.0.0` as development tooling. The finalized packages resolve directly from the official npm registry, and `pnpm-lock.yaml` pins their published integrity values. No fork, patch, third-party database, or external database is introduced.

The packaged MCP runtime remains operator tooling, and the packaged AI skills remain doctrine for builders and agents. Neither outranks verified artifact continuity or server admission.

Run MCP from an agent host with `pnpm exec receiz-mcp`. Public reads need no bearer token. Delegated writes require a Receiz-issued Connect/OIDC token supplied to the MCP process as `RECEIZ_ACCESS_TOKEN` or `RECEIZ_CONNECT_ACCESS_TOKEN`. Keep MCP imports out of `app/`, `src/`, client components, and browser bundles.

## v104 application contract and checker

`receiz.app.json` defines Wildz as a v104 `receiz.app.contract.v1` application with the `identity`, `proof`, `proofMemory`, `publicStore`, and `commerce` features. It selects `artifact-first` authority and sets `allowDatabaseAuthority` to `false`. The SDK's `defineReceizApp` and `compileReceizAppContract` APIs compile that declaration into a deterministic integration plan; the checked-in `receiz.generated.json` records the repository evidence for Record-before-Seal, durable proof memory, continuity verification, idempotency, and browser-safe secrets.

Run `pnpm receiz:check` to invoke the official v104 repository checker against target `104.0.0`. The command is also part of the release gate. A clean checker result confirms that the declared repository integration requirements have evidence; it is not a substitute for artifact verification, strict-live qualification, or remote mutation evidence.

The SDK v104 commerce clients do not expose the Wildz-specific verified conditional market ownership append required by the game contract. The market adapter therefore reports missing capability and fails closed when that append is unavailable. MCP must not synthesize it, and IndexedDB or process memory must not be presented as durable market authority.

## v104 native proof objects

New card and Vault exports use the SDK v104 native Record → Seal operation. Wildz supplies only the artifact type and exact payload bytes. The authenticated Receiz service resolves owner, claim, verification path, and native continuity; application code does not author ownership, namespace, provenance, settlement, or prior-head authority.

An export is accepted only when all of these agree:

- the authenticated Wildz player and SDK-returned Receiz owner;
- `continuity.carrier === "native-record-seal"`;
- a non-empty claim and `/v/` verification path;
- the claim and path in the SDK verification bundle; and
- successful SDK verification with no integrity errors.

The SDK-returned native artifact is the final download. Its bytes and MIME type are preserved exactly; Wildz never wraps a new v104 artifact in a legacy portable-asset envelope. The deployed `wildz-v103` idempotency namespace remains compatibility-stable across the SDK upgrade so retries cannot create duplicate proof objects.

## Legacy v102 read compatibility

Existing `receiz.portable_asset.v1` artifacts remain importable through a bounded, app-owned legacy decoder. That reader validates the canonical document, bound payload hash, artifact basis, and proof claim before exposing the embedded Wildz PNG. It is read-only and is isolated from all new proof creation.

Cryptographic authority still comes from `verification.verifyArtifact(file)` and verified server continuity. Local decoding, filenames, visual previews, MCP inspection, and model output cannot authenticate an artifact.

An offline Identity-Seal Vault is a separate supported authority path. It retains the official Receiz Identity Seal plus the Wildz signed V3 binding. Protected keys request their passphrase for that export operation only; the passphrase is neither persisted nor written to the artifact.

## MCP authority boundary

MCP may inspect capabilities, resolve public proof/app-state records, and prepare delegated commands. Offline file inspection is structural evidence, not proof verification. Use the SDK artifact verifier for admission and never reconstruct a smaller local claim from MCP output.

Identity signatures, native proof-object admission, ownership heads, settlement, player confirmation, and release authority remain SDK/artifact/server concerns. Never place credentials or passphrases in prompts, logs, examples, browser storage, generated proof metadata, or MCP resources. Mutations require the authenticated actor, expected revision/head, an idempotency key, and explicit confirmation for listing, offer, trade, payment, transfer, publication, or release actions.
