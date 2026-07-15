# Wildz V3 Kernel and Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the complete tagged Wilds V3 domain kernel, migrate to owner-scoped V8 state, bind Receiz identity to full player Vault continuity, and expose a deterministic canonical living-world API beneath the accepted standalone UI.

**Architecture:** Phase A ports only the stable history/type contracts required by tagged V8 state, then builds player-Vault continuity, a signed combined-Vault envelope, and one atomic owner-state transaction. The program pauses for the public profile/economy plan after that checkpoint. Phase B then ports the complete pure V3 domain kernel and migrates world event/state/service, standalone Receiz persistence, snapshot route, and client hook as one tested contract.

**Tech Stack:** TypeScript 5.6, `@receiz/sdk` 100.0.0, Next.js 15 route handlers, Node test runner, Receiz public-store/audit rails, IndexedDB/Web Crypto interfaces from Plan 1.

## Global Constraints

- Complete `2026-07-15-wildz-v3-identity-authority.md` first.
- Work on `main`, use path-specific staging, commit each task, and do not push.
- Feature source is `/tmp/receiz-commerce-history`, tag `v3.0.0`, commit `1cf84c0154b8cba45b0c0730dc0752235f758be8`.
- Inspect source with `git show`; apply edits with `apply_patch`. Exact pure ports must match the listed upstream blob IDs.
- Do not overwrite `PlayCampaign.tsx`, `WildsCommandDock.tsx`, `WildsWorldCanvas.tsx`, or `app/globals.css` wholesale.
- Keep the local readable `wilds-competition.ts` and its passing test unless behavior differs.
- V3 player state is independently verifiable gameplay continuity; Receiz identity remains independently verified SDK authority.
- Use `canonicalWildzActorId` for `playerId`, capture owner, binding, persistence scope, reconciliation, session, and profile projection.
- Combined-Vault verification sends full bytes to the SDK identity reader and only PNG bytes through `IEND` to the V3 parser.
- Canonical world commands that contribute value require a verified actor-owned card, not a digest-shaped client string.
- The snapshot server, route, and client hook land in one commit with exactly one `{ projection, mode }` layer.
- No new npm dependency is required.
- Complete Phase A Tasks 1–4, then execute `2026-07-15-wildz-v3-public-economy.md`, then return for Phase B Tasks 5–13. Do not cross the inter-plan gate early.

## File Structure

- `src/features/play/wilds-v3-contracts.ts` — stable family/role types shared by V8 history and later V3 algorithms.
- `src/features/play/game-state.ts` — final V8 serialization, migration, verified inventory, leader, and two support IDs.
- `src/features/play/wilds-player-vault.ts` — independently verified player payload and canonical-cursor reconciliation.
- `src/lib/receiz/wildz-identity-binding.ts` — SDK-signed evidence joining identity authority to the player Vault digests.
- `src/lib/receiz/wildz-vault-export.ts` — source-compatible combined PNG composition in the required trailer order.
- `src/lib/receiz/wildz-continuity-coordinator.ts` — staged owner checks and one atomic identity/player restore transaction.
- `src/features/play/wilds-{settlements,ecology,boss-ecology,raid-*,social-core,card-mastery,crafting,lineage-utility,narrative-memory}.ts` — pure tagged V3 behavior, adapted only at documented standalone seams.
- `src/features/play/wilds-world-{event,state,record,service}.ts` — deterministic canonical world event, replay, projection, and command boundary.
- `src/lib/receiz/wilds-world-repository.ts` and `src/lib/receiz/wilds-world-server.ts` — Receiz-backed canonical persistence with explicit local-practice fallback.
- `app/api/wilds/world/snapshot/route.ts` and `src/features/play/use-wilds-world.ts` — one atomic `{ projection, mode }` server/client contract.

## Common Focused Test Loop

