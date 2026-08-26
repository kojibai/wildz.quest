# Receiz rails for Wildz v3

The complete V124 production-runtime composition and its latency/authority boundaries are documented in [`RECEIZ_V124_RUNTIME.md`](./RECEIZ_V124_RUNTIME.md).

Wildz targets the exact `@receiz/sdk@124.0.3` release. Application code uses SDK identity, artifact, durable subject admission, proof-authority exchange, authority sessions, durable execution, recipient resolution, and executable Phi clients. `@receiz/mcp-server@124.0.3` and `@receiz/ai-skills@124.0.3` are operator tooling only; neither can replace proof verification or independently admit a mutation. The packages resolve from the public npm registry, and their published SHA-512 lockfile integrity values keep installation reproducible. This patch retains the v124 registry digest `d02429151b0bcebdaeb89485792e377afc55130f9a25e07982c1c88221314247` and operation-matrix digest `540d1c1bf39f1b288b257c79a6e020bdcc5e587fc9b7dbf6b7aaa5d082e20ad5`.

## Authority map

| Product primitive | Authoritative evidence | Failure rule |
|---|---|---|
| Receiz identity | Verified Identity Seal/key continuation, or a verified Vault with explicit v121 owner-continuity binding | A legacy proof-sealed Vault restores scoped game state but cannot replace or invent canonical account identity |
| Local owner continuity | Owner-scoped verified state in IndexedDB | Wrong-owner, stale, partial, or invalid state is rejected |
| Portable cards and Vaults | Exact portable payload, card proofs, player binding, and enclosing Vault custody | Invalid domains, conflicting bodies, and incompatible proof forks are rejected; exact duplicates are dropped |
| V121 native proof export | SDK Record → Seal result, authenticated owner, claim, verify path, and byte-exact native artifact | Any owner, claim, path, verification, or byte mismatch fails closed; no legacy-wrapper fallback |
| Legacy v102 proof import | Strict local envelope/hash decoding plus SDK verification of the enclosing server artifact | Legacy decoding is read-only and never creates new authority |
| Canonical world | Server-admitted V3 projection plus publication/audit result | Failed publication reports recovery pending, never durable success |
| Public profile/card projection | Sanitized Receiz public state with expected head and confirmed digest | Private Seal/owner data is omitted; unconfirmed publication fails |
| V121 profile showcase | Literal `profile-showcase:<owner>` identity, canonical genesis/append plans, and carried successor history in sealed bytes | Payload digests cannot become artifact identity; no new signer, issuer, or head authority is introduced |
| V121 economy showcase | Registry-bound genesis/append/merge plans with verified actor/history and verified sibling heads for merges | Planning is zero-write; missing sibling evidence, expected-head conflict, or absent capability fails closed |
| Offline proposal | Retained verified local truth | A queued proposal is not a global commitment and never advances shared authority by itself |
| Listing, offer, trade, transfer | Verified command admission and conditional append using current ownership head, expected revision, runtime-custodied actor, plan-bound capability, causal parents, registry law, named commit domain, and idempotency | The v121 SDK has no Wildz-specific conditional market append surface; missing capability, conflict, or invalid proof fails closed |
| Checkout and payment | Receiz checkout plus admitted settlement evidence | Checkout creation alone never transfers ownership |
| Exact creature history | SDK-verified enclosing card/Vault, immutable base proof, exact asset ID, causal parent, event/projection digests, admitted Kai coordinate, and bounded append | A family cache, ISO timestamp, model summary, or detached history cannot advance the card; malformed or non-causal history fails closed |
| V121 living subject and proof brain | Exact primary proof objects, byte-preserved namespaces, subject head, object Merkle root, registry and reducer identities | The proof-brain index, Twin output, memory summary, or UI projection cannot replace cited source objects |
| Creature Twin turn | Exact subject brain plus current Kai `uPulse`, temporal coordinate, world presence, causal head, relationship, and condition | A reply is observation only; unavailable real intelligence produces no canned substitute and appends no memory |
| V121 bearer instrument | Verified owner/recipient capabilities, exact transfer plan and instrument, independently verified complete claimed artifact | Preview, issue, inspection, receipt, notification, or local projection alone does not change custody; former-owner authority is revoked on claim |
| Playable proof claim | A self-contained source proof or SDK-verified V124 portable transition set, exact recipient edge consent, and the enclosing proof object's authority | The URL, button, app route, session, receipt, and global projection are carriers only; they cannot authorize, mutate, or outrank the source proof |
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

There is no external database added by Wildz. The installed app keeps owner-scoped continuity in browser IndexedDB. Shared public, world, social, and economy durability depends on configured Receiz publication, audit, proof, wallet, and settlement rails. Under the current V123 release, unattended shared-world/publication writes use the server-only `RECEIZ_CONNECT_ACCESS_TOKEN`; it is an app/service coordination credential, never a generated player login token or artifact authority.

