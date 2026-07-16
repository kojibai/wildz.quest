# Wildz Receiz SDK, MCP, and AI-skills contract

Wildz uses `@receiz/sdk@^103.0.0` as application/runtime authority and requests `@receiz/mcp-server@^103.0.0` plus `@receiz/ai-skills@^103.0.0` as development dependencies. The installed release graph resolves all three packages to `103.0.0`. No third-party database is introduced.

The published MCP `103.0.0` manifest currently carries an internal `@receiz/sdk: workspace:^` specifier. Wildz applies the same narrow pnpm override as the official Receiz application template:

```json
"@receiz/mcp-server@103.0.0>@receiz/sdk": "103.0.0"
```

This is dependency-resolution compatibility only. It does not fork SDK behavior or replace proof verification. The packaged MCP runtime remains operator tooling, and the packaged AI skills remain doctrine for builders and agents.

Run MCP from an agent host with `pnpm exec receiz-mcp`. Public reads need no bearer token. Delegated writes require a Receiz-issued Connect/OIDC token supplied to the MCP process as `RECEIZ_ACCESS_TOKEN` or `RECEIZ_CONNECT_ACCESS_TOKEN`. Keep MCP imports out of `app/`, `src/`, client components, and browser bundles.

## v103 native proof objects

New card and Vault exports use the SDK v103 native Record → Seal operation. Wildz supplies only the artifact type and exact payload bytes. The authenticated Receiz service resolves owner, claim, verification path, and native continuity; application code does not author ownership, namespace, provenance, settlement, or prior-head authority.

An export is accepted only when all of these agree:

- the authenticated Wildz player and SDK-returned Receiz owner;
- `continuity.carrier === "native-record-seal"`;
- a non-empty claim and `/v/` verification path;
- the claim and path in the SDK verification bundle; and
- successful SDK verification with no integrity errors.

The SDK-returned native artifact is the final download. Its bytes and MIME type are preserved exactly; Wildz never wraps a new v103 artifact in a legacy portable-asset envelope.

## Legacy v102 read compatibility

Existing `receiz.portable_asset.v1` artifacts remain importable through a bounded, app-owned legacy decoder. That reader validates the canonical document, bound payload hash, artifact basis, and proof claim before exposing the embedded Wildz PNG. It is read-only and is isolated from all new proof creation.

Cryptographic authority still comes from `verification.verifyArtifact(file)` and verified server continuity. Local decoding, filenames, visual previews, MCP inspection, and model output cannot authenticate an artifact.

An offline Identity-Seal Vault is a separate supported authority path. It retains the official Receiz Identity Seal plus the Wildz signed V3 binding. Protected keys request their passphrase for that export operation only; the passphrase is neither persisted nor written to the artifact.

## MCP authority boundary

MCP may inspect capabilities, resolve public proof/app-state records, and prepare delegated commands. Offline file inspection is structural evidence, not proof verification. Use the SDK artifact verifier for admission and never reconstruct a smaller local claim from MCP output.

Identity signatures, native proof-object admission, ownership heads, settlement, player confirmation, and release authority remain SDK/artifact/server concerns. Never place credentials or passphrases in prompts, logs, examples, browser storage, generated proof metadata, or MCP resources. Mutations require the authenticated actor, expected revision/head, an idempotency key, and explicit confirmation for listing, offer, trade, payment, transfer, publication, or release actions.
