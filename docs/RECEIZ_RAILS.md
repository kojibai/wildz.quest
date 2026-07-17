# Receiz rails for Wildz v3

Wildz targets the exact `@receiz/sdk@106.0.0` release. Application code uses SDK identity, artifact, native proof-object, publication, audit, and settlement clients. `@receiz/mcp-server@106.0.0` and `@receiz/ai-skills@106.0.0` are operator tooling only; neither can replace proof verification or independently admit a mutation. The finalized packages resolve directly from the official npm registry with published integrity values pinned by the lockfile.

## Authority map

| Product primitive | Authoritative evidence | Failure rule |
|---|---|---|
| Receiz identity | Verified Identity Seal/key continuation, or a verified Vault with explicit v106 owner-continuity binding | A legacy proof-sealed Vault restores scoped game state but cannot replace or invent canonical account identity |
| Local owner continuity | Owner-scoped verified state in IndexedDB | Wrong-owner, stale, partial, or invalid state is rejected |
| Portable cards and Vaults | Exact portable payload, card proofs, player binding, and enclosing Vault custody | Invalid domains, conflicting bodies, and incompatible proof forks are rejected; exact duplicates are dropped |
| V106 native proof export | SDK Record → Seal result, authenticated owner, claim, verify path, and byte-exact native artifact | Any owner, claim, path, verification, or byte mismatch fails closed; no legacy-wrapper fallback |
| Legacy v102 proof import | Strict local envelope/hash decoding plus SDK verification of the enclosing server artifact | Legacy decoding is read-only and never creates new authority |
| Canonical world | Server-admitted V3 projection plus publication/audit result | Failed publication reports recovery pending, never durable success |
| Public profile/card projection | Sanitized Receiz public state with expected head and confirmed digest | Private Seal/owner data is omitted; unconfirmed publication fails |
| Listing, offer, trade, transfer | Verified command admission and conditional append using current ownership head, expected revision, actor, tenant, capability, causal parents, registry digest, and idempotency | The v106 SDK has no Wildz-specific conditional market append surface; missing capability, conflict, or invalid proof fails closed |
| Checkout and payment | Receiz checkout plus admitted settlement evidence | Checkout creation alone never transfers ownership |

Historical creator or owner coordinates stored inside individual card proofs remain immutable provenance. They do not prevent a verified Vault from restoring cards produced on another compatible Receiz application without rewriting those histories. For a legacy Vault without owner-continuity binding, the enclosing proof establishes artifact-scoped recovery—not canonical global account ownership; account-only mutations remain Identity Seal/key-gated.

The historical-owner subset of an exact verified Vault is committed into its encrypted Wildz session. Card-required multiplayer and world commands accept those assets only with a compact membership proof under that server-derived commitment; the browser cannot supply or replace the authoritative root.

## Persistence boundary

There is no external database added by Wildz. The installed app keeps owner-scoped continuity in browser IndexedDB. Shared public, world, social, and economy durability depends on configured Receiz publication, audit, proof, wallet, and settlement rails. Under v106, unattended shared-world/publication writes use the server-only `RECEIZ_CONNECT_ACCESS_TOKEN`; it is an app/service credential, never a generated player login token.

Durable Receiz rails fail closed. Capability absence, network failure, stale revisions, proof mismatch, and unconfirmed reads or writes are returned as unavailable, conflict, or recovery-pending states; they are never simulated as success.

## V106 constitutional application boundary

`receiz.app.json` is compiled by the official v106 compiler with artifact-first authority and `allowDatabaseAuthority: false`. The release is bound to registry digest `bf851c209e807309672c0f466411baa5607ce6b3195fe4eb16755edfeb7f5a1a`; canonical changes are command-only and must carry scoped capability, actor and tenant binding, expected revision, causal parents, idempotency, and bounded effects. `pnpm receiz:check` runs the v106 repository checker and is included in the local release gate.

Compiler, registry evaluation, MCP conformance, or checker success proves only that the repository matches its declared integration contract. It does not prove artifact truth, strict-live availability, or remote mutation admission. In particular, v106's general commerce clients do not provide the Wildz-specific conditional market ownership append; market mutations remain fail-closed until Receiz exposes and the app verifies that capability.

## Offline boundary

The versioned service worker caches the app shell, its route chunks, previously visited public profile/card documents, and successful allowlisted card GET responses. Sign-in, live world, social presence, market, publication, listing, trade, transfer, payment, Receiz, artifact-proxy, personalized, failed, and mutation traffic requires a connection and remains network-only.

## Release qualification boundary

The default doctor reports package compatibility and configured capability presence without exposing values. `--strict-live` is a separate release gate and must verify configured authenticated reads. Missing production credentials remain an explicit pending external gate; they are never rewritten as a pass. Local release qualification must still fail closed on code, proof, PWA, browser, or secret-scan regressions.
