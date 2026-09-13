import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("profile username saves through signed Receiz continuation and canonical alignment", () => {
  const adapter = readFileSync("src/lib/receiz/wildz-identity-adapter.ts", "utf8");
  const route = readFileSync("app/api/auth/wildz/session/route.ts", "utf8");
  assert.match(adapter, /claimWildzProfileIdentity/);
  assert.match(adapter, /buildReceizIdContinueRequest/);
  assert.match(adapter, /alignWildzContinuityWithProofSession/);
  assert.match(adapter, /wildz_username_taken/);
  assert.match(route, /status:\s*"conflict"/);
  assert.match(route, /upstream\.status === 409/);
});

test("profile edit never replaces the existing Receiz key", () => {
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  assert.doesNotMatch(shell, /createNamedWildzIdentity/);
  assert.match(shell, /claimWildzProfileIdentity/);
});

test("profile save immediately follows the newly admitted handle and visible profile", () => {
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  assert.match(shell, /setOverlay\(\{ kind: "profile", username: canonicalHandle \}\)/);
  assert.match(shell, /setRemoteProfile\(\(profile\) => profile \? sanitizePublicWildzProfile/);
  assert.match(shell, /username: canonicalHandle/);
  assert.match(shell, /displayName: input\.displayName/);
});

test("profile offers Identity Seal authentication when signing authority is unavailable", () => {
  const sheet = readFileSync("src/features/profile/WildzProfileSheet.tsx", "utf8");
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  assert.match(sheet, /signingAvailable/);
  assert.match(sheet, /onAuthenticateIdentitySeal/);
  assert.match(sheet, /Upload Identity Seal/);
  const identityPicker = [...sheet.matchAll(/<input\b[\s\S]*?\/>/g)]
    .map((match) => match[0]).find((input) => input.includes("ref={identityInputRef}"));
  assert.ok(identityPicker, "Identity upload picker must remain present");
  const accepted = new Set(identityPicker.match(/accept="([^"]+)"/)?.[1]?.split(","));
  for (const format of ["image/png", "image/jpeg", "image/webp", "application/json", ".receizbundle", "application/vnd.receiz.bundle+json"]) {
    assert.ok(accepted.has(format), `Identity picker must accept ${format}`);
  }
  assert.ok(!accepted.has("*/*"), "Identity picker should not advertise unrestricted file types");
  assert.match(sheet, /aria-label="Upload Identity Seal or Record"[\s\S]*identityInputRef\.current\?\.click\(\)/);
  assert.match(sheet, /aria-label="Save Identity Seal"[\s\S]*disabled=\{identitySealSaving \|\| identityAuthenticating \|\| !signingAvailable \|\| !onSaveIdentitySeal\}/);
  assert.match(shell, /signingAvailable=\{identity\?\.localAuthority === "verified"\}/);
  assert.match(shell, /onAuthenticateIdentitySeal=/);
});

test("profile separates saving an Identity Seal from uploading one for authority", () => {
  const sheet = readFileSync("src/features/profile/WildzProfileSheet.tsx", "utf8");
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  const adapter = readFileSync("src/lib/receiz/wildz-identity-adapter.ts", "utf8");
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(sheet, /onSaveIdentitySeal/);
  assert.match(sheet, /wildz-profile-action-rail/);
  assert.match(sheet, /aria-label="Share profile"/);
  assert.match(sheet, /aria-label="Copy profile link"/);
  assert.match(sheet, /aria-label="Save Identity Seal"/);
  assert.match(sheet, /aria-label="Upload Identity Seal or Record"/);
  assert.match(sheet, /This Identity Seal now owns the current Vault/);
  assert.match(sheet, /await onSaveIdentitySeal\(\)/);
  assert.doesNotMatch(sheet, /aria-label="Save Identity Seal"[\s\S]{0,500}identityInputRef\.current\?\.click\(\)/);
  assert.match(sheet, /aria-label="Upload Identity Seal or Record"[\s\S]{0,500}identityInputRef\.current\?\.click\(\)/);
  assert.match(sheet, /aria-label="Save Identity Seal"[\s\S]{0,900}await onSaveIdentitySeal\(\)/);
  assert.match(css, /\.wildz-profile-action-rail\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*44px\)/s);
  assert.match(shell, /downloadWildzIdentityPlayerCard/);
  assert.match(shell, /onSaveIdentitySeal=\{saveIdentitySeal\}/);
  assert.match(adapter, /createWildzIdentityPlayerCard/);
});
