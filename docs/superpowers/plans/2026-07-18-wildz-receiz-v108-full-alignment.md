# Wildz Receiz v108 Full Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every current Wildz Receiz integration use the v108 SDK, MCP, AI-skill, proof-object, continuity, provenance, and ownership standard.

**Architecture:** Pin the exact v108 toolchain, centralize complete-artifact custody in one root-SDK adapter, and route creation, restore, continuity, and bearer ownership through native Record -> Seal artifacts. Persist exact admitted bytes and append-only artifact history; all UI, market, world, and local state remain rebuildable projections beneath verified proof objects.

**Tech Stack:** TypeScript 5.6+, Next.js 15 App Router, React 19, pnpm 10, IndexedDB, Node test runner, `@receiz/sdk@108.0.0`, `@receiz/mcp-server@108.0.0`, `@receiz/ai-skills@108.0.0`.

## Global Constraints

- Runtime code imports only current root `@receiz/sdk` surfaces; `@receiz/sdk/v107` is forbidden.
- Pin SDK, MCP, and AI Skills exactly to `108.0.0`.
- Bind ruleset `108.0.0` to registry digest `126ca9283fee4ef4c398dbcb958e861cbea191724fdab8eb08df55ff0c14bb79`.
- Enforce `ARTIFACT-001` through `ARTIFACT-010` and `RECEIZ_V108_RELEASE_AUTHORITY`.
- Exact sealed artifact bytes and verified admitted history outrank SDK, MCP, AI, server, database, IndexedDB, session, UI, market, compiler, checker, and release projections.
- Current creation and mutation use native Record -> Seal; there is no unsealed payload fallback.
- Preserve immutable object identity, exact payload, provenance root, prior ownership/history, and unknown namespaces.
- Historical artifacts are readable only through v108 verifier compatibility; no historical SDK operation may become a write path.
- Gameplay/domain receipts remain valid domain evidence; only retired v107 receipt prerequisites and receipt-as-proof-authority are forbidden.
- Every authority-changing failure leaves the last admitted artifact and projection unchanged.

---

## File Structure

- `src/lib/receiz/wildz-artifact-custody.ts`: one focused boundary for v108 verify/open, exact-byte admission, download, hashing, and reopen verification.
- `src/lib/receiz/wildz-proof-object-export.ts`: validate Wildz payload ownership, call native creation, and delegate output admission to artifact custody.
- `src/lib/receiz/wildz-artifact-codec.ts`: inspect only verified payload bytes and retain complete enclosing-artifact coordinates.
- `src/lib/receiz/adapter.ts`: expose current v108 artifact and ownership operations without historical transport abstractions.
- `src/lib/storage/wildz-indexed-db.ts`: add append-only admitted-artifact storage.
- `src/lib/receiz/wildz-identity-repository.ts`: atomically retain artifact history with owner-scoped projections.
- `app/api/market/claims/route.ts`: accept a complete artifact and return a newly verified ownership artifact.
- `scripts/receiz-v108-check.mjs`: enforce package, registry, law, import, and authority boundaries.
- `tests/support/receiz-v108-artifact-fixtures.ts`: shared current-native and verified-legacy v108 test fixtures.

### Task 1: Pin and enforce the v108 toolchain

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Rename: `scripts/receiz-v107-check.mjs` -> `scripts/receiz-v108-check.mjs`
- Modify: `tests/sdk-version.test.ts`
- Modify: `tests/wildz-release-documentation.test.ts`
- Modify: `tests/receiz-v104-app-contract.test.ts`
- Modify: `next.config.mjs`
- Modify: `receiz.app.json`
- Modify: `receiz.generated.json`

**Interfaces:**
- Consumes: published npm packages at exact version `108.0.0`.
- Produces: `pnpm receiz:check`, which exits zero only for v108 release identity, registry digest, all ten artifact laws, current authority flags, and root-SDK-only application imports.

- [ ] **Step 1: Rewrite the version contract tests to fail against v107**

Replace v107 assertions in `tests/sdk-version.test.ts` with exact v108 assertions and add an import-boundary scan:

```ts
const EXPECTED = "108.0.0";
const REGISTRY = "126ca9283fee4ef4c398dbcb958e861cbea191724fdab8eb08df55ff0c14bb79";

test("SDK, MCP, and AI skills use only Receiz v108", () => {
  assert.equal(pkg.dependencies?.["@receiz/sdk"], EXPECTED);
  assert.equal(pkg.devDependencies?.["@receiz/mcp-server"], EXPECTED);
  assert.equal(pkg.devDependencies?.["@receiz/ai-skills"], EXPECTED);
  assert.match(readFileSync("scripts/receiz-v108-check.mjs", "utf8"), new RegExp(REGISTRY));
  assert.doesNotMatch(allReceizSources(), /@receiz\/sdk\/v107/);
});
```

