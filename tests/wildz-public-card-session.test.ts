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

test("standalone card recovery prefers exact verified local truth before the public projection", () => {
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
  assert.match(page, /if \(localAsset\) \{[\s\S]*?return;[\s\S]*?if \(serverAsset\) return;[\s\S]*?fetch\(`/);
  assert.doesNotMatch(page, /initialPlayState|restorePlayState|localStorage|receiz:wilds:save:v2/);
  const registry = readFileSync("src/features/play/public-card-registry.ts", "utf8");
  assert.match(registry, /identityProof|keyFile/);
  assert.doesNotMatch(registry, /registryKey|Symbol\.for|resolveLocalPublicWildsCard/);
});

test("card and Vault sealing use the active Wildz Receiz ID without a Connect redirect", () => {
  const inventory = readFileSync("src/features/play/WildsInventory.tsx", "utf8");
  const route = readFileSync("app/api/receiz/proof-object/route.ts", "utf8");
  const identityAdapter = readFileSync("src/lib/receiz/wildz-identity-adapter.ts", "utf8");
  assert.doesNotMatch(inventory, /\/api\/auth\/receiz\/start|ensureWildzNativeProofSession|ensureActiveWildzProofSession|receizResume/);
  assert.doesNotMatch(route, /resolveWildzCookieActor|receiz_authority_required/);
  assert.match(route, /requireVerifiedWildzPng/);
  assert.match(route, /\/api\/document-seal/);
  assert.doesNotMatch(route, /verifyReceizArtifact/);
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
