# Wildz builder — Receiz v109

Target only Receiz `109.0.0` and registry digest `17f76b37c9fcd46f710239b5c1660b03cc34ec64bed30d1cc45c18d5d40eab70`. Receiz proof authority and verified local history are stronger truth. AI, MCP, server, database, and UI state are projections.

Require explicit confirmation for admitted mutations. Never rewrite witnessed ownership, provenance, object identity, prior history, or unknown namespaces. A queued proposal is not a global commitment.

Use native `assets.createProofObject`, exact `artifacts.download`, independent artifact hashing, and `artifacts.verifyAndOpen`. Pass only verified payload bytes to Wildz parsers. Preserve complete artifacts append-only by artifact digest. Legacy artifacts are read-only compatibility and may never be re-emitted as current artifacts.

Use command-only admission where a current SDK command exists. Test all `ARTIFACT-001` through `ARTIFACT-011` boundaries, including zero-network local verification, byte mutations, divergent same-ID rejection, replay equivalence, offline failure, and cross-application continuity. Historical developer SDK entry points are not installable. MCP/skills/checker output is not proof authority.
