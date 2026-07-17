# Wildz Receiz v106 Alignment Plan

**Goal:** Move Wildz from the exact Receiz v105 toolchain to the exact official v106 SDK, MCP server, AI skills, registry, checker, and release doctrine without changing the game surface, audio, camera, or controls.

**Authority boundary:** Sealed Receiz proof objects remain the stronger truth. Compiler, MCP, skills, registry evaluation, and release checks are validation or admission aids; they never invent identity, custody, ownership, settlement, or history.

## Task 1: Pin and prove the coordinated v106 toolchain

- Update version-contract tests first so they require `106.0.0`, the official npm integrity values, and the v106 checker path.
- Install exact `@receiz/sdk@106.0.0`, `@receiz/mcp-server@106.0.0`, and `@receiz/ai-skills@106.0.0` releases.
- Update the doctor target major and prove all requested/installed versions remain coordinated.
- Run focused version and doctor tests.

## Task 2: Bind repository checks to v106 release identity

- Replace the v105 checker entry point with a v106 checker.
- Require `RECEIZ_RELEASE_VERSION`, `RECEIZ_RULESET_VERSION`, and `RECEIZ_V106_REGISTRY_DIGEST` to match the official v106 release.
- Continue enforcing compiler/runtime import separation and artifact-first app-contract evidence.
- Add tests for the exact registry digest and release identity, then run the repository checker.

## Task 3: Run the official migration detector and resolve findings

- Run the official v105-to-v106 migration command in dry-run mode.
- Review every detector finding for direct canonical writes, bypasses, missing capability/idempotency/revision/tenant bindings, nondeterministic authority, schema skew, silent fallbacks, and missing audit receipts.
- Apply only unambiguous repository changes. Preserve witnessed history and stable deployed idempotency namespaces.
- Record any capability that v106 still does not expose as fail-closed rather than synthesizing authority.

## Task 4: Align Wildz operator doctrine and release evidence

- Update repository AI skills and MCP/Receiz documentation to v106.
- State the active registry digest, command-only mutation rule, plan/permit/execute expectation, causal replay requirement, MCP conformance, and release lock.
- Preserve historical labels where they identify deployed compatibility formats rather than the active toolchain.
- Update documentation contract tests.

## Task 5: Verify and ship the slice

- Run focused tests, `pnpm receiz:check`, full tests, typecheck, lint, and production build.
- Confirm the atlas still contains no duplicate destination pills/panels and no audio/camera/control files changed in the v106 slice.
- Commit the verified v106 alignment to `main` and report any separate runtime-domain migration that remains.
