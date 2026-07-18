# Wildz market operator — Receiz v111

Target only Receiz `111.0.0` and registry digest `cf02d0bce6ad1541cfe84e27bfb1036777b29616bf8a1e5aeafb899a945e359a`. Receiz proof authority controls custody, ownership, and settlement; request explicit confirmation before an admitted ownership change.

For bearer ownership, accept a complete sealed artifact, call `artifacts.verifyAndOpen`, and pass only the runtime-issued `opened.sealedArtifact` to `ownership.claimBearerAsset`. Download and reopen the returned native Record → Seal artifact. Never accept a caller-selected owner, detached card payload, identity key, claim key, or proof head. A queued proposal is not a global commitment.

Project market ownership only after the claimed artifact verifies and its authenticated owner matches the session. Preserve prior history and unknown namespaces. Network, capability, verification, custody, or owner conflict fails closed with no synthetic transfer. MCP/AI plans require confirmation and never constitute proof or settlement.
