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

test("only the owner profile exposes compact identity edit and image controls", () => {
  const sheet = readFileSync("src/features/profile/WildzProfileSheet.tsx", "utf8");
  const genesis = readFileSync("src/features/identity/WildzGenesis.tsx", "utf8");
  assert.match(sheet, /editable/);
  assert.match(sheet, /onSaveProfile/);
  assert.match(sheet, /accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(sheet, /aria-label="Edit profile"/);
  assert.doesNotMatch(genesis, /username-control|Choose your Receiz username/);
});

test("profile edit control reserves the overlay close-button hit area", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.wildz-profile-head\s*\{[^}]*padding-right:\s*(?:9[6-9]|1\d{2})px/);
  assert.match(css, /\.wildz-profile-edit-trigger\s*\{[^}]*right:\s*5[0-9]px/);
  assert.match(css, /\.wildz-overlay-dismiss\s*\{[^}]*z-index:\s*(?:1[3-9]\d|[2-9]\d{2})/s);
  assert.match(css, /\.wildz-profile-sheet\s*\{[^}]*isolation:\s*isolate/s);
});
