# Wildz V3 Identity Authority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish secure automatic Receiz identity, source-compatible Identity Seal PNG login/export, content-aware legacy artifact inspection, and authenticated Receiz sessions before V3 player continuity is introduced.

**Architecture:** Store private identity authority behind a protected IndexedDB repository and expose only a public `WildzIdentitySession` to React. The artifact codec reads bytes once and delegates proof decisions to the installed Receiz SDK and existing card/Vault verifiers. Source-compatible PKCE/OIDC routes establish remote cookie authority without confusing operator tokens with a signed-in player.

**Tech Stack:** TypeScript 5.6, Web Crypto, IndexedDB, `@receiz/sdk` 100.0.0, Next.js 15 route handlers, React 19, Node test runner.

## Global Constraints

- Execute after the production program freezes and commits the accepted current UI baseline.
- Work on `main`, commit each task, and do not push.
- Use `@receiz/sdk` for identity creation, artifact parsing, account projection, login proof, and Identity Seal trailer operations.
- Plaintext key files and raw private key material are forbidden in `localStorage`, logs, analytics, errors, public projections, prompts, screenshots, and MCP output.
- A delegated server token is operator authority and must never appear as a signed-in player session.
- Normalize one actor ID everywhere: normalized username without leading `@`, with normalized owner UID only as fallback.
- Preserve the Safari-safe bound browser fetch implementation.
- This plan handles Identity Seals and current legacy card/Vault formats. The kernel-continuity plan extends the same codec with V3 player payload and combined identity binding after V3 modules exist.

---

## File Structure

- `src/lib/storage/wildz-indexed-db.ts` — small IndexedDB transaction abstraction.
- `src/lib/receiz/wildz-identity-repository.ts` — encrypted identity persistence and active-session projection.
- `src/lib/receiz/wildz-identity-seal.ts` — source-compatible 900 by 900 Seal PNG renderer/trailer.
- `src/lib/receiz/wildz-artifact-codec.ts` — content-aware SDK/card/Vault inspection without mutation.
- `src/lib/receiz/wildz-auth-url.ts` — safe same-origin return paths.
- `src/lib/receiz/wildz-session-bridge.ts` — remote session state and local-identity continuation.
- `src/features/identity/use-wildz-identity.ts` — React identity bootstrap/switch interface.
- `app/api/auth/receiz/**` — PKCE start, callback, cross-origin completion, and current-session projection.

---

### Task 1: Protect Identity Authority in IndexedDB

**Files:**
- Create: `src/lib/storage/wildz-indexed-db.ts`
- Create: `src/lib/receiz/wildz-identity-repository.ts`
- Modify: `src/features/identity/wildz-identity.ts`
- Create: `tests/support/memory-wildz-continuity-database.ts`
- Create: `tests/wildz-identity-repository.test.ts`

**Interfaces:**
- Consumes: `ReceizKeyFile`, `ReceizIdentityAccountProjection`, `createReceizIdIdentity`, and Web Crypto.
- Produces: `canonicalWildzActorId`, `wildzOwnerScope`, `WildzIdentitySession`, `WildzContinuityDatabase`, and `WildzIdentityRepository`.

- [ ] **Step 1: Write failing identity-repository tests**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { createReceizIdIdentity, projectReceizIdentityAccount } from "@receiz/sdk";
import { canonicalWildzActorId, createWildzIdentityRepository } from "../src/lib/receiz/wildz-identity-repository";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";

test("actor ID prefers normalized username and falls back to UID", async () => {
  const identity = await createReceizIdIdentity({ username: "@Fern.Path", displayName: "Fern" });
  const projection = await projectReceizIdentityAccount(identity.keyFile);
  assert.equal(canonicalWildzActorId(projection), "fern.path");
  assert.equal(canonicalWildzActorId({ ...identity.keyFile, owner: { ...identity.keyFile.owner, username: null, uid: " Receiz:UID_7 " } }), "receiz:uid_7");
});

test("protected persistence contains no serialized private authority", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const session = await repository.bootstrap();
  const dump = JSON.stringify(database.dump());
  assert.equal(session.localAuthority, "verified");
  assert.doesNotMatch(dump, /privateKeyPkcs8B64u|privateKeyPkcs8CiphertextB64u|receiz\.key\.v1/);
  assert.equal(database.wrappingKey().extractable, false);
});
```

Add a legacy-storage test that injects a failed database transaction and asserts the `wildz:receiz-identity:v1` value and prior active pointer are unchanged.

- [ ] **Step 2: Run the test and confirm the missing module failure**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
```

