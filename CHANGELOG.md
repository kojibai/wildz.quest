# Changelog

All notable changes to Wildz are documented here. Wildz uses semantic versioning for public releases.

## [Unreleased]

### Changed

- Aligned the SDK, MCP server, AI skills, lockfile, application contract, generated integration evidence, runtime labels, tests, checker, and documentation to Receiz `114.0.0`.
- Adopted the v114 constitutional registry digest `ae912154d97b695464c3a19361bceb9440bc5d703a1d9129edac92c64192e29a` and 16-operation matrix digest `fd4ea8fccd867a0b9aab772ea6c5827ea8bdfe4c7fbed017c5a4843a40109c4f`.
- Added release-gate coverage for v114 profile-showcase identity/history authority and profile/economy showcase genesis, append, and merge planning.

## [3.0.0] - 2026-07-20

First public open-source release of the standalone Wildz product and Receiz reference implementation.

### Added

- Full-screen Next.js game PWA with a deterministic living world, collection, exploration, Mortal Arena, Hearttree, raids, bosses, settlements, social play, and multiplayer.
- Receiz identity activation, Identity Seal/key continuation, proof sessions, verified Vault restore, and owner-scoped continuity.
- Portable living-card artifacts with native v114 export, bounded verification, lineage, history, bearer ownership, cross-application restore, and verified legacy reads.
- Public player profiles, public card routes, sanitized projections, and explicit cache policy.
- Capability-gated listings, offers, trades, checkout, transfer, and settlement coordination that fails closed when the required live append surface is absent.
- Artifact-first `receiz.app.json` contract, generated integration evidence, v114 checker, MCP conformance, doctor, secret scan, and consolidated release gate.
- Receiz MCP operator documentation and Wildz-specific builder, market-operator, and release AI skills.
- Open-source architecture, contribution, security, support, conduct, provenance, and release documentation.

### Security and integrity

- Complete artifacts are verified before domain payload parsing.
- Canonical transitions require runtime-custodied evidence, current actor/history, plan-bound capability, immutable staging, independent byte resolution, a named atomic commit domain, expected head, and idempotency identity.
- Browser state, caches, MCP output, AI output, plans, queued proposals, and receipts are never promoted to proof authority.
- Authentication, live world, market, Receiz, artifact-proxy, personalized, failed, and mutation traffic remain network-only.

### Known limitations

- Production activation requires configured server-side Receiz credentials and a successful authorized strict-live qualification.
- The Receiz v114 SDK does not expose the Wildz-specific conditional market-ownership append; affected live mutations remain intentionally unavailable.
- External six-writer interoperability, remote mutation qualification, deployment, tag, and production publication are separate pending gates in the release evidence.

See the [complete v3.0.0 release notes](docs/release/v3.0.0.md) and [verification record](docs/release/verification.md).

[3.0.0]: https://github.com/kojibai/wildz.quest/releases/tag/v3.0.0
