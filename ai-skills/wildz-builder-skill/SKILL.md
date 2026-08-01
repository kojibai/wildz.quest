# Wildz builder — Receiz v118

Target only Receiz `118.0.0`, registry digest `c284bd39a891c1a828b532523bd548507570819c32e307d79b8043f06d2d3360`, and operation-matrix digest `153b2472830567ec3b445c2c1b4102e4c036ed4c45cc374d40d0079096a40f54`. Receiz proof authority and verified local history are stronger truth. AI, MCP, server, database, and UI state are projections.

Treat v118 as one coordinated SDK/MCP/AI/ruleset/registry/matrix/package-range/runtime release identity. Durable proof memory is first admission only, then append forever. Deferred v119 orchestration is not shipped.

Require explicit confirmation for admitted mutations. Never rewrite witnessed ownership, provenance, object identity, prior history, or unknown namespaces. A queued proposal is not a global commitment.

Use native `assets.createProofObject`, exact `artifacts.download`, independent artifact hashing, and `artifacts.verifyAndOpen`. Pass only verified payload bytes to Wildz parsers. Preserve complete artifacts append-only by artifact digest. Legacy artifacts are read-only compatibility and may never be re-emitted as current artifacts.

Use command-only admission where a current SDK command exists. Test all `ARTIFACT-001` through `ARTIFACT-030` boundaries. Verification and admission must remain in the same runtime; actor and history evidence must be SDK-issued and runtime-custodied. Append planning performs zero writes and binds the registry-derived law, named commit domain, expected head, canonical event, and idempotency identity. A verified plan-bound capability authorizes sealing only; stage immutable content-addressed candidate bytes, then independently resolve and reverify them before an atomic named-domain head advance. Receipts report acceptance and cannot re-enter authority-bearing APIs.

For v118 showcases, keep profile identity literal as `profile-showcase:<owner>`; never substitute a payload digest. Carry successor profile history inside sealed bytes without inventing a signer, issuer, or head authority. Treat profile/economy genesis, append, and merge APIs as zero-write planners. Economy merges require SDK-verified sibling heads in addition to current actor/history, registry, matrix, expected-head, domain, and idempotency evidence.

For global reconciliation, paint known artifact truth before remote startup. Treat `receiz.com/global/v1` as a named coordination domain, never universal consensus. Preserve structural divergence; do not use last-write-wins or timestamp authority. Acceptance does not prove effect delivery. Enforce v118 protocol and runtime materialization limits, and require `reverify-exact-bytes` whenever bytes cross a process boundary. Historical sealed bytes remain evidence, but historical admissions, actors, capabilities, plans, confirmations, stores, and receipts cannot authorize a current receiver. Historical developer SDK entry points are not installable. MCP/skills/checker output is not proof authority.