Expected: TypeScript reports `TS2307` for `wildz-identity-repository` and the memory database.

- [ ] **Step 3: Implement the database and repository contracts**

```ts
export type WildzStoreName = "wrappingKeys" | "identities" | "ownerStates" | "meta";

export interface WildzContinuityTransaction {
  get<T>(store: WildzStoreName, key: IDBValidKey): Promise<T | null>;
  put<T>(store: WildzStoreName, value: T, key?: IDBValidKey): Promise<void>;
  delete(store: WildzStoreName, key: IDBValidKey): Promise<void>;
}

export interface WildzContinuityDatabase {
  read<T>(store: WildzStoreName, key: IDBValidKey): Promise<T | null>;
  transaction<T>(stores: readonly WildzStoreName[], mode: IDBTransactionMode, operation: (tx: WildzContinuityTransaction) => Promise<T>): Promise<T>;
}

export type WildzIdentitySession = {
  schema: "receiz.wildz.identity_session.v1";
  keyId: string;
  actorId: string;
  username: string | null;
  displayName: string | null;
  portableStateStatus: "verified" | "missing" | "invalid";
  localAuthority: "verified";
  remoteStatus: "unknown" | "connected" | "pending" | "offline" | "unavailable";
};

export interface WildzIdentityRepository {
  bootstrap(legacyStorage?: Pick<Storage, "getItem" | "removeItem">): Promise<WildzIdentitySession>;
  active(): Promise<WildzIdentitySession | null>;
  prepare(keyFile: ReceizKeyFile): Promise<PreparedWildzIdentity>;
  writePrepared(tx: WildzContinuityTransaction, prepared: PreparedWildzIdentity, activate: boolean): Promise<void>;
  withKeyFile<T>(keyId: string, operation: (keyFile: ReceizKeyFile) => Promise<T>): Promise<T>;
  logout(): Promise<void>;
}
```

Generate one non-extractable AES-GCM 256-bit wrapping key and store it by IndexedDB structured clone. Encrypt serialized key bytes before opening an IndexedDB write transaction; persist only IV plus ciphertext. Persist and verify a legacy migration marker before deleting the old localStorage record. `canonicalWildzActorId` trims, removes leading `@`, lowercases, validates the username, and uses the same normalized UID fallback for a projection or key file. `wildzOwnerScope(keyId, actorId)` returns `wildz:${encodeURIComponent(keyId)}:${encodeURIComponent(actorId)}`.

- [ ] **Step 4: Run focused and existing identity tests**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-identity-repository.test.js .test-build/tests/wildz-identity.test.js
pnpm typecheck
pnpm lint
```

Expected: all listed tests pass; no plaintext key-file content appears in the memory database dump.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/wildz-indexed-db.ts src/lib/receiz/wildz-identity-repository.ts src/features/identity/wildz-identity.ts tests/support/memory-wildz-continuity-database.ts tests/wildz-identity-repository.test.ts
git commit -m "feat: protect Wildz identity authority in IndexedDB"
```

---

### Task 2: Export and Restore Source-Compatible Identity Seal PNGs

**Files:**
- Create: `src/lib/receiz/wildz-identity-seal.ts`
- Modify: `src/lib/receiz/wildz-identity-adapter.ts`
- Create: `tests/wildz-identity-seal.test.ts`

**Interfaces:**
- Consumes: `WildzIdentityRepository`, `appendReceizIdentityArtifactTrailerToPng`, and `readReceizIdentityArtifact`.
- Produces: `createWildzIdentitySealPng`, `appendWildzIdentitySealAuthority`, and repository-based `downloadWildzIdentitySeal`.

- [ ] **Step 1: Write a failing SDK round-trip test**

```ts
test("Identity Seal PNG round-trips through the official SDK", async () => {
  const identity = await createReceizIdIdentity({ username: "seal.test", displayName: "Seal Test" });
  const session = sessionFromIdentity(identity);
  const png = await createWildzIdentitySealPng(identity.keyFile, session);
  const restored = await readReceizIdentityArtifact(png);
  const projection = await projectReceizIdentityAccount(restored);
  assert.deepEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(restored.keyId, identity.keyFile.keyId);
  assert.notEqual(projection.portableStateStatus, "invalid");
});
```