Each task uses this compile/run sequence after writing its failing tests and again after implementation:

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
```

After these three preparation commands, run the exact `node --test` paths listed in that task. The red run must fail for the missing export/module or named assertion. The green run must report zero failures before the task commit.

---

## Phase A — V8 and Identity-Bound Continuity

### Task 1: Migrate to Save V8 and the V3 Player Vault

**Files:**
- Create: `src/features/play/wilds-v3-contracts.ts`
- Create: `src/features/play/wilds-civic-history.ts`
- Create: `src/features/play/wilds-ecology-history.ts`
- Create: `src/features/play/wilds-raid-history.ts`
- Create: `src/features/play/wilds-player-vault.ts`
- Modify: `src/features/play/game-state.ts`
- Modify: `src/features/play/card-export.ts`
- Modify: `tests/play-game-state.test.ts`
- Create: `tests/wilds-v3-contracts.test.ts`
- Create: `tests/wilds-civic-history.test.ts`
- Create: `tests/wilds-ecology-history.test.ts`
- Create: `tests/wilds-raid-history.test.ts`
- Create: `tests/wilds-player-vault.test.ts`

**Interfaces:**
- Produces: one shared set of tagged ecology-family, boss-family, and raid-role constants; civic/ecology/raid history projections; final V8 serialization/migration with `WildsSupportAssetIds`; `createWildsPlayerVault`; `verifyWildsPlayerVault`; `reconcileWildsPlayerVault`; and V3 PNG proof with `{ assets, player, vaultDigest }` verification.

- [ ] **Step 1: Port V8/player-Vault tests first**

```ts
assert.equal(JSON.parse(serializePlayState(progressed)).schema, "receiz.wilds.save.v8");
const restored = restorePlayState(JSON.stringify({ schema: "receiz.wilds.save.v5", state: legacyState }));
assert.deepEqual(restored.civicEvents, []);
assert.deepEqual(restored.supportAssetIds, [null, null]);
assert.throws(() => reconcileWildsPlayerVault({ local: initialPlayState, restored: vault, canonical, actorId: "player:other" }), /wilds_player_vault_owner_invalid/);
const verified = verifyPortableVaultPng(embedPortableVaultInPng(sourcePng, initialPlayState.inventory, vault));
assert.equal(verified.player?.payloadDigest, vault.payloadDigest);
```

Use the tagged fixtures for `progressed`, `legacyState`, `vault`, `canonical`, and `sourcePng`. In `wilds-v3-contracts.test.ts`, assert these exact stable contracts before any feature algorithms are ported:

```ts
assert.deepEqual(WILDS_ECOLOGY_FAMILIES, ["wandering-market", "echo-ruin", "unstable-portal", "convergence-festival", "creature-migration", "resource-bloom", "stormfront", "settlement-distress"]);
assert.deepEqual(WILDS_BOSS_FAMILIES, ["crystal-burrower", "skycoil-tempest", "mirecrown-colossus", "embermane-siegebeast", "tidal-prism-leviathan", "echo-antler-warden", "lumen-moth-sovereign", "voidroot-devourer"]);
assert.deepEqual(WILDS_RAID_CARD_ROLES, ["vanguard", "striker", "warden", "resonator", "wayfinder", "steward"]);
```

Port the tagged civic-history tests here because civic receipts are part of V8 continuity; settlement behavior remains deferred to Phase B.

Add the standalone final-continuity field now so later Trail Pack work does not silently change the meaning of an already-shipped V8 envelope:

```ts
export type WildsSupportAssetIds = readonly [string | null, string | null];
export const EMPTY_WILDS_SUPPORT_ASSET_IDS: WildsSupportAssetIds = [null, null];
```

Add `supportAssetIds: WildsSupportAssetIds` to the existing `PlayState` declaration and initialize it from `EMPTY_WILDS_SUPPORT_ASSET_IDS`; do not create a second owner-state field.

- [ ] **Step 2: Run red compile/assertions**

Expected: missing contract/history/player modules and current serializer emits V5.

- [ ] **Step 3: Port the V3 continuity behavior and stable contracts**

```text
wilds-civic-history.ts   969f20994fac1a4898f421242d3bc503f37852a8
wilds-ecology-history.ts 1a1e564f5254703089ea4e1bd5c15031bbf79d57
wilds-raid-history.ts    321c266027d2d853ae48dca6b3ff85a8921f053c
wilds-player-vault.ts    de29a0face0f6dad68803fb2af449c307a9f7b1d
game-state.ts            c7a744a75a27cc3f903b7db2f543f0b27f7ad552
card-export.ts           ca306bac9d7af434b837fdfc38e627f3ad504b6b
```

Create `wilds-v3-contracts.ts` from only the three tagged constant/type sets shown in Step 1. The later ecology, boss, and raid-role modules import and re-export those values; they never define a second copy. Adapt the tagged history and `game-state.ts` imports to this contract file until Phase B lands the algorithms. Merge V8/card-export behavior into local files, preserving the current standalone card URL and Safari publication corrections. Accept save schemas V2–V7, normalize absent support slots to `[null, null]`, reject non-string/duplicate/leader-equal support references when inventory is known, and serialize the tuple inside V8/player Vault continuity. Keep the player Vault independent from identity authority.

- [ ] **Step 4: Run continuity tests**

```bash
node --test .test-build/tests/wilds-v3-contracts.test.js .test-build/tests/wilds-civic-history.test.js .test-build/tests/play-game-state.test.js .test-build/tests/wilds-ecology-history.test.js .test-build/tests/wilds-raid-history.test.js .test-build/tests/wilds-player-vault.test.js
```

Expected: all migrations, digest, owner, bounds, duplicate, and cursor-warning tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/play/wilds-v3-contracts.ts src/features/play/wilds-civic-history.ts src/features/play/wilds-ecology-history.ts src/features/play/wilds-raid-history.ts src/features/play/wilds-player-vault.ts src/features/play/game-state.ts src/features/play/card-export.ts tests/play-game-state.test.ts tests/wilds-v3-contracts.test.ts tests/wilds-civic-history.test.ts tests/wilds-ecology-history.test.ts tests/wilds-raid-history.test.ts tests/wilds-player-vault.test.ts
git commit -m "feat: add Wilds V8 portable continuity"
```

---

### Task 2: Bind Receiz Identity to the V3 Player Vault

**Files:**
- Modify: `src/lib/receiz/wildz-png-envelope.ts`
- Create: `src/lib/receiz/wildz-identity-binding.ts`
- Create: `src/lib/receiz/wildz-vault-export.ts`
- Modify: `src/features/play/card-export.ts`
- Create: `tests/wildz-identity-binding.test.ts`
- Modify: `tests/wilds-player-vault.test.ts`

**Interfaces:**
- Consumes: Plan 1 identity repository/Seal trailer, V3 player Vault, SDK login-proof signing, and `splitWildzPngEnvelope`.
- Produces: `WildzIdentityBinding`, canonical binding challenge, create/verify binding, and combined PNG export.

- [ ] **Step 1: Write failing splice/tamper/passphrase tests**

```ts
const exported = await exportWildzIdentityPlayerVault({ keyFile: identity.keyFile, player, assets, artworkPng, passphrase });
const envelope = splitWildzPngEnvelope(exported);
assert.equal(verifyPortableVaultPng(envelope.pngBasis).player?.payloadDigest, player.payloadDigest);
assert.equal((await readReceizIdentityArtifact(exported)).keyId, identity.keyFile.keyId);
assert.equal(await verifyWildzIdentityBindingFromEnvelope(exported), true);
assert.equal(await verifyWildzIdentityBindingFromEnvelope(spliceIdentity(exported, otherIdentity.keyFile)), false);
```

Define `artworkPng`, `spliceIdentity`, and passphrase identities with ephemeral SDK fixtures in this test file. Use six distinct verified cards for `assets`. Add changed player ID, player digest, Vault digest, absent binding, duplicate binding, missing-card, and conflicting-duplicate-card cases. The two official-reader assertions prove the Wildz export remains readable by both the SDK identity reader and tagged V3 Vault reader; Task 3 proves the complete round-trip through the unified importer.

- [ ] **Step 2: Run red compile**

Expected: binding/export APIs are missing.

- [ ] **Step 3: Implement the signed evidence envelope**

```ts
export type WildzIdentityBinding = {
  schema: "receiz.wildz_identity_binding.v1";
  keyId: string;
  playerId: string;
  vaultDigest: string;
  playerPayloadDigest: string;
  signedAt: string;
  challengeB64Url: string;
  signatureB64Url: string;
  alg: ReceizIdentityKeyAlgorithm;
};

export function canonicalWildzIdentityBindingChallenge(input: Pick<WildzIdentityBinding, "keyId" | "playerId" | "vaultDigest" | "playerPayloadDigest">) {
  return canonicalPortableCardJson({ schema: "receiz.wildz_identity_binding_challenge.v1", ...input });
}
```

Export order is V3 chunk before `IEND`, optional document seal, reverify sealed V3 basis, append official SDK identity trailer, then append one Wildz binding trailer. SDK signing uses the canonical challenge and optional per-operation passphrase. Verification decodes and recomputes the challenge, verifies the SDK signature, and requires key ID, `canonicalWildzActorId`, V3 `playerId`, Vault digest, and player digest to agree.

- [ ] **Step 4: Run binding and player-Vault tests**

