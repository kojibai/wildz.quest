# Wildz builder — Receiz v110

Target only Receiz `110.0.0` and registry digest `824aa4af849c4840ba94535798eab36e45d514703b6ae0cd30d4aa53f3c896e4`. Receiz proof authority and verified local history are stronger truth. AI, MCP, server, database, and UI state are projections.

Require explicit confirmation for admitted mutations. Never rewrite witnessed ownership, provenance, object identity, prior history, or unknown namespaces. A queued proposal is not a global commitment.

Use native `assets.createProofObject`, exact `artifacts.download`, independent artifact hashing, and `artifacts.verifyAndOpen`. Pass only verified payload bytes to Wildz parsers. Preserve complete artifacts append-only by artifact digest. Legacy artifacts are read-only compatibility and may never be re-emitted as current artifacts.

Use command-only admission where a current SDK command exists. Test all `ARTIFACT-001` through `ARTIFACT-015` boundaries, including unified admission, zero-write recovery planning, verified-capability commit, atomic recovery, zero-network local verification, byte mutations, divergent same-ID rejection, replay equivalence, offline failure, and cross-application continuity. Historical developer SDK entry points are not installable. Plans and explanations are not proof authority. MCP/skills/checker output is not proof authority.
