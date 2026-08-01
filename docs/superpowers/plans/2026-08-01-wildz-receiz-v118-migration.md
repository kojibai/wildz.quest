# Wildz Receiz v118 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fully align Wildz with the exact public Receiz SDK, MCP server, and AI Skills v118 release and produce a locally verified release commit ready for the user to push.

**Architecture:** Treat v118 as one coordinated contract across npm packages, compiler-generated application evidence, repository checks, runtime version markers, MCP/AI projections, tests, and documentation. Promote only current writers and labels; preserve historical schema members as explicit compatibility inputs and never rewrite sealed history.

**Tech Stack:** Node.js 20+, TypeScript, Next.js 15, React 19, pnpm 10, `@receiz/sdk`, `@receiz/mcp-server`, `@receiz/ai-skills`, Node test runner.

## Global Constraints

- Exact packages are `@receiz/sdk@118.0.0`, `@receiz/mcp-server@118.0.0`, and `@receiz/ai-skills@118.0.0` from npm.
- Compatibility is exactly `>=118.0.0 <119.0.0`.
- Registry digest is `c284bd39a891c1a828b532523bd548507570819c32e307d79b8043f06d2d3360`.
- Operation-matrix digest is `153b2472830567ec3b445c2c1b4102e4c036ed4c45cc374d40d0079096a40f54`.
- Immutable predecessor registry digest is `598ee0fa4dc31b8394fdd2b7b8fe713c8ee8c4b33e6ecdd92101a1a93d8787a8`.
- MCP artifact inventory remains exactly nine tools.
- Historical schema readers remain additive; current writers use v118.
- Wildz product version remains `3.0.0`; no tag, push, deploy, or strict-live claim.
- Deferred v119 orchestration is not shipped.

---

### Task 1: Establish the failing v118 contract

**Files:**
- Rename: `tests/receiz-v116-app-contract.test.ts` to `tests/receiz-v118-app-contract.test.ts`
- Rename: `tests/receiz-v116-artifact-laws.test.ts` to `tests/receiz-v118-artifact-laws.test.ts`
- Modify: `tests/sdk-version.test.ts`
- Modify: `tests/wildz-release-documentation.test.ts`

**Interfaces:**
- Consumes: current v116 package manifest, lockfile, compiler contract, generated evidence, and checker.
- Produces: exact v118 assertions that fail until packages, checker, contract evidence, runtime labels, and docs are migrated.

- [ ] **Step 1: Rename active constitutional tests and replace current-version assertions**

Use v118 exports and exact identity:

```ts
RECEIZ_V118_REGISTRY_DIGEST
RECEIZ_V118_RELEASE_AUTHORITY
RECEIZ_V118_APPLICATION_OPERATIONS
RECEIZ_V118_APPLICATION_OPERATION_MATRIX_DIGEST
```

Assert SDK/release/ruleset `118.0.0`, registry digest `c284bd…3360`, matrix digest `153b24…0f54`, target `118.0.0`, the nine MCP tools, and AI index version `118.0.0`.

- [ ] **Step 2: Update package-source tests to require exact v118 npm artifacts**

Assert the three manifest versions and installed versions are `118.0.0`, no Receiz file override exists, and the lockfile contains:

```text
sha512-MgcgjTW3PpVGAlQaBnU1ZYSsjntV/J68AFth1KzeRN2GmeyMNKjIfwTz79VrPbp7qr4aPfH6XL5UW8WC23b34w==
sha512-a7j2Tz2I0WAjRGPRoHEJHaEsGue9/8UDlCTfL0nvM3QHdMbnVorYXhYZV3sUuqL+bF8+RDhbo1xAWnxTTZ6YYg==
sha512-ETQURcQlepcg0c7Z1xcwqapT6FFfFIM6YOBlWvvYoQzU2yOmQ9ONtKl8e8S982rvFMyt2oD5coSORrk+aNcAdw==
```

- [ ] **Step 3: Run the suite and verify the v118 expectations fail against v116**

Run: `pnpm test`

Expected: FAIL on missing v118 exports, package versions, checker path, or active v118 documentation. The failure must be caused by the unimplemented migration, not a syntax error.

---

### Task 2: Install v118 and regenerate the constitutional contract

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Rename: `scripts/receiz-v116-check.mjs` to `scripts/receiz-v118-check.mjs`
- Modify: `receiz.app.json`
- Modify: `receiz.generated.json`
- Modify: `scripts/receiz-doctor.mjs`
- Modify: `next.config.mjs`

**Interfaces:**
- Consumes: exact public npm packages and v118 compiler/checker exports.
- Produces: a v118 compiler contract, generated integration evidence, repository checker, and version doctor used by the release gate.

- [ ] **Step 1: Install the three exact packages**

Run:

```bash
pnpm add @receiz/sdk@118.0.0 --save-exact
pnpm add -D @receiz/mcp-server@118.0.0 @receiz/ai-skills@118.0.0 --save-exact
```

- [ ] **Step 2: Promote the repository checker to v118**

Import the v118 registry, authority, operations, matrix, and matrix digest. Set target `118.0.0`, registry digest `c284bd…3360`, matrix digest `153b24…0f54`, and v118 error/report labels. Retain the v113 global-domain and v114 protocol/materialization constants because v118 deliberately preserves those historical exported limits.

- [ ] **Step 3: Regenerate the app contract and checked-in evidence**