```bash
node --test .test-build/tests/wildz-identity-binding.test.js .test-build/tests/wilds-player-vault.test.js
pnpm typecheck
pnpm lint
```

Expected: valid protected/unprotected exports pass; every splice/tamper/duplicate fails.

- [ ] **Step 5: Commit**

```bash
git add src/lib/receiz/wildz-png-envelope.ts src/lib/receiz/wildz-identity-binding.ts src/lib/receiz/wildz-vault-export.ts src/features/play/card-export.ts tests/wildz-identity-binding.test.ts tests/wilds-player-vault.test.ts
git commit -m "feat: bind Receiz identity to Wildz V3 vaults"
```

---

### Task 3: Add Owner-Scoped State and Atomic Restore

**Files:**
- Create: `src/features/play/wilds-owner-state.ts`
- Create: `src/lib/receiz/wildz-player-state-repository.ts`
- Modify: `src/lib/receiz/wildz-artifact-codec.ts`
- Modify: `src/features/identity/wildz-restore.ts`
- Create: `src/lib/receiz/wildz-continuity-coordinator.ts`
- Create: `tests/wildz-player-state-repository.test.ts`
- Create: `tests/wildz-continuity-coordinator.test.ts`
- Modify: `tests/wildz-artifact-codec.test.ts`

**Interfaces:**
- Produces: V3 artifact classifications, `WildzOwnerState`, `WildzPlayerStateRepository`, and atomic `WildzContinuityCoordinator`.

- [ ] **Step 1: Write failing classification/transaction tests**

```ts
const inspected = await artifactCodec.inspect({ bytes: combinedVault, mimeType: "image/png" });
assert.equal(inspected.kind, "identity-player-vault");
assert.equal(inspected.identity.session.username, embeddedIdentityProjection.owner.username);
assert.deepEqual(inspected.assets.map((asset) => asset.id).sort(), expectedUniqueVaultAssetIds);
const before = database.dump();
await assert.rejects(() => coordinator.restore({ artifact: ownerMismatch, active, canonical, activation }), /owner/);
assert.deepEqual(database.dump(), before);
```

Construct `artifactCodec` with the memory identity repository. In the test, derive `embeddedIdentityProjection` with the SDK projector and derive `expectedUniqueVaultAssetIds` from the verifier-returned Vault assets after requiring duplicate IDs to have byte-identical canonical card proofs. A repeated identical asset may deduplicate once; two different proofs with the same ID are invalid. Add Identity Seal, valid combined Vault, identity-bearing Receiz Commerce Vault without a player payload, matching player-only Vault, foreign player, binding failure, explicit legacy-card confirmation, transaction failure, activation-preparation failure, stale/ahead cursor, remote outage, and a previously active different username. For the Commerce regression fixture, require the uploaded Vault to activate its SDK-projected embedded username and merge the exact sorted unique set from `inspection.assets`, even when another username was active. Reopen the repository after each successful identity-bearing restore and assert the exact embedded username, actor, V8 state, settings, events, receipts, cursor, and sorted complete card-ID set.

- [ ] **Step 2: Run red compile**

Expected: owner-state/coordinator modules and V3 inspection variants are missing.

- [ ] **Step 3: Implement the owner state and atomic coordinator**

```ts
export type WildzV3ArtifactInspection =
  | { kind: "identity-player-vault"; identity: VerifiedWildzIdentity; assets: PortableCardAsset[]; player: WildsPlayerVaultPayload; binding: WildzIdentityBinding }
  | { kind: "player-vault"; assets: PortableCardAsset[]; player: WildsPlayerVaultPayload; vaultDigest: string };

export type WildzOwnerState = {
  schema: "receiz.wildz.owner_state.v1";
  keyId: string;
  actorId: string;
  playState: PlayState;
  character: WildzCharacterGenesis | null;
  settings: { avatarStyle: "female" | "male" | null; movementMode: "walk" | "run"; audio: Record<string, boolean | number>; cardOrder: "rarity" | "newest" | "oldest" };
  personalEvents: WildsPlayerVaultPayload["personalEvents"];
  canonicalCursor: WildsPlayerVaultPayload["canonicalCursor"];
  receipts: WildsPlayerVaultPayload["receipts"];
  updatedAt: string;
};

export interface WildzPlayerStateRepository {
  load(scope: WildzOwnerScope): Promise<WildzOwnerState | null>;
  save(state: WildzOwnerState): Promise<void>;
  writePrepared(tx: WildzContinuityTransaction, state: WildzOwnerState): Promise<void>;
}

export type CommittedWildzRestoreOutcome = {
  restoreStatus: "committed";
  artifactKind: Exclude<WildzArtifactInspection["kind"], "invalid" | "unsupported">;
  session: WildzIdentitySession;
  ownerState: WildzOwnerState;
  verifiedAssetIds: string[];
  remoteStatus: WildzIdentitySession["remoteStatus"];
  warnings: WildzRestoreErrorCode[];
};

export type WildzRestoreOutcome =
  | CommittedWildzRestoreOutcome
  | {
      restoreStatus: "confirmation_required";
      artifactKind: "card-vault" | "commerce-vault";
      verifiedAssetIds: string[];
    };

export interface WildzContinuityCoordinator {
  restore(input: {
    artifact: WildzArtifactInspection;
    active: WildzIdentitySession | null;
    canonical: WildsPlayerVaultPayload["canonicalCursor"] | null;
    confirmCardOnly: boolean;
    activation: (session: WildzIdentitySession) => void;
  }): Promise<WildzRestoreOutcome>;
}
```

Extend `WildzArtifactInspection` with `WildzV3ArtifactInspection`. The identity-bearing variant carries the SDK-projected identity plus every verified V3 asset and the verified player payload. Full bytes go to the SDK; `pngBasis` goes to V3 verification. Identity plus player without a valid binding is invalid, never downgraded. Reject conflicting duplicate asset IDs, merge every unique verified Vault asset into reconciled inventory, and activate the embedded SDK username rather than retaining the prior session username. An `identity-seal` also merges its `portableAssets` only after the SDK portable-state proof and every card proof pass; unrelated domain objects never enter inventory. A `commerce-vault` with independently verified `identity` activates that embedded identity and atomically merges its complete `assets` set into the destination owner's state; a Commerce Vault without verified identity follows the explicit-confirmation card-only path and never changes the active identity. Neither path may derive cards from `projection` rows. `load` accepts only `wildzOwnerScope(keyId, actorId)`, while `save` and `writePrepared` derive and validate that same scope from `state.keyId` and `state.actorId`; no caller supplies a second owner key. Prepare verification, reconciliation, encryption, and a synchronous non-throwing activation callback before opening one transaction across identities, ownerStates, and meta. The coordinator uses `writePrepared` inside that shared transaction; normal owner-only updates use `save`. After committing, it reloads that scope and returns it as `CommittedWildzRestoreOutcome.ownerState`; `verifiedAssetIds` is the exact sorted unique verifier-returned import set, never a UI-visible subset. Invalid or failed work throws a mapped `WildzRestoreError` and returns no outcome. Remote session refresh happens after local commit and only changes remote status.

