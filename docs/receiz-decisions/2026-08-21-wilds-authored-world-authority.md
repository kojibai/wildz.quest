# Wilds authored-world authority on Receiz V123

Status: accepted implementation boundary for Wildz 8.0.0

## Decision

Player excavation is a proof-native world mutation. A rendered tunnel, chamber, water volume, portal, collision surface, encounter habitat, or atlas reference may exist only after the corresponding Receiz world transaction is admitted and replayed. A local preview is always `physical: false`.

The world is sharded by the canonical 128-unit discovery-site region. Each append is bounded to one region world (`wildz.excavation.region.v1:<x>:<z>`). Cross-region construction is rejected until Receiz exposes an explicit multi-world transaction/portal protocol.

The coordinated `@receiz/sdk`, `@receiz/mcp-server`, and `@receiz/ai-skills` V123 release is pinned exactly at `123.0.0`. The client supports the exact coordinated world rails needed after subjects exist (some SDK names retain their V122 contract suffix inside the V123 package):

- `subjects.admit`, `subjects.state`, and `subjects.resolveNamespaces`
- `world.planCommandV122`, `world.planTransactionV122`, and `world.validateTransaction`
- `world.executeTransactionV122`, `world.execution`, and `world.executionByIdempotencyKey`
- `world.additionsV122`, private commands, and multi-world planning/execution

The browser requests and records the exact granted OAuth scopes. Mutation preflight requires a cookie-bound player token carrying every scope produced by `receizOidcScopesForRails("worldCommands", "worldEvents", "subjects", "subjectMandates", "subjectInventory")`. A service/delegated token, guest identity, proof-only Vault session, missing scope, profile mismatch, foreign card, foreign subject, or stale head fails closed with zero writes.

## Implemented and verified library authority flow

1. Decrypt and validate the Wildz identity-key proof session.
2. Require the live cookie bearer and the exact granted world scopes.
3. Resolve the live Receiz profile and bind it to the same canonical player coordinate.
4. Verify the complete card and direct owner or exact Vault membership proof.
5. Resolve both explorer and creature as persistent remote Receiz subjects.
6. Bind subject IDs, current owners, creature proof digest, and exact subject heads. Resolve typed capability and condition namespaces at those exact heads through `subjects.resolveNamespaces`; request-card-derived capability never substitutes for that authority.
7. The verified library foundation derives substrate, water, space, exit/rescue, protected volumes, and route safety from the immutable Phase-B physical projection. This is not a production mutation claim.
8. Ask the SDK to plan each command and transaction; never construct an SDK command digest locally.
9. Verify exact participants, heads, world head, registry/reducer digests, command bytes, attempt, and idempotency before execution.
10. Treat only an exact V123 receipt/event chain as admitted. Ambiguous execution retains the exact staged plan and resolves additions before retry.
11. The pure authored-world foundation can rebuild authored state from supplied Receiz additions, trigger full replay on an initial gap, re-derive physical evidence, and atomically compare-and-swap a supplied graph-plus-cursor store.
12. The pure foundation can compose one immutable natural-plus-authored physical projection and proves stable warmed references. It is deliberately not connected to visible gameplay until durable incremental storage, full SDK checkpoint verification, authored atlas/restore, and private access envelopes exist. Therefore no new authored-world network or generation work runs during gameplay.

The production route currently performs durable creature admission and authority preflight only; it does not claim to mutate or hydrate the playable world. Its `GET` is a no-store capability document and reports `active: false`, `physical: false`, plus the exact missing deployment ports. The public-snapshot projector is pure and redacts owner/steward/proof identity. A future public geometry GET must require only `receiz:world_events.read`, not the mutation scope set. Creator/steward/profile publication must remain a separate, range-gated projection. Invited/private geometry remains unavailable unless a subject-scoped encrypted envelope can be verified.

## Explicitly forbidden fallbacks

- The legacy Wilds `publicStore` service is not world-mutation authority.
- The v120 in-process creature observer/runtime is not a persistent remote subject.
- A server process singleton, optimistic outbox, client assertion, locally self-hashed event, renderer mesh, or server database row is not physical authority.
- Missing scopes, subjects, grants, envelopes, heads, proof binding, or material participants never downgrade to local/practice mutation.
- Task 8 does not invent inventory balances or consume placeholder materials. Installed structures remain blocked on Task 9's exact multi-participant inventory transaction.