Keep `allReceizSources()` bounded to `app`, `src`, `scripts`, and `tests`; exclude `docs/superpowers` so the immutable design history is not treated as runtime code.

- [ ] **Step 2: Run the focused tests and verify the expected failure**

Run: `pnpm test -- --test-name-pattern "Receiz v108|release doctrine"`

Expected: FAIL because `package.json`, the checker filename, release constants, and docs still name `107.0.0`.

- [ ] **Step 3: Update dependencies and lockfile from the official registry**

Run: `pnpm add @receiz/sdk@108.0.0 --save-exact`

Run: `pnpm add -D @receiz/mcp-server@108.0.0 @receiz/ai-skills@108.0.0 --save-exact`

Expected: `package.json` and `pnpm-lock.yaml` resolve all three packages at `108.0.0` with published integrity values and no local tarball or override.

- [ ] **Step 4: Replace the repository checker with v108 release assertions**

Rename the script and replace its release boundary with:

```js
import {
  RECEIZ_RELEASE_VERSION,
  RECEIZ_RULESET_VERSION,
  RECEIZ_V108_ARTIFACT_LAWS,
  RECEIZ_V108_REGISTRY_DIGEST,
  RECEIZ_V108_RELEASE_AUTHORITY
} from "@receiz/sdk";

const TARGET_VERSION = "108.0.0";
const TARGET_REGISTRY_DIGEST = "126ca9283fee4ef4c398dbcb958e861cbea191724fdab8eb08df55ff0c14bb79";
const TARGET_LAWS = Array.from({ length: 10 }, (_, index) => `ARTIFACT-${String(index + 1).padStart(3, "0")}`);

function assertReleaseIdentity() {
  if (RECEIZ_RELEASE_VERSION !== TARGET_VERSION || RECEIZ_RULESET_VERSION !== TARGET_VERSION) throw new Error("receiz_v108_release_identity_mismatch");
  if (RECEIZ_V108_REGISTRY_DIGEST !== TARGET_REGISTRY_DIGEST) throw new Error("receiz_v108_registry_digest_mismatch");
  if (JSON.stringify(RECEIZ_V108_ARTIFACT_LAWS) !== JSON.stringify(TARGET_LAWS)) throw new Error("receiz_v108_artifact_laws_mismatch");
  if (!RECEIZ_V108_RELEASE_AUTHORITY.proofObjectFirst
    || !RECEIZ_V108_RELEASE_AUTHORITY.receizComReferenceBeforeDeveloperRails
    || RECEIZ_V108_RELEASE_AUTHORITY.queuedCommandIsGlobalCommitment !== false
    || RECEIZ_V108_RELEASE_AUTHORITY.registryPayloadIsProofAuthority !== false) {
    throw new Error("receiz_v108_authority_mismatch");
  }
}
```

Keep the existing compiler-entry-point scan, change diagnostic codes and temporary directory names from `v107` to `v108`, reject `@receiz/sdk/v107`, call `checkReceizIntegration({ root, targetSdkVersion: TARGET_VERSION })`, and emit v108 release identity plus artifact-law evidence.

- [ ] **Step 5: Regenerate the application contract through the v108 compiler**

Update `receiz.app.json` to target `108.0.0` and keep `artifact-first` plus `allowDatabaseAuthority: false`. Use `compileReceizAppContract` from `@receiz/sdk/compiler` to regenerate `receiz.generated.json`; do not hand-author generated evidence.

Run: `pnpm receiz:check`

Expected: checker reports target `108.0.0`, registry digest `126ca9...bb79`, all ten artifact laws, and no blocking findings.

- [ ] **Step 6: Run version tests**

Run: `pnpm test -- --test-name-pattern "Receiz v108|release doctrine|application contract"`

Expected: PASS.

- [ ] **Step 7: Commit the toolchain cutover**

```bash
git add package.json pnpm-lock.yaml scripts/receiz-v108-check.mjs tests/sdk-version.test.ts tests/wildz-release-documentation.test.ts tests/receiz-v104-app-contract.test.ts next.config.mjs receiz.app.json receiz.generated.json
git commit -m "build: pin Receiz v108 toolchain"
```

### Task 2: Centralize complete-artifact custody

