# Wildz Receiz v118 Migration Design

Date: 2026-08-01

Status: approved for implementation. This design supersedes `2026-08-01-wildz-receiz-v117-migration-design.md`; no v117 runtime migration was implemented.

## Goal

Fully align Wildz with the coordinated public Receiz v118 release and prepare the repository for an official Wildz release commit. The SDK, MCP server, AI Skills, constitutional identity, generated application evidence, runtime version markers, repository checks, tests, release doctrine, and checked-in agent guidance must agree on v118 exactly.

## Release identity

- Packages: `@receiz/sdk@118.0.0`, `@receiz/mcp-server@118.0.0`, and `@receiz/ai-skills@118.0.0` from npm.
- Compatibility: `>=118.0.0 <119.0.0`.
- Registry digest: `c284bd39a891c1a828b532523bd548507570819c32e307d79b8043f06d2d3360`.
- Operation-matrix digest: `153b2472830567ec3b445c2c1b4102e4c036ed4c45cc374d40d0079096a40f54`.
- Immutable predecessor registry digest: v117 digest `598ee0fa4dc31b8394fdd2b7b8fe713c8ee8c4b33e6ecdd92101a1a93d8787a8`.
- MCP artifact inventory: nine tools.
- V118 makes SDK, MCP, AI manifests, ruleset, registry, operation matrix, package range, and packed runtime identity one coordinated contract.

## Implementation boundary

The migration will:

1. Pin all three exact public npm packages and regenerate the lockfile with their published integrity values.
2. Regenerate the Wildz application contract and generated evidence through the official v118 compiler/checker surface.
3. Promote the active repository checker and contract tests from v116 to v118. Tests will bind the exact release identity, predecessor, registry digest, operation-matrix digest, compatible range, artifact laws, release-authority flags, and nine-tool MCP/AI projection.
4. Promote current Wildz-created artifact schemas, idempotency namespaces, ownership channels, verifier headers, API schema labels, UI labels, and active implementation comments to v118. Historical schema members remain explicit in read-compatibility unions; existing verified artifacts are never rewritten.
5. Update README, changelog, MCP guidance, Receiz rails, interoperability contract, release evidence, feature parity, release notes, and all checked-in Wildz AI skills wherever they describe the active Receiz release.
6. State v118 truthfully: known sealed proof truth remains stronger than SDK, MCP, AI, metadata, cache, session, database, or UI projection; durable proof memory remains first admission only, then append forever; deferred v119 orchestration is not shipped.

The migration will not invent new constitutional laws, collapse historical compatibility, change the Wildz product version `3.0.0`, create a Git tag, push, deploy, or claim production/strict-live qualification.

## Failure handling

Exact-package resolution, compiler/checker identity, registry/matrix parity, MCP/AI projection, runtime version assertions, typechecking, tests, lint, secret scan, build, or doctor failures block the release commit. A package version match without matching published integrity and coordinated identity is insufficient.

## Verification and release preparation

Active version-contract tests will be changed first and observed failing against v116. After the implementation passes focused v118 tests, the repository must pass a frozen-lockfile install and the complete `pnpm release:check` gate. Release documentation may record only evidence observed in the current run. The staged patch must pass `git diff --cached --check`; the final result will be committed locally for the user to push.
