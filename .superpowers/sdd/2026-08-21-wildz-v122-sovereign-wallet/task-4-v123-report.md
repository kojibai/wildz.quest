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

## Review fix round — 2026-08-22

Base reviewed commit: `54492d940b8ebfc9a4fb204aa34e0e02d3654650`.

### Closed findings

- Proof-authority exchange now derives the artifact digest from the exact artifact bytes with the SDK `sha256ReceizBytes` helper and binds the SDK-validated result to the challenge proof key, nonce, application/audience, exact SDK-derived scopes, issued/expiry Kai interval, and a server-derived current Kai.
- A required server-only admission port resolves the current revocation head and authenticated owner binding for the exact application/key/artifact tuple. Missing freshness/revocation/owner resolution fails closed. The returned server-only admitted context is revalidated before recovery or execution, and a foreign owner, foreign application, expired interval, stale revocation head, or altered context is rejected before recovery, authority binding, or remote execution. Consequently an invalid authority cannot permanently poison an unbound journal row.
- Both transfer orchestration modules now carry the enforced `import "server-only"` boundary. The test emission shim removes only that exact side-effect marker from `.test-build`, allowing Node unit tests to run while preserving the production Next.js boundary. No browser controller or IndexedDB surface receives the proof authority, artifact, raw intent, heads, subject IDs, or owner binding.
- Every loaded, locally constructed, staged-winner, bound, finalized, and removal-candidate journal row passes one async exact admission validator. It enforces the complete top-level and intent schemas, exact key sets, owner/application/idempotency expectations, top-level rail/key equality with the nested intent, null-or-64-hex authority digest, canonical scalar fields, and SDK `validateReceizValueIntentV122` validation.
- Journal compare-and-swap tests now compare the entire admitted entry. A failed exact conditional removal produces `unknown` and retains reconciliation state; no committed or zero-write projection is returned until removal succeeds. Tampered durable rows are rejected before lookup, binding, execution, or removal.
- Duplicate-idempotency admission now plans the incoming semantic candidate and compares every exact intent field, including `priceBasisDigest` and `valueIntentDigest`. The same key with a distinct price basis conflicts.
- `resourceTransfer` and `cardTransfer` remain unavailable even when generic world rails/scopes are admitted because their exact orchestration is not implemented. Only the exact Phi Settlement/Reserve surfaces can become live.
- The independent architecture lock now pins all three exact `123.0.0` packages and enforces the server-only transfer boundary. Current release doctrine in `README.md`, `docs/RECEIZ_RAILS.md`, and `ai-skills/wildz-release-skill/SKILL.md` is exact V123. Per-file tests prevent stale V122 text from passing through concatenation; explicitly scoped V122 builder/market doctrine remains historical/current for those separate skills.

### Review RED evidence

1. Authority/context contract RED:

   ```text
   pnpm exec tsc -p tsconfig.test.json --pretty false
   ```

   Exit `2`: the adversarial tests required the missing server-derived admission port/context, exchange dependency shape, and `authorityContext` execution input. A follow-up owner-binding RED also exited `2` because the old port exposed no authenticated owner resolution.

2. Authority tamper RED after the initial context shape existed:

   ```text
   node --test .test-build/tests/wilds-wallet-transfer.test.js
   ```

   Result: 15 tests, 14 pass, 1 fail. An altered `admittedAtKai` context was accepted instead of being rejected as `wilds_wallet_proof_authority_context_invalid`.

3. Release lock RED:

   ```text
   pnpm receiz:architecture-lock
   ```

   Exit `1`: `receiz_sdk_pin_mismatch`, `receiz_mcp_pin_mismatch`, and `receiz_ai_skills_pin_mismatch` because the independent lock still required exact V122.

4. Capability/doctrine RED:

   ```text
   npx tsx --test tests/wildz-release-documentation.test.ts tests/wilds-wallet-projections.test.ts
   ```

   Result: 18 tests, 15 pass, 3 fail. Generic world rails incorrectly advertised `resourceTransfer`; README still asserted `@receiz/sdk@122`; and the independent architecture lock rejected the V123 pins.

5. Full-suite release assertion RED:

   ```text
   npx tsx --test tests/wildz-ai-skills.test.ts
   ```

   Result: 3 tests, 2 pass, 1 fail. `Wildz AI skills state v122 artifact authority and confirmation law` required `122.0.0` from the now-current V123 release skill. The corrected test checks common authority law independently and then asserts exact V123 release version/digests/36-operation doctrine per file.

6. Exact third full-suite failure:

   ```text
   pnpm test
   ```

   Result: 1,731 tests, 1,730 pass, 1 fail. `pending signatures reject content, digest, identity, and signature tampering` expected `false` but got `true` at the signature-tamper assertion. The old test replaced the final two base64url characters with `aa`; for a 64-byte P-256 signature, non-canonical ignored padding bits can make that textual mutation decode to the original signature bytes. This was a pre-existing randomized test-vector defect, not V123 behavior. The test now flips one decoded signature byte, asserts the decoded bytes differ, and leaves production verification unchanged.

### Review GREEN evidence

- Focused authority/journal/capability/doctrine set: 33 tests, 33 pass, 0 fail.
- Focused release-skill test: 3 tests, 3 pass, 0 fail.
- Focused device-signature test after deterministic byte tamper: 3 tests, 3 pass, 0 fail.
- `pnpm test`: 1,731 tests, 159 suites, 1,731 pass, 0 fail; duration 32.13 s.
- `pnpm typecheck`: exit 0.
- `pnpm exec tsc -p tsconfig.test.json --pretty false`: exit 0.
- `pnpm receiz:check`: exit 0, `ok: true`, target `123.0.0`, exact V123 compatible range and 36-operation inventory.
- `pnpm receiz:architecture-lock`: exit 0, 479 runtime files checked.
- `pnpm receiz:conformance`: exit 0, 15 pass, 0 fail, 0 network calls, 0 database calls. The package's historical top-level `sdkVersion: 121.0.0` label remains beneath the passing exact package-compatibility ranges `>=123.0.0 <124.0.0`.
- Scoped ESLint across all changed TypeScript/MJS implementation and tests: exit 0.
- `git diff --check`: exit 0.

### Boundary retained for Task 5

The proof-authority freshness/revocation/owner resolver and durable journal remain injected server ports with no permissive fallback. Task 5 must supply production cross-instance storage and authenticated binding resolution, plus route/controller wiring and the durable distributed recipient limiter. Until then, missing ports and unsupported resource/card orchestration fail closed.