## V123 capability matrix and remaining deployment work

V123 closes the SDK-surface gaps that previously blocked lawful remote authored-world execution. Wildz now exposes, through one typed adapter, durable subject admission, exact-head namespace resolution, public and private world planning, normal and multi-world transaction execution, execution/idempotency recovery, subject access keys, proof-authority exchange, and SDK-derived Settlement/Reserve scopes and execution. Application code never manufactures Receiz command bytes, plan digests, transaction digests, or delegated scopes.

| Boundary | V123 SDK | Wildz library | Production gameplay |
|---|---:|---:|---:|
| Durable subject admission and exact-head namespaces | Available | Integrated against V123 registry and exact namespace bytes | Admission + preflight only |
| Public command/transaction planning and recovery | Available | Exact injected execution/recovery runtime | Mutation route not enabled |
| Private envelopes and subject access keys | Available | Typed adapter boundary | Private/invited authored spaces not enabled |
| Multi-world transaction | Available | Typed adapter boundary | Cross-region construction not enabled |
| Proof-authority exchange | Available | Server-only admitted authority | Requires deployment authority resolver |
| Phi Settlement/Reserve execution and recovery | Available | Wallet execution foundation | Requires durable deployment runtime |
| Natural + authored physical composition | N/A | Pure immutable projection exists | Intentionally not mounted |

The remaining blockers are deployment and product-integration work, not missing SDK methods:

- a cross-instance durable journal/checkpoint store with atomic compare-and-swap for exact plans, terminal outcomes, authored graph heads, and replay cursors;
- a deployment-supplied, server-derived proof-authority admission resolver with current Kai, revocation, owner, and exact-head namespace binding;
- durable distributed recipient-lookup limiting before username-based wallet Send can be advertised;
- authenticated authored-world mutation and hydration routes that adopt only fully verified V123 additions;
- authored atlas/save/restore/access-revocation integration using the same immutable physical projection as render, movement, camera, landing, portals, and encounters;
- exact inventory/material participants before any construction preview consumes or publishes resources;
- private/invited projection policy and encrypted-envelope hydration with no geometry, identity, proof, or grant leakage.

Until those ports are configured and proven against a live V123 deployment, wallet value reads may be available, but transfer capabilities remain unavailable; excavation and construction remain `physical: false`; and no background authored-world hydration runs in gameplay. This is an intentional fail-closed release boundary, not an SDK fallback.

## Injectable activation runtime

`createWildsV123AuthoredActivation` is the only activation boundary. Construction requires a branded cross-instance exact-transaction journal with compare-and-stage/compare-and-clear semantics, a verified checkpoint store with compare-and-swap, an additions hydrator that validates the complete SDK chain before adoption, a deployment-rooted whole-outcome authenticator, and all adapter transaction validation/execution/lookup rails.

Execution stages before the network call and rereads the canonical whole transaction to prove durable adoption. A lost response is resolved by exact transaction ID and then semantic idempotency key. Another runtime instance can recover the same transaction without replanning. Unknown outcomes retain the journal; only a literal committed outcome carrying the exact staged transaction and admitted transaction ID/digest may clear it; only a zero-write response bound to the exact transaction and idempotency key clears a failed attempt. Clear is digest-bound and verified by a post-clear read. The runtime contains no process singleton, IndexedDB, localStorage, or publicStore implementation of these ports.

The capability document keeps material construction and invited/private authored worlds false. Injecting ports still does not mount authored geometry into gameplay; that requires verified durable hydration plus authored atlas/save/restore integration and a separate release gate.

If an OAuth server omits `scope` on a token response, Wildz does not infer grants from what it requested. Mutation remains disabled until Receiz supplies authoritative token introspection or an explicit granted-scope set. Idempotency keys identify semantic intent; attempt IDs identify one execution. An ambiguous retry must reuse the exact planned bytes until additions or verified replay resolves the outcome.

## Adapter checklist