Update every `compatibleSdkRange` in `receiz.app.json` to `>=118.0.0 <119.0.0`. Use the installed compiler to generate the canonical `receiz.generated.json`, then verify the generated file is byte-equivalent to `generateNextjsAppRouterFiles(defineReceizApp(...))`.

- [ ] **Step 4: Verify the focused constitutional tests pass**

Run: `pnpm test`

Expected: package, app-contract, artifact-law, doctor, and documentation version assertions may now advance; remaining failures must identify runtime/doc surfaces still at v116.

---

### Task 3: Promote current Wildz runtime surfaces while preserving history

**Files:**
- Modify: `app/api/document-verify/route.ts`
- Modify: `app/api/market/claims/route.ts`
- Modify: `src/features/play/WildsInventory.tsx`
- Modify: `src/features/play/card-export.ts`
- Modify: `src/features/shell/WildzApp.tsx`
- Modify: `src/lib/receiz/adapter.ts`
- Modify: `src/lib/receiz/legacy-receiz-portable-asset.ts`
- Modify: `src/lib/receiz/wildz-artifact-codec.ts`
- Modify: `src/lib/receiz/wildz-artifact-history.ts`
- Modify: `src/lib/receiz/wildz-proof-object-export.ts`
- Modify: `src/lib/receiz/wildz-same-origin-verifier.ts`
- Modify: affected `tests/wildz-*.test.ts` and `tests/receiz-v103-*.test.ts`

**Interfaces:**
- Consumes: v118 SDK verification/admission runtime and existing versioned Wildz artifact formats.
- Produces: v118 labels for new writes and coordination, with v116 retained only as a historical read member.

- [ ] **Step 1: Change tests for current runtime labels**

Require `wildz-v118-` idempotency, `receiz:wildz:ownership:v118`, verifier header `v118`, current artifact/history/custody schemas ending in `.v118`, and current API bearer-claim schema `.v118`.

- [ ] **Step 2: Run tests and verify they fail on v116 labels**

Run: `pnpm test`

Expected: FAIL where current implementation still emits v116 labels.

- [ ] **Step 3: Promote current writers and labels**

Change only active output labels to v118. Extend schema unions with v118 while retaining v116 members. Update UI copy and implementation comments that identify the active SDK. Do not alter immutable payload fields that are intentionally historical evidence.

- [ ] **Step 4: Run tests and verify runtime compatibility passes**

Run: `pnpm test`

Expected: all runtime version-label and historical-compatibility tests pass.

---

### Task 4: Align release doctrine and AI guidance

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/MCP.md`
- Modify: `docs/RECEIZ_RAILS.md`
- Modify: `docs/release/artifact-interoperability.md`
- Modify: `docs/release/feature-parity.md`
- Modify: `docs/release/v3.0.0.md`
- Modify: `docs/release/verification.md`
- Modify: `ai-skills/README.md`
- Modify: `ai-skills/wildz-builder-skill/SKILL.md`
- Modify: `ai-skills/wildz-market-operator-skill/SKILL.md`
- Modify: `ai-skills/wildz-release-skill/SKILL.md`
- Modify: documentation contract tests under `tests/`

**Interfaces:**
- Consumes: verified v118 package/contract identity and current Wildz authority boundaries.
- Produces: truthful release-preparation evidence and agent doctrine that cannot outrank sealed proof truth.

- [ ] **Step 1: Update active version and digest doctrine**

Replace active v116 statements with v118, exact digests, exact range, nine-tool parity, npm provenance, first-admission-then-append-forever proof-memory law, and the explicit exclusion of deferred v119 orchestration. Preserve clearly historical v114/v116 statements in changelog history and compatibility explanations.

- [ ] **Step 2: Update documentation tests**

Require the three exact v118 packages, registry and matrix digests, public npm integrity language, v118 release-gate wording, historical compatibility, and no claim of tag/push/deploy/strict-live qualification.

- [ ] **Step 3: Run all tests**

Run: `pnpm test`

Expected: PASS with zero failures.

---

### Task 5: Qualify and commit the official-release candidate

**Files:**
- Verify: all tracked release files
- Commit: the complete v118 migration

**Interfaces:**
- Consumes: completed v118 package, runtime, contract, tests, and docs changes.
- Produces: one clean local release commit ready for the user to push.

- [ ] **Step 1: Verify reproducible installation**

Run: `pnpm install --frozen-lockfile`

Expected: exit 0 with the lockfile unchanged.

- [ ] **Step 2: Run the complete release gate**

Run: `pnpm release:check`

Expected: exit 0 after tests, typecheck, v118 checker, MCP conformance, lint, secret scan, production build, and doctor.

- [ ] **Step 3: Audit the release diff**

Run:

```bash
git diff --check
git status --short --branch
rg -n "116\\.0\\.0|v116|V116|receiz-v116|wildz-v116" --glob '!docs/superpowers/**' --glob '!node_modules/**' --glob '!.next/**' .
```

Classify every remaining v116 occurrence as explicit historical compatibility; remove any stale active claim.

- [ ] **Step 4: Stage and validate the exact patch**

Run:

```bash
git add -A
git diff --cached --check
git diff --cached --name-status
```

Expected: only the approved v118 release migration is staged.

- [ ] **Step 5: Commit the release**

Run:

```bash
git commit -m "release: align Wildz with Receiz v118"
git status --short --branch
git log -1 --oneline --decorate
```

Expected: commit succeeds, working tree is clean, and the local branch is ahead of origin for the user to push.
