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

test("public card routes trust only the cookie actor and durable projection", () => {
  const route = readFileSync("app/api/cards/[assetId]/route.ts", "utf8");
  assert.match(route, /resolveWildzCookieActor/);
  assert.match(route, /createReceizWildzPublicRepository/);
  assert.match(route, /loadVerifiedWildzPublicOwnershipAuthority/);
  assert.match(route, /requireCurrentWildzPublicOwner/);
  assert.doesNotMatch(route, /asset\.manifest\.ownerReceizId/);
  const ownershipCheck = route.indexOf("const admittedOwnerId = requireCurrentWildzPublicOwner(");
  const exactRegistrationCheck = route.indexOf("if (isCurrentWildzPublicCardRegistration(current.state, asset))");
  assert.ok(ownershipCheck >= 0 && exactRegistrationCheck > ownershipCheck);
  assert.doesNotMatch(route, /identityProof|keyFile|session\.accessToken|resolveLocalPublicWildsCard|admitPublicWildsCard/);
  assert.match(route, /status:\s*401/);
  assert.match(route, /status:\s*403/);
  assert.match(route, /status:\s*503/);
});

test("standalone card recovery resolves the public projection and exact verified local card concurrently", () => {
  const route = readFileSync("app/api/cards/[assetId]/route.ts", "utf8");
  const resolver = readFileSync("src/lib/receiz/wildz-public-card-resolver.ts", "utf8");
  const serverPage = readFileSync("app/cards/[assetId]/page.tsx", "utf8");
  assert.match(route, /resolvePublicWildsCardRecord/);
  assert.match(route, /requestOrigin\(request\)/);
  assert.match(resolver, /createReceizWildzPublicRepository/);
  assert.match(resolver, /resolveSdkPublicWildzCard/);
  assert.match(resolver, /verifyAnyWildsCard/);
  assert.doesNotMatch(serverPage, /resolvePublicWildsCardRecord/);
  assert.match(serverPage, /<WildsCardPage assetId=\{parsed\.assetId\} \/>/);
  const page = readFileSync("src/features/play/WildsCardPage.tsx", "utf8");
  assert.match(page, /initialRecord\?\.assetId === assetId/);
  assert.match(page, /fetch\(`\/api\/cards\/\$\{encodeURIComponent\(assetId\)\}`/);
  assert.match(page, /resolveLocalWildzCard\(assetId\)/);
  assert.match(page, /wildz-local-card-resolver/);
  assert.match(page, /Promise\.allSettled\(\[localResolution, publicResolution\]\)/);
  assert.doesNotMatch(page, /initialPlayState|restorePlayState|localStorage|receiz:wilds:save:v2/);
  const registry = readFileSync("src/features/play/public-card-registry.ts", "utf8");
  assert.doesNotMatch(registry, /identityProof|keyFile|passphrase|registryKey|Symbol\.for|resolveLocalPublicWildsCard/);
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
