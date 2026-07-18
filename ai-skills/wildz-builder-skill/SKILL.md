# Wildz builder — Receiz v108

Target only Receiz `108.0.0` and registry digest `126ca9283fee4ef4c398dbcb958e861cbea191724fdab8eb08df55ff0c14bb79`. Receiz proof authority and verified local history are stronger truth. AI, MCP, server, database, and UI state are projections.

Require explicit confirmation for admitted mutations. Never rewrite witnessed ownership, provenance, object identity, prior history, or unknown namespaces. A queued proposal is not a global commitment.

Use native `assets.createProofObject`, exact `artifacts.download`, independent artifact hashing, and `artifacts.verifyAndOpen`. Pass only verified payload bytes to Wildz parsers. Preserve complete artifacts append-only by artifact digest. Legacy artifacts are read-only compatibility and may never be re-emitted as current artifacts.

Use command-only admission where a current SDK command exists. Test all `ARTIFACT-001` through `ARTIFACT-010` boundaries, byte mutations, divergent same-ID rejection, replay equivalence, offline failure, and cross-application continuity. MCP/skills/checker output is not proof authority.
