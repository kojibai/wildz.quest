# Receiz rails for Wildz v3

Wildz targets the exact `@receiz/sdk@118.0.0` release. Application code uses SDK identity, artifact, native proof-object, publication, audit, and settlement clients. `@receiz/mcp-server@118.0.0` and `@receiz/ai-skills@118.0.0` are operator tooling only; neither can replace proof verification or independently admit a mutation. The packages resolve from the public npm registry, and their published lockfile integrity values keep installation reproducible.

## Authority map

| Product primitive | Authoritative evidence | Failure rule |
|---|---|---|
| Receiz identity | Verified Identity Seal/key continuation, or a verified Vault with explicit v118 owner-continuity binding | A legacy proof-sealed Vault restores scoped game state but cannot replace or invent canonical account identity |
| Local owner continuity | Owner-scoped verified state in IndexedDB | Wrong-owner, stale, partial, or invalid state is rejected |
| Portable cards and Vaults | Exact portable payload, card proofs, player binding, and enclosing Vault custody | Invalid domains, conflicting bodies, and incompatible proof forks are rejected; exact duplicates are dropped |
| V118 native proof export | SDK Record → Seal result, authenticated owner, claim, verify path, and byte-exact native artifact | Any owner, claim, path, verification, or byte mismatch fails closed; no legacy-wrapper fallback |
| Legacy v102 proof import | Strict local envelope/hash decoding plus SDK verification of the enclosing server artifact | Legacy decoding is read-only and never creates new authority |
| Canonical world | Server-admitted V3 projection plus publication/audit result | Failed publication reports recovery pending, never durable success |
| Public profile/card projection | Sanitized Receiz public state with expected head and confirmed digest | Private Seal/owner data is omitted; unconfirmed publication fails |
| V118 profile showcase | Literal `profile-showcase:<owner>` identity, canonical genesis/append plans, and carried successor history in sealed bytes | Payload digests cannot become artifact identity; no new signer, issuer, or head authority is introduced |
| V118 economy showcase | Registry-bound genesis/append/merge plans with verified actor/history and verified sibling heads for merges | Planning is zero-write; missing sibling evidence, expected-head conflict, or absent capability fails closed |
| Offline proposal | Retained verified local truth | A queued proposal is not a global commitment and never advances shared authority by itself |
| Listing, offer, trade, transfer | Verified command admission and conditional append using current ownership head, expected revision, runtime-custodied actor, plan-bound capability, causal parents, registry law, named commit domain, and idempotency | The v118 SDK has no Wildz-specific conditional market append surface; missing capability, conflict, or invalid proof fails closed |
| Checkout and payment | Receiz checkout plus admitted settlement evidence | Checkout creation alone never transfers ownership |
| Exact creature history | SDK-verified enclosing card/Vault, immutable base proof, exact asset ID, causal parent, event/projection digests, admitted Kai coordinate, and bounded append | A family cache, ISO timestamp, model summary, or detached history cannot advance the card; malformed or non-causal history fails closed |
| Ranked Arena | Verified signed global admission bound to ruleset, definition, roster revisions, and Kai root, followed by independently verified deterministic replay and current publication head at settlement | Local play may remain practice evidence, but cannot change rating, season, or published result |
| Mortal Arena | Ranked evidence plus a verified, match-scoped, player-bound, revision-pinned Mortal covenant with bounded Kai expiry | Missing, expired, mismatched, or digest-shaped consent cannot retire a creature |
| Tournament and season projection | Admitted match results under the current published ruleset and season head | Audit, coaching, local simulation, MCP output, and queued publication never change standings |

Historical creator or owner coordinates stored inside individual card proofs remain immutable provenance. They do not prevent a verified Vault from restoring cards produced on another compatible Receiz application without rewriting those histories. For a legacy Vault without owner-continuity binding, the enclosing proof establishes artifact-scoped recovery—not canonical global account ownership; account-only mutations remain Identity Seal/key-gated.

The historical-owner subset of an exact verified Vault is committed into its encrypted Wildz session. Card-required multiplayer and world commands accept those assets only with a compact membership proof under that server-derived commitment; the browser cannot supply or replace the authoritative root.

## Kai temporal and creature-continuity rails

