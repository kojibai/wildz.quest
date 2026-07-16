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

test("every admitted identity and character enters one idempotent automatic Receiz connection gate", () => {
  const source = read("src/features/shell/WildzApp.tsx");

  assert.equal(source.match(/wildzRemoteSessionBridge\.continueLocalIdentity\(/g)?.length, 1);
  assert.match(source, /const continueWildzEntry = useCallback/);
  assert.match(source, /const attemptKey = `\$\{session\.actorId\}:\$\{returnTo\}`/);
  assert.match(source, /automaticEntryRef\.current === attemptKey/);
  assert.match(source, /if \(!identity \|\| !character/);
  assert.match(source, /void continueWildzEntry\(identity\)/);
});

test("fresh genesis, Identity Seal restore, and identity-bearing Vault restore converge on the same snapshot gate", () => {
  const source = read("src/features/shell/WildzApp.tsx");
  const genesis = source.slice(source.indexOf("const completeGenesis"), source.indexOf("const restoreArtifact"));
  const restore = source.slice(source.indexOf("const restoreArtifact"), source.indexOf("const persistPlayState"));
  const initialize = source.slice(source.indexOf("const initialize"), source.indexOf("const completeGenesis"));

  assert.match(genesis, /acceptSnapshot\(snapshot\)/);
  assert.match(restore, /acceptSnapshot\(next\)/);
  assert.match(initialize, /resumed\.status === "committed"[\s\S]*acceptSnapshot\(\{/);
  assert.match(initialize, /const snapshot = await bootstrapWildzContinuity\(window\.localStorage\)/);
  assert.match(initialize, /acceptSnapshot\(snapshot\)/);
});

test("Receiz connection is not dismissible and proof-sealed Vault owner recovery keeps its required action", () => {
  const source = read("src/features/shell/WildzApp.tsx");

  assert.doesNotMatch(source, /vaultPromptMode|setVaultPromptMode/);
  assert.doesNotMatch(source, /Connect Receiz|Not now|Dismiss Vault prompt/);
  assert.match(source, /Vault owner required/);
  assert.match(source, /Sign in as Vault owner/);
});

test("gameplay mounts only after a matching Receiz session or explicit offline practice consent", () => {
  const source = read("src/features/shell/WildzApp.tsx");

  assert.match(source, /const gameplayReady = Boolean\([\s\S]*identity\.remoteStatus === "connected" \|\| offlinePracticeAccepted/);
  assert.match(source, /gameplayReady && continuity && identity && character \? <PlayCampaign/);
  assert.doesNotMatch(source, /\{continuity && identity && character \? <PlayCampaign/);
  assert.match(source, /navigator\.onLine/);
  assert.match(source, />Continue offline<\/button>/);
  assert.equal(source.match(/setOfflinePracticeAccepted\(true\)/g)?.length, 1);
});

test("OAuth callback errors survive query cleanup and block automatic redirect loops until retry", () => {
  const source = read("src/features/shell/WildzApp.tsx");
  const initialize = source.slice(source.indexOf("const initialize"), source.indexOf("const completeGenesis"));
  const callbackError = initialize.indexOf('searchParams.has("receiz_error")');
  const preserveError = initialize.indexOf("setEntryRecovery", callbackError);
  const clearQuery = initialize.indexOf("clearWildzAuthQuery()", callbackError);

  assert.ok(callbackError >= 0 && preserveError > callbackError && clearQuery > preserveError);
  assert.match(source, /if \(entryRecovery\) return;/);
  assert.match(source, /Retry Receiz/);
});

test("global shell is edge-to-edge and safe-area aware", () => {
  const styles = read("app/globals.css");
  assert.match(styles, /\.wildz-app-shell\s*\{[\s\S]*?height:\s*100dvh/);
  assert.match(styles, /env\(safe-area-inset-top\)/);
  assert.match(styles, /overscroll-behavior:\s*none/);
  assert.match(styles, /\.wildz-app\s*>\s*\.wilds-play-panel[\s\S]*?position:\s*absolute/);
  assert.match(styles, /\.wildz-app\s+\.wilds-header\s*\{\s*display:\s*none/);
});
