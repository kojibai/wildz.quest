# Receiz rails for Wildz v3

Wildz targets the exact `@receiz/sdk@116.0.0` release. Application code uses SDK identity, artifact, native proof-object, publication, audit, and settlement clients. `@receiz/mcp-server@116.0.0` and `@receiz/ai-skills@116.0.0` are operator tooling only; neither can replace proof verification or independently admit a mutation. The packages come from upstream release commit `8a8a828ec90794d3daa3c96ae97077ca2fc10121`; immutable vendored tarballs and lockfile integrity values keep installation reproducible until public npm registry publication.

## Authority map

| Product primitive | Authoritative evidence | Failure rule |
|---|---|---|
| Receiz identity | Verified Identity Seal/key continuation, or a verified Vault with explicit v116 owner-continuity binding | A legacy proof-sealed Vault restores scoped game state but cannot replace or invent canonical account identity |
| Local owner continuity | Owner-scoped verified state in IndexedDB | Wrong-owner, stale, partial, or invalid state is rejected |
| Portable cards and Vaults | Exact portable payload, card proofs, player binding, and enclosing Vault custody | Invalid domains, conflicting bodies, and incompatible proof forks are rejected; exact duplicates are dropped |
| V116 native proof export | SDK Record → Seal result, authenticated owner, claim, verify path, and byte-exact native artifact | Any owner, claim, path, verification, or byte mismatch fails closed; no legacy-wrapper fallback |
| Legacy v102 proof import | Strict local envelope/hash decoding plus SDK verification of the enclosing server artifact | Legacy decoding is read-only and never creates new authority |
| Canonical world | Server-admitted V3 projection plus publication/audit result | Failed publication reports recovery pending, never durable success |
| Public profile/card projection | Sanitized Receiz public state with expected head and confirmed digest | Private Seal/owner data is omitted; unconfirmed publication fails |
| V116 profile showcase | Literal `profile-showcase:<owner>` identity, canonical genesis/append plans, and carried successor history in sealed bytes | Payload digests cannot become artifact identity; no new signer, issuer, or head authority is introduced |
| V116 economy showcase | Registry-bound genesis/append/merge plans with verified actor/history and verified sibling heads for merges | Planning is zero-write; missing sibling evidence, expected-head conflict, or absent capability fails closed |
| Offline proposal | Retained verified local truth | A queued proposal is not a global commitment and never advances shared authority by itself |
| Listing, offer, trade, transfer | Verified command admission and conditional append using current ownership head, expected revision, runtime-custodied actor, plan-bound capability, causal parents, registry law, named commit domain, and idempotency | The v116 SDK has no Wildz-specific conditional market append surface; missing capability, conflict, or invalid proof fails closed |
| Checkout and payment | Receiz checkout plus admitted settlement evidence | Checkout creation alone never transfers ownership |

Historical creator or owner coordinates stored inside individual card proofs remain immutable provenance. They do not prevent a verified Vault from restoring cards produced on another compatible Receiz application without rewriting those histories. For a legacy Vault without owner-continuity binding, the enclosing proof establishes artifact-scoped recovery—not canonical global account ownership; account-only mutations remain Identity Seal/key-gated.

The historical-owner subset of an exact verified Vault is committed into its encrypted Wildz session. Card-required multiplayer and world commands accept those assets only with a compact membership proof under that server-derived commitment; the browser cannot supply or replace the authoritative root.

## Persistence boundary

There is no external database added by Wildz. The installed app keeps owner-scoped continuity in browser IndexedDB. Shared public, world, social, and economy durability depends on configured Receiz publication, audit, proof, wallet, and settlement rails. Under v116, unattended shared-world/publication writes use the server-only `RECEIZ_CONNECT_ACCESS_TOKEN`; it is an app/service coordination credential, never a generated player login token or artifact authority.

Durable Receiz rails fail closed. Capability absence, network failure, stale revisions, proof mismatch, and unconfirmed reads or writes are returned as unavailable, conflict, or recovery-pending states; they are never simulated as success.

## V116 constitutional application boundary

`receiz.app.json` is compiled by the official v116 compiler with artifact-first authority and `allowDatabaseAuthority: false`. The release is bound to registry digest `9bf61fcf4541edf565bb2ded252e35a976a3ca7c9176dea0f1ffac74ce192a80` and operation-matrix digest `ec5829eeec039c1f4885d056b8cd6cf6506d08547cee58daa229ecbd44155420`. Canonical changes are command-only and must carry same-runtime verified admission/history/actor evidence, the discovered registry law, named commit domain, exact plan-bound capability, expected head, canonical event, idempotency identity, and bounded effects. `pnpm receiz:check` runs the v116 repository checker and is included in the local release gate.

V116 admission reports eligibility only. Append planning performs zero writes. A transition requires a verified plan-bound capability, immutable candidate staging, independent staged-byte resolution and reverification, and an atomic head advance within the named commit domain. Receipts, projections, plans, explanations, callbacks, local rows, and Connect tokens never become proof or operation authority.

The historical migration checkpoint records forward-only preservation and zero rewritten artifacts, receipts, or heads. It remains compatibility evidence only; current execution and qualification use v116. Historical sealed bytes may be reverified, but historical runtime authority objects cannot be reused. The migration verifier is not proof authority.

Compiler, registry evaluation, MCP conformance, or checker success proves only that the repository matches its declared integration contract. It does not prove artifact truth, strict-live availability, or remote mutation admission. In particular, v116's general commerce clients do not provide the Wildz-specific conditional market ownership append; market mutations remain fail-closed until Receiz exposes and the app verifies that capability.

Global reconciliation paints known artifact truth before remote startup and uses `receiz.com/global/v1` only as a named coordination domain. Remote exact bytes and additions are independently verified. Sibling or namespace divergence remains structural and cannot be silently merged by timestamps or last-write-wins. Atomic acceptance does not prove effect delivery; effect status is resolved separately.

## Offline boundary

The versioned service worker caches the app shell, its route chunks, previously visited public profile/card documents, and successful allowlisted card GET responses. Sign-in, live world, social presence, market, publication, listing, trade, transfer, payment, Receiz, artifact-proxy, personalized, failed, and mutation traffic requires a connection and remains network-only.

## Release qualification boundary

The default doctor reports package compatibility and configured capability presence without exposing values. `--strict-live` is a separate release gate and must verify configured authenticated reads. Missing production credentials remain an explicit pending external gate; they are never rewritten as a pass. Local release qualification must still fail closed on code, proof, PWA, browser, or secret-scan regressions.