**Files:**
- Create: `src/lib/receiz/wildz-artifact-custody.ts`
- Create: `tests/wildz-artifact-custody.test.ts`
- Modify: `src/lib/receiz/adapter.ts`

**Interfaces:**
- Consumes: `ReceizClient["artifacts"]`, `ReceizSealedArtifact`, `ReceizOpenedArtifact` from the v108 root SDK.
- Produces: `openWildzArtifact`, `downloadAndReopenWildzArtifact`, `WildzAdmittedArtifact`, and adapter methods `verifyAndOpenArtifact`, `downloadArtifact`, `claimBearerArtifact`.

- [ ] **Step 1: Write mutation and exact-byte custody tests**

Create `tests/wildz-artifact-custody.test.ts` with a fake v108 artifact port and these cases:

```ts
test("opens the complete artifact before exposing verified payload", async () => {
  const result = await openWildzArtifact(new Blob([SEALED]), "card.receiz", port);
  assert.deepEqual(result.artifactBytes, SEALED);
  assert.deepEqual(result.payloadBytes, PAYLOAD);
  assert.equal(result.compatibility, "current-native");
  assert.equal(result.artifactSha256, await sha256Hex(SEALED));
});

test("rejects a one-byte artifact substitution without exposing payload", async () => {
  const changed = SEALED.slice();
  changed[changed.length - 1] ^= 1;
  await assert.rejects(openWildzArtifact(new Blob([changed]), "card.receiz", port), /wildz_artifact_verification_failed/);
  assert.equal(port.exposedPayloads, 0);
});

test("download requires byte identity and successful reopen", async () => {
  await assert.rejects(downloadAndReopenWildzArtifact(current, mismatchedPort), /wildz_artifact_download_digest_mismatch/);
});
```

Add equivalent owner, Record, claim, path, payload-binding, and Signature V4 rejection fixtures. Each fake must fail through `verifyAndOpen`; tests must never construct a production SDK artifact brand by type assertion in application code.

- [ ] **Step 2: Run the custody tests and verify failure**

Run: `pnpm test -- --test-name-pattern "complete artifact|artifact substitution|byte identity"`

Expected: FAIL because `wildz-artifact-custody.ts` does not exist.

- [ ] **Step 3: Implement the custody boundary**

Create the module with these exported contracts:

```ts
import type { ReceizClient, ReceizOpenedArtifact, ReceizSealedArtifact } from "@receiz/sdk";

export type WildzArtifactPort = Pick<ReceizClient["artifacts"], "verifyAndOpen" | "download">;

export type WildzAdmittedArtifact = Readonly<{
  artifactBytes: Uint8Array;
  artifactSha256: string;
  payloadBytes: Uint8Array;
  payloadSha256: string;
  filename: string;
  mimeType: string;
  ownerReceizId: string;
  claimId: string;
  verifyPath: string;
  recordId: string | null;
  compatibility: "current-native" | "verified-legacy-read";
}>;

export async function openWildzArtifact(file: Blob, filename: string, port: WildzArtifactPort): Promise<WildzAdmittedArtifact>;

export async function downloadAndReopenWildzArtifact(
  artifact: ReceizSealedArtifact,
  port: WildzArtifactPort
): Promise<WildzAdmittedArtifact>;
```

`openWildzArtifact` calls `verifyAndOpen` before reading `verifiedPayload`, independently hashes `file.arrayBuffer()`, requires equality with `sealedArtifact.artifactSha256`, and snapshots exact bytes. `downloadAndReopenWildzArtifact` calls `download`, verifies size and digest, reads `artifact.artifact` bytes, and calls `openWildzArtifact` on those exact bytes. Require `current-native` for newly issued output; permit `verified-legacy-read` only on input admission.

- [ ] **Step 4: Expose only current v108 operations from the adapter**

Add to `ReceizCommerceAdapter` and `createReceizCommerceAdapter`:

```ts
verifyAndOpenArtifact: ReceizClient["artifacts"]["verifyAndOpen"];
downloadArtifact: ReceizClient["artifacts"]["download"];
claimBearerArtifact: ReceizClient["ownership"]["claimBearerAsset"];
```

Implement them as direct delegates to `client.artifacts.verifyAndOpen`, `client.artifacts.download`, and `client.ownership.claimBearerAsset`. Keep `verifyArtifact` temporarily for unrelated display verification until Task 4 migrates restore admission.

- [ ] **Step 5: Run custody tests and typecheck**

Run: `pnpm test -- --test-name-pattern "complete artifact|artifact substitution|byte identity"`

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the custody boundary**

