import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("canonical shareable player route opens the profile and the legacy path redirects", () => {
  const canonical = readFileSync("app/u/[handle]/page.tsx", "utf8");
  const alias = readFileSync("app/[username]/page.tsx", "utf8");
  assert.match(canonical, /<WildzApp/);
  assert.match(canonical, /kind:\s*"profile"/);
  assert.doesNotMatch(canonical, /marketplace|PublicStorefront/);
  assert.match(alias, /redirect\(canonicalWildzProfilePath/);
});

test("shared profiles recover and publish through Receiz instead of a local placeholder", () => {
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  const route = readFileSync("app/api/profiles/[handle]/route.ts", "utf8");
  const adapter = readFileSync("src/lib/receiz/wildz-profile-adapter.ts", "utf8");
  assert.match(shell, /fetchPublicWildzProfile\(overlay\.username\)/);
  assert.match(shell, /publishCurrentWildzProfile\(localPublicProfile, ownerPlayState\.inventory\)/);
  assert.match(shell, /setProfileStatus\("publishing"\)/);
  assert.match(shell, /setProfileStatus\("unpublished"\)/);
  assert.match(shell, /shareEnabled=\{[^}]*profileStatus === "ready"/);
  assert.match(shell, /This Wildz profile has not been published yet/);
  assert.match(route, /resolveWildzCookieActor/);
  assert.match(route, /createReceizWildzPublicRepository/);
  assert.match(route, /loadVerifiedWildzPublicOwnershipAuthority/);
  assert.match(route, /requireCurrentWildzPublicOwner/);
  assert.doesNotMatch(route, /card\.manifest\.ownerReceizId/);
  assert.match(route, /wildz_public_profile_card_unverified/);
  assert.match(route, /x-wildz-public-projection/);
  assert.doesNotMatch(route, /playerReceizAccessToken|session\.accessToken|delegatedAccessToken/);
  assert.match(adapter, /WildzPublicProjectionRepository/);
  assert.doesNotMatch(adapter, /new Map|Map</);
});

test("own-profile share controls remain disabled until durable publication succeeds", () => {
  const sheet = readFileSync("src/features/profile/WildzProfileSheet.tsx", "utf8");
  assert.match(sheet, /shareEnabled/);
  assert.match(sheet, /disabled=\{!shareEnabled\}/);
  assert.match(sheet, /not yet published/i);
  assert.doesNotMatch(sheet, /Receiz verified<\/p>/);
});