Kai Klok is the primary temporal root for canonical Wildz gameplay. Its exact `uPulse` is carried as a non-negative safe integer. Causal ancestry is evaluated first; a verified descendant advances its parent. For verified divergent siblings only, the greatest admitted `uPulse` wins. Causal append sequence orders intentional events within one `uPulse`, while non-identical claims to the same causal slot fail closed unless a named merge law applies. ISO time is descriptive display metadata and never ordering or authority.

Each living card carries a complete append-only creature history sufficient to rebuild level, XP, bond, mastery, growth, condition, record, form, and life state. Verification binds the exact asset, causal parent, event digest, resulting projection digest, admitted Kai coordinate, idempotency identity, and bounded effects. Card and Vault export append this history without changing the base proof object; a verified import restores the same history and projection on a compatible application. Retirement and death are terminal unless a future named, verified law explicitly says otherwise.

High-frequency Arena inputs belong in a deterministic transcript, not in per-frame card appends. Only admitted consequences append to creature history. Ranked never causes permanent death. Mortal retirement requires the verified covenant and settlement evidence described above.

## Persistence boundary

There is no external database added by Wildz. The installed app keeps owner-scoped continuity in browser IndexedDB. Shared public, world, social, and economy durability depends on configured Receiz publication, audit, proof, wallet, and settlement rails. Under v118, unattended shared-world/publication writes use the server-only `RECEIZ_CONNECT_ACCESS_TOKEN`; it is an app/service coordination credential, never a generated player login token or artifact authority.

Durable Receiz rails fail closed. Capability absence, network failure, stale revisions, proof mismatch, and unconfirmed reads or writes are returned as unavailable, conflict, or recovery-pending states; they are never simulated as success.

## V118 constitutional application boundary

`receiz.app.json` is compiled by the official v118 compiler with artifact-first authority and `allowDatabaseAuthority: false`. The release is bound to registry digest `c284bd39a891c1a828b532523bd548507570819c32e307d79b8043f06d2d3360` and operation-matrix digest `153b2472830567ec3b445c2c1b4102e4c036ed4c45cc374d40d0079096a40f54`. Canonical changes are command-only and must carry same-runtime verified admission/history/actor evidence, the discovered registry law, named commit domain, exact plan-bound capability, expected head, canonical event, idempotency identity, and bounded effects. `pnpm receiz:check` runs the v118 repository checker and is included in the local release gate.

V118 is one coordinated SDK/MCP/AI/ruleset/registry/matrix/package-range/runtime release identity. Durable proof memory is first admission only, then append forever. Deferred v119 orchestration is not shipped.

V118 admission reports eligibility only. Append planning performs zero writes. A transition requires a verified plan-bound capability, immutable candidate staging, independent staged-byte resolution and reverification, and an atomic head advance within the named commit domain. Receipts, projections, plans, explanations, callbacks, local rows, and Connect tokens never become proof or operation authority.

The historical migration checkpoint records forward-only preservation and zero rewritten artifacts, receipts, or heads. It remains compatibility evidence only; current execution and qualification use v118. Historical sealed bytes may be reverified, but historical runtime authority objects cannot be reused. The migration verifier is not proof authority.

Compiler, registry evaluation, MCP conformance, or checker success proves only that the repository matches its declared integration contract. It does not prove artifact truth, strict-live availability, or remote mutation admission. In particular, v118's general commerce clients do not provide the Wildz-specific conditional market ownership append; market mutations remain fail-closed until Receiz exposes and the app verifies that capability.

Global reconciliation paints known artifact truth before remote startup and uses `receiz.com/global/v1` only as a named coordination domain. Remote exact bytes and additions are independently verified. Sibling or namespace divergence remains structural and cannot be silently merged by timestamps or last-write-wins. Atomic acceptance does not prove effect delivery; effect status is resolved separately.

## Offline boundary

The versioned service worker caches the app shell, its route chunks, previously visited public profile/card documents, and successful allowlisted card GET responses. Sign-in, live world, social presence, market, publication, listing, trade, transfer, payment, Receiz, artifact-proxy, personalized, failed, and mutation traffic requires a connection and remains network-only.

## Release qualification boundary

The default doctor reports package compatibility and configured capability presence without exposing values. `--strict-live` is a separate release gate and must verify configured authenticated reads. Missing production credentials remain an explicit pending external gate; they are never rewritten as a pass. Local release qualification must still fail closed on code, proof, PWA, browser, or secret-scan regressions.