```bash
git add src/lib/receiz/wildz-artifact-custody.ts src/lib/receiz/adapter.ts tests/wildz-artifact-custody.test.ts
git commit -m "feat: add v108 artifact custody boundary"
```

### Task 3: Migrate proof-object creation and download

**Files:**
- Modify: `src/lib/receiz/wildz-proof-object-export.ts`
- Modify: `app/api/receiz/proof-object/route.ts`
- Modify: `src/features/play/card-export.ts`
- Modify: `tests/receiz-v103-proof-object-export.test.ts`
- Modify: `tests/wildz-native-proof-download.test.ts`
- Modify: `tests/wildz-proof-object-continuity.test.ts`

**Interfaces:**
- Consumes: `downloadAndReopenWildzArtifact`, `ReceizClient["assets"]["createProofObject"]`.
- Produces: `createWildzExportProofObject(): Promise<{ artifact: ReceizSealedArtifact; admitted: WildzAdmittedArtifact }>`.

- [ ] **Step 1: Rewrite export tests for the v108 return type**

Replace `ReceizProofObjectCreateResult` fixtures with v108 SDK-issued artifact fixtures. Assert:

```ts
assert.equal(created.artifact.kind, "receiz.native-record-seal");
assert.equal(created.admitted.compatibility, "current-native");
assert.deepEqual(created.admitted.artifactBytes, expectedArtifactBytes);
assert.equal(created.admitted.payloadSha256, await sha256Hex(sourcePng));
assert.equal(downloadCalls, 1);
assert.equal(reopenCalls, 1);
```

Add explicit no-artifact tests for Record failure, Seal failure, download digest mismatch, owner substitution, claim substitution, verify-path substitution, and repacked-byte output.

- [ ] **Step 2: Run export tests and verify failure**

Run: `pnpm test -- --test-name-pattern "proof object export|native proof download|Record failure|Seal failure"`

Expected: FAIL because the implementation expects the removed v107-style `ReceizProofObjectCreateResult` shape and does not download/reopen.

- [ ] **Step 3: Implement native v108 creation**

Change the export module to use:

```ts
export type WildzExportProofObjectCreator = ReceizClient["assets"]["createProofObject"];

const artifact = await input.createProofObject(
  { assetType: "proof_object", payload: { mimeType: "image/png", bytes: input.bytes.slice() } },
  { idempotencyKey: `wildz-v108-${digest}`, filename: safeSourceFilename(input.filename) }
);
const admitted = await downloadAndReopenWildzArtifact(artifact, input.artifacts);
requireCurrentWildzOwner(admitted, input.actor);
return { artifact, admitted };
```

Remove `requireVerifiedContinuity(ReceizProofObjectCreateResult)` and all assumptions about `result.artifact`, `result.continuity`, or separately returned verification bundles. The SDK-issued `ReceizSealedArtifact` and custody boundary now enforce those invariants.

- [ ] **Step 4: Return exact sealed bytes from the API and UI**

Update the proof-object route to return `admitted.artifactBytes` with the artifact MIME type and filename. Update browser download code so it does not wrap, append a PNG envelope, recompress, or label payload bytes as a `.receiz` artifact.

- [ ] **Step 5: Run export and continuity tests**

Run: `pnpm test -- --test-name-pattern "proof object export|native proof download|proof object continuity"`

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: Commit native creation**

```bash
git add src/lib/receiz/wildz-proof-object-export.ts app/api/receiz/proof-object/route.ts src/features/play/card-export.ts tests/receiz-v103-proof-object-export.test.ts tests/wildz-native-proof-download.test.ts tests/wildz-proof-object-continuity.test.ts
git commit -m "feat: create native v108 proof objects"
```

### Task 4: Admit restore and continuity through v108 verified artifacts

**Files:**
- Modify: `src/lib/receiz/wildz-artifact-codec.ts`
- Modify: `src/lib/receiz/wildz-proof-sealed-vault.ts`
- Modify: `src/lib/receiz/wildz-same-origin-verifier.ts`
- Modify: `src/lib/receiz/wildz-identity-adapter.ts`
- Modify: `src/lib/receiz/wildz-vault-login-coordinator.ts`
- Modify: `src/lib/storage/wildz-indexed-db.ts`
- Modify: `src/lib/receiz/wildz-identity-repository.ts`
- Modify: `tests/support/memory-wildz-continuity-database.ts`
- Modify: `tests/wildz-artifact-codec.test.ts`
- Modify: `tests/wildz-cross-platform-continuity.test.ts`
- Modify: `tests/wildz-proof-sealed-vault.test.ts`
- Modify: `tests/wildz-vault-login-coordinator.test.ts`
- Modify: `tests/wildz-indexed-db.test.ts`