Define `sessionFromIdentity` in this test as a local helper that projects the key file and returns the exact `WildzIdentitySession` fields; do not expose the key file in the result.

- [ ] **Step 2: Run the test and verify the missing renderer failure**

Run the focused compile sequence.

Expected: `TS2307` for `wildz-identity-seal`.

- [ ] **Step 3: Implement the official PNG trailer path**

```ts
export function appendWildzIdentitySealAuthority(pngBytes: Uint8Array, keyFile: ReceizKeyFile) {
  return appendReceizIdentityArtifactTrailerToPng(pngBytes, keyFile);
}

export async function createWildzIdentitySealPng(keyFile: ReceizKeyFile, session: WildzIdentitySession) {
  const artwork = await renderWildzIdentitySealArtwork({ keyId: session.keyId, username: session.username, displayName: session.displayName });
  return appendWildzIdentitySealAuthority(artwork, keyFile);
}
```

Port the upstream 900 by 900 visible Identity Seal renderer without commerce copy. Replace the current JSON download with a repository `withKeyFile` call, download MIME `image/png`, and filename `<username>.receiz-identity-seal.png`. The public renderer receives only the session projection.

- [ ] **Step 4: Run Seal and restore tests**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-identity-seal.test.js .test-build/tests/wildz-restore.test.js
pnpm typecheck
pnpm lint
```

Expected: SDK round-trip passes; the old `.json` filename is absent.

- [ ] **Step 5: Commit**

```bash
git add src/lib/receiz/wildz-identity-seal.ts src/lib/receiz/wildz-identity-adapter.ts tests/wildz-identity-seal.test.ts
git commit -m "feat: export source-compatible Wildz identity seals"
```

---

### Task 3: Restore the Receiz OIDC and Session Bridge

**Files:**
- Create: `src/lib/receiz/wildz-auth-url.ts`
- Create: `src/lib/receiz/wildz-session-bridge.ts`
- Create: `app/api/auth/receiz/start/route.ts`
- Create: `app/api/auth/receiz/callback/route.ts`
- Create: `app/api/auth/receiz/complete/route.ts`
- Create: `app/api/auth/receiz/me/route.ts`
- Modify: `src/lib/receiz/oauth-scopes.ts`
- Modify: `src/lib/receiz/session.ts`
- Create: `tests/wildz-auth-session.test.ts`

**Interfaces:**
- Consumes: current OAuth state helpers, Receiz authorization/token APIs, and cookie session parsing.
- Produces: `normalizeWildzReturnTo`, `WILDZ_RECEIZ_SESSION_SCOPE`, four source-compatible routes, and `WildzRemoteSessionBridge`.

- [ ] **Step 1: Write failing return-path, cookie, and session tests**

```ts
test("return paths stay on the Wildz origin", () => {
  assert.equal(normalizeWildzReturnTo("/u/fern"), "/u/fern");
  assert.equal(normalizeWildzReturnTo("//evil.example/path"), "/");
  assert.equal(normalizeWildzReturnTo("https://evil.example"), "/");
});

test("delegated operator token is not a signed-in player", () => {
  const session = receizRequestSession(requestWith({ delegatedToken: "operator", cookies: {} }));
  assert.equal(session.cookieAccessToken, undefined);
  assert.equal(playerReceizAccessToken(session), undefined);
});
```

In the test file, implement `requestWith` as a `NextRequest` factory using `http://wildz.quest/api/auth/receiz/me` and injected cookie/environment inputs. Add PKCE state round-trip, signature tamper, flow nonce, completion-ticket age, no-token `/me`, and response-body-no-token assertions.

- [ ] **Step 2: Run the focused test and confirm missing routes/helpers**

Expected: compile fails for `wildz-auth-url` and route source assertions fail because routes do not exist.

- [ ] **Step 3: Adapt the source PKCE/session routes to Wildz**

