# Wildz v8.0.0 Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce and commit a complete, evidence-backed Wildz `v8.0.0` release that documents every shipped change since the `v7.0.0` tag.

**Architecture:** Treat the release as a documentation and versioning layer over the already-implemented v7-to-v8 code. Build one canonical flagship release document, mirror its public summary into the changelog and README, update only genuine application release coordinates, then replace the verification record's historical results with observations from the final v8 tree.

**Tech Stack:** Markdown, JSON, pnpm, Node.js, TypeScript, Next.js 15, React 19, Three.js, Receiz 121.0.0, Git.

**Spec:** `docs/superpowers/specs/2026-08-20-wildz-v8-release-design.md`

## Global Constraints

- The release name is `Wildz v8.0.0 — Proof-Native Living World`.
- The enclosing admitted Proof Object is authority; server, database, cache, UI, MCP, AI, and publication results remain non-authoritative projections or transport.
- Document every commit from `da3fb96` through `be6ab53` without inventing behavior not present in source or tests.
- Preserve exact Receiz SDK, MCP server, and AI-skills package version `121.0.0`.
- Do not add gameplay behavior, dependencies, network authority, or release-only bypasses.
- Do not create a tag, push, deploy, publish a GitHub release, or mutate a remote environment.
- Report only final observed gate results; distinguish repository evidence from external production evidence.

---

### Task 1: Audit the v7-to-v8 release surface

**Files:**
- Read: `docs/release/v7.0.0.md`
- Read: `CHANGELOG.md`
- Read: `README.md`
- Read: `package.json`
- Read: `pnpm-lock.yaml`
- Read: `.env.example`
- Read: `scripts/release-check.mjs`
- Read: all source and test files changed by `git diff v7.0.0..HEAD`

**Interfaces:**
- Consumes: Git tag `v7.0.0` and commits `da3fb96..be6ab53`.
- Produces: an exact feature ledger, version-coordinate inventory, and verification-command inventory used by Tasks 2–4.

- [x] **Step 1: Record the commit and file boundary**

Run:

```bash
git log v7.0.0..be6ab53 --reverse --format='%h %s'
git diff --stat v7.0.0..be6ab53
git diff --name-status v7.0.0..be6ab53
```

Expected: exactly 11 product commits and the complete changed-file set.

- [x] **Step 2: Inventory real release coordinates**

Run:

```bash
rg -n '7\.0\.0|v7\.0\.0|v7\.0\.0-r[0-9]+' package.json pnpm-lock.yaml .env.example README.md CHANGELOG.md app src public scripts tests docs/release
```

Expected: classify each match as current application metadata, installed-shell coordinate, historical compatibility text, or old release documentation. Only the first two classes advance.

- [x] **Step 3: Map claims to implementation and regression evidence**

Run:

```bash
git show --stat --oneline da3fb96 2d21be2 4f490c1 0b59f6a a6630a6 e95ecfb 95e2958 5b42131 c2351a0 989829e be6ab53
git diff v7.0.0..be6ab53 -- tests
```

Expected: every release claim has a source change, a regression test, or is clearly labeled an architectural/preserved boundary.

### Task 2: Write the canonical v8 release package

