import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  canonicalPublicCardPath,
  parsePublicCardParam
} from "../src/features/play/public-card-registry";

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

test("public card recovery never reads private browser inventory", () => {
  const route = readFileSync("app/api/cards/[assetId]/route.ts", "utf8");
  const resolver = readFileSync("src/lib/receiz/wildz-public-card-resolver.ts", "utf8");
  const serverPage = readFileSync("app/cards/[assetId]/page.tsx", "utf8");
  assert.match(route, /resolvePublicWildsCardRecord/);
  assert.match(route, /requestOrigin\(request\)/);
  assert.match(resolver, /createReceizWildzPublicRepository/);
  assert.match(resolver, /resolveSdkPublicWildzCard/);
  assert.match(resolver, /verifyAnyWildsCard/);
  assert.match(serverPage, /resolvePublicWildsCardRecord/);
  assert.match(serverPage, /initialRecord=\{initialRecord\}/);
  const page = readFileSync("src/features/play/WildsCardPage.tsx", "utf8");
  assert.doesNotMatch(page, /initialPlayState|restorePlayState|localStorage|receiz:wilds:save:v2/);
  assert.match(page, /initialRecord\?\.assetId === assetId/);
  assert.match(page, /fetch\(`\/api\/cards\/\$\{encodeURIComponent\(assetId\)\}`/);
  const registry = readFileSync("src/features/play/public-card-registry.ts", "utf8");
  assert.doesNotMatch(registry, /identityProof|keyFile|passphrase|registryKey|Symbol\.for|resolveLocalPublicWildsCard/);
});
