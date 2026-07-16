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

test("profiles publish only after the same-origin proof session is connected", () => {
  const source = read("src/features/shell/WildzApp.tsx");
  const connectedGate = source.indexOf("!proofSessionConnected");
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

test("a Vault without a display name keeps its restored Receiz username visible in the game HUD", () => {
  const source = read("src/features/shell/WildzApp.tsx");
  assert.match(source, /playerDisplayName=\{identity\.displayName \?\? `@\$\{ownerUsername\}`\}/);
});

test("every admitted identity enters by local proof and extends to a same-origin session without OAuth navigation", () => {
  const source = read("src/features/shell/WildzApp.tsx");

  assert.match(source, /connectWildzProofSession/);
  assert.doesNotMatch(source, /continueLocalIdentity|\/api\/auth\/receiz\/start/);
  assert.doesNotMatch(source, /window\.location\.assign/);
});

test("authenticated gameplay networking waits for a confirmed canonical world bootstrap", () => {
  const source = read("src/features/shell/WildzApp.tsx");
  const matched = source.indexOf("wildzRemoteSessionMatchesIdentity(identity, session)");
  const bootstrap = source.indexOf("bootstrapWildzSharedWorld", matched);
  const connected = source.indexOf("setProofSessionConnected(true)", matched);

  assert.ok(matched >= 0);
  assert.ok(bootstrap > matched);
  assert.ok(connected > bootstrap);
});

test("fresh genesis, Identity Seal restore, and identity-bearing Vault restore converge on the same snapshot gate", () => {
  const source = read("src/features/shell/WildzApp.tsx");
  const genesis = source.slice(source.indexOf("const completeGenesis"), source.indexOf("const restoreArtifact"));
  const restore = source.slice(source.indexOf("const restoreArtifact"), source.indexOf("const persistPlayState"));
  const initialize = source.slice(source.indexOf("const initialize"), source.indexOf("const completeGenesis"));

  assert.match(genesis, /acceptSnapshot\(snapshot\)/);
  assert.match(restore, /acceptSnapshot\(next\)/);
  assert.match(initialize, /const resumed = await resumePendingWildzVault[\s\S]*acceptSnapshot\(\{/);
  assert.match(initialize, /const snapshot = await bootstrapWildzContinuity\(window\.localStorage\)/);
  assert.match(initialize, /acceptSnapshot\(snapshot\)/);
});

test("proof-sealed Vault recovery never asks the authenticated Vault owner to sign in again", () => {
  const source = read("src/features/shell/WildzApp.tsx");

  assert.doesNotMatch(source, /vaultPromptMode|setVaultPromptMode/);
  assert.doesNotMatch(source, /Connect Receiz|Not now|Dismiss Vault prompt|Vault owner required|Sign in as Vault owner/);
});

test("gameplay mounts directly from any committed proof-native identity and character", () => {
  const source = read("src/features/shell/WildzApp.tsx");

  assert.match(source, /const gameplayReady = Boolean\([\s\S]*continuity[\s\S]*identity[\s\S]*character/);
  assert.doesNotMatch(source, /identity\.remoteStatus === "connected" \|\| offlinePracticeAccepted/);
  assert.match(source, /gameplayReady && continuity && identity && character \? <PlayCampaign/);
  assert.doesNotMatch(source, /Continue offline|offlinePracticeAccepted/);
});

test("local gameplay stays mounted while every authenticated world mutation waits for the exact proof session", () => {
  const shell = read("src/features/shell/WildzApp.tsx");
  const campaign = read("src/features/play/PlayCampaign.tsx");
  const multiplayer = read("src/features/play/use-wilds-multiplayer.ts");
  const world = read("src/features/play/use-wilds-world.ts");

  assert.match(shell, /networkEnabled=\{proofSessionConnected\}/);
  assert.match(campaign, /networkEnabled:\s*boolean/);
  assert.match(campaign, /enabled:\s*enabled && networkEnabled && Boolean\(avatarStyle\)/);
  assert.match(multiplayer, /if \(!latest\.current\.enabled\) throw new Error\("wilds_multiplayer_session_required"\)/);
  assert.match(world, /if \(!input\.enabled\) throw new Error\("wilds_world_session_required"\)/);
});

test("large Vault movement coalesces full-state persistence and flushes the latest state", () => {
  const source = read("src/features/shell/WildzApp.tsx");
  const persistStart = source.indexOf("const persistPlayState");
  const persist = source.slice(persistStart, source.indexOf("\n\n  return (", persistStart));

  assert.ok(persistStart >= 0);
  assert.match(source, /createLatestOnlySaveScheduler/);
  assert.match(source, /wildz:preserve-state/);
  assert.match(source, /pagehide/);
  assert.match(source, /visibilitychange/);
  assert.match(persist, /\.schedule\(\{/);
  assert.doesNotMatch(persist, /void saveWildzContinuityPlayState\(/);
});

test("legacy OAuth callback query parameters are cleared without restarting an external login", () => {
  const source = read("src/features/shell/WildzApp.tsx");
  const initialize = source.slice(source.indexOf("const initialize"), source.indexOf("const completeGenesis"));
  const callbackError = initialize.indexOf('searchParams.has("receiz_error")');
  const clearQuery = initialize.indexOf("clearWildzAuthQuery()", callbackError);

  assert.ok(callbackError >= 0 && clearQuery > callbackError);
  assert.doesNotMatch(source, /Retry Receiz|continueWildzEntry/);
});

test("global shell is edge-to-edge and safe-area aware", () => {
  const styles = read("app/globals.css");
  assert.match(styles, /\.wildz-app-shell\s*\{[\s\S]*?height:\s*100dvh/);
  assert.match(styles, /env\(safe-area-inset-top\)/);
  assert.match(styles, /overscroll-behavior:\s*none/);
  assert.match(styles, /\.wildz-app\s*>\s*\.wilds-play-panel[\s\S]*?position:\s*absolute/);
  assert.match(styles, /\.wildz-app\s+\.wilds-header\s*\{\s*display:\s*none/);
});
