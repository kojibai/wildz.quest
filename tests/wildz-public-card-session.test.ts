import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  canonicalPublicCardPath,
  createPublicWildsCardRecord,
  parsePublicCardParam,
  registerPublicWildsCard
} from "../src/features/play/public-card-registry";
import { initialPlayState } from "../src/features/play/game-state";
import { resolveLocalWildzCard } from "../src/lib/receiz/wildz-local-card-resolver";
import * as vaultAdmission from "../src/lib/receiz/wildz-vault-card-admission";
import * as publicCardRegistry from "../src/features/play/public-card-registry";

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

test("concurrent publishers share one registration for the same verified card revision", async () => {
  const asset = initialPlayState.inventory[0]!;
  const record = createPublicWildsCardRecord(asset, "https://wildz.quest", "2026-08-20T20:00:00.000Z");
  let registrations = 0;
  const fetcher = (async () => {
    registrations += 1;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    return new Response(JSON.stringify({ ok: true, record }), {
      status: 201,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  const [first, second] = await Promise.all([
    registerPublicWildsCard(asset, fetcher),
    registerPublicWildsCard(asset, fetcher)
  ]);

  assert.equal(registrations, 1);
  assert.equal(first.asset.proof.digest, asset.proof.digest);
  assert.equal(second.asset.proof.digest, asset.proof.digest);
});

test("an admitted Proof Object bypasses client re-verification but an unadmitted copy does not", () => {
  const admit = (vaultAdmission as Record<string, unknown>).admitWildzVaultProofObjects as ((input: {
    cards: typeof initialPlayState.inventory;
    playerHandle: string;
  }) => { proofObjects: unknown });
  const needsVerification = (publicCardRegistry as Record<string, unknown>).publicCardNeedsClientVerification as ((
    asset: typeof initialPlayState.inventory[number],
    proofObjects: unknown
  ) => boolean) | undefined;
  assert.equal(typeof needsVerification, "function");
  const asset = initialPlayState.inventory[0]!;
  const { proofObjects } = admit({ cards: [asset], playerHandle: "publisher" });

  assert.equal(needsVerification!(asset, proofObjects), false);
  assert.equal(needsVerification!(structuredClone(asset), proofObjects), true);
  assert.equal(needsVerification!(asset, {}), true);
});

test("a weaker publication response cannot replace or re-verify an admitted local Proof Object", async () => {
  const admit = (vaultAdmission as Record<string, unknown>).admitWildzVaultProofObjects as ((input: {
    cards: typeof initialPlayState.inventory;
    playerHandle: string;
  }) => { proofObjects: never });
  const asset = initialPlayState.inventory[0]!;
  const { proofObjects } = admit({ cards: [asset], playerHandle: "publisher" });
  const projected = createPublicWildsCardRecord(asset, "https://wildz.quest", "2026-08-20T20:00:00.000Z");
  const weakerProjection = structuredClone(projected);
  weakerProjection.asset.proof.digest = `sha256:${"0".repeat(64)}`;
  const fetcher = (async () => new Response(JSON.stringify({ ok: true, record: weakerProjection }), {
    status: 201,
    headers: { "content-type": "application/json" }
  })) as typeof fetch;

  const registered = await registerPublicWildsCard(asset, fetcher, { proofObjects });

  assert.equal(registered.asset, asset);
  assert.equal(registered.asset.proof.digest, asset.proof.digest);
  assert.equal(registered.sourceUrl, projected.sourceUrl);
});

test("public card publication treats the Proof Object as authority and the server as transport", () => {
  const route = readFileSync("app/api/cards/[assetId]/route.ts", "utf8");
  assert.doesNotMatch(route, /resolveWildzCookieActor|isReceizKeyFile|identityProof|publishPublicStoreWithIdentityProof/);
  assert.match(route, /verifyAnyWildsCard\(asset\)/);
  assert.match(route, /publishPublicStore\(\{\s*\.\.\.base,\s*state:/);
  assert.match(route, /merchantReceizId:\s*ownerCoordinate\.profileHandle/);
  assert.doesNotMatch(route, /createReceizWildzPublicRepository|loadVerifiedWildzPublicOwnershipAuthority|advanceWildzPublicState/);
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
  assert.doesNotMatch(registry, /identityProof|keyFile|defaultIdentityRepository|indexedDB/);
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
