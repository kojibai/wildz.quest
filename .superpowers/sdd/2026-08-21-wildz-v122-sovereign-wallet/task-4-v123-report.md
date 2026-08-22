# Task 4 — Receiz V123 authority and exact Phi execution report

Date: 2026-08-22

## Outcome

Wildz now pins the coordinated public Receiz `123.0.0` SDK, MCP server, and AI-skills packages and verifies the exact V123 release identity. The V123 app contract has 36 operations, compatible range `>=123.0.0 <124.0.0`, registry digest `945a581d1fc49c2dc18fbe8c129771ef464b8a58b96188bce561e88ae8b6ceeb`, and operation-matrix digest `e08cec3e3ad22c20ddd6c08169ece19f094c366214d6d6b4dc432cd97558e2c5`.

The adapter exposes exact indexed SDK client members for proof-authority exchange, V122 world planners carried by V123, namespace resolution, Settlement/Reserve plan/validate/execute, and value-execution lookup by idempotency key. No legacy `connect.transfer`, custom command/digest construction, hand-authored Phi scopes, local balance mutation, or process-local recovery journal was introduced.

## Authority and recovery design

- Phi scopes are derived only with `receizOidcScopesForRails`: Settlement requires `receiz:settlement.read/write`; Reserve requires `receiz:reserve.read/write`. The application base scope set was upgraded coherently.
- Proof-authority exchange requests the minimum exact rail scopes, validates the SDK result with `validateReceizProofAuthorityV123`, and rejects application or scope mismatch. Proof authority and its access token stay in the server-only orchestration boundary and are never journaled or projected.
- `WildsWalletTransferJournalPort` is an injected durable, cross-instance server storage contract with atomic insert-if-absent staging, bind-once authority-digest binding, exact conditional removal, and no browser/process-memory fallback. Production remains fail-closed until Task 5 supplies a concrete durable implementation.
- Preview/stage projections contain only rail, amount, and quote. Ordinary committed projection contains no raw execution ID, proof reference, authority digest, intent, subject ID, or head.
- The exact SDK-planned intent is staged before execution. Existing idempotency winners are loaded before planning. Every execution attempt first resolves `value.executionByIdempotencyKey`; unknowns and thrown/lost responses retain the journal.
- SDK outcome validation is followed by exact journal binding checks for rail, full intent/value-intent digest, amount, source/destination prior and next heads, authority digest, idempotency key, and exact source/destination proof references. A journal is removed only for an exact committed outcome or a zero-write returned after the attempt has an atomically bound authority digest. Unbound lookup zero-writes, unknowns, malformed receipts, and mismatches remain unknown and retained.
- Capability projection is unavailable by default. It becomes live only for exact SDK version `123.0.0`, the complete required V123 rail set, and every SDK-derived rail scope. Merely installing the package does not advertise execution.
- Production recipient lookup remains fail-closed; V123 still does not provide the durable distributed limiter required to enable that route.

## Strict TDD evidence

### Initial RED — missing V123 implementation

Command:

```text
pnpm exec tsc -p tsconfig.test.json --pretty false
```

Exit: `2`. The compiler reported the intentionally missing transfer/journal modules, missing `requireWildsWalletPhiAuthorityScopes`, the old zero-argument capability contract, and missing exact V123 adapter members.

After the RED tests compiled, this focused command exercised the old adoption boundary:

```text
node --test .test-build/tests/receiz-v123-app-contract.test.js .test-build/tests/sdk-version.test.js .test-build/tests/wilds-wallet-transfer.test.js
```

Result: 13 tests, 7 pass, 6 fail. Failures identified the missing 36-operation V123 app matrix, V122 checker/script target, V122 doctor target, stale V122 release/docs assertions, and privacy leakage of raw `execution:0001` in the committed projection.

### Journal atomicity RED

After tightening the journal tests to require atomic winner/bind/remove semantics and application-bound authority, test TypeScript compilation exited `2` because the old non-atomic `store/remove` shape and missing `applicationId` could not satisfy the new contract.

### Exact zero-write attribution RED

Command:

```text
node scripts/patch-test-imports.mjs && node --test .test-build/tests/wilds-wallet-transfer.test.js
```

Result: 7 tests, 6 pass, 1 fail. The failing assertion was `retains ambiguous or unattributable outcomes and removes only an exact bound zero-write`: actual `{ status: "zero-write", rail: "settlement", code: "SOURCE_HEAD_STALE" }`, expected retained `{ status: "unknown", rail: "settlement", amountPhiMicro: "2500000" }`. Production was changed to retain an unbound lookup zero-write; the same zero-write is removable only after atomic authority-digest binding.

### Full-suite discovery and exact third failure

The first full `pnpm test` after the V123 implementation reported 1,722 tests, 1,719 pass, 3 fail:

1. `v122 MCP and AI Skills expose artifact and living-subject operation maps` still asserted V122 package metadata.
2. `Wildz current release doctrine names the exact Receiz v122 toolchain` still asserted V122 packages/digests.
3. `same-origin Receiz ID continuation trusts only the canonical upstream account` deep-equaled a response without `issuedAt`; actual included `issuedAt: 1787377988467`.

The third failure was not caused by V123 runtime behavior. Prior Task 3 production already deliberately returned public session `issuedAt`; only the old exact-shape test was stale. The test now requires `issuedAt` to be a safe integer and includes it in the expected privacy-safe response. No production session contract was weakened or changed. The first two stale package/release assertions were directly caused by the coordinated package upgrade and were migrated to exact V123 metadata and tool surfaces.

## GREEN verification

- Focused wallet hardening: 7 tests, 7 pass, 0 fail.
- Focused V123/adoption/authority/session set: 40 tests, 40 pass, 0 fail.
- `pnpm test`: 1,723 tests, 159 suites, 1,723 pass, 0 fail; final duration 29.70 s.
- `pnpm typecheck`: exit 0.
- `pnpm exec tsc -p tsconfig.test.json --pretty false`: exit 0.
- `pnpm receiz:check`: exit 0, `ok: true`, target `123.0.0`, exact V123 release identity and 36 operations.
- `pnpm receiz:conformance`: exit 0, 15 pass, 0 fail, 0 network calls, 0 database calls. The package currently emits historical top-level report label `sdkVersion: 121.0.0`; its authoritative `package_compatibility` evidence passed exact SDK/MCP ranges `>=123.0.0 <124.0.0`.
- Scoped ESLint across all changed TypeScript/MJS implementation and tests: exit 0.
- `git diff --check`: exit 0.

## Deployment boundary carried to Task 5

Task 4 intentionally defines but does not instantiate the durable server journal. Thin routes, production storage wiring, distributed recipient limiter admission, and the controller state machine remain Task 5. Until those dependencies are explicitly admitted, the current production capability endpoint continues to call the projection without a V123 admission object and therefore reports sends unavailable.