**Files:**
- Create: `docs/release/v8.0.0.md`
- Modify: `CHANGELOG.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 1's feature ledger and the constitutional rules in the spec.
- Produces: the canonical v8 narrative plus discoverable public release summaries.

- [x] **Step 1: Create the flagship release document**

Write `docs/release/v8.0.0.md` with these exact top-level sections:

```markdown
# Wildz v8.0.0 — Proof-Native Living World
## The release in one sentence
## What players receive
## The Proof Object authority model
## Complete identity and game-state restoration
## Exact card and Vault movement
## Profiles that reflect admitted truth
## Immediate gameplay after admission
## A richer living world
## Preserved laws and compatibility
## Complete v7.0.0 → v8.0.0 ledger
## Verification
## Apply the update
```

Include the admission data flow, the 11-commit ledger, source/test references, and external gates not observed locally.

- [x] **Step 2: Advance the changelog**

Replace the current v121-only `Unreleased` content with an empty future-release heading and add `[8.0.0] - 2026-08-20`. The v8 entry must cover added, changed, fixed, performance, integrity, preserved behavior, and a link to `docs/release/v8.0.0.md`. Fold the v121 upgrade currently under `Unreleased` into v8 because it occurred after the v7 tag.

- [x] **Step 3: Make v8 discoverable from the README**

Add the v8 release name, one-paragraph thesis, and direct links to the canonical release and verification record. Preserve setup instructions and existing historical links.

- [x] **Step 4: Check documentation consistency**

Run:

```bash
rg -n 'server.*authorit|database.*authorit|proof object.*authorit|not yet published|single.card|complete.Vault' docs/release/v8.0.0.md CHANGELOG.md README.md
git diff --check
```

Expected: no language makes the server/database/publication result authoritative; no whitespace errors.

### Task 3: Advance the application release identity

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `src/features/pwa/PwaController.tsx`
- Modify: `tests/pwa-runtime.test.ts`
- Modify: `tests/wildz-release-documentation.test.ts`

**Interfaces:**
- Consumes: Task 1's version-coordinate classification.
- Produces: one coherent `8.0.0` application coordinate while preserving Receiz `121.0.0` dependency identity.

- [x] **Step 1: Update package metadata**

Set the root package version to `8.0.0` in `package.json`. The pnpm v9 lockfile has no root application-version field, so leave it byte-exact. Do not alter any Receiz dependency version or integrity.

- [x] **Step 2: Update the installed-shell example coordinate**

Set:

```dotenv
NEXT_PUBLIC_WILDZ_SW_RELEASE=v8.0.0-r1
```

in `.env.example`. Update another current release coordinate only if Task 1 proves it is not historical compatibility evidence.

- [x] **Step 3: Update release-contract tests before the runtime fallback**

Change `tests/pwa-runtime.test.ts` to require `v8.0.0-r1` and `tests/wildz-release-documentation.test.ts` to require package version `8.0.0`. Run:

```bash
pnpm test
```

Expected: FAIL because `PwaController.tsx` still defaults to `v7.0.0-r2`.

- [x] **Step 4: Update the PWA runtime fallback**

Set the default release in `src/features/pwa/PwaController.tsx` to `v8.0.0-r1`, matching `.env.example` and the release-contract test.

- [x] **Step 5: Prove version coherence**

Run:

```bash
node -e "const p=require('./package.json');if(p.version!=='8.0.0')process.exit(1)"
rg -n 'NEXT_PUBLIC_WILDZ_SW_RELEASE=v7|\"version\": \"7\.0\.0\"|\?\? \"v7\.0\.0-r' package.json .env.example src/features/pwa/PwaController.tsx tests/pwa-runtime.test.ts tests/wildz-release-documentation.test.ts
git diff --check
```

Expected: package assertion passes; stale-current-coordinate search returns no matches; diff check passes.

### Task 4: Qualify and record the final release

**Files:**
- Modify: `docs/release/verification.md`
- Modify: `docs/release/v8.0.0.md` only to insert exact final observations.
- Modify: `CHANGELOG.md` only if qualification exposes an inaccurate claim.

**Interfaces:**
- Consumes: the final Tasks 1–3 tree and `scripts/release-check.mjs`.
- Produces: reproducible final evidence and a clean local release commit.

- [x] **Step 1: Run focused v8 regressions**

Run the repository-supported compiled test flow filtered to the identity restore, artifact codec, full Vault, profile, publication, admission, save scheduler, mobile performance, quality governor, and render-contract test files. If the Node test runner cannot safely select source TypeScript tests directly, run the full `pnpm test` gate rather than inventing another runtime.

Expected: zero failures.

- [x] **Step 2: Run the complete release gate**

Run:

```bash
pnpm release:check
```

Expected: architecture lock, full tests, typecheck, v121 checker, conformance, lint, secret scan, optimized build, and doctor all pass. Record exact observed test/suite/file/page counts and any disclosed upstream warnings.

- [x] **Step 3: Rewrite the verification record for v8**

Set the record date and target to `2026-08-20` and `8.0.0`. Preserve relevant v121 constitutional evidence and historical browser evidence, add v8-specific identity/import/profile/performance/world sections, insert final observed gate results, and retain an explicit list of external gates not fabricated.

- [x] **Step 4: Audit the complete release diff**

Run:

```bash
git diff --check
git status --short
git diff --stat
git diff -- package.json .env.example src/features/pwa/PwaController.tsx tests/pwa-runtime.test.ts tests/wildz-release-documentation.test.ts CHANGELOG.md README.md docs/release/v8.0.0.md docs/release/verification.md
rg -n 'TBD|TODO|PLACEHOLDER' docs/release/v8.0.0.md docs/release/verification.md CHANGELOG.md
```

Expected: only intentional release files differ, no whitespace failures, no placeholders, and all claims agree with observed results.

- [x] **Step 5: Commit the verified release**

Run:

```bash
git add .env.example package.json src/features/pwa/PwaController.tsx tests/pwa-runtime.test.ts tests/wildz-release-documentation.test.ts README.md CHANGELOG.md docs/release/v8.0.0.md docs/release/verification.md docs/superpowers/plans/2026-08-20-wildz-v8-release.md
git commit -m "release: ship Wildz v8.0.0 Proof-Native Living World"
git status --short --branch
```

Expected: the release commit succeeds and the worktree is clean. Do not tag or push.