**Interfaces:**
- Consumes: `openWildzArtifact` and `WildzAdmittedArtifact`.
- Produces: `WildzStoredArtifactHistory` and atomic APIs `admitArtifactHistory(tx, entry)` / `readArtifactHistory(ownerScope)`.

- [ ] **Step 1: Add failing restore and append-only history tests**

Add tests that prove the codec never extracts a proof-object payload before `verifyAndOpen`, stores exact enclosing bytes, and rejects substitutions. Add database tests using:

```ts
test("artifact history is append-only and exact duplicates are idempotent", async () => {
  await repository.admitArtifactHistory(entryA);
  await repository.admitArtifactHistory(entryA);
  await repository.admitArtifactHistory(entryB);
  const history = await repository.readArtifactHistory(entryA.ownerScope);
  assert.deepEqual(history.map((entry) => entry.artifactSha256), [entryA.artifactSha256, entryB.artifactSha256]);
  assert.deepEqual(history[0]?.artifactBytes, entryA.artifactBytes);
});

test("a history conflict preserves both artifacts and does not advance the active projection", async () => {
  const before = await repository.active();
  await assert.rejects(repository.admitContinuity(conflictingA, conflictingB), /wildz_continuity_history_conflict/);
  assert.deepEqual(await repository.active(), before);
  assert.equal((await repository.conflicts()).length, 2);
});
```

- [ ] **Step 2: Run restore/history tests and verify failure**

Run: `pnpm test -- --test-name-pattern "append-only|history conflict|verify before extract|cross-platform continuity"`

Expected: FAIL because no admitted-artifact store exists and the codec still app-parses legacy envelopes before v108 enclosing verification.

- [ ] **Step 3: Add an artifact-history store**

Extend the store union and database version:

```ts
export type WildzStoreName = "wrappingKeys" | "identities" | "ownerStates" | "artifacts" | "meta" | "pendingRestores";
const DATABASE_VERSION = 3;
```

Persist immutable records keyed by `artifactSha256`:

```ts
export type WildzStoredArtifactHistory = Readonly<{
  schema: "receiz.wildz.artifact_history.v108";
  ownerScope: string;
  artifactSha256: string;
  priorArtifactSha256: string | null;
  provenanceRoot: string;
  historyDigestSha256: string;
  namespaces: readonly string[];
  artifactBytes: Uint8Array;
  admittedAt: string;
}>;
```

Reject changed bytes for an existing digest, reject missing prior links for current writes, preserve both records on conflicting verified branches, and never update the active owner projection in the same transaction when admission fails.

- [ ] **Step 4: Replace proof-object payload discovery with v108 open-first admission**

Inject an artifact opener into `createWildzArtifactCodec`. For complete proof-object candidates, call `openWildzArtifact` and pass only `admitted.payloadBytes` to card/Vault domain parsing. Retain `admitted.artifactBytes`, owner, claim, path, digest, and compatibility in `WildzProofObjectContinuity`. Remove direct use of `extractLegacyReceizPortableAssetDocument` from current restore admission.

Keep identity-artifact reading on current root SDK identity methods. Historical proof-object acceptance comes only from `opened.legacyCompatibility === "verified-legacy-read"`.

- [ ] **Step 5: Make Vault login and same-origin verification consume admitted artifacts**

Change verifier interfaces from raw `DocumentVerifyResponse` to `ReceizOpenedArtifact` or `WildzAdmittedArtifact`. Build Vault/player/card projections after complete admission and atomically write artifact history plus owner-scoped state. Preserve the existing rule that an artifact-scoped historical owner does not become canonical account identity.

- [ ] **Step 6: Run restore, storage, and login tests**

Run: `pnpm test -- --test-name-pattern "artifact codec|cross-platform continuity|proof-sealed|vault login|IndexedDB"`

Run: `pnpm typecheck`

Expected: PASS, including v108 verified-legacy reads and mutation rejection.

- [ ] **Step 7: Commit continuity admission**

