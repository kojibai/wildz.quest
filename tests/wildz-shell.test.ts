import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("root page renders one persistent Wildz app", () => {
  const source = read("app/page.tsx");
  assert.match(source, /<WildzApp/);
  assert.doesNotMatch(source, /PublicStorefront|Header|Footer/);
});

test("Wildz app owns the game and overlay state", () => {
  const source = read("src/features/shell/WildzApp.tsx");
  assert.equal(source.match(/<PlayCampaign\b/g)?.length, 1);
  assert.match(source, /initialOverlay/);
  assert.match(source, /wildz-app/);
});

test("local-only identities do not attempt authenticated profile publication", () => {
  const source = read("src/features/shell/WildzApp.tsx");
  const connectedGate = source.indexOf('identity.remoteStatus !== "connected"');
  const publication = source.indexOf("publishCurrentWildzProfile(localPublicProfile, ownerPlayState.inventory)");

  assert.ok(connectedGate >= 0);
  assert.ok(publication > connectedGate);
});

test("Wildz creates identity before character genesis and enters play with that identity", () => {
  const source = read("src/features/shell/WildzApp.tsx");
  assert.match(source, /bootstrapWildzContinuity/);
  assert.match(source, /<WildzGenesis/);
  assert.match(source, /ownerReceizId=\{ownerUsername\}/);
  assert.match(source, /setCharacter\(snapshot\.character\)/);
  assert.match(source, /character=\{character\}/);
  assert.doesNotMatch(source, /WILDZ_CHARACTER_STORAGE_KEY|WILDS_AVATAR_KEY/);
});

test("genesis visibly confirms the admitted Receiz identity before explorer creation", () => {
  const source = read("src/features/identity/WildzGenesis.tsx");
  assert.match(source, /Restored Receiz ID/);
  assert.match(source, /restoredIdentity\.username/);
});

test("a verified Vault is presented as restored before optional live Receiz connection", () => {
  const source = read("src/features/shell/WildzApp.tsx");
  assert.match(source, /setVaultPromptMode\(proofBackedVault \? "connect" : "login"\)/);
  assert.match(source, /Vault identity restored/);
  assert.match(source, /Connect Receiz/);
  assert.match(source, /vaultPromptMode === "connect" \? "status" : "alert"/);
  assert.match(source, /Vault owner required/);
  assert.match(source, /Sign in as Vault owner/);
});

test("global shell is edge-to-edge and safe-area aware", () => {
  const styles = read("app/globals.css");
  assert.match(styles, /\.wildz-app-shell\s*\{[\s\S]*?height:\s*100dvh/);
  assert.match(styles, /env\(safe-area-inset-top\)/);
  assert.match(styles, /overscroll-behavior:\s*none/);
  assert.match(styles, /\.wildz-app\s*>\s*\.wilds-play-panel[\s\S]*?position:\s*absolute/);
  assert.match(styles, /\.wildz-app\s+\.wilds-header\s*\{\s*display:\s*none/);
});
