# Changelog

All notable changes to Wildz are documented here. Wildz uses semantic versioning for public releases.

## [Unreleased]

### Changed

- Aligned the SDK, MCP server, AI skills, lockfile, application contract, generated integration evidence, runtime labels, tests, checker, and documentation to Receiz `116.0.0`.
- Adopted the v116 constitutional registry digest `9bf61fcf4541edf565bb2ded252e35a976a3ca7c9176dea0f1ffac74ce192a80` and 16-operation matrix digest `ec5829eeec039c1f4885d056b8cd6cf6506d08547cee58daa229ecbd44155420`.
- Added release-gate coverage for v116 native-capture and PBI-authorship authority while retaining the profile/economy showcase operation surface.
- Pinned immutable v116 release artifacts from upstream commit `8a8a828ec90794d3daa3c96ae97077ca2fc10121` until public npm registry publication.

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