```bash
git add src/lib/receiz/wildz-artifact-codec.ts src/lib/receiz/wildz-proof-sealed-vault.ts src/lib/receiz/wildz-same-origin-verifier.ts src/lib/receiz/wildz-identity-adapter.ts src/lib/receiz/wildz-vault-login-coordinator.ts src/lib/storage/wildz-indexed-db.ts src/lib/receiz/wildz-identity-repository.ts tests/support/memory-wildz-continuity-database.ts tests/wildz-artifact-codec.test.ts tests/wildz-cross-platform-continuity.test.ts tests/wildz-proof-sealed-vault.test.ts tests/wildz-vault-login-coordinator.test.ts tests/wildz-indexed-db.test.ts
git commit -m "feat: preserve v108 artifact continuity history"
```

### Task 5: Replace synthetic bearer claims with v108 ownership artifacts

**Files:**
- Modify: `app/api/market/claims/route.ts`
- Modify: `src/lib/receiz/wildz-market-adapter.ts`
- Modify: `src/lib/receiz/wildz-market-state.ts`
- Modify: `src/features/market/wildz-market.ts`
- Modify: `tests/wildz-market-routes.test.ts`
- Modify: `tests/wildz-market-state.test.ts`
- Modify: `tests/wildz-vault-ownership.test.ts`
- Modify: `tests/wildz-historical-owner-compatibility.test.ts`

**Interfaces:**
- Consumes: complete uploaded artifact, `verifyAndOpenArtifact`, `claimBearerArtifact`, `downloadAndReopenWildzArtifact`.
- Produces: an HTTP response containing a new verified artifact plus projection coordinates; `WildzOwnershipProjection` points to artifact/history digests rather than claiming receipt authority.

- [ ] **Step 1: Write failing complete-artifact ownership tests**

Replace asset-JSON claim tests with multipart or base64 complete-artifact requests. Assert the route calls operations in this order:

```ts
assert.deepEqual(calls, ["verifyAndOpen", "claimBearerAsset", "download", "verifyAndOpen"]);
assert.deepEqual(claimInput, { artifact: opened.sealedArtifact });
assert.equal("ownerReceizId" in submittedClaimInput, false);
assert.equal("expectedOwnershipHead" in submittedClaimInput, false);
assert.equal("claimantKeyId" in submittedClaimInput, false);
```

Add failure cases for payload-only input, non-bearer custody, wrong authenticated owner, ownership failure, output mutation, and prior-history truncation. Every failure must assert `ownershipTransferred: false` and no market projection append.

- [ ] **Step 2: Run ownership tests and verify failure**

Run: `pnpm test -- --test-name-pattern "bearer claim|historical owner|ownership artifact"`

Expected: FAIL because the route currently accepts detached `PortableCardAsset` JSON and synthesizes a Wildz ownership receipt.

- [ ] **Step 3: Implement the native claim route**

Parse `{ artifactBase64, filename, mimeType }`, decode to a `Blob`, enforce bounded size and exact fields, then:

```ts
const opened = await adapter.verifyAndOpenArtifact(file);
const claimed = await adapter.claimBearerArtifact({ artifact: opened.sealedArtifact });
const admitted = await downloadAndReopenWildzArtifact(claimed, {
  verifyAndOpen: adapter.verifyAndOpenArtifact,
  download: adapter.downloadArtifact
});
```

Require `opened.sealedArtifact` to be current-native or v108-verified legacy input, require claimed output to be current-native, require the output authenticated owner to match the session actor, and require carried object identity, payload digest, provenance root, prior history, and namespaces to remain intact.

- [ ] **Step 4: Demote receipts to projection evidence**

Replace synthetic `receiz.wilds_ownership_receipt.v1` authority with a projection containing source artifact digest, claimed artifact digest, current owner, previous owner, provenance root, and history digest. Domain receipts may reference that admitted artifact but cannot make ownership true without it.

- [ ] **Step 5: Run ownership and market tests**

Run: `pnpm test -- --test-name-pattern "bearer claim|historical owner|ownership artifact|market state"`

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: Commit v108 ownership**

```bash
git add app/api/market/claims/route.ts src/lib/receiz/wildz-market-adapter.ts src/lib/receiz/wildz-market-state.ts src/features/market/wildz-market.ts tests/wildz-market-routes.test.ts tests/wildz-market-state.test.ts tests/wildz-vault-ownership.test.ts tests/wildz-historical-owner-compatibility.test.ts
git commit -m "feat: claim bearer ownership through v108 artifacts"
```

### Task 6: Prove cross-application history, provenance, and compatibility

**Files:**
- Create: `tests/support/receiz-v108-artifact-fixtures.ts`
- Create: `tests/receiz-v108-conformance-corpus.test.ts`
- Modify: `tests/support/receiz-cross-platform-fixtures.ts`
- Modify: `tests/wildz-cross-platform-continuity.test.ts`
- Modify: `tests/legacy-receiz-portable-asset.test.ts`