Durable Receiz rails fail closed. Capability absence, network failure, stale revisions, proof mismatch, and unconfirmed reads or writes are returned as unavailable, conflict, or recovery-pending states; they are never simulated as success.

## Universal playable proof claims

Wildz can carry Phi, resources, exact card or creature custody, experience access, and world rights through one native claim surface. The transferable representation is self-contained in the URL fragment, so browsers do not send it during ordinary navigation and the player sees a native Claim action rather than proof plumbing. A direct bearer card claim executes through the existing exact-custody primitive. Every other claim carries an SDK-issued V124 portable execution transition set, which is independently verified before an authority session is opened, staged, and atomically executed with the recipient's exact edge consent.

The claim representation is never proof authority and cannot commit. Successful edge execution prepares the recipient's sealed source addition immediately; global source publication and message projection are asynchronous distribution. Missing projection therefore cannot demote a lawful local result, while malformed, expired, wrong-recipient, replayed, or unverified claims fail closed. Card offers are the first live producer; Phi, resource, access, and world-operation producers plug into the same carrier whenever their source operation emits the canonical V124 transition set.

## V123 constitutional application boundary

`receiz.app.json` is compiled by the official v124 compiler with artifact-first authority and `allowDatabaseAuthority: false`. The release is bound to registry digest `d02429151b0bcebdaeb89485792e377afc55130f9a25e07982c1c88221314247` and operation-matrix digest `540d1c1bf39f1b288b257c79a6e020bdcc5e587fc9b7dbf6b7aaa5d082e20ad5`. Canonical changes are command-only and must carry same-runtime verified admission/history/actor evidence, the discovered registry law, named commit domain, exact plan-bound capability, expected head, canonical event, idempotency identity, and bounded effects. `pnpm receiz:check` runs the v124 repository checker and is included in the local release gate.

V123 is one coordinated SDK/MCP/AI/ruleset/registry/matrix/package-range/runtime release identity. Durable proof memory is first admission only, then append forever. V123 causal orchestration keeps the enclosing artifact strongest, paints known truth before discovery, selects causal heads by Kai, and commits exact appends through Merkle roots with Fibonacci sparse ancestry.

V123 retains the V121 admission law: admission reports eligibility only and append planning performs zero writes. A transition requires a verified plan-bound capability, immutable candidate staging, independent staged-byte resolution and reverification, and an atomic head advance within the named commit domain. Receipts, projections, plans, explanations, callbacks, local rows, and Connect tokens never become proof or operation authority.

V123 source-first continuity keeps the sealed proof object authoritative. Server and database state accelerate global distribution and lawful restoration only; a settled surface never waits for global projection, verified hydration becomes durable cold truth, and partial projections cannot discard stronger verified fields already known locally.

Living-subject law extends that boundary: subject identity survives transfer; factual memory cites admitted events; the proof-brain index is non-authoritative; model output requires command admission; multi-subject effects are atomic; failed decisions write zero including Kai; mandates are reverified at execution; unknown namespaces remain byte-exact; bearer claims preserve identity; and former-owner authority is revoked immediately.

The historical migration checkpoint records forward-only preservation and zero rewritten artifacts, receipts, or heads. It remains compatibility evidence only; current execution and qualification use v124. Historical sealed bytes may be reverified, but historical runtime authority objects cannot be reused. The migration verifier is not proof authority.

Compiler, registry evaluation, MCP conformance, or checker success proves only that the repository matches its declared integration contract. It does not prove artifact truth, strict-live availability, or remote mutation admission. V123 retains direct bearer instruments for custody transfer, but they do not fabricate the marketplace's distinct conditional listing/payment/settlement append; those mutations remain fail-closed wherever that separate capability is unavailable.

Global reconciliation paints known artifact truth before remote startup and uses `receiz.com/global/v1` only as a named coordination domain. Remote exact bytes and additions are independently verified. Sibling or namespace divergence remains structural and cannot be silently merged by timestamps or last-write-wins. Atomic acceptance does not prove effect delivery; effect status is resolved separately.

## Offline boundary

The versioned service worker caches the app shell, its route chunks, previously visited public profile/card documents, and successful allowlisted card GET responses. Sign-in, live world, social presence, market, publication, listing, trade, transfer, payment, Receiz, artifact-proxy, personalized, failed, and mutation traffic requires a connection and remains network-only.

## Release qualification boundary

The default doctor reports package compatibility and configured capability presence without exposing values. `--strict-live` is a separate release gate and must verify configured authenticated reads. Missing production credentials remain an explicit pending external gate; they are never rewritten as a pass. Local release qualification must still fail closed on code, proof, PWA, browser, or secret-scan regressions.
