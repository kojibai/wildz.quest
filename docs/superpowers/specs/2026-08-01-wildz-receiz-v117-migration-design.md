# Wildz Receiz v117 Migration Design

Date: 2026-08-01

## Goal

Move Wildz from the exact public Receiz v116 SDK, MCP server, and AI Skills packages to the coordinated public v117 release. Every active Wildz runtime, contract, checker, test, skill, and documentation surface must identify v117 truthfully, while historical v116 artifacts remain readable where an existing compatibility union already preserves earlier schemas.

## Release identity

- Packages: `@receiz/sdk@117.0.0`, `@receiz/mcp-server@117.0.0`, and `@receiz/ai-skills@117.0.0` from npm.
- Compatibility: `>=117.0.0 <118.0.0`.
- Registry digest: `598ee0fa4dc31b8394fdd2b7b8fe713c8ee8c4b33e6ecdd92101a1a93d8787a8`.
- Operation-matrix digest: `6c71f54e2fd709f69ce35e8cf3112d9066b5b108b9d610768d9b16ad38d5cab5`.
- Registry predecessor: the v116 digest `9bf61fcf4541edf565bb2ded252e35a976a3ca7c9176dea0f1ffac74ce192a80`.
- Constitutional law inventory: unchanged from v116; v117 is an additive coordinated release.

## Implementation boundary

The migration will:

1. Change all three exact package pins and regenerate `pnpm-lock.yaml` from the public npm artifacts.
2. Regenerate or update `receiz.app.json` and `receiz.generated.json` using the official v117 compiler/checker contract.
3. Promote the active repository checker and v116 contract tests to v117 and assert the exact new release identity, registry digest, operation matrix, package integrity, and compatibility range.
4. Promote current Wildz-created artifact schemas, idempotency namespaces, cross-tab ownership channels, verifier headers, UI labels, and active comments to v117. Existing v116 schema members remain in compatibility unions so previously created artifacts are not rewritten or rejected merely because the current writer advances.
5. Update README, release evidence, interoperability doctrine, MCP guidance, Receiz rails, changelog, and checked-in Wildz AI skills wherever they describe the active version.

The migration will not add v118 orchestration features, invent new constitutional laws, rewrite historical sealed bytes, change Wildz product version `3.0.0`, create a Git tag, push, or deploy.

## Failure handling

Package resolution must fail closed if any exact v117 package is unavailable. Contract generation or checking must fail on digest, version, operation, or authority mismatches. Runtime compatibility remains additive: historical schema readers stay explicit, while new writes use v117 labels. No failed gate will be documented or committed as passing.

## Verification and commit

Version-contract tests will be changed first and observed failing against v116. After implementation, focused v117 tests must pass, followed by a frozen-lockfile install and the complete `pnpm release:check` gate. The staged diff must pass `git diff --cached --check`. The final implementation will be committed as a v117 release integration commit without a tag.
