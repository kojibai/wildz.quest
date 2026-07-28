import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const creatureDrawerPath = "src/features/play/WildzCreatureDrawer.tsx";

function readCreatureDrawer() {
  return existsSync(creatureDrawerPath) ? readFileSync(creatureDrawerPath, "utf8") : "";
}

test("social deck preserves the game command surfaces and embedded social market", () => {
  const source = readFileSync("src/features/play/WildzSocialDeck.tsx", "utf8");
  for (const token of ["onOpenFieldGuide", "onOpenProfile", "onOpenMarket", "onOpenSatchel", "nearbyCards"]) {
    assert.match(source, new RegExp(token));
  }
  assert.doesNotMatch(source, /onOpenMap|onOpenRewards|sealcub-portrait\.svg/);
  assert.doesNotMatch(source, /router\.push|href=["']\/market/);
});

test("bottom dock follows the six-slot reference order with distinct functions", () => {
  const source = readFileSync("src/features/play/WildzSocialDeck.tsx", "utf8");
  const markers = [
    'aria-label="Open Trail Pack and Wilds Heartbeat"',
    'aria-label="Open field guide"',
    'aria-label="Open player profile"',
    'aria-label="Open social market"',
    'aria-label="Open card vault"',
    'aria-label="Open foraging satchel"'
  ];
  const offsets = markers.map((marker) => source.indexOf(marker));
  assert.ok(offsets.every((offset) => offset >= 0));
  assert.deepEqual(offsets, [...offsets].sort((a, b) => a - b));
  for (const token of ["Icons.archive", "Icons.book", "Icons.users", "Icons.waveform", "WildsCreatureThumbnail", "Icons.products"]) {
    assert.match(source, new RegExp(token.replace(".", "\\.")));
  }
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

test("nearby cards render framed card artwork with verification beside the creature name", () => {
  const source = readFileSync("src/features/play/WildzSocialDeck.tsx", "utf8");
  const drawer = readCreatureDrawer();
  const thumbnail = readFileSync("src/features/play/WildsCreatureThumbnail.tsx", "utf8");
  const badge = readFileSync("src/features/play/WildsVerifiedBadge.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(source, /<WildzCreatureDrawer/);
  assert.match(drawer, /<WildsCardPreview asset=\{asset\}/);
  assert.match(source, /<WildsCreatureThumbnail asset=\{activeCard\}/);
  assert.match(drawer, /<WildsVerifiedBadge\s*\/>/);
  assert.doesNotMatch(thumbnail, /wilds-creature-verified/);
  assert.match(badge, /wilds-creature-verified/);
  assert.match(css, /\.wilds-creature-verified\s*\{/);
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