```ts
export const WILDZ_RECEIZ_SESSION_SCOPE = "wildz.quest:v1";

export function normalizeWildzReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const parsed = new URL(value, "https://wildz.quest");
    return parsed.origin === "https://wildz.quest" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : "/";
  } catch {
    return "/";
  }
}
```

Adapt the audited upstream start/callback/complete/me flow to the root app and fixed Wildz session scope. Preserve PKCE S256, signed state, nonce binding, 10-minute state, 2-minute completion ticket, `HttpOnly`, `SameSite=Lax`, HTTPS `Secure`, access-cookie path `/`, and refresh-cookie path `/api/auth/receiz`. `/me` returns only connected status and safe profile projection. `WildzRemoteSessionBridge.continueLocalIdentity` uses the SDK continuation/login-proof path and never stores its passphrase.

- [ ] **Step 4: Run auth/session tests and type checks**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-auth-session.test.js
pnpm typecheck
pnpm lint
```

Expected: all PKCE, ticket, cookie, scope, and no-token projection tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/receiz/wildz-auth-url.ts src/lib/receiz/wildz-session-bridge.ts src/lib/receiz/oauth-scopes.ts src/lib/receiz/session.ts app/api/auth/receiz tests/wildz-auth-session.test.ts
git commit -m "feat: restore authenticated Receiz session routes"
```

---

### Task 4: Classify Identity Seals and Legacy Vaults by Verified Content

**Files:**
- Create: `src/lib/receiz/wildz-png-envelope.ts`
- Create: `src/lib/receiz/wildz-artifact-codec.ts`
- Modify: `src/lib/receiz/wildz-identity-adapter.ts`
- Modify: `src/lib/receiz/receiz-commerce-vault.ts`
- Modify: `src/features/identity/wildz-restore.ts`
- Create: `tests/wildz-artifact-codec.test.ts`

**Interfaces:**
- Consumes: full upload bytes, SDK identity reader/projector, V1/V2 card/Vault verification, and Commerce Vault inspection.
- Produces: base `WildzArtifactInspection`, `splitWildzPngEnvelope`, and `inspectWildzArtifact` for the pre-V3 formats.

- [ ] **Step 1: Write failing content-classification tests**

```ts
test("action labels do not override artifact bytes", async () => {
  const seal = await generatedIdentitySealFixture();
  const inspected = await inspectWildzArtifact({ bytes: seal, mimeType: "image/png", name: "called-a-vault.png" });
  assert.equal(inspected.kind, "identity-seal");
});

test("legacy card Vault does not claim identity authority", async () => {
  const inspected = await inspectWildzArtifact({ bytes: legacyV2VaultFixture(), mimeType: "image/png" });
  assert.equal(inspected.kind, "card-vault");
  assert.equal("identity" in inspected, false);
});
```

Implement `generatedIdentitySealFixture` with Task 2's exporter and `legacyV2VaultFixture` with the current `embedPortableVaultInPng`. Add invalid portable-state, PNG signature, 64 MiB maximum, card tamper, unsupported binary, and Commerce display-projection isolation cases.

- [ ] **Step 2: Run tests and verify the codec is missing**

Expected: compile fails for `wildz-artifact-codec`.

- [ ] **Step 3: Implement byte-once verified classification**

```ts
export type WildzArtifactInspection =
  | { kind: "identity-seal"; identity: VerifiedWildzIdentity }
  | { kind: "card-vault"; assets: PortableCardAsset[]; vaultDigest: string }
  | { kind: "commerce-vault"; identity: VerifiedWildzIdentity | null; projection: ReceizCommerceVaultProjection }
  | { kind: "unsupported"; code: "wildz_artifact_unsupported" }
  | { kind: "invalid"; code: WildzRestoreErrorCode; errors: string[] };

export function splitWildzPngEnvelope(bytes: Uint8Array): { pngBasis: Uint8Array; trailer: Uint8Array };

export async function inspectWildzArtifact(input: { bytes: Uint8Array; mimeType: string; name?: string }): Promise<WildzArtifactInspection>;
```

Locate and validate the PNG `IEND` chunk. Pass full bytes to `readReceizIdentityArtifact`; pass `pngBasis` through and including `IEND` to current card/Vault readers because their parser rejects trailing SDK bytes. Treat a present portable state with status `invalid` as invalid. A Commerce projection can supply display/portable domains but supplies identity only when the SDK reader independently verifies an identity trailer.

