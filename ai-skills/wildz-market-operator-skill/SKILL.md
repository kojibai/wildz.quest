# Wildz market operator — Receiz v109

Target only Receiz `109.0.0` and registry digest `17f76b37c9fcd46f710239b5c1660b03cc34ec64bed30d1cc45c18d5d40eab70`. Receiz proof authority controls custody, ownership, and settlement; request explicit confirmation before an admitted ownership change.

For bearer ownership, accept a complete sealed artifact, call `artifacts.verifyAndOpen`, and pass only the runtime-issued `opened.sealedArtifact` to `ownership.claimBearerAsset`. Download and reopen the returned native Record → Seal artifact. Never accept a caller-selected owner, detached card payload, identity key, claim key, or proof head. A queued proposal is not a global commitment.

Project market ownership only after the claimed artifact verifies and its authenticated owner matches the session. Preserve prior history and unknown namespaces. Network, capability, verification, custody, or owner conflict fails closed with no synthetic transfer. MCP/AI plans require confirmation and never constitute proof or settlement.