**Interfaces:**
- Consumes: `@receiz/sdk/fixtures/v108/artifact-conformance-corpus.json`, artifact custody, restore codec, ownership flow.
- Produces: deterministic evidence for every corpus scenario and substitution class.

- [ ] **Step 1: Add corpus-driven failing tests**

Load the published v108 fixture through the package export and assert:

```ts
assert.equal(corpus.schema, "receiz.artifact_conformance_corpus.v108");
assert.equal(corpus.version, "108.0.0");
```

For `wildz-commerce-wildz`, `commerce-wildz-commerce`, unknown namespace, 98-card Vault, historical owner chain, v100/v102 verified legacy read, and current native scenarios, assert exact payload bytes, namespace preservation, stable object identity, ordered ownership history, and expected compatibility label.

For every mutation scenario, assert verification fails before payload exposure and leaves stored history/projections unchanged.

- [ ] **Step 2: Run corpus tests and verify failure**

Run: `pnpm test -- --test-name-pattern "v108 conformance corpus"`

Expected: FAIL because the corpus harness does not exist.

- [ ] **Step 3: Implement shared fixtures without inventing proof authority**

Create helpers that feed published scenario data into the SDK testing/emulator surface. Test helpers may issue SDK-branded sandbox artifacts only through `@receiz/sdk/testing`; they must not cast plain objects to `ReceizSealedArtifact`.

Expose:

```ts
export async function openCorpusScenario(id: string): Promise<WildzAdmittedArtifact>;
export async function roundTripCorpusScenario(id: string): Promise<WildzAdmittedArtifact>;
export async function mutateCorpusScenario(id: string, mutation: string): Promise<Blob>;
```

- [ ] **Step 4: Prove replay and idempotency equivalence**

Run the same exact Record -> Seal and ownership plans twice with the same idempotency key and require byte/digest-equivalent admitted results. Change one consequence or payload byte and require a new plan/digest rather than reuse.

- [ ] **Step 5: Run compatibility and corpus tests**

Run: `pnpm test -- --test-name-pattern "v108 conformance corpus|cross-platform continuity|legacy portable"`

Expected: PASS.

- [ ] **Step 6: Commit conformance evidence**

```bash
git add tests/support/receiz-v108-artifact-fixtures.ts tests/receiz-v108-conformance-corpus.test.ts tests/support/receiz-cross-platform-fixtures.ts tests/wildz-cross-platform-continuity.test.ts tests/legacy-receiz-portable-asset.test.ts
git commit -m "test: prove v108 cross-platform artifact continuity"
```

### Task 7: Align MCP, AI skills, and operator doctrine

**Files:**
- Modify: `ai-skills/README.md`
- Modify: `ai-skills/wildz-builder-skill/SKILL.md`
- Modify: `ai-skills/wildz-market-operator-skill/SKILL.md`
- Modify: `ai-skills/wildz-release-skill/SKILL.md`
- Modify: `docs/MCP.md`
- Modify: `docs/RECEIZ_RAILS.md`
- Modify: `docs/release/v3.0.0.md`
- Modify: `docs/release/verification.md`
- Modify: `tests/wildz-ai-skills.test.ts`
- Modify: `tests/wildz-release-documentation.test.ts`

**Interfaces:**
- Consumes: v108 AI skill manifests and MCP tool contracts from installed packages.
- Produces: local Wildz doctrine naming only v108 current operations, exact registry digest, forbidden historical prerequisites, and required evidence.

- [ ] **Step 1: Write failing doctrine tests**

Require every local skill and operator doc to contain `108.0.0`, the v108 registry digest, complete-artifact verification, Record -> Seal, append-only history, provenance/namespace preservation, and independent verification. Reject active doctrine matching:

```ts
const forbidden = [
  /@receiz\/sdk\/v107/,
  /continuity\.reconcile/,
  /continuity\.commit/,
  /proofHead\.get/,
  /claimantKeyId/,
  /expectedOwnershipHead/,
  /receipt.*(?:proves|authority)/i
];
```

Permit historical `v107` prose only when the same sentence labels it `historical`, `retired`, or `not current`.

- [ ] **Step 2: Run doctrine tests and verify failure**

Run: `pnpm test -- --test-name-pattern "AI skills|release doctrine|MCP"`

Expected: FAIL on v107 package versions, registry digest, operations, and market unavailability assumptions.

- [ ] **Step 3: Rewrite local skills from v108 package doctrine**

