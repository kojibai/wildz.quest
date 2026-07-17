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
  assert.match(sheet, /Authenticate with Identity Seal/);
  assert.match(sheet, /accept="image\/png,image\/jpeg,image\/webp,application\/json"/);
  assert.match(shell, /signingAvailable=\{identity\?\.localAuthority === "verified"\}/);
  assert.match(shell, /onAuthenticateIdentitySeal=/);
});
