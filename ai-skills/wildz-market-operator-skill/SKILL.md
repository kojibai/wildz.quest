# Wildz market operator — Receiz v118

Target only Receiz `118.0.0`, registry digest `c284bd39a891c1a828b532523bd548507570819c32e307d79b8043f06d2d3360`, and operation-matrix digest `153b2472830567ec3b445c2c1b4102e4c036ed4c45cc374d40d0079096a40f54`. Receiz proof authority controls custody, ownership, and settlement; request explicit confirmation before an admitted ownership change.

Treat v118 as one coordinated SDK/MCP/AI/ruleset/registry/matrix/package-range/runtime release identity. Durable proof memory is first admission only, then append forever. Deferred v119 orchestration is not shipped.

For bearer ownership, accept a complete sealed artifact, call `artifacts.verifyAndOpen`, and pass only the runtime-issued `opened.sealedArtifact` to `ownership.claimBearerAsset`. Download and reopen the returned native Record → Seal artifact. Never accept a caller-selected owner, detached card payload, identity key, claim key, or proof head. A queued proposal is not a global commitment.

Project market ownership only after the claimed artifact verifies and its authenticated owner matches the session. Preserve prior history and unknown namespaces. Network, capability, verification, custody, or owner conflict fails closed with no synthetic transfer. For an admitted transition, require same-runtime artifact, history, and actor custody; an exact plan-bound capability; immutable staging; independent staged-byte resolution; and atomic acceptance in the named commit domain. A Connect token, possession, receipt, projection, MCP result, or AI explanation is never ownership or operation authority. Structural divergence is preserved for explicit resolution. MCP/AI plans require confirmation and never constitute proof or settlement.

V118 economy showcase genesis, append, and merge calls are planning surfaces, not settlement. Bind them to the current registry/matrix and literal artifact identity; require verified sibling heads for merges. Never turn an economy plan, profile showcase, receipt, or payload digest into ownership authority.
