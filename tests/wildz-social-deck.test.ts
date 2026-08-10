import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const creatureDrawerPath = "src/features/play/WildzCreatureDrawer.tsx";

function readCreatureDrawer() {
  return existsSync(creatureDrawerPath) ? readFileSync(creatureDrawerPath, "utf8") : "";
}

test("unified world controls delegate secondary surfaces to the compact command dock", () => {
  const source = readFileSync("src/features/play/WildzWorldControls.tsx", "utf8");
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  assert.match(source, /nearbyCards/);
  for (const key of ["fieldGuide", "satchel", "deck", "vault"]) assert.match(campaign, new RegExp(`key: "${key}"`));
  assert.match(source, /<WildsCommandDock/);
  assert.match(campaign, /<WildzWorldControls/);
  assert.doesNotMatch(source, /onOpenMap|onOpenRewards|sealcub-portrait\.svg/);
  assert.doesNotMatch(source, /router\.push|href=["']\/market/);
});

test("thumb controls expose only two quick utilities beside movement and companion command", () => {
  const source = readFileSync("src/features/play/WildzSocialDeck.tsx", "utf8");
  assert.match(source, /aria-label="Quick utilities"/);
  assert.match(source, /aria-label="Make camp and recover"/);
  assert.match(source, /Switch to running/);
  assert.match(source, /<WildzDpad/);
  assert.match(source, /<WildsCompanionCommand/);
  assert.doesNotMatch(source, /wildz-social-actions|Open social market|Open card vault/);
});

test("Trail Pack replaces the redundant deck list with a three-companion heartbeat", () => {
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const world = readFileSync("src/features/play/WildsWorldCanvas.tsx", "utf8");

  assert.match(campaign, /label: "Trail Pack"/);
  assert.match(campaign, /One leader · two bonded supports/);
  assert.match(campaign, /Pack synergy/);
  assert.match(campaign, /Pack memory/);
  assert.match(campaign, /World whispers/);
  assert.match(campaign, /supportCards=\{trailSupportCards\}/);
  assert.match(world, /trail-pack-support-companions/);
  assert.doesNotMatch(campaign, /label: "Active Deck"/);
});

test("Slate cards render frameless artwork with verification beside the creature name", () => {
  const source = readFileSync("src/features/play/WildzSocialDeck.tsx", "utf8");
  const drawer = readCreatureDrawer();
  const thumbnail = readFileSync("src/features/play/WildsCreatureThumbnail.tsx", "utf8");
  const badge = readFileSync("src/features/play/WildsVerifiedBadge.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(source, /<WildzCreatureDrawer/);
  assert.match(source, /<WildsCompanionCommand/);
  assert.match(drawer, /<WildsCreatureThumbnail asset=\{asset\} className="wildz-slate-creature-art"/);
  assert.match(readFileSync("src/features/play/WildsCompanionCommand.tsx", "utf8"), /<WildsCreatureThumbnail asset=\{activeCard\}/);
  assert.match(drawer, /<WildsVerifiedBadge\s*\/>/);
  assert.doesNotMatch(thumbnail, /wilds-creature-verified/);
  assert.match(badge, /wilds-creature-verified/);
  assert.match(css, /\.wilds-creature-verified\s*\{/);
  assert.match(css, /\.wildz-slate-creature-art\s*\{[^}]*background:\s*transparent;[^}]*border-radius:\s*0;/s);
});

test("reordering nearby cards cannot change any displayed creature fact", () => {
  const source = readCreatureDrawer();

  assert.doesNotMatch(source, /manifest\.stage \+ index|75 \+ index/);
  assert.match(source, /logicalPosition=\{logicalIndex \+ 1\}/);
  assert.match(source, /companionProgress\[card\.manifest\.familyId\]/);
  assert.match(source, /asset\.manifest\.name/);
  assert.match(source, /form\?\.element/);
  assert.match(source, /progress\.bond/);
});

test("field guide and satchel are game-native panels without merchant reward language", () => {
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const commandDock = readFileSync("src/features/play/WildsCommandDock.tsx", "utf8");

  for (const key of ["fieldGuide", "satchel"]) assert.match(campaign, new RegExp(`key: "${key}"`));
  assert.match(campaign, /creatureFamilies/);
  assert.match(campaign, /visibleGuideFamilies = guideFamilies\.slice\(0, 24\)/);
  assert.match(campaign, /visibleGuideFamilies\.map/);
  assert.match(campaign, /Discovered|Undiscovered/);
  assert.match(campaign, /Scan .*habitat|Scan habitat/);
  for (const resource of ["state.beans", "state.streak", "state.worldMastery", "activeProgress.bond"]) {
    assert.match(campaign, new RegExp(resource.replace(".", "\\.")));
  }
  assert.match(commandDock, /"fieldGuide" \| "satchel"/);
  assert.doesNotMatch(campaign, /key: "rewards"|Locked merchant card|Portable reward|businesses can map/);
});