The builder skill must specify verify-before-extract, exact artifact bytes, native creation, download/reopen, cross-app round trip, conflict preservation, and `ARTIFACT-001` through `ARTIFACT-010`.

The market skill must specify complete-artifact `claimBearerAsset({ artifact })`, authenticated owner binding, current-native output, no caller owner/head/key, and no receipt authority.

The release skill must refuse completion without package/digest alignment, mutation/replay/compatibility tests, MCP conformance, independent verifier, and release lock.

- [ ] **Step 4: Rewrite MCP and rail documentation**

Document only current v108 artifact tools and bearer claim plan/execute tools. State explicitly that historical v107 MCP tools are not current outcomes and that MCP never verifies independently of the SDK enclosing-artifact flow.

- [ ] **Step 5: Run doctrine tests**

Run: `pnpm test -- --test-name-pattern "AI skills|release doctrine|MCP"`

Expected: PASS.

- [ ] **Step 6: Commit doctrine alignment**

```bash
git add ai-skills docs/MCP.md docs/RECEIZ_RAILS.md docs/release/v3.0.0.md docs/release/verification.md tests/wildz-ai-skills.test.ts tests/wildz-release-documentation.test.ts
git commit -m "docs: align Wildz doctrine with Receiz v108"
```

### Task 8: Close every v108 release gate

**Files:**
- Modify: `scripts/release-check.mjs`
- Modify: `docs/release/verification.md`
- Modify: `tests/release-scripts.test.ts`
- Modify: `tests/release-secret-scan.test.ts`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: one release command that refuses success unless v108 checker, MCP conformance, independent artifact evidence, compatibility corpus, tests, typecheck, lint, secret scan, and build pass.

- [ ] **Step 1: Write a failing release-gate contract test**

Require `scripts/release-check.mjs` to invoke these gates in order and propagate nonzero status:

```ts
const REQUIRED = [
  "receiz:check",
  "receiz:conformance",
  "test",
  "typecheck",
  "lint",
  "secret:scan",
  "build"
];
for (const command of REQUIRED) assert.match(releaseScript, new RegExp(command.replace(":", "\\:")));
assert.match(releaseScript, /receiz-v108-conformance-corpus/);
assert.match(releaseScript, /independent.*verify/i);
```

- [ ] **Step 2: Run the release-script tests and verify failure**

Run: `pnpm test -- --test-name-pattern "release script|release gate"`

Expected: FAIL until the script contains all v108 evidence gates.

- [ ] **Step 3: Update the release runner**

Add explicit stages for `pnpm receiz:check`, the corpus test, MCP conformance, and an independent saved-artifact verify/reopen fixture before existing full test, typecheck, lint, secret scan, and build stages. Preserve strict-live qualification as a separate credential-dependent gate and report it as pending when production credentials are absent.

- [ ] **Step 4: Run all local qualification gates**

Run: `pnpm receiz:check`

Run: `pnpm receiz:conformance`

Run: `pnpm test`

Run: `pnpm typecheck`

Run: `pnpm lint`

Run: `pnpm secret:scan`

Run: `pnpm build`

Expected: every command exits zero. If strict-live credentials are unavailable, record that exact external gate without converting it into a pass.

- [ ] **Step 5: Scan for forbidden active v107 authority**

Run: `rg -n "@receiz/sdk/v107|continuity\\.(reconcile|commit)|proofHead\\.get|claimantKeyId|expectedOwnershipHead|RECEIZ_V107|107\\.0\\.0" app src scripts tests ai-skills docs --glob '!docs/superpowers/**'`

Expected: no active matches. Any historical documentation match must be clearly labeled retired and must not appear in application, scripts, tests, or local skill instructions.

- [ ] **Step 6: Update the verification record with exact evidence**

Record SDK version, registry digest, artifact-law coverage, carrier, Signature version, artifact digest, payload digest, owner/claim binding, independent verification, cross-platform round trip, historical compatibility, MCP conformance, release-lock status, and any remaining strict-live external gate in `docs/release/verification.md`.

- [ ] **Step 7: Commit release qualification**

```bash
git add scripts/release-check.mjs docs/release/verification.md tests/release-scripts.test.ts tests/release-secret-scan.test.ts
git commit -m "test: enforce Receiz v108 release evidence"
```

- [ ] **Step 8: Inspect the final worktree**

Run: `git status --short`

Expected: clean worktree.

Run: `git log -8 --oneline`

Expected: the v108 task commits appear in order, ending with the release-evidence commit.

