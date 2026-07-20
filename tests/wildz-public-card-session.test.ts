import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  canonicalPublicCardPath,
  parsePublicCardParam
} from "../src/features/play/public-card-registry";
import { initialPlayState } from "../src/features/play/game-state";
import { resolveLocalWildzCard } from "../src/lib/receiz/wildz-local-card-resolver";

test("full and compact card parameters resolve one canonical asset", () => {
  assert.deepEqual(parsePublicCardParam("wilds:0123456789abcdef01234567"), {
    assetId: "wilds:0123456789abcdef01234567",
    source: "canonical"
  });
  assert.deepEqual(parsePublicCardParam("0123456789abcdef01234567"), {
    assetId: "wilds:0123456789abcdef01234567",
    source: "compact"
  });
  assert.equal(canonicalPublicCardPath("wilds:0123456789abcdef01234567"), "/cards/wilds%3A0123456789abcdef01234567");
  assert.equal(existsSync("app/c/[assetId]/page.tsx"), true);
});

test("public card publication accepts Identity Seal authority without making cookies superior", () => {
  const route = readFileSync("app/api/cards/[assetId]/route.ts", "utf8");
  assert.match(route, /resolveWildzCookieActor/);
  assert.match(route, /if \(identityKeyFile\)/);
  assert.match(route, /else \{\s*const actor = await resolveWildzCookieActor/);
  assert.match(route, /sameWildzPlayerCoordinate\(asset\.manifest\.ownerReceizId, actor\.profileHandle\)/);
  assert.match(route, /publishPublicStoreWithIdentityProof/);
  assert.match(route, /storeStateRecord:\s*transportRecord as unknown as JsonObject/);
  assert.match(route, /merchantReceizId:\s*ownerCoordinate\.profileHandle/);
  assert.doesNotMatch(route, /createReceizWildzPublicRepository|loadVerifiedWildzPublicOwnershipAuthority|advanceWildzPublicState/);
  assert.match(route, /status:\s*401/);
  assert.match(route, /status:\s*403/);
  assert.match(route, /status:\s*503/);
  assert.match(route, /namespace:\s*`wildz-card:\$\{record\.assetId\}`/);
  assert.match(route, /state:\s*transportRecord as unknown as JsonObject/);
});

test("standalone card recovery resolves the public projection for anonymous visitors and exact verified local card concurrently", () => {
  const route = readFileSync("app/api/cards/[assetId]/route.ts", "utf8");
  const resolver = readFileSync("src/lib/receiz/wildz-public-card-resolver.ts", "utf8");
  const serverPage = readFileSync("app/cards/[assetId]/page.tsx", "utf8");
  assert.match(route, /resolvePublicWildsCardRecord/);
  assert.match(route, /requestOrigin\(request\)/);
  assert.match(route, /return WILDZ_PRODUCT\.origin/);
  assert.match(resolver, /createReceizWildzPublicRepository/);
  assert.match(resolver, /resolveSdkPublicWildzCard/);
  assert.match(resolver, /verifyAnyWildsCard/);
  assert.match(serverPage, /resolvePublicWildsCardRecord/);
  assert.match(serverPage, /<WildsCardPage assetId=\{parsed\.assetId\} initialRecord=\{initialRecord\} \/>/);
  const page = readFileSync("src/features/play/WildsCardPage.tsx", "utf8");
  assert.match(page, /initialRecord\?\.assetId === assetId/);
  assert.match(page, /fetch\(`\/api\/cards\/\$\{encodeURIComponent\(assetId\)\}`/);
  assert.match(page, /resolveLocalWildzCard\(assetId\)/);
  assert.match(page, /wildz-local-card-resolver/);
  assert.match(page, /Promise\.allSettled\(\[localResolution, publicResolution\]\)/);
  assert.doesNotMatch(page, /initialPlayState|restorePlayState|localStorage|receiz:wilds:save:v2/);
  const registry = readFileSync("src/features/play/public-card-registry.ts", "utf8");
  assert.match(registry, /identityProof|keyFile/);
  assert.doesNotMatch(registry, /registryKey|Symbol\.for|resolveLocalPublicWildsCard/);
});

test("card and Vault sealing enter the official SDK tenant-session rail", () => {
  const startRoute = readFileSync("app/api/auth/receiz/start/route.ts", "utf8");
  const inventory = readFileSync("src/features/play/WildsInventory.tsx", "utf8");
  const session = readFileSync("src/lib/receiz/wildz-native-proof-session.ts", "utf8");
  const identityAdapter = readFileSync("src/lib/receiz/wildz-identity-adapter.ts", "utf8");
  assert.match(startRoute, /ensureTenantSession/);
  assert.match(startRoute, /fallback:\s*"artifact_upload"/);
  assert.match(startRoute, /scope:\s*WILDZ_RECEIZ_OIDC_SCOPES/);
  assert.match(session, /\/api\/auth\/receiz\/me/);
  assert.match(session, /\/api\/auth\/receiz\/start/);
  assert.match(session, /sameWildzPlayerCoordinate/);
  assert.match(inventory, /ensureWildzNativeProofSession\(player\.playerId/);
  assert.match(inventory, /ensureWildzNativeProofSession\(asset\.manifest\.ownerReceizId/);
  assert.match(identityAdapter, /downloadReceizProofObject/);
  assert.doesNotMatch(identityAdapter, /identityBound:\s*false/);
});

test("local standalone recovery returns only the exact proof-verified card", async () => {
  const asset = structuredClone(initialPlayState.inventory[0]!);
  const session = {
    schema: "receiz.wildz.identity_session.v1" as const,
    keyId: "local-card-key",
    actorId: asset.manifest.ownerReceizId,
    username: null,
    displayName: "Wildz Explorer",
    portableStateStatus: "verified" as const,
    localAuthority: "verified" as const,
    remoteStatus: "offline" as const
  };
  const dependencies = {
    database: {} as never,
    repository: { active: async () => session },
    loadOwnerState: async () => ({ playState: { inventory: [asset] } }) as never
  };

  const resolved = await resolveLocalWildzCard(asset.id, dependencies);
  assert.equal(resolved?.id, asset.id);
  assert.notEqual(resolved, asset);
  assert.equal(await resolveLocalWildzCard("wilds:ffffffffffffffffffffffff", dependencies), null);

  const tampered = structuredClone(asset);
  tampered.proof.digest = "sha256:" + "0".repeat(64);
  assert.equal(await resolveLocalWildzCard(asset.id, {
    ...dependencies,
    loadOwnerState: async () => ({ playState: { inventory: [tampered] } }) as never
  }), null);
});
