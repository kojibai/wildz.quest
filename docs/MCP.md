# Wildz MCP contract

Wildz uses `@receiz/sdk@^101.0.0` as the application/runtime authority and installs `@receiz/mcp-server@101.0.0` as an exact development dependency for agent-side operations. MCP is operational tooling only: it may inspect capabilities, validate proofs, and prepare commands, but identity signatures, ownership heads, settlement admission, and player confirmations remain authoritative SDK/proof-object concerns.

Run the locally pinned server from an MCP host with `pnpm exec receiz-mcp`. Public reads need no bearer token. Delegated writes require a Receiz-issued Connect/OIDC token supplied to the MCP process as `RECEIZ_ACCESS_TOKEN` (or `RECEIZ_CONNECT_ACCESS_TOKEN`). Keep the server import out of `app/`, `src/`, client components, and browser bundles.

Receiz 101 adds complete portable proof objects (`receiz.portable_asset.v1`). Asset and Sports manifest shapes remain available for validation/projection, but they are inspection-only and cannot be admitted as proof-object truth without a complete sealed artifact. Wildz continues to use official SDK readers, writers, proof memory, and identity APIs rather than recreating that authority.

Wildz does not currently call the v101 network `createProofObject` client path. In 101.0.0 that path compares a server-round-tripped document with raw `JSON.stringify`, so semantically identical nested records with different insertion order can produce `continuity_round_trip_failed` even when canonical bytes agree. Keep that path out of browser runtime until an integration test proves order-insensitive canonical equality. `extractReceizPortableAssetDocument` checks canonical structure and bound hashes; it is not, by itself, cryptographic signature verification—the full client flow separately calls the document-verification rail.

Never place credentials in prompts, logs, examples, browser storage, or generated artifacts. Mutations require actor identity, expected revision, idempotency key, and explicit confirmation for listing, offer, trade, payment, transfer, publication, or release actions.
