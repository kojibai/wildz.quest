# Changelog

All notable changes to Wildz are documented here. Wildz uses semantic versioning for public releases.

## [Unreleased]

### Changed

- Upgraded the coordinated Receiz toolchain to `@receiz/sdk@119.0.0`, `@receiz/mcp-server@119.0.0`, and `@receiz/ai-skills@119.0.0`, including published lockfile integrity values.
- Raised the Node.js runtime and CI floor to `20.19.0` to satisfy the v119 dependency graph.
- Migrated the application contract, generated evidence, doctor, checker, tests, runtime protocol labels, MCP guidance, release documentation, and checked-in Wildz AI skills to the v119 ruleset and `>=119.0.0 <120.0.0` compatibility range.
- Adopted registry digest `49c167a437ec7c0e486412dd62c54af4abdf94eda1ebc18d263a027d105cecd9` and 16-operation matrix digest `53cf9d6862b2396e2fe7864f8607c00c4e3b6e31b082ab5c5c8dff088fcb52c1`.
- Enforced the v119 authority guarantees that the enclosing artifact remains strongest, projections remain non-authoritative, known truth paints before discovery, Kai selects causal heads, Merkle roots commit exact appends, and Fibonacci links provide sparse ancestry.

## [5.0.0] - 2026-08-13

The first official Wildz release whose live chapter, world commands, and local progression share one Genesis-counted Kai `uPulse` state machine.

### Added

- A monotonic runtime Kai clock that establishes one observed `uPulse` boundary and advances without allowing browser clock corrections, stale projections, or server responses to rewind gameplay.
- Exact `KaiTemporalRoot` admission on world commands, including causal coordinates and deterministic conventional-time projections retained only for compatibility metadata.
- Exact Kai roots on local search, capture, battle, training, evolution, fusion, ascension, recovery, and creature-growth inputs.
- Command-driven chapter reconciliation that opens and advances the current chapter without waiting for a server scheduler tick.
- Player-safe continuity recovery: stale chapter responses refresh the projection and show actionable copy instead of internal error codes.
- Permanent card-front character-story presentation and expanded regression coverage for exact Kai, chapter, command, progression, PWA, and mobile Arena behavior.

### Changed

- Kai Klok `uPulse`, counted monotonically from Genesis, is the gameplay temporal authority. ISO timestamps are derived interoperability metadata and cannot choose, delay, veto, or reorder gameplay.
- Receiz/server state persists, proves, synchronizes, and publishes admitted consequences; it no longer decides whether the current Kai chapter is active.
- The NPC Mortal Arena control chassis is compact and touch-friendly, returning height to the 3D stage and top combat HUD without adding runtime dependencies.
- The service-worker release coordinate advances to `v5.0.0-r1`, forcing installed clients onto one coherent release shell.

### Performance and reliability

- Removed chapter readiness dependence on network polling and scheduler arrival from the player action path.
- Kept the implementation dependency-free and arithmetic-only at runtime; no new render loop, polling loop, state library, or asset payload was added.
- Added deterministic tests proving that different ISO metadata produces identical chapter events and event IDs when `uPulse` is unchanged.

### Security and integrity

- Network world mutation rejects commands without a valid exact Kai root.
- Invalid or conflicting temporal roots fail closed before canonical mutation.
- Existing Receiz v118 proof, artifact, replay, settlement, identity, market, and offline boundaries remain unchanged.

See the [complete v5.0.0 release notes](docs/release/v5.0.0.md) and [verification record](docs/release/verification.md).

## [4.0.0-alpha.0] - 2026-08-11

The first Wildz competitive-gameplay alpha: a deterministic, proof-native combat and creature-continuity release rooted in Kai Klok micro-pulses.

### Added

- Canonical Practice, Adventure, Ranked, and Mortal Arena policies with atomic 60 Hz simulation, deterministic replay, stamina, focus, guard, parry, dodge, tags, context actions, hazards, withdrawals, exact named abilities, fair observable-state opponents, and replay-grounded consequences.
- Signed global-admission and Mortal-covenant interfaces, exact roster/ruleset/Kai commitments, durable one-match nonce consumption, canonical terminal receipts, Glicko-2 rating, seven mastery drills, and local input-only ghosts.
- An immutable per-creature history chain carrying exact level, XP, bond, mastery, condition, records, relationships, scars, upgrades, form, rank, life, evidence, and Kai `uPulse` across standalone cards and complete Vaults.
- True Kai celestial progression: `00:00:00` is horizon sunrise, midday is the solar peak, Dream is visibly dark, stars and constellations are deterministic, and the player has a heading-following lantern with persisted controls.
- Kai-rooted world event v4, exact `uPulse` plus causal sequence ordering, explicit v3 replay compatibility, and deterministic shared-slot conflict rejection.
- Competitive integrity, gameplay scorecard, MCP, architecture, and AI-skill doctrine for safe simulation, coaching, release audit, and operator workflows.

### Changed

- Arena settlement now verifies and replays its canonical receipt before atomically persisting every affected owned card; reserve injuries, history, and mortality can no longer be dropped.
- Training and progression are exact-asset scoped, so same-family creatures never share level, XP, or bond state.
- Evolution, ascension, fusion, battle recovery, mortality, world events, and living history use Kai `uPulse` as temporal authority; ISO time is descriptive interoperability metadata only.
- Card and Vault import prefer causal history descendants, require trusted admission for divergent authority, reject equal-slot siblings, and never let a living fork reverse verified mortality.
- Retired-card imports require an origin receipt authority verifier; otherwise the exact artifact bytes and memorial cards enter a non-playable retirement quarantine instead of gaining gameplay or market authority.
- Night rendering now scales stars, atmosphere, fog, authored cave/storm darkness, actor readability, path guidance, and reduced motion across quality profiles.

### Security and integrity

- Self-minted history admissions cannot win divergent merges; a trusted verifier must explicitly admit either branch.
- Ranked remains unavailable without a configured global verifier, and Mortal remains unavailable without an externally signed, verified, one-use covenant.
- Practice cannot mutate canonical card progression, and local AI/MCP/skills cannot sign, admit, publish, or settle authority.
- The immutable base Receiz proof object is preserved; Wildz history travels as verified proof appends.

See the [competitive alpha release notes](docs/release/v4.0.0-alpha.0.md), [verification record](docs/release/verification.md), and [gameplay scorecard](docs/release/gameplay-scorecard.md).

### Changed

- Aligned the SDK, MCP server, AI skills, lockfile, application contract, generated integration evidence, runtime labels, tests, checker, and documentation to Receiz `118.0.0`.
- Adopted the v118 constitutional registry digest `c284bd39a891c1a828b532523bd548507570819c32e307d79b8043f06d2d3360` and 16-operation matrix digest `153b2472830567ec3b445c2c1b4102e4c036ed4c45cc374d40d0079096a40f54`.
- Coordinated SDK, MCP, AI manifests, ruleset, registry, operation matrix, compatible package range, and packed runtime as one v118 release identity, with predecessor registry digest `598ee0fa4dc31b8394fdd2b7b8fe713c8ee8c4b33e6ecdd92101a1a93d8787a8`.
- Retained release-gate coverage for native-capture, PBI-authorship, and the profile/economy showcase operation surface; durable proof memory remains first admission only, then append forever, while deferred v119 orchestration is not shipped.
- Pinned the official public npm v118 releases and their published integrity values.

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
[4.0.0-alpha.0]: https://github.com/kojibai/wildz.quest/releases/tag/v4.0.0-alpha.0
[5.0.0]: https://github.com/kojibai/wildz.quest/releases/tag/v5.0.0