- [ ] **Step 4: Run artifact and restore tests**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-artifact-codec.test.js .test-build/tests/wildz-restore.test.js
pnpm typecheck
pnpm lint
```

Expected: classification and bounds pass; no filename or selected action determines authority.

- [ ] **Step 5: Commit**

```bash
git add src/lib/receiz/wildz-png-envelope.ts src/lib/receiz/wildz-artifact-codec.ts src/lib/receiz/wildz-identity-adapter.ts src/lib/receiz/receiz-commerce-vault.ts src/features/identity/wildz-restore.ts tests/wildz-artifact-codec.test.ts
git commit -m "feat: classify Wildz artifacts from verified contents"
```

---

### Task 5: Integrate Secure Identity Bootstrap and Seal Login

**Files:**
- Create: `src/features/identity/use-wildz-identity.ts`
- Modify: `src/features/identity/WildzGenesis.tsx`
- Modify: `src/features/shell/WildzApp.tsx`
- Modify: `src/lib/receiz/adapter.ts`
- Modify: `tests/wildz-continuity-and-shell.test.ts`
- Create: `tests/wildz-identity-integration.test.ts`

**Interfaces:**
- Consumes: identity repository, base artifact codec, remote session bridge, and existing Genesis callbacks.
- Produces: automatic identity bootstrap, source-compatible Seal login/switch, public session-only React props, and remote-session status.

- [ ] **Step 1: Write failing integration/source-boundary tests**

```ts
test("React identity surfaces never receive a key file", () => {
  for (const file of ["src/features/identity/WildzGenesis.tsx", "src/features/shell/WildzApp.tsx"]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /ReceizDeviceIdentity|ReceizKeyFile|\.keyFile/);
  }
});

test("Safari-safe SDK fetch stays explicitly bound", () => {
  const source = readFileSync("src/lib/receiz/adapter.ts", "utf8");
  assert.match(source, /fetchImpl:\s*\(input, init\)\s*=>\s*window\.fetch\(input, init\)/);
});
```

Add a repository-reopen test that imports a generated Seal, activates it, discards all repository/session objects, reopens the same memory database, and recovers the same `keyId` and `actorId` without using legacy localStorage.

- [ ] **Step 2: Run tests and verify old key-file React state fails**

Expected: source-boundary test fails because current `WildzApp` stores a complete `ReceizDeviceIdentity` and current Genesis expects it.

- [ ] **Step 3: Implement the public-session hook and atomic identity switch**

```ts
export type UseWildzIdentityResult = {
  status: "loading" | "ready" | "error";
  session: WildzIdentitySession | null;
  remote: WildzRemoteSession;
  inspect(file: File): Promise<WildzArtifactInspection>;
  activateSeal(inspection: Extract<WildzArtifactInspection, { kind: "identity-seal" }>): Promise<WildzIdentitySession>;
  exportSeal(): Promise<void>;
  logout(): Promise<void>;
};
```

`activateSeal` calls `repository.prepare`, encrypts before opening the database transaction, writes the identity and active pointer together, then updates React. Failed verification or persistence leaves the prior session untouched. Genesis visibly shows the restored handle/display name before character selection. Legacy card Vault import remains a gameplay-card action and does not change identity. Keep remote connected/pending/offline status distinct from local verified authority.

- [ ] **Step 4: Run the complete identity slice**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: all commands pass; no plaintext identity is written to localStorage; Seal PNG login survives a repository reopen; remote routes compile.

- [ ] **Step 5: Commit**

```bash
git add src/features/identity/use-wildz-identity.ts src/features/identity/WildzGenesis.tsx src/features/shell/WildzApp.tsx src/lib/receiz/adapter.ts tests/wildz-continuity-and-shell.test.ts tests/wildz-identity-integration.test.ts
git commit -m "feat: wire secure Wildz identity login end to end"
```

## Plan Completion Gate

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm secret:scan
git status --short
```

Expected: every command exits 0; the worktree is clean; automatic identity, Identity Seal PNG round-trip, protected relaunch, PKCE/session routes, content-aware legacy inspection, and Safari-safe SDK fetch are covered. Combined identity-bearing V3 Vault continuity remains deliberately assigned to the next plan because its player payload does not exist until the V3 kernel lands.