- [ ] **Step 4: Run owner-state/coordinator tests**

```bash
node --test .test-build/tests/wildz-player-state-repository.test.js .test-build/tests/wildz-continuity-coordinator.test.js .test-build/tests/wildz-artifact-codec.test.js
pnpm typecheck
pnpm lint
```

Expected: valid restores persist; every failure leaves database and active session unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/features/play/wilds-owner-state.ts src/lib/receiz/wildz-player-state-repository.ts src/lib/receiz/wildz-artifact-codec.ts src/features/identity/wildz-restore.ts src/lib/receiz/wildz-continuity-coordinator.ts tests/wildz-player-state-repository.test.ts tests/wildz-continuity-coordinator.test.ts tests/wildz-artifact-codec.test.ts
git commit -m "feat: restore Wildz identity and continuity atomically"
```

---

### Task 4: Wire Owner-Scoped Continuity Into the Game Shell

**Files:**
- Create: `src/features/identity/use-wildz-continuity.ts`
- Modify: `src/features/identity/WildzGenesis.tsx`
- Modify: `src/features/shell/WildzApp.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/WildsInventory.tsx`
- Modify: `src/features/play/use-wilds-presentation.ts`
- Create: `tests/wildz-continuity-integration.test.ts`

**Interfaces:**
- Consumes: coordinator, owner state, player repository, active identity session, and combined export.
- Produces: one restore/export path in Genesis and Card Vault with a cold-restart-safe owner-scoped Play campaign.

- [ ] **Step 1: Write failing shell source/cold-restart tests**

```ts
for (const file of ["src/features/play/PlayCampaign.tsx", "src/features/play/WildsInventory.tsx"]) {
  const source = readFileSync(file, "utf8");
  assert.doesNotMatch(source, /receiz:wilds:save:v2|window\.localStorage\.setItem\(WILDS_/);
}
assert.equal(reopened.ownerState.actorId, canonicalWildzActorId(restoredIdentity));
assert.equal(reopened.session.username, embeddedIdentityProjection.owner.username);
assert.notEqual(reopened.session.username, previousSession.username);
assert.deepEqual(
  reopened.ownerState.playState.inventory.map((asset) => asset.id).sort(),
  [...new Set(exportedPlayer.playState.inventory.map((asset) => asset.id))].sort()
);
```

Build the cold-restart fixture entirely in the test with an ephemeral embedded identity, a different `previousSession`, and combined Vault bytes containing at least six unique verified cards plus one byte-identical duplicate. Derive `embeddedIdentityProjection` with `projectReceizIdentityAccount`; do not hard-code the expected username or IDs.

- [ ] **Step 2: Run red tests**

Expected: current PlayCampaign global localStorage assertions fail and the continuity hook is missing.

- [ ] **Step 3: Integrate without replacing the accepted UI**

```ts
export type UseWildzContinuityResult = {
  ownerState: WildzOwnerState | null;
  restore(file: File, options?: { confirmCardOnly?: boolean }): Promise<WildzRestoreOutcome>;
  save(next: WildzOwnerState): Promise<void>;
  exportVault(passphrase?: string): Promise<void>;
};
```

Key `PlayCampaign` by `wildzOwnerScope(session.keyId, session.actorId)`. Initialize and persist through `WildzPlayerStateRepository`; pass restored V8 state/settings/cursor into the campaign. Genesis and Inventory call the same content-aware restore method. Export always builds `createWildsPlayerVault` from the current owner state before binding it to the active identity. No React prop contains a key file.

- [ ] **Step 4: Run continuity integration and full suite**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-continuity-integration.test.js
pnpm test
pnpm typecheck
pnpm lint
```

Expected: cold restart activates the embedded username and restores the exact unique verified card-ID set plus all owner/V8 continuity; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/identity/use-wildz-continuity.ts src/features/identity/WildzGenesis.tsx src/features/shell/WildzApp.tsx src/features/play/PlayCampaign.tsx src/features/play/WildsInventory.tsx src/features/play/use-wilds-presentation.ts tests/wildz-continuity-integration.test.ts
git commit -m "feat: wire owner-scoped Wildz continuity end to end"
```

---

## Inter-Plan Gate — Public Projection and Economy

After Task 4 is green and committed, stop this plan and execute every task in `docs/superpowers/plans/2026-07-15-wildz-v3-public-economy.md`. Return here only after public profile/card recovery, authenticated compare-and-append market admission, verified Connect settlement, and append-only ownership projection pass their plan gate. This preserves the approved delivery order: continuity before public authority, public authority before the complete gameplay kernel.

## Phase B — Pure V3 Domain and Canonical World

### Task 5: Port Settlements, Civic History, and Route Memory

**Files:**
- Create: `src/features/play/wilds-route-memory.ts`
- Create: `src/features/play/wilds-settlements.ts`
- Modify: `src/features/play/wilds-landmarks.ts`
- Create: `tests/wilds-route-memory.test.ts`
- Create: `tests/wilds-settlements.test.ts`
- Modify: `tests/wilds-world-atlas.test.ts`

**Interfaces:**
- Consumes: the civic-history receipt contract already landed in Phase A.
- Produces: `createWildsRouteMemory`, `applyWildsRouteIntent`, `WAYFINDER_HOLLOW`, and `settlementAtPosition` while preserving civic replay.

- [ ] **Step 1: Port the tagged tests first**

Use the exact `v3.0.0` test bodies and retain this ownership/deduplication assertion:

```ts
const event = createWildsCivicEvent({ settlementId: "wayfinder-hollow", actorId: "player:keeper", kind: "service.completed", sourceId: "orientation", occurredAt: "2026-07-15T12:00:00.000Z", cardProofDigest: null, reputation: 5 });
assert.deepEqual(verifyWildsCivicEvent(event), { ok: true, errors: [] });
assert.equal(projectWildsCivicHistory([event, event]).reputation, 5);
assert.equal(landmarkAtPosition({ x: 72, z: 40 })?.id, "wayfinder-hollow");
```

- [ ] **Step 2: Run the red compile**

Expected: `TS2307` for route-memory and settlement modules; the Phase A civic-history test remains green.

- [ ] **Step 3: Port settlement/route behavior and adapt the landmark merge**

Source blobs:

```text
wilds-route-memory.ts   e464e54ca8f60065b69d31409c63261f14dbf793
wilds-settlements.ts    beb185883df0227b76f1421f76cdf1928d8e5790
wilds-landmarks.ts      594dafee61780ed25f3a585dc9134f07ac0a230c
```

Keep the settlements-to-landmarks back-edge type-only, import the existing Phase A civic-history contract, and merge Wayfinder Hollow into the current landmark file rather than replacing the standalone copy.

- [ ] **Step 4: Run the four focused tests**

```bash
node --test .test-build/tests/wilds-civic-history.test.js .test-build/tests/wilds-route-memory.test.js .test-build/tests/wilds-settlements.test.js .test-build/tests/wilds-world-atlas.test.js
```

Expected: all deterministic ordering, five-district, three-resident, route, and landmark assertions pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/play/wilds-route-memory.ts src/features/play/wilds-settlements.ts src/features/play/wilds-landmarks.ts tests/wilds-route-memory.test.ts tests/wilds-settlements.test.ts tests/wilds-world-atlas.test.ts
git commit -m "feat: port Wilds V3 settlement kernel"
```

---

### Task 6: Port Dynamic Ecology Grammar and Activities

**Files:**
- Create: `src/features/play/wilds-ecology.ts`
- Create: `src/features/play/wilds-ecology-activity.ts`
- Modify: `src/features/play/wilds-dynamic-sites.ts`
- Create: `tests/wilds-ecology.test.ts`
- Create: `tests/wilds-ecology-activity.test.ts`

**Interfaces:**
- Produces: deterministic `generateWildsEcologySite`, `generateWildsEcologyEnsemble`, `advanceWildsEcologySite`, `deriveWildsEcologyChild`, `createWildsEcologyActivity`, and `applyWildsEcologyActivityInput`.

- [ ] **Step 1: Port tests for all eight families**

```ts
for (const familyId of WILDS_ECOLOGY_FAMILIES) {
  const input = { familyId, pulse: "2026-07-15T21:00:00.000Z", ordinal: 1, existingSites: [] };
  const first = generateWildsEcologySite(input);
  assert.deepEqual(generateWildsEcologySite(input), first);
  assert.ok(first);
  const activity = createWildsEcologyActivity(first);
  assert.equal(applyWildsEcologyActivityInput(activity, activity.sequence[0]!).progress, 1);
}
```

- [ ] **Step 2: Run red compile**

Expected: missing ecology modules.

- [ ] **Step 3: Port exact tagged blobs**

```text
wilds-ecology.ts          2b3b6164f0baebb5a94568c77fe5141fbaa47317
wilds-ecology-activity.ts e542538aaa6bfefed6ac022da7006882cfc75a3e
wilds-dynamic-sites.ts    832a94c499f40fce7c3c7f8ef7474040a5802b7c
```

Import and re-export `WILDS_ECOLOGY_FAMILIES` and `WildsEcologyFamilyId` from `wilds-v3-contracts.ts`; do not redefine them. The dynamic-site merge widens `isDynamicSitePositionSafe` to structural site inputs and accepts candidate radius while preserving standalone sites.

- [ ] **Step 4: Run ecology tests**

```bash
node --test .test-build/tests/wilds-ecology.test.js .test-build/tests/wilds-ecology-activity.test.js .test-build/tests/wilds-dynamic-sites.test.js
```

Expected: all family, placement, lifecycle, child, and activity tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/play/wilds-ecology.ts src/features/play/wilds-ecology-activity.ts src/features/play/wilds-dynamic-sites.ts tests/wilds-ecology.test.ts tests/wilds-ecology-activity.test.ts
git commit -m "feat: add deterministic Wilds ecology"
```

---

### Task 7: Port Eight-Family Boss Ecology and Semantic Raids

**Files:**
- Create: `src/features/play/wilds-boss-ecology.ts`
- Create: `src/features/play/wilds-raid-roles.ts`
- Create: `src/features/play/wilds-raid-round.ts`
- Create: `src/features/play/wilds-raid-encounter.ts`
- Modify: `src/features/play/wilds-boss-generator.ts`
- Modify: `src/features/play/wilds-raid-core.ts`
- Modify: `src/features/play/wilds-rift-travel.ts`
- Create: `tests/wilds-boss-ecology.test.ts`
- Create: `tests/wilds-raid-roles.test.ts`
- Create: `tests/wilds-raid-round.test.ts`
- Create: `tests/wilds-raid-encounter.test.ts`

**Interfaces:**
- Produces: `generateWildsBoss`, `deriveWildsBossSuccessor`, `createWildsRaidRound`, `admitWildsRaidParticipant`, `applyWildsRaidIntent`, and `projectWildsRaidRoles`.

- [ ] **Step 1: Port semantic raid tests first**

```ts
const pulse = "2026-07-15T12:00:00.000Z";
const site = advanceDynamicSite(
  advanceDynamicSite(generateCrystalBurrow({ pulse, ordinal: 1, activeSites: [] }), "tracked"),
  "emerged"
);
const card = sealCollectedCard({
  capturedAt: pulse,
  encounterId: "raid-role-card",
  formId: "mintcub-1",
  ownerReceizId: "player-1"
});
const boss = generateWildsBoss({ familyId: "crystal-burrower", site, pulse, ordinal: 1, existingBosses: [] });
const round = createWildsRaidRound({ boss, ordinal: 1, openedAt: pulse });
assert.equal(round.squads.flat().length, 0);
assert.equal(WILDS_RAID_SUPPORT_CAPACITY, 144);
assert.equal(WILDS_RAID_LEASE_MS, 90_000);
assert.deepEqual(projectWildsRaidRoles(card), projectWildsRaidRoles(card));
```

Import `advanceDynamicSite`, `generateCrystalBurrow`, and `sealCollectedCard` exactly as the tagged tests do.

- [ ] **Step 2: Run red compile**

Expected: missing boss/raid modules.

- [ ] **Step 3: Port exact blobs atomically**

```text
wilds-boss-ecology.ts 9abf5faa6889e9ece3188f48a5c758eda30d1849
wilds-raid-roles.ts    588781b3009a404cf0f867395399a79dcf558a6c
wilds-raid-round.ts    5623df945403e9303214e6f8672a2d9fe4349bfb
wilds-raid-encounter.ts 770de997e63aa0d72a9372fb9afef0c4b507582a
```

Import and re-export boss-family and raid-role contracts from `wilds-v3-contracts.ts`; do not redefine them. Merge tagged boss generator, raid core, and Rift changes. Keep the raid-round/raid-core cycle type-only in the appropriate direction.

- [ ] **Step 4: Run boss/raid focused tests**

```bash
node --test .test-build/tests/wilds-boss-ecology.test.js .test-build/tests/wilds-raid-roles.test.js .test-build/tests/wilds-raid-round.test.js .test-build/tests/wilds-raid-encounter.test.js .test-build/tests/wilds-boss-generator.test.js .test-build/tests/wilds-raid-core.test.js .test-build/tests/wilds-rift-travel.test.js
```

Expected: all eight-family, capacity, lease, role, encounter, successor, and Rift tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/play/wilds-boss-ecology.ts src/features/play/wilds-raid-roles.ts src/features/play/wilds-raid-round.ts src/features/play/wilds-raid-encounter.ts src/features/play/wilds-boss-generator.ts src/features/play/wilds-raid-core.ts src/features/play/wilds-rift-travel.ts tests/wilds-boss-ecology.test.ts tests/wilds-raid-roles.test.ts tests/wilds-raid-round.test.ts tests/wilds-raid-encounter.test.ts
git commit -m "feat: port Wilds V3 bosses and raids"
```

---

### Task 8: Port Social, Mastery, Crafting, Lineage, Reconciliation, and Narrative

**Files:**
- Create: `src/features/play/wilds-social-core.ts`
- Create: `src/features/play/wilds-card-mastery.ts`
- Create: `src/features/play/wilds-crafting.ts`
- Create: `src/features/play/wilds-lineage-utility.ts`
- Create: `src/features/play/wilds-portable-reconciliation.ts`
- Create: `src/features/play/wilds-narrative-memory.ts`
- Create: `tests/wilds-social-core.test.ts`
- Create: `tests/wilds-card-mastery.test.ts`
- Create: `tests/wilds-card-mastery-taxonomy.test.ts`
- Create: `tests/wilds-crafting.test.ts`
- Create: `tests/wilds-lineage-utility.test.ts`
- Create: `tests/wilds-portable-reconciliation.test.ts`
- Create: `tests/wilds-narrative-memory.test.ts`

**Interfaces:**
- Produces: social team/invite/role/event/squad APIs; `projectWildsCardMastery`; `deriveLoadoutSynergy`; `advanceCardMastery`; `craftRecipe`; `lineageSummary`; `reconcilePortableRecords`; narrative story/history/return projections.

- [ ] **Step 1: Port the tagged tests first**

```ts
const card = sealCollectedCard({
  formId: "mintcub-1",
  ownerReceizId: "player:one",
  encounterId: "capture:mastery",
  capturedAt: "2026-07-15T00:00:00.000Z",
  kaiPulse: "pulse:1"
});
const team = createWildsSocialTeam({ captainId: "player:captain", name: "Rift Walkers", occurredAt: "2026-07-20T12:00:00.000Z" });
assert.equal(team.members[0]?.role, "captain");
assert.deepEqual(projectWildsCardMastery(card), projectWildsCardMastery(card));
assert.equal(projectReturnContinuity({ playerName: "Fern", regionId: "grove", memories: [] }).recap.length, 0);
```

Import `sealCollectedCard` exactly as the tagged taxonomy test does; copy the complete tagged crafting and lineage test bodies before implementation so their inventories, record digests, and timestamps remain explicit.

- [ ] **Step 2: Run red compile**

Expected: missing social/mastery/crafting/lineage/reconciliation/narrative modules.

- [ ] **Step 3: Port exact blobs**

```text
wilds-social-core.ts             a9e4248f74aa41edf2898543a980330b8b50a30e
wilds-card-mastery.ts            1011375c50150e5aab3efc0d436a46fe9e1686ab
wilds-crafting.ts                f064464ff83eecbac52ec3cc0462057ff1601c27
wilds-lineage-utility.ts         8e702faa4a4e14120ec265c2494efa691759ea9f
wilds-portable-reconciliation.ts 479d9b04439d13dfeadf028320abd74f19f00985
wilds-narrative-memory.ts        920eca20f05b507e8e59a701417a7d3032d1c658
```

Retain local `wilds-competition.ts`; run its existing exact test with this slice.

- [ ] **Step 4: Run focused tests**

```bash
node --test .test-build/tests/wilds-social-core.test.js .test-build/tests/wilds-card-mastery.test.js .test-build/tests/wilds-card-mastery-taxonomy.test.js .test-build/tests/wilds-crafting.test.js .test-build/tests/wilds-lineage-utility.test.js .test-build/tests/wilds-portable-reconciliation.test.js .test-build/tests/wilds-narrative-memory.test.js .test-build/tests/wilds-competition.test.js
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/play/wilds-social-core.ts src/features/play/wilds-card-mastery.ts src/features/play/wilds-crafting.ts src/features/play/wilds-lineage-utility.ts src/features/play/wilds-portable-reconciliation.ts src/features/play/wilds-narrative-memory.ts tests/wilds-social-core.test.ts tests/wilds-card-mastery.test.ts tests/wilds-card-mastery-taxonomy.test.ts tests/wilds-crafting.test.ts tests/wilds-lineage-utility.test.ts tests/wilds-portable-reconciliation.test.ts tests/wilds-narrative-memory.test.ts
git commit -m "feat: add Wilds V3 civilization systems"
```

---

### Task 9: Port V3 World Events, Projection, Replay, and Record

**Files:**
- Modify: `src/features/play/wilds-world-event.ts`
- Modify: `src/features/play/wilds-world-state.ts`
- Modify: `src/features/play/wilds-world-record.ts`
- Create: `tests/wilds-world-state-v3.test.ts`

**Interfaces:**
- Produces: complete V3 event union, `WildsWorldProjection`, deterministic reducer/replay/checkpoint, and complete record extraction.

- [ ] **Step 1: Write a failing ecology replay test**

```ts
const event = createWildsWorldEvent({ kind: "ecology.spawned", actorId: "receiz:pulse", causeId: "ecology-pulse:2026-07-15", pulse: "2026-07-15T21:00:00.000Z", kaiKlok: 1, occurredAt: "2026-07-15T21:00:00.000Z", previousEventId: null, payload: { site } });
const projection = reduceWildsWorldEvent(initialWildsWorldProjection(), event);
assert.deepEqual(projection.ecologySites[site.id], site);
assert.deepEqual(replayWildsWorld([], checkpointWildsWorld(projection)), projection);
```

- [ ] **Step 2: Run red assertion**

Expected: current event union/projection has no ecology field.

- [ ] **Step 3: Port exact final domain blobs**

```text
wilds-world-event.ts  8e96894c6a1c8a03d5ee53751000182325b7c5fc
wilds-world-state.ts  83e3b9ec0cc3c1c1e84225670138f5226611279b
wilds-world-record.ts 3f654059529c6a17e68b99095471779f8d4ff652
```

The event union must include ecology, semantic raid, social administration, and league events from the tag.

- [ ] **Step 4: Run world event/state tests**

```bash
node --test .test-build/tests/wilds-world-event.test.js .test-build/tests/wilds-world-state-v3.test.js
```

Expected: replay equals projection and checkpoint verification passes.

- [ ] **Step 5: Commit**

```bash
git add src/features/play/wilds-world-event.ts src/features/play/wilds-world-state.ts src/features/play/wilds-world-record.ts tests/wilds-world-state-v3.test.ts
git commit -m "feat: expand Wilds V3 world history"
```

---

### Task 10: Integrate the Canonical V3 World Service

**Files:**
- Modify: `src/features/play/wilds-world-service.ts`
- Modify: `tests/wilds-world-service.test.ts`
- Create: `tests/wilds-boss-world-service.test.ts`
- Create: `tests/wilds-ecology-world-service.test.ts`
- Create: `tests/wilds-world-social.test.ts`

**Interfaces:**
- Produces: final `WildsWorldService` with deterministic tick, ecology, bosses, raids, social commands, idempotency, replay, and checkpoints.

- [ ] **Step 1: Port the tagged service tests first**

The tests must cover deterministic causal order, stale pulse rejection, at most three undefeated bosses, one boss per region, semantic card-derived raid actions, leases/reconnect/retreat/rotation/successors, eight-site ecology, physical discovery/contribution/aftermath/children, social invites/roles/events/squads/abuse, command idempotency, and replay equality.

- [ ] **Step 2: Run red service tests**

Expected: current service lacks the V3 command/event families.

- [ ] **Step 3: Port the exact service blob**

```text
wilds-world-service.ts fd0012531d9a9412123a7db66d59051cf68096b3
```

Retain the constructor/snapshot/checkpoint/events/execute/tick interfaces from the tag.

- [ ] **Step 4: Run all four service tests**

```bash
node --test .test-build/tests/wilds-world-service.test.js .test-build/tests/wilds-boss-world-service.test.js .test-build/tests/wilds-ecology-world-service.test.js .test-build/tests/wilds-world-social.test.js
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/play/wilds-world-service.ts tests/wilds-world-service.test.ts tests/wilds-boss-world-service.test.ts tests/wilds-ecology-world-service.test.ts tests/wilds-world-social.test.ts
git commit -m "feat: integrate the Wilds V3 living world"
```

---

### Task 11: Project Boss and Ecology Knowledge Into the Atlas

**Files:**
- Modify: `src/features/play/wilds-world-atlas.ts`
- Modify: `src/features/play/wilds-context-action.ts`
- Modify: `tests/wilds-world-atlas.test.ts`
- Modify: `tests/wilds-context-action.test.ts`
- Create: `tests/wilds-boss-atlas.test.ts`
- Create: `tests/wilds-ecology-atlas.test.ts`

**Interfaces:**
- Produces: privacy-aware ecology/boss atlas projections, territory approach points, and V3 activity context priority.

- [ ] **Step 1: Write privacy/priority tests**

```ts
const hidden = projectWildsAtlas({ ...baseInput, ecologySites: [site], ecologyKnowledge: {} });
assert.equal("position" in hidden.ecologySites[0]!, false);
const known = projectWildsAtlas({ ...baseInput, ecologySites: [site], ecologyKnowledge: { [site.id]: exactKnowledge } });
assert.deepEqual("position" in known.ecologySites[0]! ? known.ecologySites[0]!.position : null, site.position);
```

Use tagged fixtures for `baseInput`, `site`, and `exactKnowledge`; add a context-action assertion that a joinable boss/ecology activity outranks greeting a selected player.

- [ ] **Step 2: Run red atlas tests**

Expected: current atlas lacks ecology/boss projections.

- [ ] **Step 3: Merge exact tagged behavior**

```text
wilds-world-atlas.ts   a1a265ddec6c421adfb792377df08fb5f43e8d16
wilds-context-action.ts 71c1fa2f79f4b547f6b6b4168f2d3e4ffd8abe11
wilds-rift-travel.ts   a138cc2efa07daa363eac54741d381d730fb8517
```

Rift travel was already merged in Task 3; verify its final hash/behavior rather than reapplying it.

- [ ] **Step 4: Run atlas/context tests**

```bash
node --test .test-build/tests/wilds-world-atlas.test.js .test-build/tests/wilds-context-action.test.js .test-build/tests/wilds-boss-atlas.test.js .test-build/tests/wilds-ecology-atlas.test.js
```

Expected: hidden knowledge omits exact positions; discovered knowledge and activity priority pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/play/wilds-world-atlas.ts src/features/play/wilds-context-action.ts tests/wilds-world-atlas.test.ts tests/wilds-context-action.test.ts tests/wilds-boss-atlas.test.ts tests/wilds-ecology-atlas.test.ts
git commit -m "feat: project V3 world knowledge into the atlas"
```

---

### Task 12: Add the Standalone World Repository and Atomic Snapshot Client

**Files:**
- Create: `src/lib/receiz/wilds-world-repository.ts`
- Modify: `src/lib/receiz/wilds-world-server.ts`
- Modify: `app/api/wilds/world/snapshot/route.ts`
- Create: `src/features/play/use-wilds-world.ts`
- Create: `tests/wilds-world-repository.test.ts`
- Create: `tests/wilds-world-client.test.ts`

**Interfaces:**
- Consumes: V3 world record/service, Receiz app-state/public-store/audit, and authenticated multiplayer actor.
- Produces: `WildsWorldRepository`, standalone server, exact snapshot route, rollback-safe canonical commands, and bounded client hook.

- [ ] **Step 1: Write atomic response/rollback tests**

```ts
assert.deepEqual(parseWildsWorldSnapshotResponse({ ok: true, projection, mode: "local_practice" }), { projection, mode: "local_practice" });
assert.throws(() => parseWildsWorldSnapshotResponse({ ok: true, projection: { projection, mode: "local_practice" } }), /wilds_world_snapshot_invalid/);
assert.throws(() => parseWildsWorldSnapshotResponse({ ok: true, projection, mode: "unknown" }), /wilds_world_snapshot_invalid/);
const route = readFileSync("app/api/wilds/world/snapshot/route.ts", "utf8");
assert.match(route, /ok:\s*true,\s*\.\.\.await worldSnapshot/);
assert.doesNotMatch(route, /projection:\s*await worldSnapshot/);
```

Repository tests must prove practice isolation, publication-failure rollback, audit-failure recovery mode without rollback after publication, and recovery of only complete V3 records.

- [ ] **Step 2: Run red client/repository tests**

Expected: repository/hook missing and current response shape differs.

- [ ] **Step 3: Implement the narrow repository and land server/route/hook together**

```ts
export interface WildsWorldRepository {
  recover(sourceUrl: string): Promise<WildsWorldRecord | null>;
  publish(input: { sourceUrl: string; actor: Pick<WildsMultiplayerActor, "handle" | "practice" | "accessToken">; record: WildsWorldRecord }): Promise<WildsWorldPublication>;
  audit(input: { sourceUrl: string; actor: Pick<WildsMultiplayerActor, "handle" | "practice" | "accessToken">; events: readonly WildsWorldEvent[] }): Promise<boolean>;
}

export type WildsWorldSnapshotMode = "receiz_live" | "local_practice";
export type WildsWorldClientMode = "connecting" | WildsWorldSnapshotMode | "receiz_recovery_pending" | "reconnecting";
export type WildsWorldSnapshotResponse = {
  projection: WildsWorldProjection;
  mode: WildsWorldSnapshotMode;
};

export function parseWildsWorldSnapshotResponse(value: unknown): WildsWorldSnapshotResponse;
```

The Receiz repository wraps only `readAppStateByUrl`, `publishPublicStore`, and `auditAppend`; namespace is `wilds:global:v3`; compute idempotency as `` `wilds:global:v3:${record.checkpoint.revision}:${record.checkpoint.lastEventId ?? "genesis"}` ``. `worldSnapshot()` returns `WildsWorldSnapshotResponse`; the route spreads it. The parser validates both fields and returns the same one-layer pair, and the hook updates projection and mode only from that parsed result. The hook polls every two seconds, aborts on cleanup, rejects revision rollback, and exposes typed commands. Merge tagged reference blobs `dfaffefb2d271418d061ef03d80cdcb8596fe6e1` server, `d100f79b3b712c4463ae4a6080b3d57ac059c4a1` route, and `9cd9427151d5df6e404ac50f277ea9f5a06e9068` hook behavior without commerce product imports.

- [ ] **Step 4: Run repository/client and API tests**

```bash
node --test .test-build/tests/wilds-world-repository.test.js .test-build/tests/wilds-world-client.test.js .test-build/tests/wilds-world-service.test.js
pnpm typecheck
pnpm lint
```

Expected: exact one-layer response, polling cleanup, rollback, and practice/live separation pass.

- [ ] **Step 5: Commit atomically**

```bash
git add src/lib/receiz/wilds-world-repository.ts src/lib/receiz/wilds-world-server.ts app/api/wilds/world/snapshot/route.ts src/features/play/use-wilds-world.ts tests/wilds-world-repository.test.ts tests/wilds-world-client.test.ts
git commit -m "feat: add the standalone V3 world repository"
```

---

### Task 13: Require Verified Cards for Canonical Contributions

**Files:**
- Create: `src/features/play/wilds-world-authority.ts`
- Modify: `src/features/play/wilds-world-service.ts`
- Modify: `src/features/play/use-wilds-world.ts`
- Modify: `src/lib/receiz/wilds-world-server.ts`
- Modify: `tests/wilds-ecology-world-service.test.ts`
- Modify: `tests/wilds-world-client.test.ts`
- Create: `tests/wilds-world-card-authority.test.ts`

**Interfaces:**
- Produces: `worldCommandRequiresCard` and `verifyWildsWorldCommandCard` for `raid.act`, legacy `raid.contribute`, and `ecology.contribute`.

- [ ] **Step 1: Write failing card-authority tests**

```ts
assert.throws(() => service.execute(ecologyContribution, { ...authority, card: undefined }), /wilds_world_verified_card_required/);
assert.throws(() => service.execute(ecologyContribution, { ...authority, card: otherCard }), /wilds_world_card_proof_invalid/);
assert.deepEqual(buildWildsWorldCommandBody(guestId, ecologyContribution, ownedCard).card, ownedCard);
```

Use real `sealCollectedCard` fixtures for `otherCard` and `ownedCard`; do not fabricate digest strings.

- [ ] **Step 2: Run red authority tests**

Expected: tagged service accepts digest-shaped input without a verified card.

- [ ] **Step 3: Implement actor-owned card verification**

```ts
export function worldCommandRequiresCard(command: WildsWorldCommand) {
  return command.type === "raid.act" || command.type === "raid.contribute" || command.type === "ecology.contribute";
}

export function verifyWildsWorldCommandCard(input: { command: WildsWorldCommand; card: PortableCardAsset | undefined }) {
  if (!worldCommandRequiresCard(input.command)) return input.card;
  if (!input.card || !verifyAnyWildsCard(input.card).ok) throw new Error("wilds_world_verified_card_required");
  if ("cardProofDigest" in input.command && input.command.cardProofDigest !== input.card.proof.digest) throw new Error("wilds_world_card_proof_invalid");
  return input.card;
}
```

The server additionally calls `authorizeWildsMultiplayerCard(actor, card)` before passing it to the service. Record this approved-spec hardening in the parity ledger.

- [ ] **Step 4: Run authority and full kernel tests**

```bash
node --test .test-build/tests/wilds-world-card-authority.test.js .test-build/tests/wilds-ecology-world-service.test.js .test-build/tests/wilds-world-client.test.js
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all pass; canonical contribution without an actor-owned verified card fails.

- [ ] **Step 5: Commit**

```bash
git add src/features/play/wilds-world-authority.ts src/features/play/wilds-world-service.ts src/features/play/use-wilds-world.ts src/lib/receiz/wilds-world-server.ts tests/wilds-ecology-world-service.test.ts tests/wilds-world-client.test.ts tests/wilds-world-card-authority.test.ts
git commit -m "fix: require verified cards for canonical world actions"
```

## Plan Completion Gate

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git diff --check
git status --short
```

Expected: every command exits 0; worktree is clean; all relevant tagged V3 pure tests pass; generated Identity Seal and combined Vault restore their canonical actor and V8 continuity; the snapshot response has one projection layer; canonical contributions require actor-owned verified cards. Verify exact pure ports with `git hash-object` against the listed blob IDs and record every intentional standalone divergence.
