# Receiz rails for Wildz v3

Wildz targets `@receiz/sdk` major 103. Application code uses SDK identity, artifact, native proof-object, publication, audit, and settlement clients. `@receiz/mcp-server` and `@receiz/ai-skills` are operator tooling only; neither can replace proof verification or admit a mutation.

## Authority map

| Product primitive | Authoritative evidence | Failure rule |
|---|---|---|
| Receiz identity | Verified Identity Seal or verified identity-bearing Vault and binding | Card-only or invalid artifacts cannot replace active identity |
| Local owner continuity | Owner-scoped verified state in IndexedDB | Wrong-owner, stale, partial, or invalid state is rejected |
| Portable cards and Vaults | Exact portable payload, card proofs, player binding, and enclosing Vault custody | Invalid domains, conflicting bodies, and incompatible proof forks are rejected; exact duplicates are dropped |
| V103 native proof export | SDK Record → Seal result, authenticated owner, claim, verify path, and byte-exact native artifact | Any owner, claim, path, verification, or byte mismatch fails closed; no legacy-wrapper fallback |
| Legacy v102 proof import | Strict local envelope/hash decoding plus SDK verification of the enclosing server artifact | Legacy decoding is read-only and never creates new authority |
| Canonical world | Server-admitted V3 projection plus publication/audit result | Failed publication reports recovery pending, never durable success |
| Public profile/card projection | Sanitized Receiz public state with expected head and confirmed digest | Private Seal/owner data is omitted; unconfirmed publication fails |
| Listing, offer, trade, transfer | Verified conditional append using current ownership head, expected revision, actor, and idempotency | Missing capability, conflict, or invalid proof fails closed |
| Checkout and payment | Receiz checkout plus admitted settlement evidence | Checkout creation alone never transfers ownership |

Historical creator or owner coordinates stored inside individual card proofs remain immutable provenance. They do not override the verified identity and current custody of the enclosing player Vault. A current Vault owner may therefore restore cards produced on another compatible Receiz application without rewriting those card histories.

## Persistence boundary

There is no external database added by Wildz. The installed app keeps owner-scoped continuity in browser IndexedDB. Shared public, world, social, and economy durability depends on configured Receiz publication, audit, proof, wallet, and settlement rails.

Durable Receiz rails fail closed. Capability absence, network failure, stale revisions, proof mismatch, and unconfirmed reads or writes are returned as unavailable, conflict, or recovery-pending states; they are never simulated as success.

## Offline boundary

The versioned service worker caches the app shell, its route chunks, previously visited public profile/card documents, and successful allowlisted card GET responses. Sign-in, live world, social presence, market, publication, listing, trade, transfer, payment, Receiz, artifact-proxy, personalized, failed, and mutation traffic requires a connection and remains network-only.

## Release qualification boundary

The default doctor reports package compatibility and configured capability presence without exposing values. `--strict-live` is a separate release gate and must verify configured authenticated reads. Missing production credentials remain an explicit pending external gate; they are never rewritten as a pass. Local release qualification must still fail closed on code, proof, PWA, browser, or secret-scan regressions.