- Expose SDK methods with their exact indexed types; do not hardcode SDK-internal URLs.
- Preserve the exact returned plans/transactions/receipts/events byte-for-byte.
- Store the token's actual granted scope set in an HttpOnly cookie and delete it on logout.
- Verify the token/profile/proof-session coordinate on every mutation request.
- Resolve subject artifacts remotely; do not cache authority beyond their exact heads.
- Re-derive the immutable physical evidence tuple on plan, unresolved retry, and replay.
- Validate causal parents, participant sets, event count, Kai equality, registry/reducer digests, and zero-write failure IDs.
- Keep public geometry, private access envelopes, and publication-filtered maker identity as separate projections.

## Failure semantics

- Authentication/scope failure: HTTP 401, zero writes.
- Identity/card/subject binding failure: HTTP 403, zero writes.
- Missing durable subject admission: HTTP 409, zero writes.
- Missing exact subject namespace authority or unavailable profile/subject resolution: HTTP 503, zero writes.
- Invalid geometry/evidence/head/transaction: HTTP 422 or domain conflict, zero writes.
- Ambiguous execution: retain exact pending bytes; query additions before any retry.
- Replay gap/tamper: discard the candidate off-side reduction, keep the last verified graph, and full replay without advancing the cursor.
- Access revocation: deny portal admission immediately and restore through the last verified safe public exit; never reveal private geometry or provenance.

## Required verification matrix

- exact/missing/extra/mismatched token scopes and cookie/profile binding;
- direct owner and exact Vault membership; arbitrary card/subject injection;
- missing remote subject and v120-ephemeral fallback refusal;
- stale/foreign participant heads, altered plans, receipts, causal parents, and zero-write failures;
- commit-then-lost-response recovery and unresolved exact-byte retry;
- additions duplicate, conflicting duplicate, gap, full replay, CAS conflict, and crash before checkpoint commit;
- independent physical-evidence replay, protected/water/route intersections, and extreme coordinates;
- public/private/invited/open/revoke and creator-versus-steward transfer;
- exact natural/authored render/collision/camera/landing/portal/encounter parity;
- 10,000 warmed movement/frame queries with zero authority builds or network calls;
- no material spend until exact Task 9 inventory participants exist.

## Precise Receiz V124 platform request

V123 supplies every cryptographic planning and execution primitive Wildz needs. V124 can remove the remaining deployment-specific authority plumbing by standardizing these hosted contracts without weakening proof-object authority:

1. A hosted durable journal API with canonical transaction bytes, compare-and-stage, digest-bound compare-and-clear, and cross-instance reads. Same transaction ID with different bytes must be a zero-write conflict.
2. Exact-once plan persistence that stores SDK-planned command/transaction bytes before execution and resolves transaction ID plus idempotency key before permitting an exact-byte retry.
3. A typed additions/replay/checkpoint validator that authenticates the complete world chain: world and subject heads, participant sets, causal parents, registry/reducer digests, event bytes, through-head, and checkpoint digest.
4. A server authority-runtime factory that binds proof-authority grants, granted scopes, current Kai/revocation, exact subject heads, namespaces, and receipt/event authentication without exporting bearer secrets to gameplay code.
5. Subject-access-filtered private additions and replay whose encrypted envelopes reveal neither private geometry nor invite/provenance identifiers to unauthorized callers, while still exposing the minimal closed exterior collider.
6. One atomic world-plus-inventory participant transaction contract for construction, repair, salvage, and trading. Every material/tool/creature/player head must be sorted, exact, and zero-write on any stale participant; no local balance projection may substitute.
7. Privacy-safe recipient resolution that returns a scoped opaque destination subject and authority proof, not raw identity/profile data, with durable distributed rate limits.
8. A machine-readable operational capability descriptor reporting which hosted journal, checkpoint, private-envelope, inventory, authority, and recovery rails are configured for one deployment. Omitted capabilities must mean unavailable, never inferred.

Wildz will keep the V123 injectable boundary and fail-closed capability response even if V124 provides these conveniences. Hosted storage, indexes, and servers remain non-authoritative acceleration; sealed proof objects, exact SDK plans, and admitted event chains remain authority.
